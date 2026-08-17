import { createDomainRecord, parseDomainRecord, portableClone } from "./contracts.mjs";
import { normalizePlatformVariant, VARIANT_STATUSES } from "./contentPlanning.mjs";

export const PLATFORM_VARIANT_REVISION_SCHEMA_VERSION = 1;
export const PLATFORM_VARIANT_REVISION_STATUS = "review";
export const PLATFORM_VARIANT_REVISION_ORIGINS = Object.freeze({ GENERATED: "generated", EDITED: "edited" });

const DESTINATIONS = new Set(["linkedin", "x"]);
const ROUTE_KINDS = new Set(["remote", "local"]);
const ORIGIN_VALUES = new Set(Object.values(PLATFORM_VARIANT_REVISION_ORIGINS));

function text(value, fallback = "", maxLength = 12000) {
  const normalized = String(value ?? "").replace(/\r\n?/g, "\n").trim();
  const resolved = normalized || fallback;
  if (resolved.length > maxLength) throw new TypeError(`PlatformVariantRevision text exceeds ${maxLength} characters.`);
  return resolved;
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

function normalizeEditProvenance(value = null) {
  if (!value) return null;
  if (typeof value !== "object" || Array.isArray(value)) throw new TypeError("PlatformVariantRevision.editProvenance must be an object.");
  return portableClone({
    editedBy: id(value.editedBy, "PlatformVariantRevision.editProvenance.editedBy"),
    editedAt: timestamp(value.editedAt, "PlatformVariantRevision.editProvenance.editedAt"),
  });
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
  if (origin === PLATFORM_VARIANT_REVISION_ORIGINS.GENERATED && !generationProvenance) {
    throw new TypeError("Generated PlatformVariantRevision requires generationProvenance.");
  }
  if (origin === PLATFORM_VARIANT_REVISION_ORIGINS.EDITED && (!editProvenance || !parsed.parentRevisionId)) {
    throw new TypeError("Edited PlatformVariantRevision requires parentRevisionId and editProvenance.");
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
    parentRevisionId: id(parsed.parentRevisionId, "PlatformVariantRevision.parentRevisionId", false),
    format,
    content,
    segments,
    inputFingerprint: text(parsed.inputFingerprint, "", 6000),
    identityContextSnapshotId: id(parsed.identityContextSnapshotId, "PlatformVariantRevision.identityContextSnapshotId"),
    generationProvenance,
    editProvenance,
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
    inputFingerprint,
    identityContextSnapshotId,
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
    inputFingerprint: `user-edit:${parent.platformVariantRevisionId}:${revisionNumber}`,
    identityContextSnapshotId: parent.identityContextSnapshotId,
    editProvenance: { editedBy, editedAt: createdAt },
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
