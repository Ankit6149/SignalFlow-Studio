import { createDomainRecord, parseDomainRecord, portableClone } from "./contracts.mjs";
import { normalizePlatformVariant, VARIANT_STATUSES } from "./contentPlanning.mjs";

export const PLATFORM_VARIANT_REVISION_SCHEMA_VERSION = 1;
export const PLATFORM_VARIANT_REVISION_STATUS = "review";
export const PLATFORM_VARIANT_REVISION_ORIGINS = Object.freeze({
  GENERATED: "generated",
  EDITED: "edited",
  AI_REVISED: "ai_revised",
  MEDIA_REBOUND: "media_rebound",
});

export const PLATFORM_VARIANT_MEDIA_ROLES = Object.freeze({
  PRIMARY_VISUAL: "primary_visual",
  SECONDARY_VISUAL: "secondary_visual",
  EVIDENCE_VISUAL: "evidence_visual",
  THUMBNAIL: "thumbnail",
});

export const PLATFORM_VARIANT_MEDIA_SOURCES = Object.freeze({
  ASSET: "asset",
  SCREENSHOT_DERIVATIVE: "screenshot_derivative",
});

const DESTINATIONS = new Set(["linkedin", "x"]);
const ROUTE_KINDS = new Set(["remote", "local"]);
const ORIGIN_VALUES = new Set(Object.values(PLATFORM_VARIANT_REVISION_ORIGINS));
const MEDIA_ROLE_VALUES = new Set(Object.values(PLATFORM_VARIANT_MEDIA_ROLES));
const MEDIA_SOURCE_VALUES = new Set(Object.values(PLATFORM_VARIANT_MEDIA_SOURCES));

function text(value, fallback = "", maxLength = 12000) {
  const normalized = String(value ?? "").replace(/\r\n?/g, "\n").trim();
  const resolved = normalized || fallback;
  if (resolved.length > maxLength) throw new TypeError(`PlatformVariantRevision text exceeds ${maxLength} characters.`);
  return resolved;
}

function optionalText(value, maxLength = 12000) {
  return text(value, "", maxLength) || null;
}

function id(value, field, required = true) {
  const normalized = text(value, "", 240);
  if (!normalized && !required) return null;
  if (!normalized) throw new TypeError(`${field} is required.`);
  if (/[/\\]|^[a-zA-Z]:/.test(normalized)) throw new TypeError(`${field} must be an opaque ID.`);
  return normalized;
}

function positiveInteger(value, field) {
  if (!Number.isInteger(value) || value < 1) throw new TypeError(`${field} must be a positive integer.`);
  return value;
}

function timestamp(value, field) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new TypeError(`${field} must be an ISO timestamp.`);
  return new Date(parsed).toISOString();
}

function normalizeDestination(value) {
  const destination = text(value, "", 40).toLowerCase();
  if (!DESTINATIONS.has(destination)) throw new TypeError(`Unsupported PlatformVariantRevision destination: ${destination || "missing"}.`);
  return destination;
}

function normalizeSegments(value, destination, format) {
  const items = Array.isArray(value) ? value : [];
  const segments = items.map((item) => text(item, "", 12000)).filter(Boolean).slice(0, 8);
  if (destination === "x" && format === "thread") {
    if (segments.length < 2) throw new TypeError("X thread revisions require at least two segments.");
    if (segments.some((segment) => segment.length > 280)) throw new TypeError("X thread segments must be 280 characters or fewer.");
  }
  return segments;
}

function normalizeFormat(value, destination) {
  const format = text(value, "single_post", 80).toLowerCase();
  const allowed = destination === "x" ? new Set(["single_post", "thread"]) : new Set(["single_post"]);
  if (!allowed.has(format)) throw new TypeError(`Unsupported ${destination} revision format: ${format}.`);
  return format;
}

function normalizeGenerationProvenance(value = null) {
  if (!value) return null;
  if (typeof value !== "object" || Array.isArray(value)) throw new TypeError("PlatformVariantRevision.generationProvenance must be an object.");
  const routeKind = text(value.routeKind, "", 40).toLowerCase();
  if (!ROUTE_KINDS.has(routeKind)) throw new TypeError("PlatformVariantRevision generation route must be remote or local.");
  return portableClone({
    taskId: id(value.taskId, "PlatformVariantRevision.generationProvenance.taskId"),
    provider: text(value.provider, "", 80),
    model: text(value.model, "", 240),
    routeKind,
    promptVersion: text(value.promptVersion, "platform_variant_v1", 80),
    generatedAt: timestamp(value.generatedAt, "PlatformVariantRevision.generationProvenance.generatedAt"),
  });
}

function normalizeStyleMemoryRefs(value = []) {
  const refs = [];
  const seen = new Set();
  for (const item of Array.isArray(value) ? value : []) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const styleMemoryId = id(item.styleMemoryId, "PlatformVariantRevision.styleMemoryRefs.styleMemoryId");
    if (seen.has(styleMemoryId)) continue;
    seen.add(styleMemoryId);
    refs.push({
      styleMemoryId,
      updatedAt: timestamp(item.updatedAt, "PlatformVariantRevision.styleMemoryRefs.updatedAt"),
    });
    if (refs.length >= 20) break;
  }
  return portableClone(refs);
}

function normalizeEditProvenance(value = null) {
  if (!value) return null;
  if (typeof value !== "object" || Array.isArray(value)) throw new TypeError("PlatformVariantRevision.editProvenance must be an object.");
  return portableClone({
    editedBy: id(value.editedBy, "PlatformVariantRevision.editProvenance.editedBy"),
    editedAt: timestamp(value.editedAt, "PlatformVariantRevision.editProvenance.editedAt"),
    restoredFromRevisionId: id(value.restoredFromRevisionId, "PlatformVariantRevision.editProvenance.restoredFromRevisionId", false),
  });
}

function normalizeMediaChangeProvenance(value = null) {
  if (!value) return null;
  if (typeof value !== "object" || Array.isArray(value)) throw new TypeError("PlatformVariantRevision.mediaChangeProvenance must be an object.");
  return portableClone({
    changedBy: id(value.changedBy, "PlatformVariantRevision.mediaChangeProvenance.changedBy"),
    changedAt: timestamp(value.changedAt, "PlatformVariantRevision.mediaChangeProvenance.changedAt"),
    reason: optionalText(value.reason, 1000),
  });
}

function normalizeMediaBinding(value, index) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`PlatformVariantRevision.mediaBindings[${index}] must be an object.`);
  }
  const role = text(value.role, PLATFORM_VARIANT_MEDIA_ROLES.PRIMARY_VISUAL, 80).toLowerCase();
  if (!MEDIA_ROLE_VALUES.has(role)) throw new TypeError(`Unsupported PlatformVariantRevision media role: ${role}.`);
  const source = text(value.source, PLATFORM_VARIANT_MEDIA_SOURCES.ASSET, 80).toLowerCase();
  if (!MEDIA_SOURCE_VALUES.has(source)) throw new TypeError(`Unsupported PlatformVariantRevision media source: ${source}.`);
  const screenshotQualityReviewId = id(value.screenshotQualityReviewId, `PlatformVariantRevision.mediaBindings[${index}].screenshotQualityReviewId`, false);
  const imageDerivativePlanId = id(value.imageDerivativePlanId, `PlatformVariantRevision.mediaBindings[${index}].imageDerivativePlanId`, false);
  const imageDerivativeVariantId = id(value.imageDerivativeVariantId, `PlatformVariantRevision.mediaBindings[${index}].imageDerivativeVariantId`, false);
  if (source === PLATFORM_VARIANT_MEDIA_SOURCES.SCREENSHOT_DERIVATIVE
    && (!screenshotQualityReviewId || !imageDerivativePlanId || !imageDerivativeVariantId)) {
    throw new TypeError("Screenshot derivative media bindings require exact quality-review, derivative-plan, and derivative-variant IDs.");
  }
  return {
    role,
    source,
    assetId: id(value.assetId, `PlatformVariantRevision.mediaBindings[${index}].assetId`),
    assetVersionId: id(value.assetVersionId, `PlatformVariantRevision.mediaBindings[${index}].assetVersionId`),
    screenshotQualityReviewId,
    imageDerivativePlanId,
    imageDerivativeVariantId,
  };
}

export function normalizePlatformVariantMediaBindings(value = []) {
  const items = Array.isArray(value) ? value.slice(0, 4) : [];
  const normalized = items.map(normalizeMediaBinding);
  const roles = new Set();
  for (const binding of normalized) {
    if (roles.has(binding.role)) throw new TypeError(`PlatformVariantRevision media role ${binding.role} may be bound only once.`);
    roles.add(binding.role);
  }
  normalized.sort((left, right) => left.role.localeCompare(right.role) || left.assetId.localeCompare(right.assetId));
  return portableClone(normalized);
}

export function normalizePlatformVariantRevision(input = {}) {
  const parsed = input?.kind === "PlatformVariantRevision" && input?.schemaVersion
    ? parseDomainRecord(input, "PlatformVariantRevision")
    : input;
  const destination = normalizeDestination(parsed.destination);
  const format = normalizeFormat(parsed.format, destination);
  const segments = normalizeSegments(parsed.segments, destination, format);
  let content = text(parsed.content, "", 12000);
  if (destination === "x" && format === "thread") content = segments.join("\n\n");
  if (!content) throw new TypeError("PlatformVariantRevision.content is required.");
  if (destination === "x" && format === "single_post" && content.length > 280) {
    throw new TypeError("X single-post revisions must be 280 characters or fewer.");
  }
  const origin = text(parsed.origin, PLATFORM_VARIANT_REVISION_ORIGINS.GENERATED, 40).toLowerCase();
  if (!ORIGIN_VALUES.has(origin)) throw new TypeError(`Unsupported PlatformVariantRevision origin: ${origin}.`);
  const generationProvenance = normalizeGenerationProvenance(parsed.generationProvenance);
  const editProvenance = normalizeEditProvenance(parsed.editProvenance);
  const mediaChangeProvenance = normalizeMediaChangeProvenance(parsed.mediaChangeProvenance);
  const parentRevisionId = id(parsed.parentRevisionId, "PlatformVariantRevision.parentRevisionId", false);
  const changeRequest = optionalText(parsed.changeRequest, 2000);
  const mediaBindings = normalizePlatformVariantMediaBindings(parsed.mediaBindings);
  if (origin === PLATFORM_VARIANT_REVISION_ORIGINS.GENERATED && !generationProvenance) {
    throw new TypeError("Generated PlatformVariantRevision requires generationProvenance.");
  }
  if (origin === PLATFORM_VARIANT_REVISION_ORIGINS.EDITED && (!editProvenance || !parentRevisionId)) {
    throw new TypeError("Edited PlatformVariantRevision requires parentRevisionId and editProvenance.");
  }
  if (origin === PLATFORM_VARIANT_REVISION_ORIGINS.AI_REVISED && (!generationProvenance || !parentRevisionId || !changeRequest)) {
    throw new TypeError("AI-revised PlatformVariantRevision requires parentRevisionId, changeRequest, and generationProvenance.");
  }
  if (origin === PLATFORM_VARIANT_REVISION_ORIGINS.MEDIA_REBOUND && (!mediaChangeProvenance || !parentRevisionId)) {
    throw new TypeError("Media-rebound PlatformVariantRevision requires parentRevisionId and mediaChangeProvenance.");
  }
  const createdAt = timestamp(parsed.createdAt, "PlatformVariantRevision.createdAt");
  return createDomainRecord("PlatformVariantRevision", {
    revisionSchemaVersion: PLATFORM_VARIANT_REVISION_SCHEMA_VERSION,
    platformVariantRevisionId: id(parsed.platformVariantRevisionId, "PlatformVariantRevision.platformVariantRevisionId"),
    workspaceId: id(parsed.workspaceId, "PlatformVariantRevision.workspaceId"),
    platformVariantId: id(parsed.platformVariantId, "PlatformVariantRevision.platformVariantId"),
    contentPieceId: id(parsed.contentPieceId, "PlatformVariantRevision.contentPieceId"),
    narrativeStrategyId: id(parsed.narrativeStrategyId, "PlatformVariantRevision.narrativeStrategyId"),
    destination,
    revisionNumber: positiveInteger(parsed.revisionNumber, "PlatformVariantRevision.revisionNumber"),
    strategyRevision: positiveInteger(parsed.strategyRevision, "PlatformVariantRevision.strategyRevision"),
    status: PLATFORM_VARIANT_REVISION_STATUS,
    origin,
    parentRevisionId,
    changeRequest,
    format,
    content,
    segments,
    mediaBindings,
    inputFingerprint: text(parsed.inputFingerprint, "", 6000),
    identityContextSnapshotId: id(parsed.identityContextSnapshotId, "PlatformVariantRevision.identityContextSnapshotId"),
    styleMemoryRefs: normalizeStyleMemoryRefs(parsed.styleMemoryRefs),
    generationProvenance,
    editProvenance,
    mediaChangeProvenance,
    createdAt,
  });
}

export function createPlatformVariantRevision({
  platformVariantRevisionId,
  workspaceId,
  platformVariantId,
  contentPieceId,
  narrativeStrategyId,
  destination,
  revisionNumber,
  strategyRevision,
  output,
  inputFingerprint,
  identityContextSnapshotId,
  styleMemoryRefs = [],
  mediaBindings = [],
  generationProvenance,
  createdAt,
} = {}) {
  return normalizePlatformVariantRevision({
    platformVariantRevisionId,
    workspaceId,
    platformVariantId,
    contentPieceId,
    narrativeStrategyId,
    destination,
    revisionNumber,
    strategyRevision,
    status: PLATFORM_VARIANT_REVISION_STATUS,
    origin: PLATFORM_VARIANT_REVISION_ORIGINS.GENERATED,
    format: output?.format,
    content: output?.content,
    segments: output?.segments,
    mediaBindings,
    inputFingerprint,
    identityContextSnapshotId,
    styleMemoryRefs,
    generationProvenance,
    createdAt,
  });
}

export function createEditedPlatformVariantRevision({
  platformVariantRevisionId,
  parentRevision,
  revisionNumber,
  content,
  segments,
  format,
  editedBy,
  restoredFromRevisionId = null,
  createdAt,
} = {}) {
  const parent = normalizePlatformVariantRevision(parentRevision);
  return normalizePlatformVariantRevision({
    platformVariantRevisionId,
    workspaceId: parent.workspaceId,
    platformVariantId: parent.platformVariantId,
    contentPieceId: parent.contentPieceId,
    narrativeStrategyId: parent.narrativeStrategyId,
    destination: parent.destination,
    revisionNumber,
    strategyRevision: parent.strategyRevision,
    status: PLATFORM_VARIANT_REVISION_STATUS,
    origin: PLATFORM_VARIANT_REVISION_ORIGINS.EDITED,
    parentRevisionId: parent.platformVariantRevisionId,
    format: format || parent.format,
    content,
    segments: segments || [],
    mediaBindings: parent.mediaBindings,
    inputFingerprint: restoredFromRevisionId
      ? `restore:${restoredFromRevisionId}:${parent.platformVariantRevisionId}:${revisionNumber}`
      : `user-edit:${parent.platformVariantRevisionId}:${revisionNumber}`,
    identityContextSnapshotId: parent.identityContextSnapshotId,
    styleMemoryRefs: parent.styleMemoryRefs,
    editProvenance: { editedBy, editedAt: createdAt, restoredFromRevisionId },
    createdAt,
  });
}

export function createRestoredPlatformVariantRevision({
  platformVariantRevisionId,
  currentRevision,
  sourceRevision,
  revisionNumber,
  restoredBy,
  createdAt,
} = {}) {
  const current = normalizePlatformVariantRevision(currentRevision);
  const source = normalizePlatformVariantRevision(sourceRevision);
  if (current.workspaceId !== source.workspaceId
    || current.platformVariantId !== source.platformVariantId
    || current.contentPieceId !== source.contentPieceId
    || current.narrativeStrategyId !== source.narrativeStrategyId
    || current.destination !== source.destination
    || current.strategyRevision !== source.strategyRevision) {
    throw new TypeError("Only a prior revision from the same exact PlatformVariant planning contract can be restored.");
  }
  return normalizePlatformVariantRevision({
    platformVariantRevisionId,
    workspaceId: current.workspaceId,
    platformVariantId: current.platformVariantId,
    contentPieceId: current.contentPieceId,
    narrativeStrategyId: current.narrativeStrategyId,
    destination: current.destination,
    revisionNumber,
    strategyRevision: current.strategyRevision,
    status: PLATFORM_VARIANT_REVISION_STATUS,
    origin: PLATFORM_VARIANT_REVISION_ORIGINS.EDITED,
    parentRevisionId: current.platformVariantRevisionId,
    format: source.format,
    content: source.content,
    segments: source.segments,
    mediaBindings: source.mediaBindings,
    inputFingerprint: `restore:${source.platformVariantRevisionId}:${current.platformVariantRevisionId}:${revisionNumber}`,
    identityContextSnapshotId: source.identityContextSnapshotId,
    styleMemoryRefs: source.styleMemoryRefs,
    editProvenance: {
      editedBy: restoredBy,
      editedAt: createdAt,
      restoredFromRevisionId: source.platformVariantRevisionId,
    },
    createdAt,
  });
}

export function createRequestedPlatformVariantRevision({
  platformVariantRevisionId,
  parentRevision,
  revisionNumber,
  output,
  changeRequest,
  styleMemoryRefs = null,
  generationProvenance,
  createdAt,
} = {}) {
  const parent = normalizePlatformVariantRevision(parentRevision);
  return normalizePlatformVariantRevision({
    platformVariantRevisionId,
    workspaceId: parent.workspaceId,
    platformVariantId: parent.platformVariantId,
    contentPieceId: parent.contentPieceId,
    narrativeStrategyId: parent.narrativeStrategyId,
    destination: parent.destination,
    revisionNumber,
    strategyRevision: parent.strategyRevision,
    status: PLATFORM_VARIANT_REVISION_STATUS,
    origin: PLATFORM_VARIANT_REVISION_ORIGINS.AI_REVISED,
    parentRevisionId: parent.platformVariantRevisionId,
    changeRequest,
    format: output?.format || parent.format,
    content: output?.content,
    segments: output?.segments,
    mediaBindings: parent.mediaBindings,
    inputFingerprint: `change-request:${parent.platformVariantRevisionId}:${revisionNumber}`,
    identityContextSnapshotId: parent.identityContextSnapshotId,
    styleMemoryRefs: styleMemoryRefs || parent.styleMemoryRefs,
    generationProvenance,
    createdAt,
  });
}

export function createMediaReboundPlatformVariantRevision({
  platformVariantRevisionId,
  parentRevision,
  revisionNumber,
  mediaBindings,
  changedBy,
  reason = null,
  createdAt,
} = {}) {
  const parent = normalizePlatformVariantRevision(parentRevision);
  return normalizePlatformVariantRevision({
    platformVariantRevisionId,
    workspaceId: parent.workspaceId,
    platformVariantId: parent.platformVariantId,
    contentPieceId: parent.contentPieceId,
    narrativeStrategyId: parent.narrativeStrategyId,
    destination: parent.destination,
    revisionNumber,
    strategyRevision: parent.strategyRevision,
    status: PLATFORM_VARIANT_REVISION_STATUS,
    origin: PLATFORM_VARIANT_REVISION_ORIGINS.MEDIA_REBOUND,
    parentRevisionId: parent.platformVariantRevisionId,
    format: parent.format,
    content: parent.content,
    segments: parent.segments,
    mediaBindings,
    inputFingerprint: `media-rebind:${parent.platformVariantRevisionId}:${revisionNumber}`,
    identityContextSnapshotId: parent.identityContextSnapshotId,
    styleMemoryRefs: parent.styleMemoryRefs,
    mediaChangeProvenance: {
      changedBy,
      changedAt: createdAt,
      reason,
    },
    createdAt,
  });
}

export function attachPlatformVariantRevision(variantInput, revisionInput, now) {
  const variant = normalizePlatformVariant(variantInput);
  const revision = normalizePlatformVariantRevision(revisionInput);
  if (variant.workspaceId !== revision.workspaceId
    || variant.platformVariantId !== revision.platformVariantId
    || variant.contentPieceId !== revision.contentPieceId
    || variant.narrativeStrategyId !== revision.narrativeStrategyId
    || variant.destination !== revision.destination) {
    throw new TypeError("PlatformVariantRevision does not belong to the target PlatformVariant.");
  }
  return normalizePlatformVariant({
    ...variant,
    status: VARIANT_STATUSES.REVIEW,
    currentRevisionId: revision.platformVariantRevisionId,
    identityContextSnapshotId: revision.identityContextSnapshotId,
    updatedAt: now,
  });
}

export function markPlatformVariantGenerationFailed(variantInput, now) {
  const variant = normalizePlatformVariant(variantInput);
  return normalizePlatformVariant({
    ...variant,
    status: variant.currentRevisionId ? VARIANT_STATUSES.REVIEW : VARIANT_STATUSES.FAILED,
    updatedAt: now,
  });
}
