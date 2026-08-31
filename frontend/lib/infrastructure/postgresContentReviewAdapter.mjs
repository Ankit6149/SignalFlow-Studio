import { assertPort } from "../domain/ports.mjs";
import {
  normalizePlatformVariantApproval,
  normalizePlatformVariantReview,
} from "../domain/platformVariantReviews.mjs";
import { stableStringify } from "../domain/contracts.mjs";

const SUPPORTED = new Set(["PlatformVariantReview", "PlatformVariantApproval"]);

function requireDatabase(database) {
  if (!database || typeof database.query !== "function") {
    throw new TypeError("Postgres content review repository requires a database query executor.");
  }
  return database;
}

function resultRows(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.rows)) return result.rows;
  return [];
}

function jsonValue(value) {
  if (!value) return {};
  return typeof value === "string" ? JSON.parse(value) : value;
}

function normalize(input) {
  if (!input || typeof input !== "object") throw new TypeError("Content review repository requires a record.");
  if (!SUPPORTED.has(input.kind)) throw new TypeError(`Unsupported content review record: ${input.kind || "missing"}.`);
  return input.kind === "PlatformVariantReview"
    ? normalizePlatformVariantReview(input)
    : normalizePlatformVariantApproval(input);
}

function recordId(record) {
  return record.kind === "PlatformVariantReview"
    ? record.platformVariantReviewId
    : record.platformVariantApprovalId;
}

function metadata(record) {
  if (record.kind === "PlatformVariantReview") {
    return {
      platformVariantReviewId: null,
      status: record.overallVerdict,
      createdAt: record.createdAt,
      updatedAt: record.createdAt,
    };
  }
  return {
    platformVariantReviewId: record.platformVariantReviewId || null,
    status: record.decision,
    createdAt: record.decidedAt,
    updatedAt: record.decidedAt,
  };
}

function rowRecord(row = {}) {
  const record = normalize(jsonValue(row.record));
  const meta = metadata(record);
  if (
    row.record_id !== recordId(record)
    || row.workspace_id !== record.workspaceId
    || row.record_kind !== record.kind
    || row.platform_variant_id !== record.platformVariantId
    || row.platform_variant_revision_id !== record.platformVariantRevisionId
    || (row.platform_variant_review_id || null) !== meta.platformVariantReviewId
    || row.destination !== record.destination
    || row.status !== meta.status
  ) {
    const error = new Error("Stored content review metadata does not match its canonical record.");
    error.code = "content_review_storage_integrity_error";
    throw error;
  }
  return record;
}

export function createPostgresContentReviewRepository({ database, workspaceId } = {}) {
  const db = requireDatabase(database);
  const scope = String(workspaceId || "").trim();
  if (!scope) {
    const error = new Error("Postgres content review repository requires workspace context.");
    error.code = "postgres_workspace_scope_required";
    throw error;
  }

  function assertOwned(input) {
    const record = normalize(input);
    if (record.workspaceId !== scope) {
      const error = new Error("Cross-workspace content review repository access is forbidden.");
      error.code = "postgres_workspace_scope_mismatch";
      throw error;
    }
    return record;
  }

  async function list() {
    return resultRows(await db.query(
      `SELECT * FROM sf_content_review_records
       WHERE workspace_id = $1
       ORDER BY updated_at DESC, record_id`,
      [scope],
    )).map(rowRecord);
  }

  async function get(id) {
    const normalizedId = String(id || "").trim();
    if (!normalizedId) return null;
    const rows = resultRows(await db.query(
      `SELECT * FROM sf_content_review_records
       WHERE record_id = $1 AND workspace_id = $2
       LIMIT 1`,
      [normalizedId, scope],
    ));
    return rows[0] ? rowRecord(rows[0]) : null;
  }

  async function upsert(input) {
    const record = assertOwned(input);
    const id = recordId(record);
    const meta = metadata(record);
    const existing = await get(id);
    if (existing) {
      if (stableStringify(existing) !== stableStringify(record)) {
        const error = new Error(`${record.kind} ${id} is immutable and cannot be rewritten.`);
        error.code = "content_review_immutable_conflict";
        throw error;
      }
      return existing;
    }

    const rows = resultRows(await db.query(`
INSERT INTO sf_content_review_records (
  record_id, workspace_id, record_kind, platform_variant_id,
  platform_variant_revision_id, platform_variant_review_id,
  destination, status, record, schema_version, created_at, updated_at
) VALUES (
  $1, $2, $3, $4,
  $5, $6,
  $7, $8, $9::jsonb, $10, $11::timestamptz, $12::timestamptz
)
ON CONFLICT (record_id) DO NOTHING
RETURNING *`, [
      id,
      scope,
      record.kind,
      record.platformVariantId,
      record.platformVariantRevisionId,
      meta.platformVariantReviewId,
      record.destination,
      meta.status,
      JSON.stringify(record),
      Number(record.schemaVersion || record.reviewSchemaVersion || record.approvalSchemaVersion || 1),
      meta.createdAt,
      meta.updatedAt,
    ]));

    if (rows.length !== 1) {
      const concurrent = await get(id);
      if (concurrent && stableStringify(concurrent) === stableStringify(record)) return concurrent;
      const error = new Error(`Content review record ${id} could not be persisted immutably.`);
      error.code = "content_review_persistence_failed";
      throw error;
    }
    return rowRecord(rows[0]);
  }

  async function remove() {
    const error = new Error("Hosted review history is immutable and cannot be removed through the repository port.");
    error.code = "content_review_remove_forbidden";
    throw error;
  }

  return assertPort("contentReviewRepository", { list, get, upsert, remove });
}

export { rowRecord as contentReviewRecordFromRow };
