import { assertPort } from "../domain/ports.mjs";
import {
  normalizeAssetLineage,
  normalizeAssetRoleBinding,
  normalizeMediaDecision,
  normalizeMediaIntentResolution,
  normalizeMediaRequirement,
} from "../domain/mediaIntelligence.mjs";
import {
  normalizeImageDerivativePlan,
  normalizeScreenshotQualityReview,
} from "../domain/screenshotProduction.mjs";

const SUPPORTED = new Set([
  "MediaIntentResolution",
  "AssetRoleBinding",
  "AssetLineage",
  "MediaDecision",
  "MediaRequirement",
  "ScreenshotQualityReview",
  "ImageDerivativePlan",
]);

function requireDatabase(database) {
  if (!database || typeof database.query !== "function") throw new TypeError("Postgres media intelligence repository requires a database query executor.");
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

function normalize(input) {
  if (!input || typeof input !== "object" || !SUPPORTED.has(input.kind)) throw new TypeError(`Unsupported media intelligence record: ${input?.kind || "missing"}.`);
  if (input.kind === "MediaIntentResolution") return normalizeMediaIntentResolution(input);
  if (input.kind === "AssetRoleBinding") return normalizeAssetRoleBinding(input);
  if (input.kind === "AssetLineage") return normalizeAssetLineage(input);
  if (input.kind === "MediaDecision") return normalizeMediaDecision(input);
  if (input.kind === "MediaRequirement") return normalizeMediaRequirement(input);
  if (input.kind === "ScreenshotQualityReview") return normalizeScreenshotQualityReview(input);
  return normalizeImageDerivativePlan(input);
}

function recordId(record) {
  if (record.kind === "MediaIntentResolution") return record.mediaIntentResolutionId;
  if (record.kind === "AssetRoleBinding") return record.assetRoleBindingId;
  if (record.kind === "AssetLineage") return record.assetLineageId;
  if (record.kind === "MediaDecision") return record.mediaDecisionId;
  if (record.kind === "MediaRequirement") return record.mediaRequirementId;
  if (record.kind === "ScreenshotQualityReview") return record.screenshotQualityReviewId;
  if (record.kind === "ImageDerivativePlan") return record.imageDerivativePlanId;
  throw new TypeError(`Unsupported media intelligence record: ${record.kind || "missing"}.`);
}

function metadata(record) {
  return {
    scopeType: record.scopeType || null,
    scopeId: record.scopeId || null,
    contentPieceId: record.contentPieceId || (record.scopeType === "content_piece" ? record.scopeId : null),
    assetId: record.assetId || record.sourceAssetId || null,
    destination: record.destination || null,
    status: record.status || "ready",
    revision: Number(record.revision || record.dependencyVersion || 1),
  };
}

export function mediaRecordFromRow(row = {}) {
  const record = normalize(jsonValue(row.record, {}));
  const meta = metadata(record);
  if (
    recordId(record) !== row.record_id
    || record.workspaceId !== row.workspace_id
    || record.kind !== row.record_kind
    || (meta.scopeType || null) !== (row.scope_type || null)
    || (meta.scopeId || null) !== (row.scope_id || null)
    || (meta.contentPieceId || null) !== (row.content_piece_id || null)
    || (meta.assetId || null) !== (row.asset_id || null)
    || (meta.destination || null) !== (row.destination || null)
    || meta.status !== row.status
    || meta.revision !== Number(row.revision)
  ) {
    const error = new Error("Stored media intelligence metadata does not match its canonical record.");
    error.code = "media_storage_integrity_error";
    throw error;
  }
  return record;
}

export function createPostgresMediaIntelligenceRepository({ database, workspaceId = null } = {}) {
  const db = requireDatabase(database);
  const scope = String(workspaceId || "").trim();
  if (!scope) {
    const error = new Error("Postgres media intelligence repository requires workspace context.");
    error.code = "postgres_workspace_scope_required";
    throw error;
  }

  function assertOwned(input) {
    const record = normalize(input);
    if (record.workspaceId !== scope) {
      const error = new Error("Cross-workspace media intelligence access is forbidden.");
      error.code = "postgres_workspace_scope_mismatch";
      throw error;
    }
    return record;
  }

  async function list() {
    return resultRows(await db.query(
      `SELECT * FROM sf_media_records WHERE workspace_id = $1 ORDER BY updated_at DESC, record_id`,
      [scope],
    )).map(mediaRecordFromRow);
  }

  async function get(id) {
    const normalizedId = String(id || "").trim();
    if (!normalizedId) return null;
    const rows = resultRows(await db.query(
      `SELECT * FROM sf_media_records WHERE record_id = $1 AND workspace_id = $2 LIMIT 1`,
      [normalizedId, scope],
    ));
    return rows[0] ? mediaRecordFromRow(rows[0]) : null;
  }

  async function listByScope(scopeType, scopeId) {
    return resultRows(await db.query(
      `SELECT * FROM sf_media_records
       WHERE workspace_id = $1 AND scope_type = $2 AND scope_id = $3
       ORDER BY updated_at DESC, record_id`,
      [scope, String(scopeType || "").trim(), String(scopeId || "").trim()],
    )).map(mediaRecordFromRow);
  }

  async function listByContentPiece(contentPieceId) {
    return resultRows(await db.query(
      `SELECT * FROM sf_media_records
       WHERE workspace_id = $1 AND content_piece_id = $2
       ORDER BY updated_at DESC, record_id`,
      [scope, String(contentPieceId || "").trim()],
    )).map(mediaRecordFromRow);
  }

  async function upsert(input) {
    const record = assertOwned(input);
    const meta = metadata(record);
    const rows = resultRows(await db.query(`
INSERT INTO sf_media_records (
  record_id, workspace_id, record_kind, scope_type, scope_id, content_piece_id,
  asset_id, destination, status, revision, schema_version, record, created_at, updated_at
) VALUES (
  $1, $2, $3, $4, $5, $6,
  $7, $8, $9, $10, $11, $12::jsonb, $13::timestamptz, $14::timestamptz
)
ON CONFLICT (record_id) DO UPDATE SET
  scope_type = EXCLUDED.scope_type,
  scope_id = EXCLUDED.scope_id,
  content_piece_id = EXCLUDED.content_piece_id,
  asset_id = EXCLUDED.asset_id,
  destination = EXCLUDED.destination,
  status = EXCLUDED.status,
  revision = EXCLUDED.revision,
  schema_version = EXCLUDED.schema_version,
  record = EXCLUDED.record,
  updated_at = EXCLUDED.updated_at
WHERE sf_media_records.workspace_id = EXCLUDED.workspace_id
  AND sf_media_records.record_kind = EXCLUDED.record_kind
RETURNING *`, [
      recordId(record), scope, record.kind, meta.scopeType, meta.scopeId, meta.contentPieceId,
      meta.assetId, meta.destination, meta.status, meta.revision,
      Number(record.schemaVersion || record.mediaSchemaVersion || 1), JSON.stringify(record), record.createdAt, record.updatedAt || record.createdAt,
    ]));
    if (rows.length !== 1) {
      const error = new Error(`Media intelligence record ${recordId(record)} could not be persisted.`);
      error.code = "media_persistence_failed";
      throw error;
    }
    return mediaRecordFromRow(rows[0]);
  }

  async function remove(id) {
    const rows = resultRows(await db.query(
      `DELETE FROM sf_media_records WHERE record_id = $1 AND workspace_id = $2 RETURNING record_id`,
      [String(id || "").trim(), scope],
    ));
    return rows.length === 1;
  }

  return assertPort("mediaIntelligenceRepository", { list, get, upsert, remove, listByScope, listByContentPiece });
}
