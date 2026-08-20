import { assertPort } from "../domain/ports.mjs";
import { normalizeProjectContextSnapshot } from "../domain/projectContexts.mjs";

function requireDatabase(database) {
  if (!database || typeof database.query !== "function") {
    throw new TypeError("Postgres ProjectContext repository requires a database query executor.");
  }
  return database;
}

function resultRows(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.rows)) return result.rows;
  return [];
}

function jsonValue(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "string") return JSON.parse(value);
  return value;
}

function timestamp(value) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : value;
}

function scopedWorkspace(workspaceId) {
  const normalized = String(workspaceId || "").trim();
  return normalized || null;
}

function assertWorkspaceScope(scope, workspaceId = null) {
  if (!scope) {
    const error = new Error("A workspace-scoped Postgres ProjectContext repository requires workspace context.");
    error.code = "postgres_workspace_scope_required";
    throw error;
  }
  if (workspaceId && String(workspaceId) !== scope) {
    const error = new Error("Cross-workspace ProjectContext repository access is forbidden.");
    error.code = "postgres_workspace_scope_mismatch";
    throw error;
  }
  return scope;
}

function requiredToken(value, field) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new TypeError(`${field} is required.`);
  return normalized;
}

export function projectContextFromRow(row) {
  return normalizeProjectContextSnapshot({
    projectContextSchemaVersion: Number(row.schema_version || 1),
    projectContextSnapshotId: row.project_context_snapshot_id,
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    version: Number(row.version),
    supersedesId: row.supersedes_id,
    fingerprint: row.fingerprint,
    repositoryRef: jsonValue(row.repository_ref, null),
    sourceArtifactIds: row.source_artifact_ids || [],
    supplementalSourceArtifactIds: row.supplemental_source_artifact_ids || [],
    assetIds: row.asset_ids || [],
    privacyClass: row.privacy_class,
    synthesis: jsonValue(row.synthesis, {}),
    synthesisProvenance: jsonValue(row.synthesis_provenance, {}),
    createdAt: timestamp(row.created_at),
  });
}

const CONTEXT_COLUMNS = `
  project_context_snapshot_id, workspace_id, project_id, version, supersedes_id,
  fingerprint, repository_ref, source_artifact_ids, supplemental_source_artifact_ids,
  asset_ids, privacy_class, synthesis, synthesis_provenance, schema_version, created_at`;

export function createPostgresProjectContextRepository({ database, workspaceId = null } = {}) {
  const db = requireDatabase(database);
  const scope = scopedWorkspace(workspaceId);

  async function list() {
    const owner = assertWorkspaceScope(scope);
    return resultRows(await db.query(
      `SELECT ${CONTEXT_COLUMNS}
       FROM sf_project_context_snapshots
       WHERE workspace_id = $1
       ORDER BY project_id, version DESC, created_at DESC`,
      [owner],
    )).map(projectContextFromRow);
  }

  async function listByProject(projectId) {
    const owner = assertWorkspaceScope(scope);
    const normalizedProjectId = requiredToken(projectId, "projectId");
    return resultRows(await db.query(
      `SELECT ${CONTEXT_COLUMNS}
       FROM sf_project_context_snapshots
       WHERE workspace_id = $1 AND project_id = $2
       ORDER BY version DESC, created_at DESC`,
      [owner, normalizedProjectId],
    )).map(projectContextFromRow);
  }

  async function get(projectContextSnapshotId) {
    const owner = assertWorkspaceScope(scope);
    const normalizedId = requiredToken(projectContextSnapshotId, "projectContextSnapshotId");
    const rows = resultRows(await db.query(
      `SELECT ${CONTEXT_COLUMNS}
       FROM sf_project_context_snapshots
       WHERE workspace_id = $1 AND project_context_snapshot_id = $2
       LIMIT 1`,
      [owner, normalizedId],
    ));
    return rows[0] ? projectContextFromRow(rows[0]) : null;
  }

  async function findByFingerprint(projectId, fingerprint) {
    const owner = assertWorkspaceScope(scope);
    const normalizedProjectId = requiredToken(projectId, "projectId");
    const normalizedFingerprint = requiredToken(fingerprint, "fingerprint");
    const rows = resultRows(await db.query(
      `SELECT ${CONTEXT_COLUMNS}
       FROM sf_project_context_snapshots
       WHERE workspace_id = $1 AND project_id = $2 AND fingerprint = $3
       LIMIT 1`,
      [owner, normalizedProjectId, normalizedFingerprint],
    ));
    return rows[0] ? projectContextFromRow(rows[0]) : null;
  }

  async function getLatestByProject(projectId) {
    const owner = assertWorkspaceScope(scope);
    const normalizedProjectId = requiredToken(projectId, "projectId");
    const rows = resultRows(await db.query(
      `SELECT ${CONTEXT_COLUMNS}
       FROM sf_project_context_snapshots
       WHERE workspace_id = $1 AND project_id = $2
       ORDER BY version DESC, created_at DESC
       LIMIT 1`,
      [owner, normalizedProjectId],
    ));
    return rows[0] ? projectContextFromRow(rows[0]) : null;
  }

  async function upsert(input) {
    const context = normalizeProjectContextSnapshot(input);
    const owner = assertWorkspaceScope(scope, context.workspaceId);

    const rows = resultRows(await db.query(`
WITH lock_project AS MATERIALIZED (
  SELECT pg_advisory_xact_lock(hashtextextended($2 || ':' || $3, 0)) AS locked
), existing AS MATERIALIZED (
  SELECT ${CONTEXT_COLUMNS}
  FROM sf_project_context_snapshots, lock_project
  WHERE workspace_id = $2 AND project_id = $3 AND fingerprint = $4
  LIMIT 1
), latest AS MATERIALIZED (
  SELECT project_context_snapshot_id, version
  FROM sf_project_context_snapshots, lock_project
  WHERE workspace_id = $2 AND project_id = $3
  ORDER BY version DESC
  LIMIT 1
), inserted AS (
  INSERT INTO sf_project_context_snapshots (
    project_context_snapshot_id, workspace_id, project_id, version, supersedes_id,
    fingerprint, repository_ref, source_artifact_ids, supplemental_source_artifact_ids,
    asset_ids, privacy_class, synthesis, synthesis_provenance, schema_version, created_at
  )
  SELECT
    $1, $2, $3, COALESCE(latest.version, 0) + 1, latest.project_context_snapshot_id,
    $4, $5::jsonb, $6::text[], $7::text[],
    $8::text[], $9, $10::jsonb, $11::jsonb, $12, $13::timestamptz
  FROM lock_project
  LEFT JOIN latest ON true
  WHERE NOT EXISTS (SELECT 1 FROM existing)
  ON CONFLICT DO NOTHING
  RETURNING ${CONTEXT_COLUMNS}
)
SELECT ${CONTEXT_COLUMNS} FROM inserted
UNION ALL
SELECT ${CONTEXT_COLUMNS} FROM existing
LIMIT 1`, [
      context.projectContextSnapshotId,
      owner,
      context.projectId,
      context.fingerprint,
      context.repositoryRef ? JSON.stringify(context.repositoryRef) : null,
      context.sourceArtifactIds,
      context.supplementalSourceArtifactIds,
      context.assetIds,
      context.privacyClass,
      JSON.stringify(context.synthesis),
      JSON.stringify(context.synthesisProvenance),
      context.projectContextSchemaVersion,
      context.createdAt,
    ]));

    if (rows.length !== 1) {
      const error = new Error(`ProjectContextSnapshot ${context.projectContextSnapshotId} conflicts with existing immutable history.`);
      error.code = "project_context_immutable_conflict";
      throw error;
    }
    const persisted = projectContextFromRow(rows[0]);
    if (persisted.workspaceId !== owner || persisted.projectId !== context.projectId || persisted.fingerprint !== context.fingerprint) {
      const error = new Error("Persisted ProjectContextSnapshot does not match the requested workspace/project/evidence identity.");
      error.code = "project_context_persistence_mismatch";
      throw error;
    }
    return persisted;
  }

  async function remove() {
    assertWorkspaceScope(scope);
    const error = new Error("Hosted ProjectContextSnapshots are immutable history. Use an explicit retention/deletion workflow rather than generic repository removal.");
    error.code = "project_context_immutable_delete_forbidden";
    throw error;
  }

  return assertPort("projectContextRepository", {
    list,
    get,
    upsert,
    remove,
    listByProject,
    findByFingerprint,
    getLatestByProject,
  });
}
