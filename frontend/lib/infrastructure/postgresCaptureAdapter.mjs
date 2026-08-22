import { assertPort } from "../domain/ports.mjs";
import { normalizeCaptureJob, normalizeCaptureRecipe } from "../domain/captureRecipes.mjs";

function requireDatabase(database) {
  if (!database || typeof database.query !== "function") throw new TypeError("Postgres capture repository requires a database query executor.");
  return database;
}

function resultRows(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.rows)) return result.rows;
  return [];
}

function jsonValue(value, fallback = {}) {
  if (value === null || value === undefined || value === "") return fallback;
  return typeof value === "string" ? JSON.parse(value) : value;
}

export function captureRecipeFromRow(row = {}) {
  const recipe = normalizeCaptureRecipe(jsonValue(row.record, {}));
  if (
    recipe.captureRecipeId !== row.capture_recipe_id
    || recipe.version !== Number(row.version)
    || recipe.workspaceId !== row.workspace_id
    || recipe.projectId !== row.project_id
    || recipe.targetOrigin !== row.target_origin
    || recipe.allowedEnvironment !== row.allowed_environment
    || recipe.status !== row.status
  ) {
    const error = new Error("Stored capture recipe metadata does not match its canonical record.");
    error.code = "capture_recipe_storage_integrity_error";
    throw error;
  }
  return recipe;
}

export function captureJobFromRow(row = {}) {
  const job = normalizeCaptureJob(jsonValue(row.record, {}));
  if (
    job.captureJobId !== row.capture_job_id
    || job.workspaceId !== row.workspace_id
    || (job.projectId || null) !== (row.project_id || null)
    || job.captureRecipeId !== row.capture_recipe_id
    || job.captureRecipeVersion !== Number(row.capture_recipe_version)
    || job.jobId !== row.durable_job_id
    || job.captureKind !== row.capture_kind
    || job.status !== row.status
  ) {
    const error = new Error("Stored capture job metadata does not match its canonical record.");
    error.code = "capture_job_storage_integrity_error";
    throw error;
  }
  return job;
}

export function createPostgresCaptureRepository({ database, workspaceId = null } = {}) {
  const db = requireDatabase(database);
  const scope = String(workspaceId || "").trim();
  if (!scope) {
    const error = new Error("Postgres capture repository requires workspace context.");
    error.code = "postgres_workspace_scope_required";
    throw error;
  }

  function ownedRecipe(input) {
    const recipe = normalizeCaptureRecipe(input);
    if (recipe.workspaceId !== scope) {
      const error = new Error("Cross-workspace capture recipe access is forbidden.");
      error.code = "postgres_workspace_scope_mismatch";
      throw error;
    }
    return recipe;
  }

  function ownedJob(input) {
    const job = normalizeCaptureJob(input);
    if (job.workspaceId !== scope) {
      const error = new Error("Cross-workspace capture job access is forbidden.");
      error.code = "postgres_workspace_scope_mismatch";
      throw error;
    }
    return job;
  }

  async function listRecipes({ projectId = null, captureRecipeId = null } = {}) {
    const rows = resultRows(await db.query(
      `SELECT * FROM sf_capture_recipes
       WHERE workspace_id = $1
         AND ($2::text IS NULL OR project_id = $2)
         AND ($3::text IS NULL OR capture_recipe_id = $3)
       ORDER BY updated_at DESC, capture_recipe_id, version DESC`,
      [scope, projectId ? String(projectId).trim() : null, captureRecipeId ? String(captureRecipeId).trim() : null],
    ));
    return rows.map(captureRecipeFromRow);
  }

  async function getRecipe(captureRecipeId, version = null) {
    const id = String(captureRecipeId || "").trim();
    if (!id) return null;
    const rows = resultRows(await db.query(
      `SELECT * FROM sf_capture_recipes
       WHERE workspace_id = $1 AND capture_recipe_id = $2
         AND ($3::integer IS NULL OR version = $3)
       ORDER BY version DESC
       LIMIT 1`,
      [scope, id, Number.isInteger(version) ? version : null],
    ));
    return rows[0] ? captureRecipeFromRow(rows[0]) : null;
  }

  async function upsertRecipe(input) {
    const recipe = ownedRecipe(input);
    const rows = resultRows(await db.query(`
INSERT INTO sf_capture_recipes (
  capture_recipe_id, version, workspace_id, project_id, target_origin,
  allowed_environment, status, schema_version, record, created_at, updated_at
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::timestamptz, $11::timestamptz)
ON CONFLICT (capture_recipe_id, version) DO UPDATE SET
  status = EXCLUDED.status,
  record = EXCLUDED.record,
  updated_at = EXCLUDED.updated_at
WHERE sf_capture_recipes.workspace_id = EXCLUDED.workspace_id
  AND sf_capture_recipes.project_id = EXCLUDED.project_id
  AND sf_capture_recipes.target_origin = EXCLUDED.target_origin
  AND sf_capture_recipes.allowed_environment = EXCLUDED.allowed_environment
RETURNING *`, [
      recipe.captureRecipeId, recipe.version, scope, recipe.projectId, recipe.targetOrigin,
      recipe.allowedEnvironment, recipe.status, Number(recipe.schemaVersion || recipe.captureSchemaVersion || 1),
      JSON.stringify(recipe), recipe.createdAt, recipe.updatedAt,
    ]));
    if (rows.length !== 1) {
      const error = new Error(`Capture recipe ${recipe.captureRecipeId}@${recipe.version} could not be persisted.`);
      error.code = "capture_recipe_persistence_failed";
      throw error;
    }
    return captureRecipeFromRow(rows[0]);
  }

  async function listJobs({ captureRecipeId = null } = {}) {
    const rows = resultRows(await db.query(
      `SELECT * FROM sf_capture_jobs
       WHERE workspace_id = $1 AND ($2::text IS NULL OR capture_recipe_id = $2)
       ORDER BY created_at DESC, capture_job_id`,
      [scope, captureRecipeId ? String(captureRecipeId).trim() : null],
    ));
    return rows.map(captureJobFromRow);
  }

  async function getJob(captureJobId) {
    const id = String(captureJobId || "").trim();
    if (!id) return null;
    const rows = resultRows(await db.query(
      `SELECT * FROM sf_capture_jobs WHERE workspace_id = $1 AND capture_job_id = $2 LIMIT 1`,
      [scope, id],
    ));
    return rows[0] ? captureJobFromRow(rows[0]) : null;
  }

  async function upsertJob(input) {
    const job = ownedJob(input);
    const rows = resultRows(await db.query(`
INSERT INTO sf_capture_jobs (
  capture_job_id, workspace_id, project_id, capture_recipe_id, capture_recipe_version,
  durable_job_id, capture_kind, status, schema_version, record, created_at, updated_at, completed_at
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::timestamptz, $12::timestamptz, $13::timestamptz)
ON CONFLICT (capture_job_id) DO UPDATE SET
  status = EXCLUDED.status,
  record = EXCLUDED.record,
  updated_at = EXCLUDED.updated_at,
  completed_at = EXCLUDED.completed_at
WHERE sf_capture_jobs.workspace_id = EXCLUDED.workspace_id
  AND sf_capture_jobs.capture_recipe_id = EXCLUDED.capture_recipe_id
  AND sf_capture_jobs.capture_recipe_version = EXCLUDED.capture_recipe_version
  AND sf_capture_jobs.durable_job_id = EXCLUDED.durable_job_id
RETURNING *`, [
      job.captureJobId, scope, job.projectId, job.captureRecipeId, job.captureRecipeVersion,
      job.jobId, job.captureKind, job.status, Number(job.schemaVersion || job.captureSchemaVersion || 1),
      JSON.stringify(job), job.createdAt, job.updatedAt, job.completedAt,
    ]));
    if (rows.length !== 1) {
      const error = new Error(`Capture job ${job.captureJobId} could not be persisted.`);
      error.code = "capture_job_persistence_failed";
      throw error;
    }
    return captureJobFromRow(rows[0]);
  }

  return assertPort("captureRepository", { listRecipes, getRecipe, upsertRecipe, listJobs, getJob, upsertJob });
}
