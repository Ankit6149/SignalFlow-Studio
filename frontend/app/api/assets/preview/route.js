import { requireOwnerAccess } from "../../_auth";
import { createProductionHostedExactAssetPreviewApplication } from "../../../../lib/server/hostedAssetPreviewDependencies.mjs";
import { createHostedMediaPreviewReceiptService } from "../../../../lib/server/hostedMediaPreviewReceipt.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, no-store, max-age=0",
      "x-content-type-options": "nosniff",
    },
  });
}

function statusFor(error) {
  if (Number.isInteger(error?.status) && error.status >= 400 && error.status <= 599) return error.status;
  const byCode = {
    asset_not_found: 404,
    asset_deleted: 410,
    stale_preview_asset: 409,
    unsupported_preview_media: 415,
    hosted_asset_preview_invalid: 400,
    hosted_asset_storage_unconfigured: 503,
    preview_receipt_secret_unconfigured: 503,
    signalflow_database_unconfigured: 503,
    signalflow_database_invalid: 503,
    blob_not_found: 503,
    asset_storage_missing: 503,
    hosted_asset_preview_bytes_invalid: 503,
    hosted_asset_preview_empty: 503,
  };
  return byCode[String(error?.code || "")] || 500;
}

function safeErrorMessage(error, status) {
  if (status === 404) return "The requested review Asset is unavailable.";
  if (status === 409) return "The requested AssetVersion is no longer the exact current version.";
  if (status === 410) return "The requested review Asset has been deleted.";
  if (status === 415) return "This exact preview endpoint supports image Assets only.";
  if (status === 400) return "The exact Asset preview request is invalid.";
  return "SignalFlow could not resolve the exact private review Asset.";
}

function publicError(error) {
  const status = statusFor(error);
  return json({
    ok: false,
    code: String(error?.code || "hosted_asset_preview_failed"),
    error: safeErrorMessage(error, status),
  }, status);
}

export async function GET(request) {
  const accessError = requireOwnerAccess(request);
  if (accessError) return accessError;

  try {
    const url = new URL(request.url);
    const application = createProductionHostedExactAssetPreviewApplication();
    const result = await application.readExactImage({
      assetId: url.searchParams.get("assetId"),
      assetVersionId: url.searchParams.get("assetVersionId"),
    });
    const receiptService = createHostedMediaPreviewReceiptService({
      signingSecret: process.env.SIGNALFLOW_MEDIA_PREVIEW_RECEIPT_SECRET,
    });
    const previewReceipt = receiptService.issue({
      workspaceId: result.workspaceId,
      assetId: result.asset.assetId,
      assetVersionId: result.asset.assetVersionId,
    });

    return new Response(result.bytes, {
      status: 200,
      headers: {
        "content-type": result.mimeType,
        "content-length": String(result.bytes.byteLength),
        "cache-control": "private, no-store, max-age=0",
        "x-content-type-options": "nosniff",
        "cross-origin-resource-policy": "same-origin",
        "referrer-policy": "no-referrer",
        "x-signalflow-asset-id": result.asset.assetId,
        "x-signalflow-asset-version": result.asset.assetVersionId,
        "x-signalflow-preview-receipt": previewReceipt,
      },
    });
  } catch (error) {
    return publicError(error);
  }
}
