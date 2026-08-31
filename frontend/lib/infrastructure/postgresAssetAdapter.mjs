import { assertPort } from "../domain/ports.mjs";
import { normalizeAsset } from "../domain/sourceArtifacts.mjs";
import { stableStringify } from "../domain/contracts.mjs";

const RECORD_KIND = "Asset";

function requireDatabase(database) {
  if (!database || typeof database.query !== "function") {
    throw new TypeError("Postgres Asset repository requires a database query executor.");
  }
  return database;
}

function resultRows(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.rows)) return result.rows;
  return [];
}

function workspace(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    const error = new Error("Postgres Asset repository requires workspace context.");
    error.code = "postgres_workspace_scope_required";
    throw error;
  }
  return normalized;
}

function jsonValue(value) {
  if (!value) return {};
  return typeof value === "string" ? JSON.parse(value) : value;
}

function assetFromRow(row = {}) {
  const record = normalizeAsset(jsonValue(row.record), {
    workspaceId: row.workspace_id,
    now: jsonValue(row.record)?.updatedAt || jsonValue(row.record)?.createdAt,
  });
  if (
    row.record_id !== record.assetId
    || row.workspace_id !== record.workspaceId
    || row.record_kind !== RECORD_KIND
    || row.asset_id !== record.assetId
  ) {
    const error = new Error("Stored Asset metadata does not match its canonical record.");
    error.code = "asset_storage_integrity_error";
    throw error;
  }
  return record;
}

function immutableIdentity(asset) {
  return {
    assetId: asset.assetId,
    workspaceId: asset.workspaceId,
    projectId: asset.projectId,
    campaignId: asset.campaignId,
    assetType: asset.assetType,
    lifecycle: asset.lifecycle,
    originalName: asset.originalName,
    mimeType: asset.mimeType,
    byteSize: asset.byteSize,
    dimensions: asset.dimensions,
    durationMs: asset.durationMs,
    contentHash: asset.contentHash,
    storageRef: asset.storageRef,
    blobId: asset.blobId,
    contentType: asset.contentType,
    userMetadata: asset.userMetadata,
    privacy: asset.privacy,
    provenance: asset.provenance,
    parentAssetIds: asset.parentAssetIds,
    derivedAssetIds: asset.derivedAssetIds,
    createdAt: asset.createdAt,
  };
}

function sameImmutableIdentity(left, right) {
  return stableStringify(immutableIdentity(left)) === stableStringify(immutableIdentity(right));
}

function recordStatus(asset) {
  return asset.deletion?.state === "deleted" ? "deleted" : String(asset.availability || "available");
}

export function createPostgresAssetRepository({ database, workspaceId } = {}) {
  const db = requireDatabase(database);
  const owner = workspace(workspaceId);

  function assertOwned(input) {
    const asset = normalizeAsset(input, {
      workspaceId: owner,
      projectId: input?.projectId || null,
      campaignId: input?.campaignId || null,
      now: input?.updatedAt || input?.createdAt,
    });
    if (asset.workspaceId !== owner) {
      const error = new Error("Cross-workspace Asset persistence is forbidden.");
      error.code = "postgres_workspace_scope_mismatch";
      throw error;
    }
    return asset;
  }

  async function list() {
    return resultRows(await db.query(
      `SELECT * FROM sf_media_records
       WHERE workspace_id = $1 AND record_kind = $2
       ORDER BY updated_at DESC, record_id`,
      [owner, RECORD_KIND],
    )).map(assetFromRow);
  }

  async function get(assetId) {
    const id = String(assetId || "").trim();
    if (!id) return null;
    const rows = resultRows(await db.query(
      `SELECT * FROM sf_media_records
       WHERE workspace_id = $1 AND record_kind = $2 AND record_id = $3
       LIMIT 1`,
      [owner, RECORD_KIND, id],
    ));
    return rows[0] ? assetFromRow(rows[0]) : null;
  }

  async function upsert(input) {
    const asset = assertOwned(input);
    const existing = await get(asset.assetId);
    if (existing) {
      if (!sameImmutableIdentity(existing, asset)) {
        const error = new Error(`Asset ${asset.assetId} conflicts with existing immutable blob metadata.`);
        error.code = "asset_immutable_conflict";
        throw error;
      }
      if (existing.assetVersionId === asset.assetVersionId) {
        if (stableStringify(existing) !== stableStringify(asset)) {
          const error = new Error(`AssetVersion ${asset.assetVersionId} cannot be rewritten in place.`);
          error.code = "asset_version_immutable_conflict";
          throw error;
        }
        return existing;
      }
      if (String(asset.updatedAt || "").localeCompare(String(existing.updatedAt || "")) < 0) {
        const error = new Error(`Asset ${asset.assetId} cannot be rolled back with stale metadata.`);
        error.code = "stale_asset_update";
        throw error;
      }
    }

    const rows = resultRows(await db.query(`
INSERT INTO sf_media_records (
  record_id, workspace_id, record_kind, scope_type, scope_id, content_piece_id,
  asset_id, destination, status, revision, schema_version, record, created_at, updated_at
) VALUES (
  $1, $2, $3, NULL, NULL, NULL,
  $4, NULL, $5, 1, $6, $7::jsonb, $8::timestamptz, $9::timestamptz
)
ON CONFLICT (record_id) DO UPDATE SET
  status = EXCLUDED.status,
  schema_version = EXCLUDED.schema_version,
  record = EXCLUDED.record,
  updated_at = EXCLUDED.updated_at
WHERE sf_media_records.workspace_id = EXCLUDED.workspace_id
  AND sf_media_records.record_kind = EXCLUDED.record_kind
  AND sf_media_records.asset_id = EXCLUDED.asset_id
RETURNING *`, [
      asset.assetId,
      owner,
      RECORD_KIND,
      asset.assetId,
      recordStatus(asset),
      Number(asset.schemaVersion || 1),
      JSON.stringify(asset),
      asset.createdAt,
      asset.updatedAt,
    ]));

    if (rows.length !== 1) {
      const error = new Error(`Asset ${asset.assetId} could not be persisted in this workspace.`);
      error.code = "asset_persistence_failed";
      throw error;
    }
    return assetFromRow(rows[0]);
  }

  async function remove() {
    const error = new Error("Hosted Assets require the explicit private-storage deletion workflow.");
    error.code = "asset_delete_requires_storage_workflow";
    throw error;
  }

  return assertPort("assetRepository", { list, get, upsert, remove });
}
