import { createPrivateAssetStorageApplication } from "../application/privateAssetStorageApplication.mjs";
import { createPostgresAssetRepository } from "../infrastructure/postgresAssetAdapter.mjs";
import { createPostgresBlobStorage } from "../infrastructure/postgresBlobStorage.mjs";
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

function present(env, name) {
  return Boolean(String(env?.[name] || "").trim());
}

export function hostedAssetStorageConfigurationStatus(env = process.env) {
  const requiredS3 = [
    HOSTED_ASSET_STORAGE_ENV.endpoint,
    HOSTED_ASSET_STORAGE_ENV.bucket,
    HOSTED_ASSET_STORAGE_ENV.accessKeyId,
    HOSTED_ASSET_STORAGE_ENV.secretAccessKey,
  ];
  const configuredS3 = requiredS3.filter((name) => present(env, name));

  if (configuredS3.length === requiredS3.length) {
    return Object.freeze({ configured: true, missing: [], provider: "s3-compatible" });
  }
  if (configuredS3.length > 0) {
    return Object.freeze({
      configured: false,
      missing: requiredS3.filter((name) => !present(env, name)),
      provider: "s3-compatible",
    });
  }
  if (present(env, "DATABASE_URL")) {
    return Object.freeze({ configured: true, missing: [], provider: "postgres" });
  }
  return Object.freeze({ configured: false, missing: ["DATABASE_URL"], provider: "postgres" });
}

function createConfiguredBlobStorage({ env, fetchImpl, clock, database, workspaceId }) {
  const status = hostedAssetStorageConfigurationStatus(env);
  if (!status.configured) {
    throw previewError(
      "hosted_asset_storage_unconfigured",
      "SignalFlow private Asset storage is not configured.",
      503,
      { missing: status.missing },
    );
  }

  if (status.provider === "postgres") {
    return createPostgresBlobStorage({ database, workspaceId, clock });
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

export function createProductionHostedPrivateAssetStorage({
  env = process.env,
  fetchImpl = globalThis.fetch,
  clock = { now: () => new Date().toISOString() },
  database = null,
  assetRepository = null,
  blobStorage = null,
} = {}) {
  const workspaceId = resolveOwnerWorkspaceId(env);
  const storageStatus = blobStorage ? null : hostedAssetStorageConfigurationStatus(env);
  const databaseRequired = !assetRepository || (!blobStorage && storageStatus?.provider === "postgres");
  const db = database || (databaseRequired ? createNeonQueryExecutor({ databaseUrl: env.DATABASE_URL }) : null);
  const assets = assetRepository || createPostgresAssetRepository({ database: db, workspaceId });
  const blobs = blobStorage || createConfiguredBlobStorage({
    env,
    fetchImpl,
    clock,
    database: db,
    workspaceId,
  });
  const privateStorage = createPrivateAssetStorageApplication({
    blobStorage: blobs,
    assetRepository: assets,
    clock,
  });
  return Object.freeze({
    workspaceId,
    database: db,
    assetRepository: assets,
    blobStorage: blobs,
    privateStorage,
  });
}

export function createProductionHostedExactAssetPreviewApplication(options = {}) {
  const storage = createProductionHostedPrivateAssetStorage(options);

  async function readExactImage({ assetId, assetVersionId } = {}) {
    const requestedAssetId = requiredOpaque(assetId, "assetId");
    const requestedVersionId = requiredOpaque(assetVersionId, "assetVersionId");
    const { asset, bytes: storedBytes } = await storage.privateStorage.readAsset({
      workspaceId: storage.workspaceId,
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
      workspaceId: storage.workspaceId,
      asset,
      bytes,
      mimeType: asset.mimeType || "image/png",
    });
  }

  return Object.freeze({ workspaceId: storage.workspaceId, readExactImage });
}
