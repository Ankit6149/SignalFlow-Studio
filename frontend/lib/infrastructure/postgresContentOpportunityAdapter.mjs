import { assertPort } from "../domain/ports.mjs";
import { normalizeContentOpportunity } from "../domain/contentOpportunities.mjs";

function requireDatabase(database) {
  if (!database || typeof database.query !== "function") {
    throw new TypeError("Postgres ContentOpportunity repository requires a database query executor.");
  }
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

function requiredWorkspace(value) {
  const workspaceId = String(value || "").trim();
  if (!workspaceId) {
    const error = new Error("A workspace-scoped Postgres ContentOpportunity repository requires workspace context.");
    error.code = "postgres_workspace_scope_required";
    throw error;
  }
  return workspaceId;
}

function assertWorkspace(scope, value) {
  const owner = requiredWorkspace(scope);
  if (value && String(value) !== owner) {
    const error = new Error("Cross-workspace ContentOpportunity repository access is forbidden.");
    error.code = "postgres_workspace_scope_mismatch";
    throw error;
  }
  return owner;
}

export function opportunityFromRow(row = {}) {
  const opportunity = normalizeContentOpportunity(jsonValue(row.record, {}));
  if (
    opportunity.opportunityId !== row.opportunity_id
    || opportunity.workspaceId !== row.workspace_id
    || opportunity.inputFingerprint !== row.input_fingerprint
  ) {
    const error = new Error("Stored ContentOpportunity metadata does not match its canonical record.");
    error.code = "content_opportunity_storage_integrity_error";
    throw error;
  }
  return opportunity;
}

export function createPostgresContentOpportunityRepository({ database, workspaceId = null } = {}) {
  const db = requireDatabase(database);
  const scope = workspaceId ? String(workspaceId).trim() : null;

  async function list() {
    const owner = assertWorkspace(scope);
    return resultRows(await db.query(
      `SELECT * FROM sf_content_opportunities
       WHERE workspace_id = $1
       ORDER BY score DESC, updated_at DESC, opportunity_id`,
      [owner],
    )).map(opportunityFromRow);
  }

  async function get(opportunityId) {
    const owner = assertWorkspace(scope);
    const normalizedId = String(opportunityId || "").trim();
    if (!normalizedId) return null;
    const rows = resultRows(await db.query(
      `SELECT * FROM sf_content_opportunities
       WHERE opportunity_id = $1 AND workspace_id = $2
       LIMIT 1`,
      [normalizedId, owner],
    ));
    return rows[0] ? opportunityFromRow(rows[0]) : null;
  }

  async function findByFingerprint(inputFingerprint) {
    const owner = assertWorkspace(scope);
    const fingerprint = String(inputFingerprint || "").trim();
    if (!fingerprint) return null;
    const rows = resultRows(await db.query(
      `SELECT * FROM sf_content_opportunities
       WHERE workspace_id = $1 AND input_fingerprint = $2
       LIMIT 1`,
      [owner, fingerprint],
    ));
    return rows[0] ? opportunityFromRow(rows[0]) : null;
  }

  async function upsert(input) {
    const opportunity = normalizeContentOpportunity(input);
    const owner = assertWorkspace(scope, opportunity.workspaceId);
    const rows = resultRows(await db.query(`
INSERT INTO sf_content_opportunities (
  opportunity_id, workspace_id, project_id, project_context_snapshot_id,
  signal_ids, input_fingerprint, status, recommendation, score,
  record, schema_version, created_at, updated_at
) VALUES (
  $1, $2, $3, $4,
  $5::text[], $6, $7, $8, $9,
  $10::jsonb, $11, $12::timestamptz, $13::timestamptz
)
ON CONFLICT (workspace_id, input_fingerprint) DO UPDATE SET
  project_id = CASE WHEN sf_content_opportunities.opportunity_id = EXCLUDED.opportunity_id THEN EXCLUDED.project_id ELSE sf_content_opportunities.project_id END,
  project_context_snapshot_id = CASE WHEN sf_content_opportunities.opportunity_id = EXCLUDED.opportunity_id THEN EXCLUDED.project_context_snapshot_id ELSE sf_content_opportunities.project_context_snapshot_id END,
  signal_ids = CASE WHEN sf_content_opportunities.opportunity_id = EXCLUDED.opportunity_id THEN EXCLUDED.signal_ids ELSE sf_content_opportunities.signal_ids END,
  status = CASE WHEN sf_content_opportunities.opportunity_id = EXCLUDED.opportunity_id THEN EXCLUDED.status ELSE sf_content_opportunities.status END,
  recommendation = CASE WHEN sf_content_opportunities.opportunity_id = EXCLUDED.opportunity_id THEN EXCLUDED.recommendation ELSE sf_content_opportunities.recommendation END,
  score = CASE WHEN sf_content_opportunities.opportunity_id = EXCLUDED.opportunity_id THEN EXCLUDED.score ELSE sf_content_opportunities.score END,
  record = CASE WHEN sf_content_opportunities.opportunity_id = EXCLUDED.opportunity_id THEN EXCLUDED.record ELSE sf_content_opportunities.record END,
  schema_version = CASE WHEN sf_content_opportunities.opportunity_id = EXCLUDED.opportunity_id THEN EXCLUDED.schema_version ELSE sf_content_opportunities.schema_version END,
  updated_at = CASE WHEN sf_content_opportunities.opportunity_id = EXCLUDED.opportunity_id THEN EXCLUDED.updated_at ELSE sf_content_opportunities.updated_at END
RETURNING *`, [
      opportunity.opportunityId,
      owner,
      opportunity.projectId,
      opportunity.projectContextSnapshotId,
      opportunity.signalIds,
      opportunity.inputFingerprint,
      opportunity.status,
      opportunity.recommendation,
      opportunity.score,
      JSON.stringify(opportunity),
      opportunity.opportunitySchemaVersion,
      opportunity.createdAt,
      opportunity.updatedAt,
    ]));
    if (rows.length !== 1) {
      const error = new Error(`ContentOpportunity ${opportunity.opportunityId} could not be persisted.`);
      error.code = "content_opportunity_persistence_failed";
      throw error;
    }
    return opportunityFromRow(rows[0]);
  }

  async function remove(opportunityId) {
    const owner = assertWorkspace(scope);
    const rows = resultRows(await db.query(
      "DELETE FROM sf_content_opportunities WHERE opportunity_id = $1 AND workspace_id = $2 RETURNING opportunity_id",
      [String(opportunityId || "").trim(), owner],
    ));
    return rows.length === 1;
  }

  return assertPort("contentOpportunityRepository", {
    list,
    get,
    upsert,
    remove,
    findByFingerprint,
  });
}
