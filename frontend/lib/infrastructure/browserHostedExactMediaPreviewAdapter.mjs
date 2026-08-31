export class HostedExactMediaPreviewError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "HostedExactMediaPreviewError";
    this.code = code;
    this.details = { ...details };
  }
}

function required(value, field) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new HostedExactMediaPreviewError("missing_preview_field", `${field} is required.`, { field });
  if (/[/\\]|^[a-zA-Z]:/.test(normalized) || normalized.length > 320) {
    throw new HostedExactMediaPreviewError("invalid_preview_field", `${field} must be an opaque identifier.`, { field });
  }
  return normalized;
}

function safeEndpoint(value) {
  const endpoint = String(value || "/api/assets/preview").trim();
  if (!endpoint.startsWith("/") || endpoint.startsWith("//")) {
    throw new HostedExactMediaPreviewError("unsafe_preview_endpoint", "Hosted preview endpoint must be same-origin.");
  }
  return endpoint;
}

async function responseError(response) {
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  const code = String(payload?.code || `hosted_preview_http_${response.status || "error"}`);
  const message = String(payload?.error || "The exact hosted review media is unavailable.");
  return new HostedExactMediaPreviewError(code, message, { status: response.status || null });
}

export function createBrowserHostedExactMediaPreviewAdapter({
  fetchImpl = globalThis.fetch,
  endpoint = "/api/assets/preview",
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new HostedExactMediaPreviewError("preview_fetch_unavailable", "Hosted exact media preview requires fetch().");
  }
  const previewEndpoint = safeEndpoint(endpoint);

  async function readExact({ assetId, assetVersionId } = {}) {
    const requestedAssetId = required(assetId, "assetId");
    const requestedVersionId = required(assetVersionId, "assetVersionId");
    const query = new URLSearchParams({
      assetId: requestedAssetId,
      assetVersionId: requestedVersionId,
    });
    const response = await fetchImpl(`${previewEndpoint}?${query.toString()}`, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: { accept: "image/*" },
    });
    if (!response?.ok) throw await responseError(response);

    const resolvedAssetId = String(response.headers?.get?.("x-signalflow-asset-id") || "").trim();
    const resolvedVersionId = String(response.headers?.get?.("x-signalflow-asset-version") || "").trim();
    if (resolvedAssetId !== requestedAssetId || resolvedVersionId !== requestedVersionId) {
      throw new HostedExactMediaPreviewError(
        "hosted_preview_identity_mismatch",
        "Hosted preview response did not resolve the exact AssetVersion requested.",
      );
    }

    const mimeType = String(response.headers?.get?.("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!mimeType.startsWith("image/")) {
      throw new HostedExactMediaPreviewError("unsupported_preview_media", "Hosted exact review preview returned non-image media.");
    }

    const previewReceipt = String(response.headers?.get?.("x-signalflow-preview-receipt") || "").trim();
    if (!previewReceipt) {
      throw new HostedExactMediaPreviewError(
        "hosted_preview_receipt_missing",
        "Hosted exact review media did not include a signed visibility receipt.",
      );
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.byteLength) {
      throw new HostedExactMediaPreviewError("preview_blob_missing", "Hosted exact review media returned no bytes.");
    }

    return {
      asset: {
        kind: "Asset",
        assetId: requestedAssetId,
        assetVersionId: requestedVersionId,
        originalName: "Exact hosted review media",
        mimeType,
        assetType: "image",
        userMetadata: { altText: "Exact review media" },
      },
      bytes,
      mimeType,
      previewReceipt,
    };
  }

  return Object.freeze({ readExact });
}
