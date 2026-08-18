function safeRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function cleanString(value, maxLength = 12000) {
  return String(value ?? "").replace(/\r\n?/g, "\n").trim().slice(0, maxLength);
}

function outputString(value, field, maxLength = 12000) {
  const normalized = String(value ?? "").replace(/\r\n?/g, "\n").trim();
  if (normalized.length > maxLength) throw new TypeError(`${field} exceeds ${maxLength} characters.`);
  return normalized;
}

function cleanList(value, maxItems = 40, maxLength = 1200) {
  return (Array.isArray(value) ? value : [])
    .map((item) => cleanString(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function safeIdentitySnapshot(input = {}) {
  const source = safeRecord(input);
  return {
    identityContextSnapshotId: cleanString(source.identityContextSnapshotId, 240),
    workspaceId: cleanString(source.workspaceId, 240),
    platform: cleanString(source.platform, 40) || null,
    projectId: cleanString(source.projectId, 240) || null,
    profileRefs: safeRecord(source.profileRefs),
    identity: safeRecord(source.identity),
    perception: safeRecord(source.perception),
    voice: safeRecord(source.voice),
    boundaries: safeRecord(source.boundaries),
    platformExpression: safeRecord(source.platformExpression),
    projectGuidance: safeRecord(source.projectGuidance),
    campaignInstructions: cleanList(source.campaignInstructions, 40, 1200),
    effectiveRules: Array.isArray(source.effectiveRules) ? source.effectiveRules.slice(0, 100) : [],
  };
}

function safeStyleMemory(input = []) {
  return (Array.isArray(input) ? input : [])
    .map((item) => {
      const source = safeRecord(item);
      const styleMemoryId = cleanString(source.styleMemoryId, 240);
      const hypothesis = cleanString(source.hypothesis, 600);
      if (!styleMemoryId || !hypothesis) return null;
      return {
        styleMemoryId,
        hypothesis,
        category: cleanString(source.category, 80),
        scope: safeRecord(source.scope),
        confidence: Number.isFinite(Number(source.confidence)) ? Number(source.confidence) : 0,
        evidenceCount: Number.isFinite(Number(source.evidenceCount)) ? Number(source.evidenceCount) : 0,
        status: cleanString(source.status, 40),
        updatedAt: cleanString(source.updatedAt, 80),
      };
    })
    .filter(Boolean)
    .slice(0, 8);
}

export function normalizePlatformVariantTaskInput(input = {}) {
  const strategy = safeRecord(input.strategy);
  const contentPiece = safeRecord(input.contentPiece);
  const variant = safeRecord(input.variant);
  const sourceSignal = safeRecord(input.sourceSignal);
  const identityContext = safeIdentitySnapshot(input.identityContext);
  const styleMemory = safeStyleMemory(input.styleMemory);
  const dataClassification = cleanString(input.dataClassification, 80).toLowerCase();
  const destination = cleanString(variant.destination, 40).toLowerCase();

  if (!cleanString(strategy.narrativeStrategyId, 240) || strategy.status !== "approved") {
    throw new TypeError("Platform writing requires an approved persisted NarrativeStrategy.");
  }
  if (!Number.isInteger(strategy.strategyRevision) || strategy.strategyRevision < 1) {
    throw new TypeError("Platform writing requires an exact NarrativeStrategy revision.");
  }
  if (!cleanString(contentPiece.contentPieceId, 240) || contentPiece.narrativeStrategyId !== strategy.narrativeStrategyId) {
    throw new TypeError("Platform writing requires a ContentPiece owned by the approved NarrativeStrategy.");
  }
  if (!cleanString(variant.platformVariantId, 240) || variant.contentPieceId !== contentPiece.contentPieceId || variant.narrativeStrategyId !== strategy.narrativeStrategyId) {
    throw new TypeError("Platform writing requires a PlatformVariant owned by the ContentPiece and strategy.");
  }
  if (!["linkedin", "x"].includes(destination) || variant.status === "omitted") {
    throw new TypeError("Platform writing accepts only non-omitted LinkedIn/X variants.");
  }
  if (!cleanString(sourceSignal.signalId, 240) || sourceSignal.workspaceId !== strategy.workspaceId) {
    throw new TypeError("Platform writing requires the canonical source Signal in the same workspace.");
  }
  if (!identityContext.identityContextSnapshotId || identityContext.workspaceId !== strategy.workspaceId || identityContext.platform !== destination) {
    throw new TypeError("Platform writing requires a destination-specific Identity Context Snapshot in the same workspace.");
  }
  if (!dataClassification) throw new TypeError("Platform writing requires the source data classification.");

  return {
    strategy,
    contentPiece,
    variant: { ...variant, destination },
    sourceSignal,
    identityContext,
    styleMemory,
    dataClassification,
  };
}

export function normalizePlatformVariantDraft(raw = {}, destination = "") {
  const source = safeRecord(raw);
  const platform = cleanString(destination, 40).toLowerCase();
  if (!["linkedin", "x"].includes(platform)) throw new TypeError("Platform draft destination must be LinkedIn or X.");
  const format = outputString(source.format || "single_post", "Platform draft format", 80).toLowerCase();

  if (platform === "linkedin") {
    if (format !== "single_post") throw new TypeError("LinkedIn Personal Alpha currently accepts a single_post draft.");
    const content = outputString(source.content, "LinkedIn draft", 12000);
    if (!content) throw new TypeError("LinkedIn draft content is required.");
    return { format, content, segments: [] };
  }

  if (!["single_post", "thread"].includes(format)) throw new TypeError("X draft format must be single_post or thread.");
  if (format === "single_post") {
    const content = outputString(source.content, "X draft", 12000);
    if (!content) throw new TypeError("X draft content is required.");
    if (content.length > 280) throw new TypeError("X single-post draft exceeds 280 characters.");
    return { format, content, segments: [] };
  }

  const segments = (Array.isArray(source.segments) ? source.segments : [])
    .map((item, index) => outputString(item, `X thread segment ${index + 1}`, 12000))
    .filter(Boolean)
    .slice(0, 8);
  if (segments.length < 2) throw new TypeError("X thread draft requires at least two segments.");
  if (segments.some((segment) => segment.length > 280)) throw new TypeError("X thread segments must be 280 characters or fewer.");
  return { format, content: segments.join("\n\n"), segments };
}

export function buildPlatformVariantPrompt(input = {}) {
  const { strategy, contentPiece, variant, sourceSignal, identityContext, styleMemory } = normalizePlatformVariantTaskInput(input);
  const destination = variant.destination;
  const formatRules = destination === "x"
    ? `For X, choose either single_post (content <= 280 characters) or thread (2-8 segments, each <= 280 characters). Use a thread only if the idea genuinely cannot stay coherent in one post.`
    : `For LinkedIn, return format single_post and one complete native post. Do not turn it into a thread or generic launch announcement.`;

  return `You are SignalFlow's platform writer. Write ONLY the requested ${destination === "x" ? "X" : "LinkedIn"} variant from an already approved story plan.

This is a destination-writing stage, not a strategy stage. The user has already approved the NarrativeStrategy. Preserve that exact story decision.

NON-NEGOTIABLE RULES:
- Use only facts present in the source Signal, approved strategy, ContentPiece, and approved project/identity context. Never invent metrics, customers, dates, integrations, outcomes, life experiences, launch state, or publication history.
- Explicit boundaries and project prohibited claims outrank every writing preference.
- Campaign instructions and explicit platform/global Voice preferences outrank learned preferences.
- Learned preferences are bounded, explainable guidance only. Ignore any learned preference that conflicts with explicit context or does not fit this story.
- Sound like the same person represented by the exact Identity Context Snapshot; adapt only the expression to the destination.
- Do not use generic AI/marketing language, inflated claims, engagement bait, forced questions, emoji/hashtags, or CTA patterns unless the exact Voice/platform context supports them.
- Do not mention SignalFlow's internal planning process, scores, prompts, snapshots, learned-memory IDs, or AI provider.
- Do not add a platform merely because it exists; this task writes only the supplied persisted PlatformVariant.
- Do not explain your reasoning. Return publishable copy only in the JSON fields below.
- ${formatRules}

APPROVED NARRATIVE STRATEGY (revision ${strategy.strategyRevision}):
${JSON.stringify({
    narrativeStrategyId: strategy.narrativeStrategyId,
    strategyRevision: strategy.strategyRevision,
    coreIdea: strategy.coreIdea,
    audienceTakeaway: strategy.audienceTakeaway,
    narrativeArc: strategy.narrativeArc,
    hookDirection: strategy.hookDirection,
    factualConstraints: strategy.factualConstraints,
    boundaryConstraints: strategy.boundaryConstraints,
  }, null, 2)}

CANONICAL CONTENT PIECE:
${JSON.stringify({
    contentPieceId: contentPiece.contentPieceId,
    purpose: contentPiece.purpose,
    canonicalIntent: contentPiece.canonicalIntent,
    claims: contentPiece.claims,
    evidenceRefs: contentPiece.evidenceRefs,
  }, null, 2)}

DESTINATION VARIANT:
${JSON.stringify({
    platformVariantId: variant.platformVariantId,
    destination,
    adaptationIntent: variant.adaptationIntent,
  }, null, 2)}

SOURCE SIGNAL:
${JSON.stringify({
    signalId: sourceSignal.signalId,
    headline: sourceSignal.headline,
    summary: sourceSignal.summary,
    boundaryNote: sourceSignal.boundaryNote || null,
    signalKind: sourceSignal.signalKind,
  }, null, 2)}

EXACT DESTINATION-SPECIFIC IDENTITY CONTEXT:
${JSON.stringify(identityContext, null, 2)}

BOUNDED LEARNED PREFERENCES (LOWER PRECEDENCE THAN EXPLICIT VOICE / BOUNDARIES):
${JSON.stringify(styleMemory, null, 2)}

Return ONLY valid JSON.
For LinkedIn:
{"format":"single_post","content":"...","segments":[]}
For X single post:
{"format":"single_post","content":"...","segments":[]}
For X thread:
{"format":"thread","content":"","segments":["post 1","post 2"]}`;
}

export function acceptPlatformVariantDraft(raw, destination) {
  return normalizePlatformVariantDraft(raw, destination);
}
