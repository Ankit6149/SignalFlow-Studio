import {
  createDomainRecord,
  DOMAIN_KINDS,
  DOMAIN_SCHEMA_VERSION,
  portableClone,
} from "./contracts.mjs";

export const CONTENT_OPPORTUNITY_SCHEMA_VERSION = 1;

export const CONTENT_OPPORTUNITY_STATUSES = Object.freeze({
  PROPOSED: "proposed",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  PLANNED: "planned",
  DRAFTED: "drafted",
  APPROVED: "approved",
});

export const OPPORTUNITY_RECOMMENDATIONS = Object.freeze({
  DISCUSS: "discuss",
  HOLD: "hold",
  SKIP: "skip",
});

const STATUS_VALUES = new Set(Object.values(CONTENT_OPPORTUNITY_STATUSES));
const RECOMMENDATION_VALUES = new Set(Object.values(OPPORTUNITY_RECOMMENDATIONS));
const EVIDENCE_LEVELS = new Set(["weak", "moderate", "strong"]);
const ALLOWED_DESTINATIONS = new Set(["linkedin", "x"]);
const ALLOWED_FORMATS = new Set(["text", "single_image", "carousel", "demo", "short_video", "none"]);

function requiredText(value, field, max = 4000) {
  const text = String(value || "").trim();
  if (!text) throw new TypeError(`${field} is required.`);
  if (text.length > max) throw new TypeError(`${field} must be ${max} characters or fewer.`);
  return text;
}

function optionalText(value, max = 4000) {
  if (value === null || value === undefined || value === "") return null;
  const text = String(value).trim();
  if (!text) return null;
  if (text.length > max) throw new TypeError(`Text value must be ${max} characters or fewer.`);
  return text;
}

function normalizeDate(value, field) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new TypeError(`${field} must be a valid date.`);
  return date.toISOString();
}

function normalizeScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    throw new TypeError("Opportunity score must be between 0 and 100.");
  }
  return Math.round(score);
}

function normalizeStringList(value, field, allowed = null) {
  if (!Array.isArray(value)) throw new TypeError(`${field} must be an array.`);
  const normalized = Array.from(new Set(value.map((item) => String(item || "").trim().toLowerCase()).filter(Boolean)));
  if (allowed) {
    for (const item of normalized) {
      if (!allowed.has(item)) throw new TypeError(`${field} contains unsupported value: ${item}.`);
    }
  }
  return normalized;
}

function normalizeFactors(value = []) {
  if (!Array.isArray(value)) throw new TypeError("evaluation.factors must be an array.");
  return value.slice(0, 8).map((factor, index) => {
    if (!factor || typeof factor !== "object" || Array.isArray(factor)) {
      throw new TypeError(`evaluation.factors[${index}] must be an object.`);
    }
    return {
      key: requiredText(factor.key, `evaluation.factors[${index}].key`, 80),
      label: requiredText(factor.label, `evaluation.factors[${index}].label`, 120),
      score: normalizeScore(factor.score),
      note: requiredText(factor.note, `evaluation.factors[${index}].note`, 700),
    };
  });
}

export function normalizeOpportunityEvaluation(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("ContentOpportunity evaluation must be an object.");
  }
  const recommendation = String(value.recommendation || "").trim().toLowerCase();
  if (!RECOMMENDATION_VALUES.has(recommendation)) {
    throw new TypeError(`Unsupported opportunity recommendation: ${recommendation || "missing"}.`);
  }
  const evidenceLevel = String(value.evidenceQuality?.level || "").trim().toLowerCase();
  if (!EVIDENCE_LEVELS.has(evidenceLevel)) {
    throw new TypeError(`Unsupported evidence quality level: ${evidenceLevel || "missing"}.`);
  }
  return {
    recommendation,
    score: normalizeScore(value.score),
    whyNow: requiredText(value.whyNow, "evaluation.whyNow", 1400),
    evidenceQuality: {
      level: evidenceLevel,
      note: requiredText(value.evidenceQuality?.note, "evaluation.evidenceQuality.note", 1000),
    },
    narrativeNote: requiredText(value.narrativeNote, "evaluation.narrativeNote", 1200),
    repetitionNote: requiredText(value.repetitionNote, "evaluation.repetitionNote", 1200),
    boundaryNote: requiredText(value.boundaryNote, "evaluation.boundaryNote", 1200),
    factors: normalizeFactors(value.factors || []),
  };
}

export function normalizeOpportunityAngles(value) {
  if (!Array.isArray(value) || value.length < 3 || value.length > 5) {
    throw new TypeError("A ContentOpportunity must contain 3 to 5 angles.");
  }
  const seenIds = new Set();
  const seenTitles = new Set();
  return value.map((angle, index) => {
    if (!angle || typeof angle !== "object" || Array.isArray(angle)) {
      throw new TypeError(`angles[${index}] must be an object.`);
    }
    const angleId = requiredText(angle.angleId, `angles[${index}].angleId`, 120);
    const title = requiredText(angle.title, `angles[${index}].title`, 180);
    const titleKey = title.toLowerCase();
    if (seenIds.has(angleId)) throw new TypeError(`Duplicate angleId: ${angleId}.`);
    if (seenTitles.has(titleKey)) throw new TypeError(`Opportunity angles must be materially distinct; duplicate title: ${title}.`);
    seenIds.add(angleId);
    seenTitles.add(titleKey);
    return {
      angleId,
      family: requiredText(angle.family || "other", `angles[${index}].family`, 80),
      title,
      summary: requiredText(angle.summary, `angles[${index}].summary`, 1000),
      rationale: requiredText(angle.rationale, `angles[${index}].rationale`, 1000),
    };
  });
}

function normalizeSelectedAngle(value, angles) {
  if (!value) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("selectedAngle must be an object or null.");
  }
  const type = String(value.type || "").trim().toLowerCase();
  if (type === "recommended") {
    const angleId = requiredText(value.angleId, "selectedAngle.angleId", 120);
    const angle = angles.find((item) => item.angleId === angleId);
    if (!angle) throw new TypeError(`Selected angle ${angleId} is not part of this opportunity.`);
    return { type, angleId, text: angle.title };
  }
  if (type === "custom") {
    return {
      type,
      angleId: null,
      text: requiredText(value.text, "selectedAngle.text", 1800),
    };
  }
  throw new TypeError(`Unsupported selected angle type: ${type || "missing"}.`);
}

export function normalizeContentOpportunity(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("ContentOpportunity must be an object.");
  }
  const schemaVersion = Number(input.schemaVersion ?? CONTENT_OPPORTUNITY_SCHEMA_VERSION);
  if (schemaVersion !== CONTENT_OPPORTUNITY_SCHEMA_VERSION || schemaVersion !== DOMAIN_SCHEMA_VERSION) {
    throw new TypeError(`Unsupported ContentOpportunity schema version: ${schemaVersion}.`);
  }
  if (input.kind && input.kind !== DOMAIN_KINDS.CONTENT_OPPORTUNITY) {
    throw new TypeError(`Expected ContentOpportunity, received ${input.kind}.`);
  }
  const status = String(input.status || "").trim().toLowerCase();
  if (!STATUS_VALUES.has(status)) throw new TypeError(`Unsupported ContentOpportunity status: ${status || "missing"}.`);
  const angles = normalizeOpportunityAngles(input.angles);
  const recommendedDestinations = normalizeStringList(input.recommendedDestinations || [], "recommendedDestinations", ALLOWED_DESTINATIONS);
  const recommendedFormats = normalizeStringList(input.recommendedFormats || [], "recommendedFormats", ALLOWED_FORMATS);
  if (recommendedDestinations.length === 0) throw new TypeError("ContentOpportunity needs at least one recommended destination.");
  if (recommendedFormats.length === 0) throw new TypeError("ContentOpportunity needs at least one recommended format.");

  return createDomainRecord(DOMAIN_KINDS.CONTENT_OPPORTUNITY, {
    opportunityId: requiredText(input.opportunityId, "opportunityId", 240),
    workspaceId: requiredText(input.workspaceId, "workspaceId", 240),
    signalId: requiredText(input.signalId, "signalId", 240),
    status,
    evaluation: normalizeOpportunityEvaluation(input.evaluation),
    angles,
    selectedAngle: normalizeSelectedAngle(input.selectedAngle, angles),
    recommendedDestinations,
    recommendedFormats,
    evaluationContext: {
      identitySummary: optionalText(input.evaluationContext?.identitySummary, 1600),
      desiredPerception: optionalText(input.evaluationContext?.desiredPerception, 1200),
      explicitBoundaries: Array.isArray(input.evaluationContext?.explicitBoundaries)
        ? input.evaluationContext.explicitBoundaries.map((item) => requiredText(item, "evaluationContext.explicitBoundaries[]", 700)).slice(0, 20)
        : [],
      recentNarrativeSummaries: Array.isArray(input.evaluationContext?.recentNarrativeSummaries)
        ? input.evaluationContext.recentNarrativeSummaries.map((item) => requiredText(item, "evaluationContext.recentNarrativeSummaries[]", 700)).slice(0, 20)
        : [],
    },
    createdAt: normalizeDate(input.createdAt, "createdAt"),
    updatedAt: normalizeDate(input.updatedAt || input.createdAt, "updatedAt"),
    evaluatedAt: normalizeDate(input.evaluatedAt || input.createdAt, "evaluatedAt"),
    rejectedAt: input.rejectedAt ? normalizeDate(input.rejectedAt, "rejectedAt") : null,
  });
}

export function createContentOpportunity({
  opportunityId,
  workspaceId,
  signalId,
  evaluation,
  angles,
  recommendedDestinations,
  recommendedFormats,
  evaluationContext = {},
}, now) {
  return normalizeContentOpportunity({
    schemaVersion: CONTENT_OPPORTUNITY_SCHEMA_VERSION,
    kind: DOMAIN_KINDS.CONTENT_OPPORTUNITY,
    opportunityId,
    workspaceId,
    signalId,
    status: CONTENT_OPPORTUNITY_STATUSES.PROPOSED,
    evaluation,
    angles,
    selectedAngle: null,
    recommendedDestinations,
    recommendedFormats,
    evaluationContext,
    createdAt: now,
    updatedAt: now,
    evaluatedAt: now,
    rejectedAt: null,
  });
}

export function selectRecommendedAngle(input, angleId, now) {
  const current = normalizeContentOpportunity(input);
  if (current.status === CONTENT_OPPORTUNITY_STATUSES.REJECTED) {
    throw new Error("Rejected opportunities must be reopened before selecting an angle.");
  }
  return normalizeContentOpportunity({
    ...portableClone(current),
    status: CONTENT_OPPORTUNITY_STATUSES.ACCEPTED,
    selectedAngle: { type: "recommended", angleId },
    updatedAt: now,
    rejectedAt: null,
  });
}

export function selectCustomOpportunityAngle(input, text, now) {
  const current = normalizeContentOpportunity(input);
  if (current.status === CONTENT_OPPORTUNITY_STATUSES.REJECTED) {
    throw new Error("Rejected opportunities must be reopened before selecting an angle.");
  }
  return normalizeContentOpportunity({
    ...portableClone(current),
    status: CONTENT_OPPORTUNITY_STATUSES.ACCEPTED,
    selectedAngle: { type: "custom", text },
    updatedAt: now,
    rejectedAt: null,
  });
}

export function rejectContentOpportunity(input, now) {
  const current = normalizeContentOpportunity(input);
  return normalizeContentOpportunity({
    ...portableClone(current),
    status: CONTENT_OPPORTUNITY_STATUSES.REJECTED,
    selectedAngle: null,
    updatedAt: now,
    rejectedAt: now,
  });
}

export function reopenContentOpportunity(input, now) {
  const current = normalizeContentOpportunity(input);
  return normalizeContentOpportunity({
    ...portableClone(current),
    status: CONTENT_OPPORTUNITY_STATUSES.PROPOSED,
    updatedAt: now,
    rejectedAt: null,
  });
}
