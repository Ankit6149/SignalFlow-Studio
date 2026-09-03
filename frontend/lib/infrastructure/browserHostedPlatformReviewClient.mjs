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

function normalizeAutoReview(input = null) {
  if (!input) return null;
  return Object.freeze({
    status: input.status ? String(input.status) : null,
    platformVariantReviewId: input.platformVariantReviewId ? String(input.platformVariantReviewId) : null,
    failureCode: input.failureCode ? String(input.failureCode) : null,
  });
}

function normalizeReviewPreparation(input = null) {
  if (!input) return null;
  return Object.freeze({
    reviewedCount: Number.isInteger(input.reviewedCount) ? input.reviewedCount : 0,
    skippedCount: Number.isInteger(input.skippedCount) ? input.skippedCount : 0,
    deferredCount: Number.isInteger(input.deferredCount) ? input.deferredCount : 0,
    failed: Array.isArray(input.failed) ? input.failed.map((item) => Object.freeze({
      platformVariantId: item?.platformVariantId ? String(item.platformVariantId) : null,
      platformVariantRevisionId: item?.platformVariantRevisionId ? String(item.platformVariantRevisionId) : null,
      destination: item?.destination ? String(item.destination) : null,
      code: item?.code ? String(item.code) : "platform_review_failed",
    })) : [],
  });
}

function normalizeScreenshotResult(input = {}) {
  return Object.freeze({
    status: String(input.status || "").trim(),
    platformVariantId: input.platformVariantId ? String(input.platformVariantId) : null,
    platformVariantRevisionId: input.platformVariantRevisionId ? String(input.platformVariantRevisionId) : null,
    sourceRevisionId: input.sourceRevisionId ? String(input.sourceRevisionId) : null,
    boundRevision: input.boundRevision ? normalizePlatformVariantRevision(input.boundRevision) : null,
    captureRecipeId: input.captureRecipeId ? String(input.captureRecipeId) : null,
    captureRecipeVersion: Number.isInteger(input.captureRecipeVersion) ? input.captureRecipeVersion : null,
    checkpoint: input.checkpoint ? String(input.checkpoint) : null,
    captureJobId: input.captureJobId ? String(input.captureJobId) : null,
    durableJobId: input.durableJobId ? String(input.durableJobId) : null,
    durableJobStatus: input.durableJobStatus ? String(input.durableJobStatus) : null,
    sourceAsset: input.sourceAsset ? Object.freeze({ ...input.sourceAsset }) : null,
    qualityReview: input.qualityReview ? Object.freeze({ ...input.qualityReview }) : null,
    derivativePlan: input.derivativePlan ? Object.freeze({ ...input.derivativePlan }) : null,
    derivative: input.derivative ? Object.freeze({ ...input.derivative }) : null,
    autoReview: normalizeAutoReview(input.autoReview),
  });
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
      reviewPreparation: normalizeReviewPreparation(data.result?.reviewPreparation),
    });
  }

  async function generateVariant(platformVariantId) {
    const data = await request("POST", { action: "generate_variant", platformVariantId: required(platformVariantId, "platformVariantId") });
    return normalizePlatformVariantRevision(data.revision);
  }

  async function regenerateVariant(platformVariantId, { expectedCurrentRevisionId } = {}) {
    const data = await request("POST", {
      action: "regenerate_variant",
      platformVariantId: required(platformVariantId, "platformVariantId"),
      expectedCurrentRevisionId: required(expectedCurrentRevisionId, "expectedCurrentRevisionId"),
    });
    return normalizePlatformVariantRevision(data.revision);
  }

  async function editCurrentVariant(platformVariantId, { expectedCurrentRevisionId, content = "", segments = [], format = null } = {}) {
    const data = await request("POST", {
      action: "edit_revision",
      platformVariantId: required(platformVariantId, "platformVariantId"),
      expectedCurrentRevisionId: required(expectedCurrentRevisionId, "expectedCurrentRevisionId"),
      content: String(content ?? ""),
      segments: Array.isArray(segments) ? segments.map((item) => String(item ?? "")) : [],
      format: format ? String(format) : null,
    });
    return normalizePlatformVariantRevision(data.revision);
  }

  async function produceScreenshot(platformVariantId, {
    expectedCurrentRevisionId,
    aspectRatio,
    role = "primary_visual",
    captureRecipeId = null,
    captureRecipeVersion = null,
    checkpoint = null,
  } = {}) {
    const data = await request("POST", {
      action: "produce_screenshot",
      platformVariantId: required(platformVariantId, "platformVariantId"),
      expectedCurrentRevisionId: required(expectedCurrentRevisionId, "expectedCurrentRevisionId"),
      aspectRatio: required(aspectRatio, "aspectRatio"),
      role: required(role, "role"),
      captureRecipeId: captureRecipeId ? required(captureRecipeId, "captureRecipeId") : null,
      captureRecipeVersion: Number.isInteger(captureRecipeVersion) ? captureRecipeVersion : null,
      checkpoint: checkpoint ? required(checkpoint, "checkpoint") : null,
    });
    return normalizeScreenshotResult(data.result || {});
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
    editCurrentVariant,
    produceScreenshot,
    reviewRevision,
    approveRevision,
    rejectRevision,
    restoreRevision,
  });
}
