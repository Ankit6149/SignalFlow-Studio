import { createPrivateAssetStorageApplication } from "../application/privateAssetStorageApplication.mjs";
import { createPostgresAssetRepository } from "../infrastructure/postgresAssetAdapter.mjs";
import { createS3CompatibleBlobStorage } from "../infrastructure/s3CompatibleBlobStorage.mjs";
import { resolveOwnerWorkspaceId } from "./githubConnectionDependencies.mjs";
import { createNeonQueryExecutor } from "./neonDatabase.mjs";

export const HOSTED_ASSET_STORAGE_ENV = Object.freeze({
  endpoint: "SIGNALFLOW_S3_ENDPOINT",
  bucket: "SIGNALFLOW_S3_BUCKET",
  region: "SIGNALFLOW_S3_REGION",
  accessKeyId: "SIGNALFLOW_S3_ACCESS_KEY_ID",
  secretAccessKey: "SIGNALFLOW_S3_SECRET_ACCESS_KEY",
  sessionToken: "SIGNALFLOW_S3_SESSION_TOKEN",
  provider: "SIGNALFLOW_S3_PROVIDER",
});

function requiredOpaque(value, field) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    const error = new Error(`${field} is required.`);
    error.code = "hosted_asset_preview_invalid";
    error.status = 400;
    throw error;
  }
  if (/[/\\]|^[a-zA-Z]:/.test(normalized) || normalized.length > 320) {
    const error = new Error(`${field} must be an opaque identifier.`);
    error.code = "hosted_asset_preview_invalid";
    error.status = 400;
    throw error;
  }
  return normalized;
}

function previewError(code, message, status, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  error.details = { ...details };
  return error;
}

function normalizeBytes(value) {
  if (value instanceof Uint8Array) return new Uint8Array(value);
  if (value instanceof ArrayBuffer) return new Uint8Array(value.slice(0));
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
  throw previewError("hosted_asset_preview_bytes_invalid", "Stored Asset bytes are unavailable in a supported binary representation.", 503);
}

export function hostedAssetStorageConfigurationStatus(env = process.env) {
  const required = [
    HOSTED_ASSET_STORAGE_ENV.endpoint,
    HOSTED_ASSET_STORAGE_ENV.bucket,
    HOSTED_ASSET_STORAGE_ENV.accessKeyId,
    HOSTED_ASSET_STORAGE_ENV.secretAccessKey,
  ];
  const missing = required.filter((name) => !String(env?.[name] || "").trim());
  return Object.freeze({ configured: missing.length === 0, missing });
}

function createConfiguredBlobStorage({ env, fetchImpl, clock }) {
  const status = hostedAssetStorageConfigurationStatus(env);
  if (!status.configured) {
    throw previewError(
      "hosted_asset_storage_unconfigured",
      "SignalFlow private Asset storage is not configured.",
      503,
      { missing: status.missing },
    );
  }
  return createS3CompatibleBlobStorage({
    endpoint: env[HOSTED_ASSET_STORAGE_ENV.endpoint],
    bucket: env[HOSTED_ASSET_STORAGE_ENV.bucket],
    region: env[HOSTED_ASSET_STORAGE_ENV.region] || "auto",
    accessKeyId: env[HOSTED_ASSET_STORAGE_ENV.accessKeyId],
    secretAccessKey: env[HOSTED_ASSET_STORAGE_ENV.secretAccessKey],
    sessionToken: env[HOSTED_ASSET_STORAGE_ENV.sessionToken] || null,
    provider: env[HOSTED_ASSET_STORAGE_ENV.provider] || "s3-compatible",
    fetchImpl,
    clock,
  });
}

export function createProductionHostedExactAssetPreviewApplication({
  env = process.env,
  fetchImpl = globalThis.fetch,
  clock = { now: () => new Date().toISOString() },
  database = null,
  assetRepository = null,
  blobStorage = null,
} = {}) {
  const workspaceId = resolveOwnerWorkspaceId(env);
  const db = database || (assetRepository ? null : createNeonQueryExecutor({ databaseUrl: env.DATABASE_URL }));
  const assets = assetRepository || createPostgresAssetRepository({ database: db, workspaceId });
  const blobs = blobStorage || createConfiguredBlobStorage({ env, fetchImpl, clock });
  const privateStorage = createPrivateAssetStorageApplication({
    blobStorage: blobs,
    assetRepository: assets,
    clock,
  });

  async function readExactImage({ assetId, assetVersionId } = {}) {
    const requestedAssetId = requiredOpaque(assetId, "assetId");
    const requestedVersionId = requiredOpaque(assetVersionId, "assetVersionId");
    const { asset, bytes: storedBytes } = await privateStorage.readAsset({
      workspaceId,
      assetId: requestedAssetId,
    });

    if (asset.assetVersionId !== requestedVersionId) {
      throw previewError(
        "stale_preview_asset",
        "Preview must resolve the exact AssetVersion bound to the review revision.",
        409,
        { assetId: requestedAssetId, requestedAssetVersionId: requestedVersionId },
      );
    }
    if (asset.assetType !== "image" || !String(asset.mimeType || "").toLowerCase().startsWith("image/")) {
      throw previewError(
        "unsupported_preview_media",
        "Hosted exact review preview currently supports image Assets only.",
        415,
        { assetId: requestedAssetId, assetType: asset.assetType },
      );
    }

    const bytes = normalizeBytes(storedBytes);
    if (!bytes.byteLength) {
      throw previewError("hosted_asset_preview_empty", "The exact AssetVersion has no readable bytes.", 503);
    }

    return Object.freeze({
      workspaceId,
      asset,
      bytes,
      mimeType: asset.mimeType || "image/png",
    });
  }

  return Object.freeze({ workspaceId, readExactImage });
}
