import { assertPort, createSystemClock } from "../domain/ports.mjs";
import { normalizeAsset, PRIVACY_CLASSES } from "../domain/sourceArtifacts.mjs";

const HOSTED_STORAGE_PRIVACY = new Set([
  PRIVACY_CLASSES.PUBLIC,
  PRIVACY_CLASSES.WORKSPACE_PRIVATE,
]);

const PREVIEW_MIN_SECONDS = 30;
const PREVIEW_MAX_SECONDS = 300;

export class AssetBlobStorageError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "AssetBlobStorageError";
    this.code = code;
    this.details = { ...details };
  }
}

function requiredText(value, field, maxLength = 4000) {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new AssetBlobStorageError("missing_storage_field", `${field} is required.`, { field });
  if (normalized.length > maxLength) throw new AssetBlobStorageError("storage_field_too_long", `${field} is too long.`, { field });
  return normalized;
}

function normalizeContentType(value) {
  const normalized = String(value || "application/octet-stream").trim().toLowerCase();
  if (!/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+(?:\s*;.*)?$/i.test(normalized)) {
    throw new AssetBlobStorageError("invalid_content_type", "Asset content type is invalid.");
  }
  return normalized;
}

async function toBytes(value) {
  if (value instanceof Uint8Array) return new Uint8Array(value);
  if (value instanceof ArrayBuffer) return new Uint8Array(value.slice(0));
  if (typeof Blob !== "undefined" && value instanceof Blob) return new Uint8Array(await value.arrayBuffer());
  if (typeof value === "string") return new TextEncoder().encode(value);
  throw new AssetBlobStorageError("unsupported_blob_value", "Private asset storage accepts bytes, ArrayBuffer, Blob, or string content.");
}

async function sha256Hex(value) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new AssetBlobStorageError("crypto_unavailable", "Web Crypto SHA-256 is required for immutable asset storage.");
  const bytes = value instanceof Uint8Array ? value : new TextEncoder().encode(String(value));
  const digest = new Uint8Array(await subtle.digest("SHA-256", bytes));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function privacyClassOf(assetOrPrivacy) {
  if (typeof assetOrPrivacy === "string") return assetOrPrivacy;
  return String(assetOrPrivacy?.classification || PRIVACY_CLASSES.WORKSPACE_PRIVATE).toLowerCase();
}

function assertHostedPrivacyAllowed(assetOrPrivacy) {
  const classification = privacyClassOf(assetOrPrivacy);
  if (!HOSTED_STORAGE_PRIVACY.has(classification)) {
    throw new AssetBlobStorageError(
      "hosted_storage_privacy_blocked",
      `Hosted object storage is blocked for ${classification} media.`,
      { classification },
    );
  }
  return classification;
}

function assertOwnedAsset(asset, workspaceId) {
  if (!asset || asset.kind !== "Asset") {
    throw new AssetBlobStorageError("asset_not_found", "Asset was not found.");
  }
  if (asset.workspaceId !== workspaceId) {
    throw new AssetBlobStorageError("cross_workspace_asset_access", "Cross-workspace asset access is forbidden.");
  }
  return asset;
}

function clampPreviewSeconds(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 60;
  return Math.max(PREVIEW_MIN_SECONDS, Math.min(PREVIEW_MAX_SECONDS, Math.round(parsed)));
}

function safeStorageRef({ descriptor = {}, blobId, objectKey }) {
  return {
    provider: String(descriptor.provider || "s3-compatible"),
    blobId,
    objectKey: String(descriptor.objectKey || objectKey),
    region: descriptor.region ? String(descriptor.region) : null,
  };
}

function contentHashValue(hex) {
  return `sha256:${hex}`;
}

function compareStoredObject(existing, { byteSize, contentHash }) {
  if (!existing) return;
  if (Number.isFinite(existing.byteSize) && Number(existing.byteSize) !== byteSize) {
    throw new AssetBlobStorageError("immutable_blob_collision", "Existing immutable blob has an unexpected byte size.");
  }
  if (existing.contentHash && String(existing.contentHash).toLowerCase() !== contentHash.toLowerCase()) {
    throw new AssetBlobStorageError("immutable_blob_collision", "Existing immutable blob has an unexpected content hash.");
  }
}

export function createPrivateAssetStorageApplication({
  blobStorage,
  assetRepository,
  clock = createSystemClock(),
} = {}) {
  const storage = assertPort("blobStorage", blobStorage);
  const assets = assertPort("assetRepository", assetRepository);
  const time = assertPort("clock", clock);

  async function immutableIdentity(workspaceId, bytes) {
    const workspaceHash = await sha256Hex(requiredText(workspaceId, "workspaceId"));
    const contentHex = await sha256Hex(bytes);
    const workspaceNamespace = workspaceHash.slice(0, 20);
    return {
      contentHex,
      contentHash: contentHashValue(contentHex),
      blobId: `blob-${workspaceNamespace}-${contentHex}`,
      objectKey: `workspaces/${workspaceNamespace}/assets/sha256/${contentHex}`,
    };
  }

  async function storeAsset({
    workspaceId,
    projectId = null,
    campaignId = null,
    bytes: inputBytes,
    originalName = "captured-asset.bin",
    mimeType = "application/octet-stream",
    privacy = { classification: PRIVACY_CLASSES.WORKSPACE_PRIVATE },
    lifecycle = "original",
    provenance = null,
    userMetadata = null,
    dimensions = null,
    durationMs = null,
  } = {}) {
    const ownerWorkspaceId = requiredText(workspaceId, "workspaceId", 240);
    assertHostedPrivacyAllowed(privacy);
    const bytes = await toBytes(inputBytes);
    if (!bytes.byteLength) throw new AssetBlobStorageError("empty_blob", "Zero-byte assets are not stored.");
    const contentType = normalizeContentType(mimeType);
    const identity = await immutableIdentity(ownerWorkspaceId, bytes);
    const storageOptions = {
      objectKey: identity.objectKey,
      contentType,
      contentHash: identity.contentHash,
      byteSize: bytes.byteLength,
    };

    let existingObject = null;
    if (typeof storage.head === "function") {
      existingObject = await storage.head(identity.blobId, storageOptions);
      compareStoredObject(existingObject, storageOptions);
    }

    let descriptor = existingObject || {};
    if (!existingObject) {
      descriptor = await storage.put(identity.blobId, bytes, storageOptions) || {};
    }

    const now = time.now();
    const asset = normalizeAsset({
      workspaceId: ownerWorkspaceId,
      projectId,
      campaignId,
      originalName,
      mimeType: contentType,
      byteSize: bytes.byteLength,
      dimensions,
      durationMs,
      contentHash: identity.contentHash,
      lifecycle,
      storageRef: safeStorageRef({ descriptor, blobId: identity.blobId, objectKey: identity.objectKey }),
      privacy,
      provenance: provenance || [{
        eventType: lifecycle === "derived" ? "derived" : "captured",
        method: "api",
        actorType: "worker",
        occurredAt: now,
      }],
      userMetadata: userMetadata || {},
      uploadState: "complete",
      availability: "available",
      createdAt: now,
      updatedAt: now,
    }, {
      workspaceId: ownerWorkspaceId,
      projectId,
      campaignId,
      now,
    });

    const current = await assets.get(asset.assetId);
    if (current) {
      assertOwnedAsset(current, ownerWorkspaceId);
      if (current.contentHash !== asset.contentHash || current.storageRef?.objectKey !== asset.storageRef?.objectKey) {
        throw new AssetBlobStorageError("asset_identity_collision", "Canonical Asset identity conflicts with immutable storage identity.");
      }
      if (current.deletion?.state === "deleted") {
        throw new AssetBlobStorageError("asset_previously_deleted", "A deleted immutable Asset cannot be silently resurrected.");
      }
      return { asset: current, stored: false, reusedObject: true };
    }

    return {
      asset: await assets.upsert(asset),
      stored: !existingObject,
      reusedObject: Boolean(existingObject),
    };
  }

  async function readAsset({ workspaceId, assetId } = {}) {
    const ownerWorkspaceId = requiredText(workspaceId, "workspaceId", 240);
    const asset = assertOwnedAsset(await assets.get(requiredText(assetId, "assetId", 300)), ownerWorkspaceId);
    assertHostedPrivacyAllowed(asset.privacy);
    if (asset.deletion?.state === "deleted" || asset.availability === "deleted") {
      throw new AssetBlobStorageError("asset_deleted", "Deleted asset content is unavailable.");
    }
    if (!asset.storageRef?.blobId || !asset.storageRef?.objectKey) {
      throw new AssetBlobStorageError("asset_storage_missing", "Asset has no hosted storage reference.");
    }
    const value = await storage.get(asset.storageRef.blobId, { objectKey: asset.storageRef.objectKey });
    if (value === null || value === undefined) {
      throw new AssetBlobStorageError("blob_not_found", "Stored asset content was not found.");
    }
    return { asset, bytes: value };
  }

  async function createPreview({ workspaceId, assetId, expiresInSeconds = 60 } = {}) {
    const ownerWorkspaceId = requiredText(workspaceId, "workspaceId", 240);
    const asset = assertOwnedAsset(await assets.get(requiredText(assetId, "assetId", 300)), ownerWorkspaceId);
    assertHostedPrivacyAllowed(asset.privacy);
    if (asset.deletion?.state === "deleted" || asset.availability === "deleted") {
      throw new AssetBlobStorageError("asset_deleted", "Deleted assets cannot receive preview authorization.");
    }
    if (typeof storage.createReadUrl !== "function") {
      throw new AssetBlobStorageError("preview_not_supported", "This blob storage adapter cannot issue private preview authorization.");
    }
    const ttl = clampPreviewSeconds(expiresInSeconds);
    const preview = await storage.createReadUrl(asset.storageRef.blobId, {
      objectKey: asset.storageRef.objectKey,
      expiresInSeconds: ttl,
    });
    const url = requiredText(preview?.url, "preview.url", 12000);
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") throw new AssetBlobStorageError("unsafe_preview_url", "Private preview authorization must use HTTPS.");
    return {
      assetId: asset.assetId,
      assetVersionId: asset.assetVersionId,
      url,
      expiresAt: preview.expiresAt || new Date(Date.parse(time.now()) + ttl * 1000).toISOString(),
    };
  }

  async function deleteAsset({ workspaceId, assetId } = {}) {
    const ownerWorkspaceId = requiredText(workspaceId, "workspaceId", 240);
    const asset = assertOwnedAsset(await assets.get(requiredText(assetId, "assetId", 300)), ownerWorkspaceId);
    assertHostedPrivacyAllowed(asset.privacy);
    if (asset.deletion?.state === "deleted" || asset.availability === "deleted") {
      return { asset, removed: false, alreadyDeleted: true };
    }
    if (!asset.storageRef?.blobId || !asset.storageRef?.objectKey) {
      throw new AssetBlobStorageError("asset_storage_missing", "Asset has no hosted storage reference.");
    }
    const removed = await storage.remove(asset.storageRef.blobId, { objectKey: asset.storageRef.objectKey });
    const now = time.now();
    const deleted = normalizeAsset({
      ...asset,
      availability: "deleted",
      deletion: {
        ...(asset.deletion || {}),
        state: "deleted",
        requestedAt: asset.deletion?.requestedAt || now,
        deletedAt: now,
        issueCodes: [],
      },
      updatedAt: now,
    }, {
      workspaceId: ownerWorkspaceId,
      projectId: asset.projectId,
      campaignId: asset.campaignId,
      now,
    });
    return { asset: await assets.upsert(deleted), removed: Boolean(removed), alreadyDeleted: false };
  }

  return {
    storeAsset,
    readAsset,
    createPreview,
    deleteAsset,
  };
}
