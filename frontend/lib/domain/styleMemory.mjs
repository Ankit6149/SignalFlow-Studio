import { createDomainRecord, parseDomainRecord, portableClone } from "./contracts.mjs";

export const FEEDBACK_EVENT_SCHEMA_VERSION = 1;
export const STYLE_MEMORY_SCHEMA_VERSION = 1;

export const FEEDBACK_KINDS = Object.freeze({
  APPROVED_UNCHANGED: "approved_unchanged",
  APPROVED_AFTER_EDIT: "approved_after_edit",
  CHANGES_REQUESTED: "changes_requested",
  REGENERATED: "regenerated",
  REJECTED: "rejected",
  DESTINATION_REMOVED: "destination_removed",
  DONT_POST_THIS: "dont_post_this",
  NOT_FOR_THIS_PLATFORM: "not_for_this_platform",
  TOO_PERSONAL: "too_personal",
  TOO_CORPORATE: "too_corporate",
  TOO_GENERIC: "too_generic",
  TOO_PROMOTIONAL: "too_promotional",
  TOO_TECHNICAL: "too_technical",
  NOT_TECHNICAL_ENOUGH: "not_technical_enough",
  WRONG_ANGLE: "wrong_angle",
  WRONG_MEDIA: "wrong_media",
  MANUAL_STYLE_NOTE: "manual_style_note",
  EXPLICIT_PREFERENCE: "explicit_preference",
  EXPLICIT_BOUNDARY: "explicit_boundary",
});

export const LEARNING_ELIGIBILITY = Object.freeze({
  ELIGIBLE: "eligible",
  EXCLUDED_FACTUAL: "excluded_factual",
  EXCLUDED_COMPLIANCE: "excluded_compliance",
  EXCLUDED_SOURCE_CHANGE: "excluded_source_change",
  EXCLUDED_ONE_OFF: "excluded_one_off",
  EXCLUDED_BOUNDARY: "excluded_boundary",
});

export const STYLE_MEMORY_CATEGORIES = Object.freeze({
  OPENING: "opening",
  TONE: "tone",
  PROMOTION: "promotion",
  PERSONALITY: "personality",
  SPECIFICITY: "specificity",
  BREVITY: "brevity",
  TECHNICALITY: "technicality",
  STRUCTURE: "structure",
  PLATFORM_FIT: "platform_fit",
  OTHER: "other",
});

export const STYLE_MEMORY_SCOPES = Object.freeze({
  GLOBAL: "global",
  PLATFORM: "platform",
  PROJECT: "project",
});

export const STYLE_MEMORY_STATUSES = Object.freeze({
  CANDIDATE: "candidate",
  ACTIVE: "active",
  USER_CONFIRMED: "user_confirmed",
  REJECTED: "rejected",
  SUPERSEDED: "superseded",
});

export const STYLE_OBSERVATION_DIRECTIONS = Object.freeze({
  SUPPORT: "support",
  CONTRADICT: "contradict",
});

const FEEDBACK_KIND_VALUES = new Set(Object.values(FEEDBACK_KINDS));
const ELIGIBILITY_VALUES = new Set(Object.values(LEARNING_ELIGIBILITY));
const CATEGORY_VALUES = new Set(Object.values(STYLE_MEMORY_CATEGORIES));
const SCOPE_VALUES = new Set(Object.values(STYLE_MEMORY_SCOPES));
const STATUS_VALUES = new Set(Object.values(STYLE_MEMORY_STATUSES));
const DIRECTION_VALUES = new Set(Object.values(STYLE_OBSERVATION_DIRECTIONS));
const PLATFORM_VALUES = new Set(["linkedin", "x"]);

function text(value, fallback = "", maxLength = 2400) {
  const normalized = String(value ?? "").replace(/\r\n?/g, "\n").trim();
  const resolved = normalized || fallback;
  if (resolved.length > maxLength) throw new TypeError(`StyleMemory text exceeds ${maxLength} characters.`);
  return resolved;
}

function optionalText(value, maxLength = 2400) {
  return text(value, "", maxLength) || null;
}

function id(value, field, required = true) {
  const normalized = text(value, "", 240);
  if (!normalized && !required) return null;
  if (!normalized) throw new TypeError(`${field} is required.`);
  if (/[/\\]|^[a-zA-Z]:/.test(normalized)) throw new TypeError(`${field} must be an opaque ID.`);
  return normalized;
}

function timestamp(value, field) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new TypeError(`${field} must be an ISO timestamp.`);
  return new Date(parsed).toISOString();
}

function enumValue(value, values, fallback, field) {
  const normalized = text(value, fallback, 80).toLowerCase();
  if (!values.has(normalized)) throw new TypeError(`${field} contains unsupported value: ${normalized}.`);
  return normalized;
}

function list(values, { maxItems = 80, maxLength = 240 } = {}) {
  const items = Array.isArray(values) ? values : [];
  const seen = new Set();
  const result = [];
  for (const value of items) {
    const normalized = text(value, "", maxLength);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= maxItems) break;
  }
  return result;
}

function clamp(value, minimum = 0, maximum = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return minimum;
  return Math.min(maximum, Math.max(minimum, numeric));
}

function normalizePlatform(value) {
  const platform = optionalText(value, 40)?.toLowerCase() || null;
  if (platform && !PLATFORM_VALUES.has(platform)) throw new TypeError(`Unsupported feedback platform: ${platform}.`);
  return platform;
}

export function normalizeStyleObservation(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("Style observation must be an object.");
  const hypothesisKey = text(input.hypothesisKey, "", 160).toLowerCase();
  const hypothesis = text(input.hypothesis, "", 600);
  if (!hypothesisKey || !hypothesis) throw new TypeError("Style observation requires hypothesisKey and hypothesis.");
  return portableClone({
    hypothesisKey,
    hypothesis,
    category: enumValue(input.category, CATEGORY_VALUES, STYLE_MEMORY_CATEGORIES.OTHER, "StyleObservation.category"),
    direction: enumValue(input.direction, DIRECTION_VALUES, STYLE_OBSERVATION_DIRECTIONS.SUPPORT, "StyleObservation.direction"),
    weight: clamp(input.weight ?? 0.6, 0.1, 1),
    reason: optionalText(input.reason, 800),
  });
}

export function normalizeFeedbackEvent(input = {}) {
  const parsed = input?.kind === "FeedbackEvent" && input?.schemaVersion
    ? parseDomainRecord(input, "FeedbackEvent")
    : input;
  const createdAt = timestamp(parsed.createdAt, "FeedbackEvent.createdAt");
  const structuredReason = parsed.structuredReason && typeof parsed.structuredReason === "object" && !Array.isArray(parsed.structuredReason)
    ? portableClone({
      code: optionalText(parsed.structuredReason.code, 120),
      observations: (Array.isArray(parsed.structuredReason.observations) ? parsed.structuredReason.observations : []).slice(0, 12).map(normalizeStyleObservation),
    })
    : { code: null, observations: [] };
  return createDomainRecord("FeedbackEvent", {
    feedbackSchemaVersion: FEEDBACK_EVENT_SCHEMA_VERSION,
    feedbackEventId: id(parsed.feedbackEventId, "FeedbackEvent.feedbackEventId"),
    workspaceId: id(parsed.workspaceId, "FeedbackEvent.workspaceId"),
    userId: id(parsed.userId, "FeedbackEvent.userId"),
    targetType: text(parsed.targetType, "platform_variant_revision", 80).toLowerCase(),
    targetId: id(parsed.targetId, "FeedbackEvent.targetId"),
    platform: normalizePlatform(parsed.platform),
    projectId: id(parsed.projectId, "FeedbackEvent.projectId", false),
    feedbackKind: enumValue(parsed.feedbackKind, FEEDBACK_KIND_VALUES, FEEDBACK_KINDS.MANUAL_STYLE_NOTE, "FeedbackEvent.feedbackKind"),
    structuredReason,
    freeformReason: optionalText(parsed.freeformReason, 1600),
    beforeRevisionId: id(parsed.beforeRevisionId, "FeedbackEvent.beforeRevisionId", false),
    afterRevisionId: id(parsed.afterRevisionId, "FeedbackEvent.afterRevisionId", false),
    learningEligibility: enumValue(parsed.learningEligibility, ELIGIBILITY_VALUES, LEARNING_ELIGIBILITY.ELIGIBLE, "FeedbackEvent.learningEligibility"),
    createdAt,
  });
}

export function createFeedbackEvent(values = {}) {
  return normalizeFeedbackEvent(values);
}

function normalizeScope(input = {}) {
  const type = enumValue(input.type, SCOPE_VALUES, STYLE_MEMORY_SCOPES.GLOBAL, "StyleMemory.scope.type");
  const platform = normalizePlatform(input.platform);
  const projectId = id(input.projectId, "StyleMemory.scope.projectId", false);
  if (type === STYLE_MEMORY_SCOPES.PLATFORM && !platform) throw new TypeError("Platform-scoped StyleMemory requires scope.platform.");
  if (type === STYLE_MEMORY_SCOPES.PROJECT && !projectId) throw new TypeError("Project-scoped StyleMemory requires scope.projectId.");
  return portableClone({ type, platform: type === STYLE_MEMORY_SCOPES.PLATFORM ? platform : null, projectId: type === STYLE_MEMORY_SCOPES.PROJECT ? projectId : null });
}

export function styleMemoryIdentity({ hypothesisKey, category, scope } = {}) {
  const normalizedScope = normalizeScope(scope || {});
  return [
    text(hypothesisKey, "", 160).toLowerCase(),
    enumValue(category, CATEGORY_VALUES, STYLE_MEMORY_CATEGORIES.OTHER, "StyleMemory.category"),
    normalizedScope.type,
    normalizedScope.platform || "-",
    normalizedScope.projectId || "-",
  ].join("::");
}

export function normalizeStyleMemoryHypothesis(input = {}) {
  const parsed = input?.kind === "StyleMemoryHypothesis" && input?.schemaVersion
    ? parseDomainRecord(input, "StyleMemoryHypothesis")
    : input;
  const scope = normalizeScope(parsed.scope || {});
  const hypothesisKey = text(parsed.hypothesisKey, "", 160).toLowerCase();
  const hypothesis = text(parsed.hypothesis, "", 600);
  if (!hypothesisKey || !hypothesis) throw new TypeError("StyleMemoryHypothesis requires hypothesisKey and hypothesis.");
  const supporting = list(parsed.supportingFeedbackEventIds, { maxItems: 100, maxLength: 240 });
  const contradicting = list(parsed.contradictingFeedbackEventIds, { maxItems: 100, maxLength: 240 });
  const evidenceCount = Math.max(0, Number.parseInt(parsed.evidenceCount ?? supporting.length + contradicting.length, 10) || 0);
  return createDomainRecord("StyleMemoryHypothesis", {
    styleMemorySchemaVersion: STYLE_MEMORY_SCHEMA_VERSION,
    styleMemoryId: id(parsed.styleMemoryId, "StyleMemoryHypothesis.styleMemoryId"),
    workspaceId: id(parsed.workspaceId, "StyleMemoryHypothesis.workspaceId"),
    userId: id(parsed.userId, "StyleMemoryHypothesis.userId"),
    hypothesisKey,
    hypothesis,
    category: enumValue(parsed.category, CATEGORY_VALUES, STYLE_MEMORY_CATEGORIES.OTHER, "StyleMemoryHypothesis.category"),
    scope,
    confidence: clamp(parsed.confidence ?? 0.35),
    evidenceCount,
    supportingFeedbackEventIds: supporting,
    contradictingFeedbackEventIds: contradicting,
    exampleApprovedRevisionIds: list(parsed.exampleApprovedRevisionIds, { maxItems: 40, maxLength: 240 }),
    exampleRejectedRevisionIds: list(parsed.exampleRejectedRevisionIds, { maxItems: 40, maxLength: 240 }),
    status: enumValue(parsed.status, STATUS_VALUES, STYLE_MEMORY_STATUSES.CANDIDATE, "StyleMemoryHypothesis.status"),
    lastEvaluatedAt: timestamp(parsed.lastEvaluatedAt, "StyleMemoryHypothesis.lastEvaluatedAt"),
    createdAt: timestamp(parsed.createdAt, "StyleMemoryHypothesis.createdAt"),
    updatedAt: timestamp(parsed.updatedAt, "StyleMemoryHypothesis.updatedAt"),
  });
}

export function createStyleMemoryHypothesis(values = {}) {
  return normalizeStyleMemoryHypothesis(values);
}

export function deriveStyleMemoryState({ supportingCount = 0, contradictingCount = 0, explicitlyConfirmed = false } = {}) {
  if (explicitlyConfirmed) return { confidence: 1, status: STYLE_MEMORY_STATUSES.USER_CONFIRMED };
  const confidence = clamp(0.35 + supportingCount * 0.18 - contradictingCount * 0.14, 0.1, 0.95);
  const status = supportingCount >= 2 && confidence >= 0.65
    ? STYLE_MEMORY_STATUSES.ACTIVE
    : STYLE_MEMORY_STATUSES.CANDIDATE;
  return { confidence, status };
}

const ANNOUNCEMENT_WORDS = ["excited to", "thrilled to", "happy to announce", "proud to announce", "proud to share", "launching", "we launched", "announce"];
const PROBLEM_WORDS = ["problem", "issue", "constraint", "challenge", "because", "needed", "why", "reason", "realized"];
const PROMOTIONAL_WORDS = ["game-changing", "revolutionary", "amazing", "incredible", "super excited", "seamless", "unlock", "transformative"];

function countTerms(value, terms) {
  const lower = String(value || "").toLowerCase();
  return terms.reduce((count, term) => count + (lower.includes(term) ? 1 : 0), 0);
}

function firstChunk(value, max = 220) {
  return String(value || "").trim().slice(0, max);
}

export function analyzeRevisionStyleDelta(beforeContent, afterContent) {
  const before = String(beforeContent || "");
  const after = String(afterContent || "");
  const observations = [];
  const beforeOpening = firstChunk(before);
  const afterOpening = firstChunk(after);
  const beforeAnnouncement = countTerms(beforeOpening, ANNOUNCEMENT_WORDS);
  const afterAnnouncement = countTerms(afterOpening, ANNOUNCEMENT_WORDS);
  const beforeProblem = countTerms(beforeOpening, PROBLEM_WORDS);
  const afterProblem = countTerms(afterOpening, PROBLEM_WORDS);
  if (beforeAnnouncement > afterAnnouncement && afterProblem > beforeProblem) {
    observations.push(normalizeStyleObservation({
      hypothesisKey: "opening.problem_reason_over_announcement",
      hypothesis: "Prefer problem/reason openings over announcement-style openings.",
      category: STYLE_MEMORY_CATEGORIES.OPENING,
      direction: STYLE_OBSERVATION_DIRECTIONS.SUPPORT,
      weight: 0.78,
      reason: "The approved edit removed announcement framing and added problem/reason context near the opening.",
    }));
  }

  const beforePromo = countTerms(before, PROMOTIONAL_WORDS);
  const afterPromo = countTerms(after, PROMOTIONAL_WORDS);
  if (beforePromo > afterPromo) {
    observations.push(normalizeStyleObservation({
      hypothesisKey: "tone.restrained_over_promotional",
      hypothesis: "Prefer restrained, concrete language over promotional hype.",
      category: STYLE_MEMORY_CATEGORIES.PROMOTION,
      direction: STYLE_OBSERVATION_DIRECTIONS.SUPPORT,
      weight: 0.72,
      reason: "The approved edit removed promotional language.",
    }));
  }

  const beforeFirstPerson = countTerms(` ${before.toLowerCase()} `, [" i ", " my ", " me "]);
  const afterFirstPerson = countTerms(` ${after.toLowerCase()} `, [" i ", " my ", " me "]);
  if (afterFirstPerson > beforeFirstPerson) {
    observations.push(normalizeStyleObservation({
      hypothesisKey: "voice.first_person_context",
      hypothesis: "Prefer first-person context when explaining personal work or decisions.",
      category: STYLE_MEMORY_CATEGORIES.PERSONALITY,
      direction: STYLE_OBSERVATION_DIRECTIONS.SUPPORT,
      weight: 0.58,
      reason: "The approved edit added first-person context.",
    }));
  }

  if (before.length >= 240 && after.length <= before.length * 0.72) {
    observations.push(normalizeStyleObservation({
      hypothesisKey: "brevity.tighter_drafts",
      hypothesis: "Prefer tighter drafts when the same idea can be expressed more directly.",
      category: STYLE_MEMORY_CATEGORIES.BREVITY,
      direction: STYLE_OBSERVATION_DIRECTIONS.SUPPORT,
      weight: 0.42,
      reason: "The approved edit materially shortened the draft.",
    }));
  }
  return portableClone(observations);
}

export function styleObservationsFromExplicitReason(reason) {
  const value = String(reason || "").toLowerCase();
  const observations = [];
  const push = (input) => observations.push(normalizeStyleObservation(input));
  if (/more direct|direct opening|get to the point|too indirect/.test(value)) push({ hypothesisKey: "opening.more_direct", hypothesis: "Prefer direct openings that get to the point quickly.", category: STYLE_MEMORY_CATEGORIES.OPENING, weight: 0.76 });
  if (/less (corporate|formal)|too corporate/.test(value)) push({ hypothesisKey: "tone.less_corporate", hypothesis: "Prefer a less corporate, more natural tone.", category: STYLE_MEMORY_CATEGORIES.TONE, weight: 0.82 });
  if (/less (generic|vague)|too generic|more specific/.test(value)) push({ hypothesisKey: "specificity.more_concrete", hypothesis: "Prefer concrete, specific language over generic phrasing.", category: STYLE_MEMORY_CATEGORIES.SPECIFICITY, weight: 0.82 });
  if (/less promotional|too promotional|less hype|no hype/.test(value)) push({ hypothesisKey: "tone.restrained_over_promotional", hypothesis: "Prefer restrained, concrete language over promotional hype.", category: STYLE_MEMORY_CATEGORIES.PROMOTION, weight: 0.88 });
  if (/more technical|not technical enough/.test(value)) push({ hypothesisKey: "technicality.more_technical", hypothesis: "Prefer more technical detail when the audience can use it.", category: STYLE_MEMORY_CATEGORIES.TECHNICALITY, weight: 0.78 });
  if (/less technical|too technical/.test(value)) push({ hypothesisKey: "technicality.less_technical", hypothesis: "Prefer less technical framing unless the detail is necessary.", category: STYLE_MEMORY_CATEGORIES.TECHNICALITY, weight: 0.78 });
  if (/shorter|more concise|too long|tighter/.test(value)) push({ hypothesisKey: "brevity.tighter_drafts", hypothesis: "Prefer tighter drafts when the same idea can be expressed more directly.", category: STYLE_MEMORY_CATEGORIES.BREVITY, weight: 0.72 });
  if (/more personal|first person|sound like me/.test(value)) push({ hypothesisKey: "voice.first_person_context", hypothesis: "Prefer first-person context when explaining personal work or decisions.", category: STYLE_MEMORY_CATEGORIES.PERSONALITY, weight: 0.68 });
  return portableClone(observations);
}
