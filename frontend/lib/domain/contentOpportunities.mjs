import {
  createDomainRecord,
  parseDomainRecord,
  portableClone,
  stableStringify,
} from "./contracts.mjs";
import { normalizeContentSignal } from "./contentSignals.mjs";
import { normalizeProjectContextSnapshot } from "./projectContexts.mjs";

export const CONTENT_OPPORTUNITY_SCHEMA_VERSION = 2;

export const OPPORTUNITY_RECOMMENDATIONS = Object.freeze({
  POST: "post",
  HOLD: "hold",
  SKIP: "skip",
});

export const CONTENT_OPPORTUNITY_STATUSES = Object.freeze({
  PROPOSED: "proposed",
  SHORTLISTED: "shortlisted",
  SELECTED: "selected",
  SNOOZED: "snoozed",
  REJECTED: "rejected",
  EXPIRED: "expired",
  CONVERTED_TO_CAMPAIGN: "converted_to_campaign",
});

export const OPPORTUNITY_FRESHNESS = Object.freeze({
  FRESH: "fresh",
  STILL_RELEVANT: "still_relevant",
  EVERGREEN: "evergreen",
  EXPIRING: "expiring",
  EXPIRED: "expired",
});

export const MEDIA_TYPES = Object.freeze([
  "none",
  "text_only",
  "single_image",
  "screenshot",
  "diagram",
  "carousel",
  "short_video",
]);

const STATUS_VALUES = new Set(Object.values(CONTENT_OPPORTUNITY_STATUSES));
const RECOMMENDATION_VALUES = new Set(Object.values(OPPORTUNITY_RECOMMENDATIONS));
const FRESHNESS_VALUES = new Set(Object.values(OPPORTUNITY_FRESHNESS));
const EVIDENCE_LEVELS = new Set(["strong", "medium", "weak", "unknown"]);
const RISK_LEVELS = new Set(["unknown", "low", "medium", "high"]);
const DESTINATIONS = new Set(["linkedin", "x"]);
const MEDIA_VALUES = new Set(MEDIA_TYPES);

function text(value, fallback = "", maxLength = 12000) {
  const normalized = String(value ?? "").replace(/\r\n?/g, "\n").trim();
  const resolved = normalized || fallback;
  if (resolved.length > maxLength) throw new TypeError(`ContentOpportunity text exceeds ${maxLength} characters.`);
  return resolved;
}

function optionalText(value, maxLength = 12000) {
  const normalized = text(value, "", maxLength);
  return normalized || null;
}

function opaqueId(value, field, required = true) {
  const normalized = text(value, "", 240);
  if (!normalized && !required) return null;
  if (!normalized) throw new TypeError(`ContentOpportunity.${field} is required.`);
  if (/[/\\]|^[a-zA-Z]:/.test(normalized)) throw new TypeError(`ContentOpportunity.${field} must be an opaque ID.`);
  return normalized;
}

function timestamp(value, fallback = null, field = "timestamp") {
  const candidate = value || fallback;
  if (!candidate) return null;
  const parsed = Date.parse(candidate);
  if (!Number.isFinite(parsed)) throw new TypeError(`ContentOpportunity.${field} must be an ISO timestamp.`);
  return new Date(parsed).toISOString();
}

function enumValue(value, allowed, fallback, field) {
  const normalized = text(value, fallback, 80).toLowerCase();
  if (!allowed.has(normalized)) throw new TypeError(`ContentOpportunity.${field} contains an unsupported value: ${normalized}.`);
  return normalized;
}

function numberValue(value, fallback, min, max, field) {
  const candidate = value === undefined || value === null ? fallback : Number(value);
  if (!Number.isFinite(candidate) || candidate < min || candidate > max) {
    throw new TypeError(`ContentOpportunity.${field} must be between ${min} and ${max}.`);
  }
  return candidate;
}

function uniqueIds(values, field) {
  if (!Array.isArray(values)) throw new TypeError(`ContentOpportunity.${field} must be an array.`);
  return Array.from(new Set(values.map((value) => opaqueId(value, field)))).sort();
}

function normalizeScoreBreakdown(value = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return portableClone({
    freshness: numberValue(source.freshness, 50, 0, 100, "scoreBreakdown.freshness"),
    importance: numberValue(source.importance, 50, 0, 100, "scoreBreakdown.importance"),
    novelty: numberValue(source.novelty, 50, 0, 100, "scoreBreakdown.novelty"),
    audienceValue: numberValue(source.audienceValue, 50, 0, 100, "scoreBreakdown.audienceValue"),
    narrativeFit: numberValue(source.narrativeFit, 50, 0, 100, "scoreBreakdown.narrativeFit"),
    evidenceStrength: numberValue(source.evidenceStrength, 50, 0, 100, "scoreBreakdown.evidenceStrength"),
  });
}

function normalizeAssessment(value, { levelSet, fallbackLevel = "unknown", field }) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return portableClone({
    level: enumValue(source.level, levelSet, fallbackLevel, `${field}.level`),
    reason: text(source.reason, "Not enough context to assess confidently.", 1200),
  });
}

function normalizeAngles(values, { required = false } = {}) {
  const source = Array.isArray(values) ? values : [];
  const seen = new Set();
  const angles = [];
  for (const [index, value] of source.entries()) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const title = text(value.title, "", 160);
    const summary = text(value.summary || value.description, "", 1000);
    const approach = text(value.approach, summary, 1000);
    if (!title || !summary) continue;
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    angles.push({
      angleId: `angle-${index + 1}`,
      title,
      summary,
      approach,
    });
    if (angles.length === 5) break;
  }
  if (required && angles.length < 3) {
    throw new TypeError("A post-worthy ContentOpportunity requires at least three materially distinct candidate angles.");
  }
  return portableClone(angles);
}

function normalizeDestinations(values) {
  const source = Array.isArray(values) ? values : [];
  const normalized = [];
  for (const value of source) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const destination = text(value.destination, "", 80).toLowerCase();
    if (!DESTINATIONS.has(destination) || normalized.some((item) => item.destination === destination)) continue;
    normalized.push({
      destination,
      recommended: value.recommended !== false,
      reason: text(value.reason, "Fits the current story direction.", 1000),
      format: text(value.format, destination === "x" ? "concise post or short thread" : "professional narrative post", 160),
    });
  }
  return portableClone(normalized);
}

function normalizeExcludedDestinations(values) {
  if (!Array.isArray(values)) return [];
  return portableClone(values
    .filter((value) => value && typeof value === "object" && !Array.isArray(value))
    .map((value) => ({
      destination: text(value.destination, "", 80).toLowerCase(),
      reason: text(value.reason, "Not recommended for this opportunity.", 1000),
    }))
    .filter((value) => value.destination && !DESTINATIONS.has(value.destination))
    .slice(0, 12));
}

function normalizeMediaTypes(values) {
  if (!Array.isArray(values)) return ["text_only"];
  const resolved = Array.from(new Set(values.map((value) => text(value, "", 80).toLowerCase()).filter((value) => MEDIA_VALUES.has(value))));
  return resolved.length ? resolved.slice(0, 4) : ["text_only"];
}

function normalizeEvaluationProvenance(value, createdAt) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return portableClone({
    taskId: opaqueId(source.taskId, "evaluationProvenance.taskId"),
    taskType: text(source.taskType, "opportunity_evaluation", 80),
    provider: text(source.provider, "deterministic", 80),
    model: text(source.model, "deterministic", 160),
    routeKind: text(source.routeKind, "local", 80),
    evaluatedAt: timestamp(source.evaluatedAt, createdAt, "evaluationProvenance.evaluatedAt"),
  });
}

function assertOpportunitySchema(input) {
  if (input?.opportunitySchemaVersion === undefined || input?.opportunitySchemaVersion === null) return;
  if (!Number.isInteger(input.opportunitySchemaVersion)) throw new TypeError("ContentOpportunity.opportunitySchemaVersion must be an integer.");
  if (input.opportunitySchemaVersion > CONTENT_OPPORTUNITY_SCHEMA_VERSION) {
    throw new TypeError(`ContentOpportunity schema ${input.opportunitySchemaVersion} is newer than supported schema ${CONTENT_OPPORTUNITY_SCHEMA_VERSION}.`);
  }
}

export function normalizeOpportunityEvaluation(input = {}) {
  const recommendation = enumValue(input.recommendation, RECOMMENDATION_VALUES, OPPORTUNITY_RECOMMENDATIONS.HOLD, "recommendation");
  const angles = normalizeAngles(input.candidateAngles, { required: recommendation === OPPORTUNITY_RECOMMENDATIONS.POST });
  const requestedAngleId = optionalText(input.recommendedAngleId, 120);
  const recommendedAngleTitle = text(input.recommendedAngleTitle, "", 160).toLowerCase();
  const recommendedAngle = requestedAngleId
    ? angles.find((item) => item.angleId === requestedAngleId) || null
    : recommendedAngleTitle
      ? angles.find((item) => item.title.toLowerCase() === recommendedAngleTitle) || null
      : null;
  return portableClone({
    recommendation,
    title: text(input.title, "Opportunity", 240),
    summary: text(input.summary, "", 4000),
    whyNow: text(input.whyNow, "The topic was explicitly captured by the user and may merit review.", 2400),
    score: Math.round(numberValue(input.score, recommendation === OPPORTUNITY_RECOMMENDATIONS.POST ? 65 : 35, 0, 100, "score")),
    scoreBreakdown: normalizeScoreBreakdown(input.scoreBreakdown),
    confidence: numberValue(input.confidence, 0.5, 0, 1, "confidence"),
    evidenceReadiness: normalizeAssessment(input.evidenceReadiness, { levelSet: EVIDENCE_LEVELS, field: "evidenceReadiness" }),
    narrativeFit: normalizeAssessment(input.narrativeFit, { levelSet: EVIDENCE_LEVELS, field: "narrativeFit" }),
    repetitionRisk: normalizeAssessment(input.repetitionRisk, { levelSet: RISK_LEVELS, field: "repetitionRisk" }),
    candidateAngles: angles,
    recommendedAngleId: recommendation === OPPORTUNITY_RECOMMENDATIONS.POST ? recommendedAngle?.angleId || null : null,
    candidateDestinations: normalizeDestinations(input.candidateDestinations),
    excludedDestinations: normalizeExcludedDestinations(input.excludedDestinations),
    recommendedMediaTypes: normalizeMediaTypes(input.recommendedMediaTypes),
    freshnessState: enumValue(input.freshnessState, FRESHNESS_VALUES, OPPORTUNITY_FRESHNESS.STILL_RELEVANT, "freshnessState"),
    productionEffortEstimate: text(input.productionEffortEstimate, "low", 80).toLowerCase(),
  });
}

export function normalizeContentOpportunity(input = {}) {
  assertOpportunitySchema(input);
  const parsed = input?.kind === "ContentOpportunity" ? parseDomainRecord(input, "ContentOpportunity") : input;
  const createdAt = timestamp(parsed.createdAt, null, "createdAt");
  if (!createdAt) throw new TypeError("ContentOpportunity.createdAt is required.");
  const recommendation = enumValue(parsed.recommendation, RECOMMENDATION_VALUES, OPPORTUNITY_RECOMMENDATIONS.HOLD, "recommendation");
  const selectedAngleId = optionalText(parsed.selectedAngleId, 120);
  const customAngle = parsed.customAngle && typeof parsed.customAngle === "object" && !Array.isArray(parsed.customAngle)
    ? portableClone({
        title: text(parsed.customAngle.title, "Something else", 160),
        summary: text(parsed.customAngle.summary, "", 1200),
        approach: text(parsed.customAngle.approach || parsed.customAngle.summary, "", 1200),
      })
    : null;
  const status = enumValue(parsed.status, STATUS_VALUES, CONTENT_OPPORTUNITY_STATUSES.PROPOSED, "status");
  const snoozedUntil = timestamp(parsed.snoozedUntil, null, "snoozedUntil");
  if (status === CONTENT_OPPORTUNITY_STATUSES.SNOOZED && !snoozedUntil) {
    throw new TypeError("A snoozed ContentOpportunity requires snoozedUntil.");
  }
  const evaluation = normalizeOpportunityEvaluation({ ...parsed, recommendation });
  return createDomainRecord("ContentOpportunity", {
    opportunitySchemaVersion: CONTENT_OPPORTUNITY_SCHEMA_VERSION,
    opportunityId: opaqueId(parsed.opportunityId, "opportunityId"),
    workspaceId: opaqueId(parsed.workspaceId, "workspaceId"),
    projectId: opaqueId(parsed.projectId, "projectId", false),
    projectContextSnapshotId: opaqueId(parsed.projectContextSnapshotId, "projectContextSnapshotId", false),
    signalIds: uniqueIds(parsed.signalIds || [], "signalIds"),
    inputFingerprint: text(parsed.inputFingerprint, "", 160),
    ...evaluation,
    status,
    selectedAngleId,
    customAngle,
    snoozedUntil: status === CONTENT_OPPORTUNITY_STATUSES.SNOOZED ? snoozedUntil : null,
    createdAt,
    updatedAt: timestamp(parsed.updatedAt, createdAt, "updatedAt"),
    reviewedAt: timestamp(parsed.reviewedAt, null, "reviewedAt"),
    evaluationProvenance: normalizeEvaluationProvenance(parsed.evaluationProvenance, createdAt),
  });
}

export function createContentOpportunity({
  opportunityId,
  workspaceId,
  projectId = null,
  projectContextSnapshotId = null,
  signalIds,
  inputFingerprint,
  evaluation,
  evaluationProvenance,
  createdAt,
} = {}) {
  const normalizedEvaluation = normalizeOpportunityEvaluation(evaluation);
  return normalizeContentOpportunity({
    opportunityId,
    workspaceId,
    projectId,
    projectContextSnapshotId,
    signalIds,
    inputFingerprint,
    ...normalizedEvaluation,
    status: CONTENT_OPPORTUNITY_STATUSES.PROPOSED,
    createdAt,
    updatedAt: createdAt,
    evaluationProvenance,
  });
}

export function opportunityInputFingerprint(signalInput, projectContextInput = null) {
  const signal = normalizeContentSignal(signalInput);
  const canonical = {
    signalId: signal.signalId,
    projectId: signal.projectId,
    sourceRevision: signal.sourceRevision || null,
    headline: signal.headline,
    summary: signal.summary,
    signalKind: signal.signalKind,
    importanceHints: signal.importanceHints,
    privacyClassification: signal.privacyClassification,
    boundaryNote: signal.boundaryNote,
    sourceArtifactIds: signal.sourceArtifactIds,
    assetIds: signal.assetIds,
    occurredAt: signal.occurredAt,
  };
  if (projectContextInput) {
    const projectContext = normalizeProjectContextSnapshot(projectContextInput);
    canonical.projectContextSnapshotId = projectContext.projectContextSnapshotId;
    canonical.projectContextFingerprint = projectContext.fingerprint;
  }
  const serialized = stableStringify(canonical);
  let hash = 2166136261;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function selectOpportunityAngle(opportunityInput, angleId, now) {
  const opportunity = normalizeContentOpportunity(opportunityInput);
  const normalizedId = text(angleId, "", 120);
  if (!opportunity.candidateAngles.some((angle) => angle.angleId === normalizedId)) {
    throw new TypeError(`ContentOpportunity angle ${normalizedId || "missing"} does not exist.`);
  }
  return normalizeContentOpportunity({
    ...opportunity,
    status: CONTENT_OPPORTUNITY_STATUSES.SELECTED,
    selectedAngleId: normalizedId,
    customAngle: null,
    reviewedAt: timestamp(now, opportunity.updatedAt, "reviewedAt"),
    updatedAt: timestamp(now, opportunity.updatedAt, "updatedAt"),
  });
}

export function setCustomOpportunityAngle(opportunityInput, customAngle, now) {
  const opportunity = normalizeContentOpportunity(opportunityInput);
  const summary = text(customAngle?.summary || customAngle?.approach || customAngle, "", 1200);
  if (!summary) throw new TypeError("Something else requires a narrative direction.");
  return normalizeContentOpportunity({
    ...opportunity,
    status: CONTENT_OPPORTUNITY_STATUSES.SELECTED,
    selectedAngleId: "custom",
    customAngle: {
      title: text(customAngle?.title, "Something else", 160),
      summary,
      approach: text(customAngle?.approach, summary, 1200),
    },
    reviewedAt: timestamp(now, opportunity.updatedAt, "reviewedAt"),
    updatedAt: timestamp(now, opportunity.updatedAt, "updatedAt"),
  });
}

export function transitionContentOpportunity(opportunityInput, status, now, { snoozedUntil = null } = {}) {
  const opportunity = normalizeContentOpportunity(opportunityInput);
  const nextStatus = enumValue(status, STATUS_VALUES, opportunity.status, "status");
  return normalizeContentOpportunity({
    ...opportunity,
    status: nextStatus,
    snoozedUntil: nextStatus === CONTENT_OPPORTUNITY_STATUSES.SNOOZED ? snoozedUntil : null,
    reviewedAt: [CONTENT_OPPORTUNITY_STATUSES.REJECTED, CONTENT_OPPORTUNITY_STATUSES.SHORTLISTED].includes(nextStatus)
      ? timestamp(now, opportunity.updatedAt, "reviewedAt")
      : opportunity.reviewedAt,
    updatedAt: timestamp(now, opportunity.updatedAt, "updatedAt"),
  });
}

export function deterministicSkipEvaluation(signalInput, reason) {
  const signal = normalizeContentSignal(signalInput);
  return normalizeOpportunityEvaluation({
    recommendation: OPPORTUNITY_RECOMMENDATIONS.SKIP,
    title: signal.headline,
    summary: signal.summary || signal.headline,
    whyNow: reason,
    score: 0,
    scoreBreakdown: {
      freshness: 0,
      importance: 0,
      novelty: 0,
      audienceValue: 0,
      narrativeFit: 0,
      evidenceStrength: 0,
    },
    confidence: 1,
    evidenceReadiness: { level: "unknown", reason },
    narrativeFit: { level: "unknown", reason },
    repetitionRisk: { level: "unknown", reason: "Narrative memory was not needed for this deterministic skip." },
    candidateAngles: [],
    candidateDestinations: [],
    excludedDestinations: [],
    recommendedMediaTypes: ["none"],
    freshnessState: OPPORTUNITY_FRESHNESS.STILL_RELEVANT,
    productionEffortEstimate: "none",
  });
}
