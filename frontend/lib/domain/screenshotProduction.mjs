import { createDomainRecord, parseDomainRecord, portableClone } from "./contracts.mjs";

export const SCREENSHOT_QUALITY_STATES = Object.freeze({
  READY: "ready",
  NEEDS_REVIEW: "needs_review",
  BLOCKED: "blocked",
});

export const QUALITY_CHECK_STATES = Object.freeze({
  PASSED: "passed",
  FAILED: "failed",
  UNCERTAIN: "uncertain",
  NOT_CHECKED: "not_checked",
});

export const DERIVATIVE_PLAN_STATES = Object.freeze({
  READY: "ready",
  NEEDS_REVIEW: "needs_review",
  BLOCKED: "blocked",
});

export const DERIVATIVE_VARIANT_STATES = Object.freeze({
  READY_FOR_RENDER: "ready_for_render",
  NEEDS_REVIEW: "needs_review",
  NEEDS_ALTERNATE_LAYOUT: "needs_alternate_layout",
  BLOCKED: "blocked",
  RENDERED: "rendered",
});

export const SCREENSHOT_ASPECT_TARGETS = Object.freeze({
  "16:9": Object.freeze({ width: 1600, height: 900 }),
  "9:16": Object.freeze({ width: 1080, height: 1920 }),
  "1:1": Object.freeze({ width: 1080, height: 1080 }),
  "4:5": Object.freeze({ width: 1080, height: 1350 }),
});

const QUALITY_STATE_VALUES = new Set(Object.values(SCREENSHOT_QUALITY_STATES));
const CHECK_STATE_VALUES = new Set(Object.values(QUALITY_CHECK_STATES));
const PLAN_STATE_VALUES = new Set(Object.values(DERIVATIVE_PLAN_STATES));
const VARIANT_STATE_VALUES = new Set(Object.values(DERIVATIVE_VARIANT_STATES));
const ASPECT_VALUES = new Set(Object.keys(SCREENSHOT_ASPECT_TARGETS));
const SAFE_CODE = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

export class ScreenshotProductionError extends TypeError {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ScreenshotProductionError";
    this.code = code;
    this.details = portableClone(details);
  }
}

function text(value, fallback = "", maxLength = 1600) {
  const normalized = String(value ?? "").replace(/\r\n?/g, "\n").trim();
  const resolved = normalized || fallback;
  if (resolved.length > maxLength) throw new ScreenshotProductionError("screenshot_text_too_long", `Screenshot field exceeds ${maxLength} characters.`);
  return resolved;
}

function opaqueId(value, field, required = true) {
  const normalized = text(value, "", 240);
  if (!normalized && !required) return null;
  if (!normalized) throw new ScreenshotProductionError("missing_screenshot_id", `${field} is required.`, { field });
  if (/[/\\]|^[a-zA-Z]:/.test(normalized)) throw new ScreenshotProductionError("non_opaque_screenshot_id", `${field} must be an opaque ID.`, { field });
  return normalized;
}

function timestamp(value, fallback = null, field = "timestamp") {
  const candidate = value || fallback;
  const parsed = Date.parse(candidate || "");
  if (!Number.isFinite(parsed)) throw new ScreenshotProductionError("invalid_screenshot_timestamp", `${field} must be an ISO timestamp.`, { field });
  return new Date(parsed).toISOString();
}

function enumValue(value, allowed, fallback, field) {
  const normalized = text(value, fallback, 100).toLowerCase();
  if (!allowed.has(normalized)) throw new ScreenshotProductionError("invalid_screenshot_enum", `${field} contains unsupported value: ${normalized}.`, { field, value: normalized });
  return normalized;
}

function safeCode(value, field) {
  const normalized = text(value, "", 120).toLowerCase();
  if (!SAFE_CODE.test(normalized)) throw new ScreenshotProductionError("invalid_screenshot_code", `${field} must be a stable lowercase identifier.`, { field });
  return normalized;
}

function uniqueCodes(values, field, maxItems = 50) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((value) => safeCode(value, field)))].slice(0, maxItems);
}

function positiveInteger(value, field) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new ScreenshotProductionError("invalid_screenshot_dimension", `${field} must be a positive number.`, { field });
  return Math.round(parsed);
}

function normalizeDimensions(value, field = "dimensions") {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ScreenshotProductionError("invalid_screenshot_dimensions", `${field} is required.`, { field });
  return {
    width: positiveInteger(value.width, `${field}.width`),
    height: positiveInteger(value.height, `${field}.height`),
  };
}

function normalizeRect(value, field, required = false) {
  if (!value) {
    if (required) throw new ScreenshotProductionError("missing_screenshot_region", `${field} is required.`, { field });
    return null;
  }
  if (typeof value !== "object" || Array.isArray(value)) throw new ScreenshotProductionError("invalid_screenshot_region", `${field} must be a normalized rectangle.`, { field });
  const rect = {
    x: Number(value.x),
    y: Number(value.y),
    width: Number(value.width),
    height: Number(value.height),
  };
  for (const [key, number] of Object.entries(rect)) {
    if (!Number.isFinite(number) || number < 0 || number > 1) throw new ScreenshotProductionError("invalid_screenshot_region", `${field}.${key} must be between 0 and 1.`, { field, key });
  }
  if (rect.width <= 0 || rect.height <= 0 || rect.x + rect.width > 1.000001 || rect.y + rect.height > 1.000001) {
    throw new ScreenshotProductionError("invalid_screenshot_region", `${field} must fit inside the source image.`, { field });
  }
  return portableClone(rect);
}

function normalizeCheck(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { state: QUALITY_CHECK_STATES.NOT_CHECKED, issueCodes: [] };
  }
  return portableClone({
    state: enumValue(value.state, CHECK_STATE_VALUES, QUALITY_CHECK_STATES.NOT_CHECKED, `${field}.state`),
    issueCodes: uniqueCodes(value.issueCodes, `${field}.issueCodes`),
    confidence: Number.isFinite(Number(value.confidence)) ? Math.max(0, Math.min(1, Number(value.confidence))) : null,
  });
}

function deriveQualityState(checks) {
  if ([checks.decode, checks.privacy].some((check) => check.state === QUALITY_CHECK_STATES.FAILED)) return SCREENSHOT_QUALITY_STATES.BLOCKED;
  if (Object.values(checks).some((check) => [QUALITY_CHECK_STATES.FAILED, QUALITY_CHECK_STATES.UNCERTAIN, QUALITY_CHECK_STATES.NOT_CHECKED].includes(check.state))) {
    return SCREENSHOT_QUALITY_STATES.NEEDS_REVIEW;
  }
  return SCREENSHOT_QUALITY_STATES.READY;
}

export function normalizeScreenshotQualityReview(input = {}) {
  const parsed = input?.kind === "ScreenshotQualityReview" && input?.schemaVersion
    ? parseDomainRecord(input, "ScreenshotQualityReview")
    : input;
  const createdAt = timestamp(parsed.createdAt, null, "ScreenshotQualityReview.createdAt");
  const checks = {
    decode: normalizeCheck(parsed.checks?.decode, "ScreenshotQualityReview.checks.decode"),
    blank: normalizeCheck(parsed.checks?.blank, "ScreenshotQualityReview.checks.blank"),
    errorState: normalizeCheck(parsed.checks?.errorState, "ScreenshotQualityReview.checks.errorState"),
    loadingState: normalizeCheck(parsed.checks?.loadingState, "ScreenshotQualityReview.checks.loadingState"),
    subjectVisible: normalizeCheck(parsed.checks?.subjectVisible, "ScreenshotQualityReview.checks.subjectVisible"),
    privacy: normalizeCheck(parsed.checks?.privacy, "ScreenshotQualityReview.checks.privacy"),
    legibility: normalizeCheck(parsed.checks?.legibility, "ScreenshotQualityReview.checks.legibility"),
  };
  const derivedState = deriveQualityState(checks);
  const status = enumValue(parsed.status, QUALITY_STATE_VALUES, derivedState, "ScreenshotQualityReview.status");
  if (status === SCREENSHOT_QUALITY_STATES.READY && derivedState !== SCREENSHOT_QUALITY_STATES.READY) {
    throw new ScreenshotProductionError("unsafe_screenshot_quality_override", "A screenshot with failed or uncertain checks cannot be marked ready.");
  }
  return createDomainRecord("ScreenshotQualityReview", {
    screenshotQualityReviewId: opaqueId(parsed.screenshotQualityReviewId, "ScreenshotQualityReview.screenshotQualityReviewId"),
    workspaceId: opaqueId(parsed.workspaceId, "ScreenshotQualityReview.workspaceId"),
    assetId: opaqueId(parsed.assetId, "ScreenshotQualityReview.assetId"),
    assetVersionId: opaqueId(parsed.assetVersionId, "ScreenshotQualityReview.assetVersionId"),
    sourceDimensions: normalizeDimensions(parsed.sourceDimensions, "ScreenshotQualityReview.sourceDimensions"),
    status,
    checks,
    issueCodes: uniqueCodes(parsed.issueCodes || Object.values(checks).flatMap((check) => check.issueCodes), "ScreenshotQualityReview.issueCodes", 100),
    evaluator: {
      name: safeCode(parsed.evaluator?.name || "signalflow_screenshot_quality", "ScreenshotQualityReview.evaluator.name"),
      version: text(parsed.evaluator?.version, "1", 100),
    },
    createdAt,
    updatedAt: timestamp(parsed.updatedAt, createdAt, "ScreenshotQualityReview.updatedAt"),
  });
}

export function createScreenshotQualityReview({
  screenshotQualityReviewId,
  workspaceId,
  asset,
  observations = {},
  evaluator = null,
  createdAt,
} = {}) {
  if (!asset || asset.kind !== "Asset" || asset.assetType !== "image") {
    throw new ScreenshotProductionError("invalid_screenshot_asset", "Screenshot quality review requires a canonical image Asset.");
  }
  if (asset.workspaceId !== workspaceId) throw new ScreenshotProductionError("cross_workspace_screenshot", "Screenshot quality review cannot inspect another workspace's Asset.");
  const check = (state, issueCode = null, confidence = null) => ({ state, issueCodes: issueCode ? [issueCode] : [], confidence });
  const decode = observations.decodeOk === false
    ? check(QUALITY_CHECK_STATES.FAILED, "image_decode_failed", 1)
    : observations.decodeOk === true ? check(QUALITY_CHECK_STATES.PASSED, null, 1) : check(QUALITY_CHECK_STATES.UNCERTAIN, "image_decode_unverified");
  const blank = observations.blankLike === true
    ? check(QUALITY_CHECK_STATES.FAILED, "blank_or_uniform_capture", observations.blankConfidence)
    : observations.blankLike === false ? check(QUALITY_CHECK_STATES.PASSED, null, observations.blankConfidence) : check(QUALITY_CHECK_STATES.UNCERTAIN, "blank_state_unverified");
  const errorState = observations.errorDetected === true
    ? check(QUALITY_CHECK_STATES.FAILED, "error_state_visible", observations.errorConfidence)
    : observations.errorDetected === false ? check(QUALITY_CHECK_STATES.PASSED, null, observations.errorConfidence) : check(QUALITY_CHECK_STATES.UNCERTAIN, "error_state_unverified");
  const loadingState = observations.loadingDetected === true
    ? check(QUALITY_CHECK_STATES.FAILED, "loading_state_visible", observations.loadingConfidence)
    : observations.loadingDetected === false ? check(QUALITY_CHECK_STATES.PASSED, null, observations.loadingConfidence) : check(QUALITY_CHECK_STATES.UNCERTAIN, "loading_state_unverified");
  const subjectVisible = observations.subjectVisible === false
    ? check(QUALITY_CHECK_STATES.FAILED, "intended_subject_missing", observations.subjectConfidence)
    : observations.subjectVisible === true ? check(QUALITY_CHECK_STATES.PASSED, null, observations.subjectConfidence) : check(QUALITY_CHECK_STATES.UNCERTAIN, "subject_visibility_unverified");
  const privacy = observations.privacyState === "blocked"
    ? check(QUALITY_CHECK_STATES.FAILED, "privacy_review_blocked", 1)
    : observations.privacyState === "passed" ? check(QUALITY_CHECK_STATES.PASSED, null, 1) : check(QUALITY_CHECK_STATES.UNCERTAIN, "privacy_review_unverified");
  const legibility = observations.legible === false
    ? check(QUALITY_CHECK_STATES.FAILED, "target_legibility_failed", observations.legibilityConfidence)
    : observations.legible === true ? check(QUALITY_CHECK_STATES.PASSED, null, observations.legibilityConfidence) : check(QUALITY_CHECK_STATES.UNCERTAIN, "target_legibility_unverified");
  return normalizeScreenshotQualityReview({
    screenshotQualityReviewId,
    workspaceId,
    assetId: asset.assetId,
    assetVersionId: asset.assetVersionId,
    sourceDimensions: asset.dimensions,
    checks: { decode, blank, errorState, loadingState, subjectVisible, privacy, legibility },
    evaluator,
    createdAt,
    updatedAt: createdAt,
  });
}

function ratioOf(aspectRatio) {
  const [width, height] = aspectRatio.split(":").map(Number);
  return width / height;
}

function regionBounds(regions) {
  if (!regions.length) return null;
  const minX = Math.min(...regions.map((region) => region.x));
  const minY = Math.min(...regions.map((region) => region.y));
  const maxX = Math.max(...regions.map((region) => region.x + region.width));
  const maxY = Math.max(...regions.map((region) => region.y + region.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function computeCrop({ dimensions, aspectRatio, focalRegion, evidenceRegions }) {
  const sourceWidth = dimensions.width;
  const sourceHeight = dimensions.height;
  const targetRatio = ratioOf(aspectRatio);
  const sourceRatio = sourceWidth / sourceHeight;
  let cropWidth = sourceWidth;
  let cropHeight = sourceHeight;
  if (sourceRatio > targetRatio) cropWidth = sourceHeight * targetRatio;
  else if (sourceRatio < targetRatio) cropHeight = sourceWidth / targetRatio;

  const evidenceBounds = regionBounds(evidenceRegions);
  if (evidenceBounds) {
    const evidenceWidth = evidenceBounds.width * sourceWidth;
    const evidenceHeight = evidenceBounds.height * sourceHeight;
    if (evidenceWidth > cropWidth + 0.5 || evidenceHeight > cropHeight + 0.5) return null;
  }

  const anchor = focalRegion || evidenceBounds || { x: 0.5, y: 0.5, width: 0, height: 0 };
  let x = (anchor.x + anchor.width / 2) * sourceWidth - cropWidth / 2;
  let y = (anchor.y + anchor.height / 2) * sourceHeight - cropHeight / 2;

  if (evidenceBounds) {
    const left = evidenceBounds.x * sourceWidth;
    const right = (evidenceBounds.x + evidenceBounds.width) * sourceWidth;
    const top = evidenceBounds.y * sourceHeight;
    const bottom = (evidenceBounds.y + evidenceBounds.height) * sourceHeight;
    x = clamp(x, right - cropWidth, left);
    y = clamp(y, bottom - cropHeight, top);
  }
  x = clamp(x, 0, sourceWidth - cropWidth);
  y = clamp(y, 0, sourceHeight - cropHeight);
  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.max(1, Math.round(cropWidth)),
    height: Math.max(1, Math.round(cropHeight)),
  };
}

function normalizeVariant(value, index) {
  const aspectRatio = enumValue(value.aspectRatio, ASPECT_VALUES, "1:1", `ImageDerivativePlan.variants[${index}].aspectRatio`);
  return portableClone({
    variantId: opaqueId(value.variantId, `ImageDerivativePlan.variants[${index}].variantId`),
    aspectRatio,
    targetDimensions: normalizeDimensions(value.targetDimensions || SCREENSHOT_ASPECT_TARGETS[aspectRatio], `ImageDerivativePlan.variants[${index}].targetDimensions`),
    crop: value.crop ? {
      x: Math.max(0, Math.round(Number(value.crop.x || 0))),
      y: Math.max(0, Math.round(Number(value.crop.y || 0))),
      width: positiveInteger(value.crop.width, `ImageDerivativePlan.variants[${index}].crop.width`),
      height: positiveInteger(value.crop.height, `ImageDerivativePlan.variants[${index}].crop.height`),
    } : null,
    status: enumValue(value.status, VARIANT_STATE_VALUES, DERIVATIVE_VARIANT_STATES.READY_FOR_RENDER, `ImageDerivativePlan.variants[${index}].status`),
    issueCodes: uniqueCodes(value.issueCodes, `ImageDerivativePlan.variants[${index}].issueCodes`),
    outputAssetId: opaqueId(value.outputAssetId, `ImageDerivativePlan.variants[${index}].outputAssetId`, false),
    outputAssetVersionId: opaqueId(value.outputAssetVersionId, `ImageDerivativePlan.variants[${index}].outputAssetVersionId`, false),
  });
}

export function normalizeImageDerivativePlan(input = {}) {
  const parsed = input?.kind === "ImageDerivativePlan" && input?.schemaVersion
    ? parseDomainRecord(input, "ImageDerivativePlan")
    : input;
  const createdAt = timestamp(parsed.createdAt, null, "ImageDerivativePlan.createdAt");
  const variants = Array.isArray(parsed.variants) ? parsed.variants.slice(0, 8).map(normalizeVariant) : [];
  if (!variants.length) throw new ScreenshotProductionError("missing_derivative_variants", "ImageDerivativePlan requires at least one output variant.");
  return createDomainRecord("ImageDerivativePlan", {
    imageDerivativePlanId: opaqueId(parsed.imageDerivativePlanId, "ImageDerivativePlan.imageDerivativePlanId"),
    workspaceId: opaqueId(parsed.workspaceId, "ImageDerivativePlan.workspaceId"),
    sourceAssetId: opaqueId(parsed.sourceAssetId, "ImageDerivativePlan.sourceAssetId"),
    sourceAssetVersionId: opaqueId(parsed.sourceAssetVersionId, "ImageDerivativePlan.sourceAssetVersionId"),
    screenshotQualityReviewId: opaqueId(parsed.screenshotQualityReviewId, "ImageDerivativePlan.screenshotQualityReviewId"),
    sourceDimensions: normalizeDimensions(parsed.sourceDimensions, "ImageDerivativePlan.sourceDimensions"),
    focalRegion: normalizeRect(parsed.focalRegion, "ImageDerivativePlan.focalRegion", false),
    evidenceRegions: Array.isArray(parsed.evidenceRegions) ? parsed.evidenceRegions.slice(0, 20).map((region, index) => normalizeRect(region, `ImageDerivativePlan.evidenceRegions[${index}]`, true)) : [],
    variants,
    status: enumValue(parsed.status, PLAN_STATE_VALUES, DERIVATIVE_PLAN_STATES.NEEDS_REVIEW, "ImageDerivativePlan.status"),
    createdAt,
    updatedAt: timestamp(parsed.updatedAt, createdAt, "ImageDerivativePlan.updatedAt"),
  });
}

export function planScreenshotDerivatives({
  imageDerivativePlanId,
  workspaceId,
  sourceAsset,
  qualityReview,
  aspectRatios = ["16:9", "9:16", "1:1", "4:5"],
  focalRegion = null,
  evidenceRegions = [],
  idFactory = (aspectRatio) => `derivative-${aspectRatio.replace(":", "x")}`,
  createdAt,
} = {}) {
  const review = normalizeScreenshotQualityReview(qualityReview);
  if (!sourceAsset || sourceAsset.kind !== "Asset" || sourceAsset.assetType !== "image") throw new ScreenshotProductionError("invalid_screenshot_asset", "Derivative planning requires a canonical image Asset.");
  if (sourceAsset.workspaceId !== workspaceId || review.workspaceId !== workspaceId) throw new ScreenshotProductionError("cross_workspace_screenshot", "Derivative planning cannot use another workspace's records.");
  if (review.assetId !== sourceAsset.assetId || review.assetVersionId !== sourceAsset.assetVersionId) throw new ScreenshotProductionError("stale_screenshot_quality_review", "Derivative planning requires a quality review for the exact source Asset version.");
  const sourceDimensions = normalizeDimensions(sourceAsset.dimensions, "sourceAsset.dimensions");
  const normalizedFocal = normalizeRect(focalRegion, "focalRegion", false);
  const normalizedEvidence = Array.isArray(evidenceRegions) ? evidenceRegions.slice(0, 20).map((region, index) => normalizeRect(region, `evidenceRegions[${index}]`, true)) : [];
  const requested = [...new Set(aspectRatios.map((ratio) => enumValue(ratio, ASPECT_VALUES, "1:1", "aspectRatio")))];
  const variants = requested.map((aspectRatio) => {
    const crop = computeCrop({ dimensions: sourceDimensions, aspectRatio, focalRegion: normalizedFocal, evidenceRegions: normalizedEvidence });
    if (!crop) {
      return {
        variantId: idFactory(aspectRatio),
        aspectRatio,
        targetDimensions: SCREENSHOT_ASPECT_TARGETS[aspectRatio],
        crop: null,
        status: DERIVATIVE_VARIANT_STATES.NEEDS_ALTERNATE_LAYOUT,
        issueCodes: ["required_evidence_would_be_cropped"],
      };
    }
    const target = SCREENSHOT_ASPECT_TARGETS[aspectRatio];
    const upscaleFactor = Math.max(target.width / crop.width, target.height / crop.height);
    const issueCodes = upscaleFactor > 2 ? ["large_upscale_required"] : [];
    const state = review.status === SCREENSHOT_QUALITY_STATES.BLOCKED
      ? DERIVATIVE_VARIANT_STATES.BLOCKED
      : review.status === SCREENSHOT_QUALITY_STATES.NEEDS_REVIEW || issueCodes.length
        ? DERIVATIVE_VARIANT_STATES.NEEDS_REVIEW
        : DERIVATIVE_VARIANT_STATES.READY_FOR_RENDER;
    return {
      variantId: idFactory(aspectRatio),
      aspectRatio,
      targetDimensions: target,
      crop,
      status: state,
      issueCodes: review.status === SCREENSHOT_QUALITY_STATES.BLOCKED ? ["source_quality_blocked"] : issueCodes,
    };
  });
  const status = review.status === SCREENSHOT_QUALITY_STATES.BLOCKED
    ? DERIVATIVE_PLAN_STATES.BLOCKED
    : review.status === SCREENSHOT_QUALITY_STATES.NEEDS_REVIEW || variants.some((variant) => variant.status !== DERIVATIVE_VARIANT_STATES.READY_FOR_RENDER)
      ? DERIVATIVE_PLAN_STATES.NEEDS_REVIEW
      : DERIVATIVE_PLAN_STATES.READY;
  return normalizeImageDerivativePlan({
    imageDerivativePlanId,
    workspaceId,
    sourceAssetId: sourceAsset.assetId,
    sourceAssetVersionId: sourceAsset.assetVersionId,
    screenshotQualityReviewId: review.screenshotQualityReviewId,
    sourceDimensions,
    focalRegion: normalizedFocal,
    evidenceRegions: normalizedEvidence,
    variants,
    status,
    createdAt,
    updatedAt: createdAt,
  });
}
