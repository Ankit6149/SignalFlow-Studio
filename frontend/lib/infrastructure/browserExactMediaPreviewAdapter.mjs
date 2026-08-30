import { normalizeAsset } from "../domain/sourceArtifacts.mjs";
import { createBrowserAssetRepository, createBrowserBlobStorage } from "./transferAdapters.mjs";

export class ExactMediaPreviewError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ExactMediaPreviewError";
    this.code = code;
    this.details = { ...details };
  }
}

function required(value, field) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new ExactMediaPreviewError("missing_preview_field", `${field} is required.`, { field });
  return normalized;
}

export function createBrowserExactMediaPreviewAdapter({
  getStorage,
  assetKey = "signalflow_assets_v1",
  blobKey = "signalflow_blobs_v1",
  workspaceId = "local-personal",
} = {}) {
  const ownerWorkspaceId = required(workspaceId, "workspaceId");
  const assets = createBrowserAssetRepository({ getStorage, key: assetKey });
  const blobs = createBrowserBlobStorage({ getStorage, key: blobKey });

  async function readExact({ assetId, assetVersionId } = {}) {
    const stored = await assets.get(required(assetId, "assetId"));
    if (!stored || stored.kind !== "Asset") throw new ExactMediaPreviewError("preview_asset_not_found", "The exact review Asset is not available in browser storage.");
    const asset = normalizeAsset(stored, {
      workspaceId: stored.workspaceId || ownerWorkspaceId,
      projectId: stored.projectId || null,
      campaignId: stored.campaignId || null,
      now: stored.updatedAt || stored.createdAt,
    });
    if (asset.workspaceId !== ownerWorkspaceId) throw new ExactMediaPreviewError("cross_workspace_preview", "Cross-workspace media preview is forbidden.");
    if (asset.assetVersionId !== required(assetVersionId, "assetVersionId")) {
      throw new ExactMediaPreviewError("stale_preview_asset", "Preview must resolve the exact AssetVersion bound to the review revision.");
    }
    if (asset.assetType !== "image") throw new ExactMediaPreviewError("unsupported_preview_media", "This exact review preview currently supports image Assets only.");
    if (!asset.storageRef?.blobId) throw new ExactMediaPreviewError("preview_blob_missing", "The exact browser Asset has no local blob reference.");
    const bytes = await blobs.get(asset.storageRef.blobId);
    if (!(bytes instanceof Uint8Array) || !bytes.byteLength) throw new ExactMediaPreviewError("preview_blob_missing", "The exact browser Asset bytes are unavailable.");
    return { asset, bytes, mimeType: asset.mimeType || "image/png" };
  }

  return { readExact };
}
