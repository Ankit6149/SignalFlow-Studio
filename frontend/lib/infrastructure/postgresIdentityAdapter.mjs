import { assertPort } from "../domain/ports.mjs";
import { IDENTITY_RECORD_KINDS, normalizeIdentityRecord } from "../domain/identityProfiles.mjs";

function requireDatabase(database) {
  if (!database || typeof database.query !== "function") {
    throw new TypeError("Postgres identity repository requires a database query executor.");
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

function requiredScope(value, field) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    const error = new Error(`Postgres identity repository requires ${field}.`);
    error.code = "postgres_identity_scope_required";
    throw error;
  }
  return normalized;
}

function recordId(record) {
  const candidates = [
    record.identityProfileId,
    record.perceptionProfileId,
    record.voiceProfileId,
    record.boundaryProfileId,
    record.platformExpressionProfileId,
    record.projectGuidanceProfileId,
    record.identityContextSnapshotId,
  ].filter(Boolean);
  if (candidates.length !== 1) throw new TypeError(`${record.kind || "Identity record"} must have exactly one record ID.`);
  return candidates[0];
}

function scopeKey(record) {
  if (record.kind === IDENTITY_RECORD_KINDS.PLATFORM_EXPRESSION) return `platform:${record.platform}`;
  if (record.kind === IDENTITY_RECORD_KINDS.PROJECT_GUIDANCE) return `project:${record.projectId}`;
  if (record.kind === IDENTITY_RECORD_KINDS.CONTEXT_SNAPSHOT) return `snapshot:${record.identityContextSnapshotId}`;
  return "global";
}

function recordVersion(record) {
  return record.kind === IDENTITY_RECORD_KINDS.CONTEXT_SNAPSHOT ? 0 : Number(record.version || 0);
}

function schemaVersion(record) {
  return Number(record.schemaVersion || record.profileSchemaVersion || 1);
}

export function identityFromRow(row = {}) {
  const record = normalizeIdentityRecord(jsonValue(row.record, {}));
  if (
    recordId(record) !== row.record_id
    || record.workspaceId !== row.workspace_id
    || record.userId !== row.user_id
    || record.kind !== row.record_kind
    || scopeKey(record) !== row.scope_key
    || recordVersion(record) !== Number(row.record_version)
  ) {
    const error = new Error("Stored identity metadata does not match its canonical record.");
    error.code = "identity_storage_integrity_error";
    throw error;
  }
  return record;
}

export function createPostgresIdentityRepository({ database, workspaceId = null, userId = null } = {}) {
  const db = requireDatabase(database);
  const workspaceScope = requiredScope(workspaceId, "workspaceId");
  const userScope = requiredScope(userId, "userId");

  function assertOwned(record) {
    if (record.workspaceId !== workspaceScope || record.userId !== userScope) {
      const error = new Error("Cross-owner identity repository access is forbidden.");
      error.code = "postgres_identity_scope_mismatch";
      throw error;
    }
    return record;
  }

  async function list() {
    return resultRows(await db.query(
      `SELECT * FROM sf_identity_records
       WHERE workspace_id = $1 AND user_id = $2
       ORDER BY record_kind, scope_key, record_version DESC, created_at DESC, record_id`,
      [workspaceScope, userScope],
    )).map(identityFromRow);
  }

  async function get(id) {
    const normalizedId = String(id || "").trim();
    if (!normalizedId) return null;
    const rows = resultRows(await db.query(
      `SELECT * FROM sf_identity_records
       WHERE record_id = $1 AND workspace_id = $2 AND user_id = $3
       LIMIT 1`,
      [normalizedId, workspaceScope, userScope],
    ));
    return rows[0] ? identityFromRow(rows[0]) : null;
  }

  async function upsert(input) {
    const record = assertOwned(normalizeIdentityRecord(input));
    const id = recordId(record);
    const rows = resultRows(await db.query(`
INSERT INTO sf_identity_records (
  record_id, workspace_id, user_id, record_kind, scope_key, record_version,
  record, schema_version, created_at, updated_at
) VALUES (
  $1, $2, $3, $4, $5, $6,
  $7::jsonb, $8, $9::timestamptz, $10::timestamptz
)
ON CONFLICT (record_id) DO UPDATE SET
  record = EXCLUDED.record,
  schema_version = EXCLUDED.schema_version,
  updated_at = EXCLUDED.updated_at
WHERE sf_identity_records.workspace_id = EXCLUDED.workspace_id
  AND sf_identity_records.user_id = EXCLUDED.user_id
  AND sf_identity_records.record_kind = EXCLUDED.record_kind
  AND sf_identity_records.scope_key = EXCLUDED.scope_key
  AND sf_identity_records.record_version = EXCLUDED.record_version
RETURNING *`, [
      id,
      workspaceScope,
      userScope,
      record.kind,
      scopeKey(record),
      recordVersion(record),
      JSON.stringify(record),
      schemaVersion(record),
      record.createdAt,
      record.updatedAt || record.createdAt,
    ]));
    if (rows.length !== 1) {
      const error = new Error(`Identity record ${id} could not be persisted in the scoped owner workspace.`);
      error.code = "identity_persistence_failed";
      throw error;
    }
    return identityFromRow(rows[0]);
  }

  async function remove(id) {
    const rows = resultRows(await db.query(
      `DELETE FROM sf_identity_records
       WHERE record_id = $1 AND workspace_id = $2 AND user_id = $3
       RETURNING record_id`,
      [String(id || "").trim(), workspaceScope, userScope],
    ));
    return rows.length === 1;
  }

  return assertPort("identityRepository", { list, get, upsert, remove });
}
