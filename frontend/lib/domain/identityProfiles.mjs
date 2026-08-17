import { createDomainRecord, parseDomainRecord, portableClone } from "./contracts.mjs";

export const IDENTITY_PROFILE_SCHEMA_VERSION = 1;

export const IDENTITY_RECORD_KINDS = Object.freeze({
  IDENTITY: "IdentityProfile",
  PERCEPTION: "PerceptionProfile",
  VOICE: "VoiceProfile",
  BOUNDARY: "BoundaryProfile",
  PLATFORM_EXPRESSION: "PlatformExpressionProfile",
  PROJECT_GUIDANCE: "ProjectGuidanceProfile",
  CONTEXT_SNAPSHOT: "IdentityContextSnapshot",
});

export const IDENTITY_PRECEDENCE = Object.freeze([
  "safety_authorization",
  "explicit_boundary",
  "campaign_instruction",
  "platform_preference",
  "global_identity_voice",
  "learned_preference",
  "generic_platform_default",
]);

const PLATFORM_VALUES = new Set(["linkedin", "x"]);
const TECHNICAL_DEPTH = new Set(["light", "balanced", "deep"]);
const VULNERABILITY = new Set(["avoid", "selective", "open"]);
const EMOJI_POLICY = new Set(["none", "rare", "natural", "allowed"]);
const ENFORCEMENT = new Set(["block", "warn"]);

function text(value, fallback = "", maxLength = 12000) {
  const normalized = String(value ?? "").replace(/\r\n?/g, "\n").trim();
  const resolved = normalized || fallback;
  if (resolved.length > maxLength) throw new TypeError(`Identity profile text exceeds ${maxLength} characters.`);
  return resolved;
}

function optionalText(value, maxLength = 12000) {
  const normalized = text(value, "", maxLength);
  return normalized || null;
}

function opaqueId(value, field, required = true) {
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

function version(value) {
  const resolved = Number(value || 1);
  if (!Number.isInteger(resolved) || resolved < 1) throw new TypeError("Profile version must be a positive integer.");
  return resolved;
}

function enumValue(value, allowed, fallback, field) {
  const normalized = text(value, fallback, 80).toLowerCase();
  if (!allowed.has(normalized)) throw new TypeError(`${field} contains an unsupported value: ${normalized}.`);
  return normalized;
}

function stringList(values, maxItems = 80, maxLength = 1000) {
  if (values === undefined || values === null) return [];
  if (!Array.isArray(values)) throw new TypeError("Identity profile list fields must be arrays.");
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

function common(input, { idField, kind }) {
  const parsed = input?.kind === kind ? parseDomainRecord(input, kind) : input;
  if (parsed?.profileSchemaVersion && parsed.profileSchemaVersion > IDENTITY_PROFILE_SCHEMA_VERSION) {
    throw new TypeError(`${kind} schema ${parsed.profileSchemaVersion} is newer than supported schema ${IDENTITY_PROFILE_SCHEMA_VERSION}.`);
  }
  const createdAt = timestamp(parsed.createdAt, null, `${kind}.createdAt`);
  if (!createdAt) throw new TypeError(`${kind}.createdAt is required.`);
  return {
    parsed,
    values: {
      profileSchemaVersion: IDENTITY_PROFILE_SCHEMA_VERSION,
      [idField]: opaqueId(parsed[idField], `${kind}.${idField}`),
      workspaceId: opaqueId(parsed.workspaceId, `${kind}.workspaceId`),
      userId: opaqueId(parsed.userId, `${kind}.userId`),
      version: version(parsed.version),
      supersedesId: opaqueId(parsed.supersedesId, `${kind}.supersedesId`, false),
      createdAt,
      updatedAt: timestamp(parsed.updatedAt, createdAt, `${kind}.updatedAt`),
    },
  };
}

export function normalizeIdentityProfile(input = {}) {
  const { parsed, values } = common(input, { idField: "identityProfileId", kind: IDENTITY_RECORD_KINDS.IDENTITY });
  return createDomainRecord(IDENTITY_RECORD_KINDS.IDENTITY, {
    ...values,
    primaryTopics: stringList(parsed.primaryTopics, 40, 500),
    expertise: stringList(parsed.expertise, 40, 500),
    interests: stringList(parsed.interests, 40, 500),
    worldviewNotes: optionalText(parsed.worldviewNotes, 6000),
    recurringThemes: stringList(parsed.recurringThemes, 40, 500),
    personalityTraits: stringList(parsed.personalityTraits, 30, 300),
    backgroundContext: optionalText(parsed.backgroundContext, 8000),
    technicalDepth: enumValue(parsed.technicalDepth, TECHNICAL_DEPTH, "balanced", "IdentityProfile.technicalDepth"),
    vulnerabilityPreference: enumValue(parsed.vulnerabilityPreference, VULNERABILITY, "selective", "IdentityProfile.vulnerabilityPreference"),
    humorStyle: optionalText(parsed.humorStyle, 1200),
    confidenceStyle: optionalText(parsed.confidenceStyle, 1200),
    approvedContextNotes: stringList(parsed.approvedContextNotes, 50, 1200),
  });
}

export function normalizePerceptionProfile(input = {}) {
  const { parsed, values } = common(input, { idField: "perceptionProfileId", kind: IDENTITY_RECORD_KINDS.PERCEPTION });
  return createDomainRecord(IDENTITY_RECORD_KINDS.PERCEPTION, {
    ...values,
    qualitiesToSignal: stringList(parsed.qualitiesToSignal, 40, 500),
    qualitiesToAvoid: stringList(parsed.qualitiesToAvoid, 40, 500),
    desiredAudienceImpressions: stringList(parsed.desiredAudienceImpressions, 40, 700),
    longTermNarrative: stringList(parsed.longTermNarrative, 40, 1000),
    currentPositioning: stringList(parsed.currentPositioning, 40, 1000),
    credibilitySignals: stringList(parsed.credibilitySignals, 50, 1000),
    antiPatterns: stringList(parsed.antiPatterns, 50, 1000),
  });
}

export function normalizeVoiceProfile(input = {}) {
  const { parsed, values } = common(input, { idField: "voiceProfileId", kind: IDENTITY_RECORD_KINDS.VOICE });
  return createDomainRecord(IDENTITY_RECORD_KINDS.VOICE, {
    ...values,
    writingPrinciples: stringList(parsed.writingPrinciples, 60, 1000),
    dislikes: stringList(parsed.dislikes, 60, 1000),
    openingPreferences: stringList(parsed.openingPreferences, 40, 700),
    openingAntiPatterns: stringList(parsed.openingAntiPatterns, 40, 700),
    preferredVocabulary: stringList(parsed.preferredVocabulary, 80, 200),
    bannedVocabulary: stringList(parsed.bannedVocabulary, 80, 200),
    rhythm: optionalText(parsed.rhythm, 1200),
    emojiPolicy: enumValue(parsed.emojiPolicy, EMOJI_POLICY, "rare", "VoiceProfile.emojiPolicy"),
    hashtagPolicy: optionalText(parsed.hashtagPolicy, 1000),
    ctaStyle: optionalText(parsed.ctaStyle, 1000),
    formattingPreferences: stringList(parsed.formattingPreferences, 40, 500),
    storytellingPatterns: stringList(parsed.storytellingPatterns, 40, 1000),
    technicalExplanationStyle: optionalText(parsed.technicalExplanationStyle, 1600),
    approvedExamples: stringList(parsed.approvedExamples, 12, 5000),
    rejectedExamples: stringList(parsed.rejectedExamples, 12, 5000),
  });
}

function normalizeCustomRules(values) {
  if (!Array.isArray(values)) return [];
  return portableClone(values.slice(0, 80).map((rule, index) => {
    if (!rule || typeof rule !== "object" || Array.isArray(rule)) throw new TypeError("Boundary custom rules must be objects.");
    const scope = text(rule.scope, "global", 80).toLowerCase();
    if (!["global", "project", "platform", "time"].includes(scope)) throw new TypeError(`Unsupported boundary scope: ${scope}.`);
    const enforcement = enumValue(rule.enforcement, ENFORCEMENT, "block", `BoundaryProfile.customRules[${index}].enforcement`);
    return {
      ruleId: text(rule.ruleId, `rule-${index + 1}`, 120),
      scope,
      projectId: rule.projectId ? opaqueId(rule.projectId, "BoundaryProfile.customRules.projectId") : null,
      platform: rule.platform ? enumValue(rule.platform, PLATFORM_VALUES, "linkedin", "BoundaryProfile.customRules.platform") : null,
      enforcement,
      rule: text(rule.rule, "", 2000),
      confidentialUntil: timestamp(rule.confidentialUntil, null, "BoundaryProfile.customRules.confidentialUntil"),
    };
  }).filter((rule) => rule.rule));
}

export function normalizeBoundaryProfile(input = {}) {
  const { parsed, values } = common(input, { idField: "boundaryProfileId", kind: IDENTITY_RECORD_KINDS.BOUNDARY });
  return createDomainRecord(IDENTITY_RECORD_KINDS.BOUNDARY, {
    ...values,
    blockedTopics: stringList(parsed.blockedTopics, 60, 500),
    blockedPeopleProjects: stringList(parsed.blockedPeopleProjects, 60, 500),
    blockedPhrases: stringList(parsed.blockedPhrases, 100, 500),
    unverifiedMetricsPolicy: enumValue(parsed.unverifiedMetricsPolicy, ENFORCEMENT, "block", "BoundaryProfile.unverifiedMetricsPolicy"),
    fabricatedVulnerabilityPolicy: enumValue(parsed.fabricatedVulnerabilityPolicy, ENFORCEMENT, "block", "BoundaryProfile.fabricatedVulnerabilityPolicy"),
    exaggeratedLaunchLanguagePolicy: enumValue(parsed.exaggeratedLaunchLanguagePolicy, ENFORCEMENT, "warn", "BoundaryProfile.exaggeratedLaunchLanguagePolicy"),
    customRules: normalizeCustomRules(parsed.customRules),
  });
}

export function normalizePlatformExpressionProfile(input = {}) {
  const { parsed, values } = common(input, { idField: "platformExpressionProfileId", kind: IDENTITY_RECORD_KINDS.PLATFORM_EXPRESSION });
  return createDomainRecord(IDENTITY_RECORD_KINDS.PLATFORM_EXPRESSION, {
    ...values,
    platform: enumValue(parsed.platform, PLATFORM_VALUES, "linkedin", "PlatformExpressionProfile.platform"),
    expressionRules: stringList(parsed.expressionRules, 50, 1000),
    preferredFormats: stringList(parsed.preferredFormats, 20, 300),
    narrativeDepth: text(parsed.narrativeDepth, "balanced", 120),
    concision: text(parsed.concision, "balanced", 120),
    ctaStyle: optionalText(parsed.ctaStyle, 800),
  });
}

export function normalizeProjectGuidanceProfile(input = {}) {
  const { parsed, values } = common(input, { idField: "projectGuidanceProfileId", kind: IDENTITY_RECORD_KINDS.PROJECT_GUIDANCE });
  return createDomainRecord(IDENTITY_RECORD_KINDS.PROJECT_GUIDANCE, {
    ...values,
    projectId: opaqueId(parsed.projectId, "ProjectGuidanceProfile.projectId"),
    terminology: stringList(parsed.terminology, 60, 500),
    audience: stringList(parsed.audience, 40, 700),
    approvedFacts: stringList(parsed.approvedFacts, 100, 1500),
    prohibitedClaims: stringList(parsed.prohibitedClaims, 100, 1000),
    stage: optionalText(parsed.stage, 500),
    recurringThemes: stringList(parsed.recurringThemes, 50, 800),
    visualGuidance: stringList(parsed.visualGuidance, 50, 1000),
  });
}

function normalizeProfileRefs(refs = {}) {
  const result = {};
  for (const [key, value] of Object.entries(refs || {})) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    result[key] = {
      id: opaqueId(value.id, `IdentityContextSnapshot.profileRefs.${key}.id`),
      version: version(value.version),
    };
  }
  return portableClone(result);
}

export function normalizeIdentityContextSnapshot(input = {}) {
  const parsed = input?.kind === IDENTITY_RECORD_KINDS.CONTEXT_SNAPSHOT
    ? parseDomainRecord(input, IDENTITY_RECORD_KINDS.CONTEXT_SNAPSHOT)
    : input;
  const createdAt = timestamp(parsed.createdAt, null, "IdentityContextSnapshot.createdAt");
  if (!createdAt) throw new TypeError("IdentityContextSnapshot.createdAt is required.");
  return createDomainRecord(IDENTITY_RECORD_KINDS.CONTEXT_SNAPSHOT, {
    identityContextSnapshotId: opaqueId(parsed.identityContextSnapshotId, "IdentityContextSnapshot.identityContextSnapshotId"),
    workspaceId: opaqueId(parsed.workspaceId, "IdentityContextSnapshot.workspaceId"),
    userId: opaqueId(parsed.userId, "IdentityContextSnapshot.userId"),
    platform: parsed.platform ? enumValue(parsed.platform, PLATFORM_VALUES, "linkedin", "IdentityContextSnapshot.platform") : null,
    projectId: opaqueId(parsed.projectId, "IdentityContextSnapshot.projectId", false),
    profileRefs: normalizeProfileRefs(parsed.profileRefs),
    precedence: Array.isArray(parsed.precedence) ? stringList(parsed.precedence, 20, 120) : [...IDENTITY_PRECEDENCE],
    identity: portableClone(parsed.identity || {}),
    perception: portableClone(parsed.perception || {}),
    voice: portableClone(parsed.voice || {}),
    boundaries: portableClone(parsed.boundaries || {}),
    platformExpression: portableClone(parsed.platformExpression || {}),
    projectGuidance: portableClone(parsed.projectGuidance || {}),
    campaignInstructions: stringList(parsed.campaignInstructions, 40, 1200),
    effectiveRules: portableClone(parsed.effectiveRules || []),
    createdAt,
  });
}

export function normalizeIdentityRecord(input = {}) {
  switch (input?.kind) {
    case IDENTITY_RECORD_KINDS.IDENTITY: return normalizeIdentityProfile(input);
    case IDENTITY_RECORD_KINDS.PERCEPTION: return normalizePerceptionProfile(input);
    case IDENTITY_RECORD_KINDS.VOICE: return normalizeVoiceProfile(input);
    case IDENTITY_RECORD_KINDS.BOUNDARY: return normalizeBoundaryProfile(input);
    case IDENTITY_RECORD_KINDS.PLATFORM_EXPRESSION: return normalizePlatformExpressionProfile(input);
    case IDENTITY_RECORD_KINDS.PROJECT_GUIDANCE: return normalizeProjectGuidanceProfile(input);
    case IDENTITY_RECORD_KINDS.CONTEXT_SNAPSHOT: return normalizeIdentityContextSnapshot(input);
    default: throw new TypeError(`Unknown identity record kind: ${input?.kind || "missing"}.`);
  }
}

function phraseMatches(textValue, phrases) {
  const haystack = String(textValue || "").toLowerCase();
  return phrases.filter((phrase) => haystack.includes(String(phrase).toLowerCase()));
}

export function evaluateExplicitBoundaryText(textValue, snapshotInput) {
  const snapshot = normalizeIdentityContextSnapshot(snapshotInput);
  const boundaries = snapshot.boundaries || {};
  const project = snapshot.projectGuidance || {};
  const blocked = [];
  const warnings = [];

  for (const phrase of phraseMatches(textValue, boundaries.blockedPhrases || [])) {
    blocked.push({ code: "blocked_phrase", value: phrase, reason: `Explicit boundary blocks the phrase “${phrase}”.` });
  }
  for (const phrase of phraseMatches(textValue, project.prohibitedClaims || [])) {
    blocked.push({ code: "prohibited_project_claim", value: phrase, reason: `Project guidance prohibits the claim “${phrase}”.` });
  }
  const exaggerated = ["game-changing", "revolutionary", "groundbreaking", "world-class", "best-in-class"];
  const exaggeratedMatches = phraseMatches(textValue, exaggerated);
  if (exaggeratedMatches.length) {
    const target = boundaries.exaggeratedLaunchLanguagePolicy === "block" ? blocked : warnings;
    for (const phrase of exaggeratedMatches) target.push({ code: "exaggerated_launch_language", value: phrase, reason: `The phrase “${phrase}” conflicts with the configured launch-language boundary.` });
  }

  return portableClone({
    allowed: blocked.length === 0,
    blocked,
    warnings,
    snapshotId: snapshot.identityContextSnapshotId,
  });
}
