import { normalizeContentPiece, normalizePlatformVariant } from "../domain/contentPlanning.mjs";
import { normalizePlatformVariantRevision } from "../domain/platformVariantRevisions.mjs";
import { normalizePlatformVariantApproval, normalizePlatformVariantReview } from "../domain/platformVariantReviews.mjs";

function requireFetch(fetchImpl) {
  if (typeof fetchImpl !== "function") throw new TypeError("Hosted platform review client requires fetch().");
  return fetchImpl;
}

function required(value, field) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new TypeError(`Hosted platform review requires ${field}.`);
  return normalized;
}

async function parseResponse(response) {
  const raw = await response.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    const error = new Error("Hosted platform review API returned an unreadable response.");
    error.code = "hosted_platform_review_unreadable";
    error.status = response.status;
    throw error;
  }
  if (!response.ok || !data?.ok) {
    const error = new Error(data?.error || `Hosted platform review request failed (HTTP ${response.status}).`);
    error.code = data?.code || "hosted_platform_review_failed";
    error.status = response.status;
    throw error;
  }
  return data;
}

function normalizeReviewBundle(input) {
  if (!input) return null;
  return Object.freeze({
    variant: normalizePlatformVariant(input.variant),
    revision: input.revision ? normalizePlatformVariantRevision(input.revision) : null,
    review: input.review ? normalizePlatformVariantReview(input.review) : null,
    decision: input.decision ? normalizePlatformVariantApproval(input.decision) : null,
    approvalValid: Boolean(input.approvalValid),
    isCurrent: Boolean(input.isCurrent),
    planningCurrent: Boolean(input.planningCurrent),
  });
}

function normalizeGenerationEntry(input = {}) {
  return Object.freeze({
    variant: normalizePlatformVariant(input.variant),
    currentRevision: input.currentRevision ? normalizePlatformVariantRevision(input.currentRevision) : null,
    history: Array.isArray(input.history) ? input.history.map(normalizePlatformVariantRevision) : [],
    review: normalizeReviewBundle(input.review),
  });
}

function normalizeBundle(bundle = {}) {
  return Object.freeze({
    contentPiece: bundle.contentPiece ? normalizeContentPiece(bundle.contentPiece) : null,
    variants: Array.isArray(bundle.variants) ? bundle.variants.map(normalizeGenerationEntry) : [],
  });
}

function normalizeVisibleMedia(input = []) {
  if (!Array.isArray(input)) throw new TypeError("visibleMedia must be an array.");
  return input.map((item) => ({
    role: required(item?.role, "visibleMedia.role"),
    assetId: required(item?.assetId, "visibleMedia.assetId"),
    assetVersionId: required(item?.assetVersionId, "visibleMedia.assetVersionId"),
    previewReceipt: required(item?.previewReceipt, "visibleMedia.previewReceipt"),
  }));
}

export function createBrowserHostedPlatformReviewClient({ fetchImpl = globalThis.fetch } = {}) {
  const fetcher = requireFetch(fetchImpl);

  async function request(method, body = null, query = "") {
    const response = await fetcher(`/api/platform-review${query}`, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials: "same-origin",
      cache: "no-store",
    });
    return parseResponse(response);
  }

  async function getBundle(contentPieceId) {
    const id = required(contentPieceId, "contentPieceId");
    const data = await request("GET", null, `?contentPieceId=${encodeURIComponent(id)}`);
    return normalizeBundle(data.bundle || {});
  }

  async function generateReady(contentPieceId) {
    const data = await request("POST", { action: "generate_ready", contentPieceId: required(contentPieceId, "contentPieceId") });
    return Object.freeze({
      generated: Array.isArray(data.result?.generated) ? data.result.generated.map(normalizePlatformVariantRevision) : [],
      failed: Array.isArray(data.result?.failed) ? data.result.failed.map((item) => ({ ...item })) : [],
      bundle: normalizeBundle(data.result?.bundle || {}),
    });
  }

  async function generateVariant(platformVariantId) {
    const data = await request("POST", { action: "generate_variant", platformVariantId: required(platformVariantId, "platformVariantId") });
    return normalizePlatformVariantRevision(data.revision);
  }

  async function regenerateVariant(platformVariantId) {
    const data = await request("POST", { action: "regenerate_variant", platformVariantId: required(platformVariantId, "platformVariantId") });
    return normalizePlatformVariantRevision(data.revision);
  }

  async function reviewRevision(platformVariantId, platformVariantRevisionId, { expectedCurrentRevisionId, refresh = false } = {}) {
    const data = await request("POST", {
      action: "review_revision",
      platformVariantId: required(platformVariantId, "platformVariantId"),
      platformVariantRevisionId: required(platformVariantRevisionId, "platformVariantRevisionId"),
      expectedCurrentRevisionId: required(expectedCurrentRevisionId, "expectedCurrentRevisionId"),
      refresh: refresh === true,
    });
    return normalizePlatformVariantReview(data.review);
  }

  async function approveRevision(platformVariantId, platformVariantRevisionId, { expectedCurrentRevisionId, visibleMedia = [], note = "" } = {}) {
    const data = await request("POST", {
      action: "approve_revision",
      platformVariantId: required(platformVariantId, "platformVariantId"),
      platformVariantRevisionId: required(platformVariantRevisionId, "platformVariantRevisionId"),
      expectedCurrentRevisionId: required(expectedCurrentRevisionId, "expectedCurrentRevisionId"),
      visibleMedia: normalizeVisibleMedia(visibleMedia),
      note: String(note || "").trim(),
    });
    return normalizePlatformVariantApproval(data.approval);
  }

  async function rejectRevision(platformVariantId, platformVariantRevisionId, { expectedCurrentRevisionId, note = "" } = {}) {
    const data = await request("POST", {
      action: "reject_revision",
      platformVariantId: required(platformVariantId, "platformVariantId"),
      platformVariantRevisionId: required(platformVariantRevisionId, "platformVariantRevisionId"),
      expectedCurrentRevisionId: required(expectedCurrentRevisionId, "expectedCurrentRevisionId"),
      note: String(note || "").trim(),
    });
    return normalizePlatformVariantApproval(data.approval);
  }

  async function restoreRevision(platformVariantId, platformVariantRevisionId, { expectedCurrentRevisionId } = {}) {
    const data = await request("POST", {
      action: "restore_revision",
      platformVariantId: required(platformVariantId, "platformVariantId"),
      platformVariantRevisionId: required(platformVariantRevisionId, "platformVariantRevisionId"),
      expectedCurrentRevisionId: required(expectedCurrentRevisionId, "expectedCurrentRevisionId"),
    });
    return normalizePlatformVariantRevision(data.revision);
  }

  return Object.freeze({
    getBundle,
    generateReady,
    generateVariant,
    regenerateVariant,
    reviewRevision,
    approveRevision,
    rejectRevision,
    restoreRevision,
  });
}
