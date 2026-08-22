import { assertPort } from "../domain/ports.mjs";
import {
  normalizeContentPiece,
  normalizeNarrativeStrategy,
  normalizePlatformVariant,
} from "../domain/contentPlanning.mjs";
import { normalizePlatformVariantRevision } from "../domain/platformVariantRevisions.mjs";

const SUPPORTED = new Set(["NarrativeStrategy", "ContentPiece", "PlatformVariant", "PlatformVariantRevision"]);

function requireDatabase(database) {
  if (!database || typeof database.query !== "function") {
    throw new TypeError("Postgres content planning repository requires a database query executor.");
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

function normalize(input) {
  if (!input || typeof input !== "object") throw new TypeError("Content planning repository requires a record.");
  if (!SUPPORTED.has(input.kind)) throw new TypeError(`Unsupported content planning record: ${input.kind || "missing"}.`);
  if (input.kind === "NarrativeStrategy") return normalizeNarrativeStrategy(input);
  if (input.kind === "ContentPiece") return normalizeContentPiece(input);
  if (input.kind === "PlatformVariant") return normalizePlatformVariant(input);
  return normalizePlatformVariantRevision(input);
}

function recordId(record) {
  if (record.kind === "NarrativeStrategy") return record.narrativeStrategyId;
  if (record.kind === "ContentPiece") return record.contentPieceId;
  if (record.kind === "PlatformVariant") return record.platformVariantId;
  if (record.kind === "PlatformVariantRevision") return record.platformVariantRevisionId;
  throw new TypeError(`Unsupported content planning record: ${record.kind || "missing"}.`);
}

function metadata(record) {
  if (record.kind === "NarrativeStrategy") {
    return {
      opportunityId: record.opportunityId,
      narrativeStrategyId: null,
      contentPieceId: null,
      destination: null,
      status: record.status,
    };
  }
  if (record.kind === "ContentPiece") {
    return {
      opportunityId: record.opportunityId,
      narrativeStrategyId: record.narrativeStrategyId,
      contentPieceId: null,
      destination: null,
      status: record.status,
    };
  }
  if (record.kind === "PlatformVariant") {
    return {
      opportunityId: null,
      narrativeStrategyId: record.narrativeStrategyId,
      contentPieceId: record.contentPieceId,
      destination: record.destination,
      status: record.status,
    };
  }
  return {
    opportunityId: null,
    narrativeStrategyId: record.narrativeStrategyId,
    contentPieceId: record.contentPieceId,
    destination: record.destination,
    status: record.status,
  };
}

function timestamp(record, field) {
  return record[field] || record.createdAt;
}

export function planningRecordFromRow(row = {}) {
  const record = normalize(jsonValue(row.record, {}));
  const meta = metadata(record);
  if (
    recordId(record) !== row.record_id
    || record.workspaceId !== row.workspace_id
    || record.kind !== row.record_kind
    || (meta.opportunityId || null) !== (row.opportunity_id || null)
    || (meta.narrativeStrategyId || null) !== (row.narrative_strategy_id || null)
    || (meta.contentPieceId || null) !== (row.content_piece_id || null)
    || (meta.destination || null) !== (row.destination || null)
    || meta.status !== row.status
  ) {
    const error = new Error("Stored content planning metadata does not match its canonical record.");
    error.code = "content_planning_storage_integrity_error";
    throw error;
  }
  return record;
}

export function createPostgresContentPlanningRepository({ database, workspaceId = null } = {}) {
  const db = requireDatabase(database);
  const scope = String(workspaceId || "").trim();
  if (!scope) {
    const error = new Error("Postgres content planning repository requires workspace context.");
    error.code = "postgres_workspace_scope_required";
    throw error;
  }

  function assertOwned(record) {
    if (record.workspaceId !== scope) {
      const error = new Error("Cross-workspace content planning repository access is forbidden.");
      error.code = "postgres_workspace_scope_mismatch";
      throw error;
    }
    return record;
  }

  async function list() {
    return resultRows(await db.query(
      `SELECT * FROM sf_content_planning_records
       WHERE workspace_id = $1
       ORDER BY updated_at DESC, created_at DESC, record_id`,
      [scope],
    )).map(planningRecordFromRow);
  }

  async function get(id) {
    const normalizedId = String(id || "").trim();
    if (!normalizedId) return null;
    const rows = resultRows(await db.query(
      `SELECT * FROM sf_content_planning_records
       WHERE record_id = $1 AND workspace_id = $2
       LIMIT 1`,
      [normalizedId, scope],
    ));
    return rows[0] ? planningRecordFromRow(rows[0]) : null;
  }

  async function upsert(input) {
    const record = assertOwned(normalize(input));
    const meta = metadata(record);
    const rows = resultRows(await db.query(`
INSERT INTO sf_content_planning_records (
  record_id, workspace_id, record_kind, opportunity_id, narrative_strategy_id,
  content_piece_id, destination, status, record, schema_version, created_at, updated_at
) VALUES (
  $1, $2, $3, $4, $5,
  $6, $7, $8, $9::jsonb, $10, $11::timestamptz, $12::timestamptz
)
ON CONFLICT (record_id) DO UPDATE SET
  opportunity_id = EXCLUDED.opportunity_id,
  narrative_strategy_id = EXCLUDED.narrative_strategy_id,
  content_piece_id = EXCLUDED.content_piece_id,
  destination = EXCLUDED.destination,
  status = EXCLUDED.status,
  record = EXCLUDED.record,
  schema_version = EXCLUDED.schema_version,
  updated_at = EXCLUDED.updated_at
WHERE sf_content_planning_records.workspace_id = EXCLUDED.workspace_id
  AND sf_content_planning_records.record_kind = EXCLUDED.record_kind
RETURNING *`, [
      recordId(record),
      scope,
      record.kind,
      meta.opportunityId,
      meta.narrativeStrategyId,
      meta.contentPieceId,
      meta.destination,
      meta.status,
      JSON.stringify(record),
      Number(record.schemaVersion || record.planningSchemaVersion || record.revisionSchemaVersion || 1),
      record.createdAt,
      timestamp(record, "updatedAt"),
    ]));
    if (rows.length !== 1) {
      const error = new Error(`Content planning record ${recordId(record)} could not be persisted.`);
      error.code = "content_planning_persistence_failed";
      throw error;
    }
    return planningRecordFromRow(rows[0]);
  }

  async function remove(id) {
    const rows = resultRows(await db.query(
      `DELETE FROM sf_content_planning_records
       WHERE record_id = $1 AND workspace_id = $2
       RETURNING record_id`,
      [String(id || "").trim(), scope],
    ));
    return rows.length === 1;
  }

  return assertPort("contentPlanningRepository", { list, get, upsert, remove });
}
