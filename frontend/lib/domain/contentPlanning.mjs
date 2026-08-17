import { createDomainRecord, parseDomainRecord, portableClone } from "./contracts.mjs";

export const CONTENT_PLANNING_SCHEMA_VERSION = 1;

export const STRATEGY_STATUSES = Object.freeze({
  DRAFT: "draft",
  APPROVED: "approved",
  NEEDS_REVISION: "needs_revision",
  SUPERSEDED: "superseded",
});

export const CONTENT_PIECE_STATUSES = Object.freeze({
  PLANNED: "planned",
  GENERATING: "generating",
  REVIEW: "review",
  APPROVED: "approved",
  REJECTED: "rejected",
});

export const VARIANT_STATUSES = Object.freeze({
  PLANNED: "planned",
  GENERATING: "generating",
  REVIEW: "review",
  APPROVED: "approved",
  REJECTED: "rejected",
  OMITTED: "omitted",
  FAILED: "failed",
});

const STRATEGY_STATUS_VALUES = new Set(Object.values(STRATEGY_STATUSES));
const PIECE_STATUS_VALUES = new Set(Object.values(CONTENT_PIECE_STATUSES));
const VARIANT_STATUS_VALUES = new Set(Object.values(VARIANT_STATUSES));
const DESTINATIONS = new Set(["linkedin", "x"]);
const DESTINATION_DECISIONS = new Set(["include", "optional", "exclude"]);

function text(value, fallback = "", maxLength = 12000) {
  const normalized = String(value ?? "").replace(/\r\n?/g, "\n").trim();
  const resolved = normalized || fallback;
  if (resolved.length > maxLength) throw new TypeError(`Content planning text exceeds ${maxLength} characters.`);
  return resolved;
}

function optionalText(value, maxLength = 12000) {
  const normalized = text(value, "", maxLength);
  return normalized || null;
}

function id(value, field, required = true) {
  const normalized = text(value, "", 240);
  if (!normalized && !required) return null;
  if (!normalized) throw new TypeError(`${field} is required.`);
  if (/[/\\]|^[a-zA-Z]:/.test(normalized)) throw new TypeError(`${field} must be an opaque ID.`);
  return normalized;
}

function timestamp(value, fallback = null, field = "timestamp") {
  const candidate = value || fallback;
  if (!candidate) return null;
  const parsed = Date.parse(candidate);
  if (!Number.isFinite(parsed)) throw new TypeError(`${field} must be an ISO timestamp.`);
  return new Date(parsed).toISOString();
}

function enumValue(value, allowed, fallback, field) {
  const normalized = text(value, fallback, 80).toLowerCase();
  if (!allowed.has(normalized)) throw new TypeError(`${field} contains unsupported value: ${normalized}.`);
  return normalized;
}

function list(values, { maxItems = 80, maxLength = 1600 } = {}) {
  if (values === undefined || values === null) return [];
  if (!Array.isArray(values)) throw new TypeError("Content planning list must be an array.");
  const seen = new Set();
  const result = [];
  for (const item of values) {
    const normalized = text(item, "", maxLength);
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
    if (result.length >= maxItems) break;
  }
  return result;
}

function normalizeSelectedAngle(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("NarrativeStrategy.selectedAngle is required.");
  return portableClone({
    angleId: text(value.angleId, "custom", 120),
    title: text(value.title, "Something else", 200),
    summary: text(value.summary, "", 1800),
    approach: text(value.approach || value.summary, "", 1800),
  });
}

function normalizeDestinationPlan(values = []) {
  if (!Array.isArray(values)) throw new TypeError("NarrativeStrategy.destinationPlan must be an array.");
  const result = [];
  for (const item of values) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const destination = text(item.destination, "", 80).toLowerCase();
    if (!DESTINATIONS.has(destination) || result.some((entry) => entry.destination === destination)) continue;
    result.push({
      destination,
      decision: enumValue(item.decision, DESTINATION_DECISIONS, "include", "NarrativeStrategy.destinationPlan.decision"),
      reason: text(item.reason, "Destination decision follows the selected narrative strategy.", 1200),
      format: text(item.format, destination === "x" ? "single post or short thread" : "single narrative post", 240),
      adaptationNotes: list(item.adaptationNotes, { maxItems: 12, maxLength: 700 }),
    });
  }
  return portableClone(result);
}

function normalizeMediaRequirements(values = []) {
  if (!Array.isArray(values)) return [];
  return portableClone(values.slice(0, 12).map((item) => {
    if (typeof item === "string") return { type: text(item, "text_only", 80), reason: "", required: false };
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    return {
      type: text(item.type, "text_only", 80).toLowerCase(),
      reason: text(item.reason, "", 1200),
      required: item.required === true,
    };
  }).filter(Boolean));
}

export function normalizeStrategyProposal(input = {}) {
  return portableClone({
    title: text(input.title, "Narrative plan", 240),
    coreIdea: text(input.coreIdea, "", 2400),
    audienceTakeaway: text(input.audienceTakeaway, "", 2400),
    narrativeArc: list(input.narrativeArc, { maxItems: 8, maxLength: 1200 }),
    hookDirection: text(input.hookDirection, "", 1200),
    evidencePlan: list(input.evidencePlan, { maxItems: 20, maxLength: 1400 }),
    factualConstraints: list(input.factualConstraints, { maxItems: 30, maxLength: 1200 }),
    boundaryConstraints: list(input.boundaryConstraints, { maxItems: 30, maxLength: 1200 }),
    destinationPlan: normalizeDestinationPlan(input.destinationPlan),
    mediaRequirements: normalizeMediaRequirements(input.mediaRequirements),
    sequencingNotes: list(input.sequencingNotes, { maxItems: 12, maxLength: 1000 }),
  });
}

export function normalizeNarrativeStrategy(input = {}) {
  const parsed = input?.kind === "NarrativeStrategy" && input?.schemaVersion
    ? parseDomainRecord(input, "NarrativeStrategy")
    : input;
  const createdAt = timestamp(parsed.createdAt, null, "NarrativeStrategy.createdAt");
  if (!createdAt) throw new TypeError("NarrativeStrategy.createdAt is required.");
  const proposal = normalizeStrategyProposal(parsed);
  if (!proposal.coreIdea || !proposal.audienceTakeaway || proposal.narrativeArc.length < 2) {
    throw new TypeError("NarrativeStrategy requires a core idea, audience takeaway, and at least two narrative-arc beats.");
  }
  return createDomainRecord("NarrativeStrategy", {
    planningSchemaVersion: CONTENT_PLANNING_SCHEMA_VERSION,
    narrativeStrategyId: id(parsed.narrativeStrategyId, "NarrativeStrategy.narrativeStrategyId"),
    workspaceId: id(parsed.workspaceId, "NarrativeStrategy.workspaceId"),
    opportunityId: id(parsed.opportunityId, "NarrativeStrategy.opportunityId"),
    projectId: id(parsed.projectId, "NarrativeStrategy.projectId", false),
    inputFingerprint: text(parsed.inputFingerprint, "", 3000),
    strategyRevision: Number.isInteger(parsed.strategyRevision) && parsed.strategyRevision > 0 ? parsed.strategyRevision : 1,
    status: enumValue(parsed.status, STRATEGY_STATUS_VALUES, STRATEGY_STATUSES.DRAFT, "NarrativeStrategy.status"),
    selectedAngle: normalizeSelectedAngle(parsed.selectedAngle),
    identityContextSnapshotId: id(parsed.identityContextSnapshotId, "NarrativeStrategy.identityContextSnapshotId"),
    ...proposal,
    origin: portableClone({
      type: text(parsed.origin?.type, "ai", 40).toLowerCase(),
      taskId: id(parsed.origin?.taskId, "NarrativeStrategy.origin.taskId"),
    }),
    createdAt,
    updatedAt: timestamp(parsed.updatedAt, createdAt, "NarrativeStrategy.updatedAt"),
    approvedAt: timestamp(parsed.approvedAt, null, "NarrativeStrategy.approvedAt"),
  });
}

export function createNarrativeStrategy({
  narrativeStrategyId,
  workspaceId,
  opportunityId,
  projectId = null,
  inputFingerprint,
  selectedAngle,
  identityContextSnapshotId,
  proposal,
  taskId,
  createdAt,
} = {}) {
  return normalizeNarrativeStrategy({
    narrativeStrategyId,
    workspaceId,
    opportunityId,
    projectId,
    inputFingerprint,
    strategyRevision: 1,
    status: STRATEGY_STATUSES.DRAFT,
    selectedAngle,
    identityContextSnapshotId,
    ...normalizeStrategyProposal(proposal),
    origin: { type: "ai", taskId },
    createdAt,
    updatedAt: createdAt,
  });
}

export function reviseNarrativeStrategy(strategyInput, patch = {}, now) {
  const strategy = normalizeNarrativeStrategy(strategyInput);
  const proposal = normalizeStrategyProposal({ ...strategy, ...patch });
  return normalizeNarrativeStrategy({
    ...strategy,
    ...proposal,
    strategyRevision: strategy.strategyRevision + 1,
    status: STRATEGY_STATUSES.DRAFT,
    approvedAt: null,
    updatedAt: timestamp(now, strategy.updatedAt, "NarrativeStrategy.updatedAt"),
  });
}

export function approveNarrativeStrategy(strategyInput, now) {
  const strategy = normalizeNarrativeStrategy(strategyInput);
  return normalizeNarrativeStrategy({
    ...strategy,
    status: STRATEGY_STATUSES.APPROVED,
    approvedAt: timestamp(now, strategy.updatedAt, "NarrativeStrategy.approvedAt"),
    updatedAt: timestamp(now, strategy.updatedAt, "NarrativeStrategy.updatedAt"),
  });
}

export function normalizeContentPiece(input = {}) {
  const parsed = input?.kind === "ContentPiece" && input?.schemaVersion ? parseDomainRecord(input, "ContentPiece") : input;
  const createdAt = timestamp(parsed.createdAt, null, "ContentPiece.createdAt");
  if (!createdAt) throw new TypeError("ContentPiece.createdAt is required.");
  return createDomainRecord("ContentPiece", {
    contentPieceId: id(parsed.contentPieceId, "ContentPiece.contentPieceId"),
    workspaceId: id(parsed.workspaceId, "ContentPiece.workspaceId"),
    narrativeStrategyId: id(parsed.narrativeStrategyId, "ContentPiece.narrativeStrategyId"),
    opportunityId: id(parsed.opportunityId, "ContentPiece.opportunityId"),
    purpose: text(parsed.purpose, "Communicate the selected narrative clearly and authentically.", 1200),
    sequenceRole: text(parsed.sequenceRole, "primary", 80).toLowerCase(),
    canonicalIntent: text(parsed.canonicalIntent, "", 2400),
    claims: list(parsed.claims, { maxItems: 30, maxLength: 1200 }),
    evidenceRefs: list(parsed.evidenceRefs, { maxItems: 50, maxLength: 240 }),
    status: enumValue(parsed.status, PIECE_STATUS_VALUES, CONTENT_PIECE_STATUSES.PLANNED, "ContentPiece.status"),
    createdAt,
    updatedAt: timestamp(parsed.updatedAt, createdAt, "ContentPiece.updatedAt"),
  });
}

export function createPrimaryContentPiece({ contentPieceId, strategy, opportunityId, createdAt } = {}) {
  const normalized = normalizeNarrativeStrategy(strategy);
  if (normalized.status !== STRATEGY_STATUSES.APPROVED) throw new TypeError("ContentPiece creation requires an approved NarrativeStrategy.");
  return normalizeContentPiece({
    contentPieceId,
    workspaceId: normalized.workspaceId,
    narrativeStrategyId: normalized.narrativeStrategyId,
    opportunityId,
    purpose: normalized.audienceTakeaway,
    sequenceRole: "primary",
    canonicalIntent: normalized.coreIdea,
    claims: normalized.factualConstraints,
    evidenceRefs: [],
    status: CONTENT_PIECE_STATUSES.PLANNED,
    createdAt,
    updatedAt: createdAt,
  });
}

export function normalizePlatformVariant(input = {}) {
  const parsed = input?.kind === "PlatformVariant" && input?.schemaVersion ? parseDomainRecord(input, "PlatformVariant") : input;
  const createdAt = timestamp(parsed.createdAt, null, "PlatformVariant.createdAt");
  if (!createdAt) throw new TypeError("PlatformVariant.createdAt is required.");
  const destination = enumValue(parsed.destination, DESTINATIONS, "linkedin", "PlatformVariant.destination");
  return createDomainRecord("PlatformVariant", {
    platformVariantId: id(parsed.platformVariantId, "PlatformVariant.platformVariantId"),
    workspaceId: id(parsed.workspaceId, "PlatformVariant.workspaceId"),
    contentPieceId: id(parsed.contentPieceId, "PlatformVariant.contentPieceId"),
    narrativeStrategyId: id(parsed.narrativeStrategyId, "PlatformVariant.narrativeStrategyId"),
    destination,
    status: enumValue(parsed.status, VARIANT_STATUS_VALUES, VARIANT_STATUSES.PLANNED, "PlatformVariant.status"),
    identityContextSnapshotId: id(parsed.identityContextSnapshotId, "PlatformVariant.identityContextSnapshotId", false),
    adaptationIntent: optionalText(parsed.adaptationIntent, 1600),
    currentRevisionId: id(parsed.currentRevisionId, "PlatformVariant.currentRevisionId", false),
    omittedReason: optionalText(parsed.omittedReason, 1200),
    createdAt,
    updatedAt: timestamp(parsed.updatedAt, createdAt, "PlatformVariant.updatedAt"),
  });
}

export function createPlannedPlatformVariant({ platformVariantId, contentPiece, strategy, destination, identityContextSnapshotId = null, createdAt } = {}) {
  const piece = normalizeContentPiece(contentPiece);
  const narrative = normalizeNarrativeStrategy(strategy);
  const plan = narrative.destinationPlan.find((item) => item.destination === destination);
  const excluded = plan?.decision === "exclude";
  return normalizePlatformVariant({
    platformVariantId,
    workspaceId: narrative.workspaceId,
    contentPieceId: piece.contentPieceId,
    narrativeStrategyId: narrative.narrativeStrategyId,
    destination,
    status: excluded ? VARIANT_STATUSES.OMITTED : VARIANT_STATUSES.PLANNED,
    identityContextSnapshotId,
    adaptationIntent: plan?.adaptationNotes?.join("\n") || plan?.reason || null,
    omittedReason: excluded ? plan.reason : null,
    createdAt,
    updatedAt: createdAt,
  });
}
