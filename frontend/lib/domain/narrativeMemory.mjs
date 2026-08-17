import {
  createDomainRecord,
  parseDomainRecord,
  portableClone,
  stableStringify,
} from "./contracts.mjs";

export const NARRATIVE_MEMORY_SCHEMA_VERSION = 1;

export const NARRATIVE_HISTORY_STRENGTHS = Object.freeze({
  PREPARED_INTERNAL: "prepared_internal",
  PUBLISHED_CONFIRMED: "published_confirmed",
});

export const REPETITION_RISK_LEVELS = Object.freeze({
  NONE: "none",
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  UNKNOWN: "unknown",
});

export const REPETITION_ACTIONS = Object.freeze({
  OKAY: "okay",
  DIFFERENTIATE: "differentiate",
  POSTPONE: "postpone",
  FOLLOW_UP: "follow_up",
  SKIP: "skip",
});

const HISTORY_STRENGTHS = new Set(Object.values(NARRATIVE_HISTORY_STRENGTHS));
const PLATFORMS = new Set(["linkedin", "x"]);
const RISK_LEVELS = new Set(Object.values(REPETITION_RISK_LEVELS));
const ACTIONS = new Set(Object.values(REPETITION_ACTIONS));

function text(value, fallback = "", maxLength = 2400) {
  const normalized = String(value ?? "").replace(/\r\n?/g, "\n").trim();
  const resolved = normalized || fallback;
  if (resolved.length > maxLength) throw new TypeError(`NarrativeMemory text exceeds ${maxLength} characters.`);
  return resolved;
}

function optionalText(value, maxLength = 2400) {
  const normalized = text(value, "", maxLength);
  return normalized || null;
}

function id(value, field, required = true) {
  const normalized = text(value, "", 240);
  if (!normalized && !required) return null;
  if (!normalized) throw new TypeError(`NarrativeMemory.${field} is required.`);
  if (/[/\\]|^[a-zA-Z]:/.test(normalized)) throw new TypeError(`NarrativeMemory.${field} must be an opaque ID.`);
  return normalized;
}

function timestamp(value, fallback = null, field = "timestamp") {
  const candidate = value || fallback;
  if (!candidate) return null;
  const parsed = Date.parse(candidate);
  if (!Number.isFinite(parsed)) throw new TypeError(`NarrativeMemory.${field} must be an ISO timestamp.`);
  return new Date(parsed).toISOString();
}

function enumValue(value, values, fallback, field) {
  const normalized = text(value, fallback, 80).toLowerCase();
  if (!values.has(normalized)) throw new TypeError(`NarrativeMemory.${field} contains unsupported value: ${normalized}.`);
  return normalized;
}

function list(values, { maxItems = 80, maxLength = 1200 } = {}) {
  if (values === undefined || values === null) return [];
  if (!Array.isArray(values)) throw new TypeError("NarrativeMemory list fields must be arrays.");
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

function normalizeWords(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 3);
}

function hashText(value) {
  const source = String(value || "");
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function lexicalSignature(value, { maxItems = 96 } = {}) {
  const words = normalizeWords(value);
  const hashes = [];
  const seen = new Set();
  if (words.length < 3) {
    for (const word of words) {
      const hashed = `w:${hashText(word)}`;
      if (!seen.has(hashed)) {
        seen.add(hashed);
        hashes.push(hashed);
      }
    }
    return hashes.slice(0, maxItems);
  }
  for (let index = 0; index <= words.length - 3; index += 1) {
    const hashed = `g3:${hashText(words.slice(index, index + 3).join(" "))}`;
    if (seen.has(hashed)) continue;
    seen.add(hashed);
    hashes.push(hashed);
    if (hashes.length >= maxItems) break;
  }
  return hashes;
}

export function narrativeSemanticFingerprint({ topic, angle, coreIdea, claims = [] } = {}) {
  const source = stableStringify({
    topic: text(topic, "", 800).toLowerCase(),
    angle: text(angle, "", 800).toLowerCase(),
    coreIdea: text(coreIdea, "", 2400).toLowerCase(),
    claims: list(claims, { maxItems: 30, maxLength: 1200 }).map((item) => item.toLowerCase()).sort(),
  });
  return `sf-narrative-v1-${hashText(source)}-${source.length}`;
}

export function normalizeNarrativeMemory(input = {}) {
  const parsed = input?.kind === "NarrativeMemory" && input?.schemaVersion
    ? parseDomainRecord(input, "NarrativeMemory")
    : input;
  const createdAt = timestamp(parsed.createdAt, null, "createdAt");
  if (!createdAt) throw new TypeError("NarrativeMemory.createdAt is required.");
  const historyStrength = enumValue(
    parsed.historyStrength,
    HISTORY_STRENGTHS,
    NARRATIVE_HISTORY_STRENGTHS.PREPARED_INTERNAL,
    "historyStrength",
  );
  const publishedAt = timestamp(parsed.publishedAt, null, "publishedAt");
  if (historyStrength === NARRATIVE_HISTORY_STRENGTHS.PUBLISHED_CONFIRMED && !publishedAt) {
    throw new TypeError("NarrativeMemory published_confirmed history requires publishedAt.");
  }
  if (historyStrength === NARRATIVE_HISTORY_STRENGTHS.PREPARED_INTERNAL && publishedAt) {
    throw new TypeError("NarrativeMemory prepared_internal history cannot claim publishedAt.");
  }
  const topic = text(parsed.topic, "", 1000);
  const angle = text(parsed.angle, "", 1000);
  const coreIdea = text(parsed.coreIdea, "", 2400);
  if (!topic || !angle || !coreIdea) throw new TypeError("NarrativeMemory requires topic, angle, and coreIdea.");
  const claims = list(parsed.claims, { maxItems: 30, maxLength: 1200 });
  return createDomainRecord("NarrativeMemory", {
    narrativeMemorySchemaVersion: NARRATIVE_MEMORY_SCHEMA_VERSION,
    narrativeMemoryId: id(parsed.narrativeMemoryId, "narrativeMemoryId"),
    workspaceId: id(parsed.workspaceId, "workspaceId"),
    projectId: id(parsed.projectId, "projectId", false),
    opportunityId: id(parsed.opportunityId, "opportunityId"),
    narrativeStrategyId: id(parsed.narrativeStrategyId, "narrativeStrategyId"),
    contentPieceId: id(parsed.contentPieceId, "contentPieceId"),
    platformVariantId: id(parsed.platformVariantId, "platformVariantId"),
    platformVariantRevisionId: id(parsed.platformVariantRevisionId, "platformVariantRevisionId"),
    platformVariantApprovalId: id(parsed.platformVariantApprovalId, "platformVariantApprovalId"),
    platform: enumValue(parsed.platform, PLATFORMS, "linkedin", "platform"),
    historyStrength,
    topic,
    angle,
    coreIdea,
    claims,
    evidenceRefs: list(parsed.evidenceRefs, { maxItems: 60, maxLength: 240 }),
    mediaAssetIds: list(parsed.mediaAssetIds, { maxItems: 60, maxLength: 240 }),
    lexicalHashes: list(parsed.lexicalHashes, { maxItems: 96, maxLength: 40 }),
    semanticFingerprint: text(
      parsed.semanticFingerprint,
      narrativeSemanticFingerprint({ topic, angle, coreIdea, claims }),
      160,
    ),
    approvedAt: timestamp(parsed.approvedAt, createdAt, "approvedAt"),
    publishedAt: historyStrength === NARRATIVE_HISTORY_STRENGTHS.PUBLISHED_CONFIRMED ? publishedAt : null,
    createdAt,
    updatedAt: timestamp(parsed.updatedAt, createdAt, "updatedAt"),
  });
}

export function createPreparedNarrativeMemory({
  narrativeMemoryId,
  workspaceId,
  projectId = null,
  opportunityId,
  narrativeStrategyId,
  contentPieceId,
  platformVariantId,
  platformVariantRevisionId,
  platformVariantApprovalId,
  platform,
  topic,
  angle,
  coreIdea,
  claims = [],
  evidenceRefs = [],
  mediaAssetIds = [],
  approvedContent = "",
  approvedAt,
  createdAt = approvedAt,
} = {}) {
  return normalizeNarrativeMemory({
    narrativeMemoryId,
    workspaceId,
    projectId,
    opportunityId,
    narrativeStrategyId,
    contentPieceId,
    platformVariantId,
    platformVariantRevisionId,
    platformVariantApprovalId,
    platform,
    historyStrength: NARRATIVE_HISTORY_STRENGTHS.PREPARED_INTERNAL,
    topic,
    angle,
    coreIdea,
    claims,
    evidenceRefs,
    mediaAssetIds,
    lexicalHashes: lexicalSignature(approvedContent),
    semanticFingerprint: narrativeSemanticFingerprint({ topic, angle, coreIdea, claims }),
    approvedAt,
    publishedAt: null,
    createdAt,
    updatedAt: createdAt,
  });
}

function tokenSet(value) {
  return new Set(normalizeWords(value));
}

function jaccard(left, right) {
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const item of left) if (right.has(item)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

function overlapRatio(leftValues, rightValues) {
  const left = new Set(leftValues || []);
  const right = new Set(rightValues || []);
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const item of left) if (right.has(item)) intersection += 1;
  return intersection / Math.min(left.size, right.size);
}

function daysBetween(left, right) {
  const leftTime = Date.parse(left || "");
  const rightTime = Date.parse(right || "");
  if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) return null;
  return Math.abs(rightTime - leftTime) / 86400000;
}

function normalizeCandidate(candidate = {}) {
  return {
    projectId: optionalText(candidate.projectId, 240),
    topic: text(candidate.topic || candidate.title, "", 1000),
    summary: text(candidate.summary, "", 4000),
    angle: text(candidate.angle || candidate.selectedAngle?.title || candidate.recommendedAngle?.title, "", 1000),
    angleSummary: text(candidate.angleSummary || candidate.selectedAngle?.summary || candidate.recommendedAngle?.summary, "", 1600),
    coreIdea: text(candidate.coreIdea || candidate.summary, "", 2400),
    claims: list(candidate.claims, { maxItems: 30, maxLength: 1200 }),
    destinations: Array.from(new Set((candidate.destinations || []).map((item) => String(item || "").toLowerCase()).filter((item) => PLATFORMS.has(item)))),
    lexicalHashes: lexicalSignature(`${candidate.title || ""}\n${candidate.summary || ""}\n${candidate.angle || candidate.selectedAngle?.title || candidate.recommendedAngle?.title || ""}`),
    occurredAt: candidate.occurredAt || candidate.createdAt || null,
    hasFollowUpEvidence: candidate.hasFollowUpEvidence === true,
  };
}

export function buildNarrativeRepetitionReport(candidateInput = {}, memoryInputs = [], { now = new Date().toISOString(), maxMatches = 5 } = {}) {
  const candidate = normalizeCandidate(candidateInput);
  const memories = (Array.isArray(memoryInputs) ? memoryInputs : [])
    .map(normalizeNarrativeMemory)
    .filter((memory) => !candidate.projectId || !memory.projectId || memory.projectId === candidate.projectId)
    .filter((memory) => !candidate.destinations.length || candidate.destinations.includes(memory.platform));

  if (!memories.length) {
    return portableClone({
      riskLevel: REPETITION_RISK_LEVELS.UNKNOWN,
      recommendedAction: REPETITION_ACTIONS.OKAY,
      matchedMemoryIds: [],
      matches: [],
      explanation: "No relevant narrative history is available yet, so repetition cannot be confirmed or ruled out.",
      historyAvailable: false,
    });
  }

  const scored = memories.map((memory) => {
    const topicOverlap = jaccard(tokenSet(`${candidate.topic} ${candidate.summary}`), tokenSet(memory.topic));
    const angleOverlap = jaccard(tokenSet(`${candidate.angle} ${candidate.angleSummary}`), tokenSet(memory.angle));
    const coreOverlap = jaccard(tokenSet(candidate.coreIdea), tokenSet(memory.coreIdea));
    const claimOverlap = jaccard(tokenSet(candidate.claims.join(" ")), tokenSet(memory.claims.join(" ")));
    const lexicalOverlap = overlapRatio(candidate.lexicalHashes, memory.lexicalHashes);
    const ageDays = daysBetween(memory.publishedAt || memory.approvedAt, candidate.occurredAt || now);
    const recencyWeight = ageDays === null ? 0.65 : ageDays <= 14 ? 1 : ageDays <= 45 ? 0.85 : ageDays <= 120 ? 0.6 : 0.35;
    const similarity = Math.min(1, (
      topicOverlap * 0.24
      + angleOverlap * 0.30
      + coreOverlap * 0.24
      + claimOverlap * 0.12
      + lexicalOverlap * 0.10
    ) * recencyWeight);
    return {
      narrativeMemoryId: memory.narrativeMemoryId,
      contentPieceId: memory.contentPieceId,
      platform: memory.platform,
      historyStrength: memory.historyStrength,
      topicOverlap,
      angleOverlap,
      coreIdeaOverlap: coreOverlap,
      claimOverlap,
      lexicalOverlap,
      ageDays,
      similarity,
    };
  }).sort((left, right) => right.similarity - left.similarity);

  const matches = scored.filter((item) => item.similarity >= 0.18).slice(0, maxMatches);
  const strongest = matches[0] || null;
  let riskLevel = REPETITION_RISK_LEVELS.LOW;
  let recommendedAction = REPETITION_ACTIONS.OKAY;
  let explanation = "Relevant narrative history exists, but this candidate is sufficiently differentiated from it.";

  if (strongest?.similarity >= 0.68 || (strongest?.angleOverlap >= 0.7 && strongest?.topicOverlap >= 0.5)) {
    riskLevel = REPETITION_RISK_LEVELS.HIGH;
    recommendedAction = candidate.hasFollowUpEvidence ? REPETITION_ACTIONS.FOLLOW_UP : REPETITION_ACTIONS.POSTPONE;
    explanation = candidate.hasFollowUpEvidence
      ? "This closely overlaps a recent prepared story, but the candidate declares new follow-up evidence; frame it explicitly as a follow-up instead of re-announcing the same story."
      : "This closely overlaps a recent prepared story in topic and angle. Differentiate or postpone it instead of preparing the same narrative again.";
  } else if (strongest?.similarity >= 0.42 || strongest?.angleOverlap >= 0.55) {
    riskLevel = REPETITION_RISK_LEVELS.MEDIUM;
    recommendedAction = candidate.hasFollowUpEvidence ? REPETITION_ACTIONS.FOLLOW_UP : REPETITION_ACTIONS.DIFFERENTIATE;
    explanation = candidate.hasFollowUpEvidence
      ? "A related story exists; use the new evidence to make this an explicit follow-up."
      : "A materially similar angle exists in recent story history. Adjust the angle before autopilot preparation.";
  }

  return portableClone({
    riskLevel: enumValue(riskLevel, RISK_LEVELS, REPETITION_RISK_LEVELS.UNKNOWN, "repetitionRiskLevel"),
    recommendedAction: enumValue(recommendedAction, ACTIONS, REPETITION_ACTIONS.OKAY, "repetitionRecommendedAction"),
    matchedMemoryIds: matches.map((item) => item.narrativeMemoryId),
    matches,
    explanation,
    historyAvailable: true,
  });
}
