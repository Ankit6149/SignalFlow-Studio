import { normalizeCriticResult } from "../domain/platformVariantReviews.mjs";

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function text(value, maxLength = 12000) {
  return String(value ?? "").replace(/\r\n?/g, "\n").trim().slice(0, maxLength);
}

function list(value, maxItems = 40, maxLength = 1200) {
  return (Array.isArray(value) ? value : []).map((item) => text(item, maxLength)).filter(Boolean).slice(0, maxItems);
}

export function normalizeVariantCriticInput(input = {}) {
  const revision = record(input.revision);
  const variant = record(input.variant);
  const strategy = record(input.strategy);
  const contentPiece = record(input.contentPiece);
  const sourceSignal = record(input.sourceSignal);
  const identityContext = record(input.identityContext);
  const dataClassification = text(input.dataClassification, 80).toLowerCase();

  if (!text(revision.platformVariantRevisionId, 240) || !text(revision.content, 12000)) throw new TypeError("Critic requires an exact PlatformVariantRevision with content.");
  if (!text(variant.platformVariantId, 240) || variant.currentRevisionId !== revision.platformVariantRevisionId) throw new TypeError("Critic only reviews the current exact PlatformVariantRevision.");
  if (!text(strategy.narrativeStrategyId, 240) || strategy.narrativeStrategyId !== revision.narrativeStrategyId || strategy.strategyRevision !== revision.strategyRevision) {
    throw new TypeError("Critic requires the exact NarrativeStrategy revision used by the draft.");
  }
  if (!text(contentPiece.contentPieceId, 240) || contentPiece.contentPieceId !== revision.contentPieceId) throw new TypeError("Critic requires the canonical ContentPiece used by the draft.");
  if (!text(sourceSignal.signalId, 240) || sourceSignal.workspaceId !== revision.workspaceId) throw new TypeError("Critic requires the canonical source Signal in the same workspace.");
  if (!text(identityContext.identityContextSnapshotId, 240) || identityContext.identityContextSnapshotId !== revision.identityContextSnapshotId || identityContext.workspaceId !== revision.workspaceId) {
    throw new TypeError("Critic requires the exact Identity Context Snapshot used by the draft.");
  }
  if (identityContext.platform !== revision.destination) throw new TypeError("Identity Context Snapshot platform must match the reviewed destination.");
  if (!dataClassification) throw new TypeError("Critic requires the source data classification.");

  return {
    revision,
    variant,
    strategy,
    contentPiece,
    sourceSignal,
    identityContext,
    dataClassification,
  };
}

function responseContract(label) {
  return `Return ONLY valid JSON in this exact shape:\n{"verdict":"pass|warn|block","summary":"one concise user-facing sentence","findings":[{"code":"short_machine_code","severity":"info|warning|block","message":"concise finding the user can act on","suggestion":"optional concrete fix","evidenceRefs":["optional opaque source IDs"]}]}\nDo not include hidden reasoning, chain-of-thought, scoring traces, or speculative facts.`;
}

export function buildEvidenceCriticPrompt(input = {}) {
  const { revision, strategy, contentPiece, sourceSignal } = normalizeVariantCriticInput(input);
  return `You are SignalFlow's factual/evidence critic. Review ONE exact ${revision.destination === "x" ? "X" : "LinkedIn"} draft revision.

Your job is narrow: identify claims in the draft that are unsupported, overstated, contradicted, or materially less precise than the supplied canonical evidence. Do NOT judge writing style or whether it sounds like the author; that is a separate critic.

RULES:
- Treat only the supplied source Signal, approved NarrativeStrategy, ContentPiece claims/evidence references, and explicit factual constraints as evidence.
- Never use outside knowledge to "fill in" a missing fact.
- A claim may be plausible and still be unsupported here.
- Block fabricated metrics, customers, dates, shipped-state claims, integrations, results, or personal experiences not supported by the supplied evidence.
- Use warning for wording that may overstate or blur a supported fact but is straightforward to correct.
- Use info only for non-blocking precision notes.
- If the draft makes no unsupported material claim, return pass with no findings.
- Findings must be concise and user-visible; do not expose internal reasoning.

EXACT DRAFT REVISION:
${JSON.stringify({ revisionId: revision.platformVariantRevisionId, destination: revision.destination, content: revision.content, segments: revision.segments || [] }, null, 2)}

CANONICAL SOURCE SIGNAL:
${JSON.stringify({ signalId: sourceSignal.signalId, headline: sourceSignal.headline, summary: sourceSignal.summary, boundaryNote: sourceSignal.boundaryNote || null }, null, 2)}

APPROVED STRATEGY FACTUAL CONTRACT:
${JSON.stringify({ strategyRevision: strategy.strategyRevision, coreIdea: strategy.coreIdea, audienceTakeaway: strategy.audienceTakeaway, factualConstraints: list(strategy.factualConstraints), evidencePlan: list(strategy.evidencePlan) }, null, 2)}

CONTENT PIECE:
${JSON.stringify({ canonicalIntent: contentPiece.canonicalIntent, claims: list(contentPiece.claims), evidenceRefs: list(contentPiece.evidenceRefs, 50, 240) }, null, 2)}

${responseContract("evidence")}`;
}

export function buildAuthenticityCriticPrompt(input = {}) {
  const { revision, strategy, identityContext } = normalizeVariantCriticInput(input);
  return `You are SignalFlow's authenticity critic. Review ONE exact ${revision.destination === "x" ? "X" : "LinkedIn"} draft revision against the exact Identity Context Snapshot used to create it.

Your job is narrow: identify language that materially conflicts with the user's explicit Voice, desired perception, platform expression, project guidance, or boundaries. Do NOT re-evaluate factual support; that is a separate critic.

RULES:
- Explicit boundaries outrank every style preference.
- Block text that clearly violates an explicit blocked rule/topic/claim.
- Warn when the copy sounds materially unlike the saved Voice, uses disliked generic AI/marketing patterns, forced engagement, unsupported founder persona, or platform behavior the snapshot says to avoid.
- Do not demand stylistic sameness; preserve natural variation.
- Do not invent preferences not present in the snapshot.
- If the draft is compatible with the snapshot, return pass with no findings.
- Findings must explain the observable mismatch and, when useful, suggest a concrete rewrite direction.
- Do not expose hidden reasoning or chain-of-thought.

EXACT DRAFT REVISION:
${JSON.stringify({ revisionId: revision.platformVariantRevisionId, destination: revision.destination, content: revision.content, segments: revision.segments || [] }, null, 2)}

APPROVED STORY INTENT:
${JSON.stringify({ strategyRevision: strategy.strategyRevision, coreIdea: strategy.coreIdea, audienceTakeaway: strategy.audienceTakeaway }, null, 2)}

EXACT IDENTITY CONTEXT SNAPSHOT:
${JSON.stringify({
    identityContextSnapshotId: identityContext.identityContextSnapshotId,
    identity: record(identityContext.identity),
    perception: record(identityContext.perception),
    voice: record(identityContext.voice),
    boundaries: record(identityContext.boundaries),
    platformExpression: record(identityContext.platformExpression),
    projectGuidance: record(identityContext.projectGuidance),
    campaignInstructions: list(identityContext.campaignInstructions),
    effectiveRules: Array.isArray(identityContext.effectiveRules) ? identityContext.effectiveRules.slice(0, 100) : [],
  }, null, 2)}

${responseContract("authenticity")}`;
}

export function acceptEvidenceCritic(raw = {}) {
  return normalizeCriticResult(raw, "evidence");
}

export function acceptAuthenticityCritic(raw = {}) {
  return normalizeCriticResult(raw, "authenticity");
}
