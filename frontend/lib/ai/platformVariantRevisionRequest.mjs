import { normalizePlatformVariantDraft } from "./platformVariantWriting.mjs";

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function text(value, maxLength = 12000) {
  const normalized = String(value ?? "").replace(/\r\n?/g, "\n").trim();
  if (normalized.length > maxLength) throw new TypeError(`Change-request text exceeds ${maxLength} characters.`);
  return normalized;
}

function conciseReview(reviewInput = null) {
  const review = record(reviewInput);
  if (!review.platformVariantReviewId) return null;
  const findings = [];
  for (const item of [
    ...(Array.isArray(review.boundaryPrecheck?.blocked) ? review.boundaryPrecheck.blocked : []),
    ...(Array.isArray(review.boundaryPrecheck?.warnings) ? review.boundaryPrecheck.warnings : []),
    ...(Array.isArray(review.evidence?.findings) ? review.evidence.findings : []),
    ...(Array.isArray(review.authenticity?.findings) ? review.authenticity.findings : []),
  ]) {
    if (!item || typeof item !== "object") continue;
    findings.push({
      code: text(item.code, 120),
      severity: text(item.severity, 40),
      message: text(item.message, 1200),
      suggestion: item.suggestion ? text(item.suggestion, 1200) : null,
    });
    if (findings.length >= 20) break;
  }
  return {
    platformVariantReviewId: text(review.platformVariantReviewId, 240),
    overallVerdict: text(review.overallVerdict, 40),
    findings,
  };
}

export function normalizePlatformRevisionRequestInput(input = {}) {
  const parentRevision = record(input.parentRevision);
  const variant = record(input.variant);
  const strategy = record(input.strategy);
  const contentPiece = record(input.contentPiece);
  const sourceSignal = record(input.sourceSignal);
  const identityContext = record(input.identityContext);
  const changeRequest = text(input.changeRequest, 2000);
  const dataClassification = text(input.dataClassification, 80).toLowerCase();
  const review = conciseReview(input.review);

  if (!changeRequest) throw new TypeError("A natural-language change request is required.");
  if (!parentRevision.platformVariantRevisionId || !parentRevision.content) throw new TypeError("Change request requires the exact current PlatformVariantRevision.");
  if (!variant.platformVariantId || variant.currentRevisionId !== parentRevision.platformVariantRevisionId) throw new TypeError("Change request only applies to the current exact PlatformVariantRevision.");
  if (!strategy.narrativeStrategyId || strategy.narrativeStrategyId !== parentRevision.narrativeStrategyId || strategy.strategyRevision !== parentRevision.strategyRevision) {
    throw new TypeError("Change request requires the exact approved NarrativeStrategy revision used by the draft.");
  }
  if (!contentPiece.contentPieceId || contentPiece.contentPieceId !== parentRevision.contentPieceId) throw new TypeError("Change request requires the canonical ContentPiece used by the draft.");
  if (!sourceSignal.signalId || sourceSignal.workspaceId !== parentRevision.workspaceId) throw new TypeError("Change request requires the canonical source Signal in the same workspace.");
  if (!identityContext.identityContextSnapshotId || identityContext.identityContextSnapshotId !== parentRevision.identityContextSnapshotId || identityContext.workspaceId !== parentRevision.workspaceId) {
    throw new TypeError("Change request requires the exact Identity Context Snapshot used by the current draft.");
  }
  if (identityContext.platform !== parentRevision.destination) throw new TypeError("Identity Context Snapshot platform must match the target revision.");
  if (!dataClassification) throw new TypeError("Change request requires the source data classification.");
  if (review && review.platformVariantReviewId !== input.review?.platformVariantReviewId) throw new TypeError("Invalid review context.");

  return {
    parentRevision,
    variant,
    strategy,
    contentPiece,
    sourceSignal,
    identityContext,
    changeRequest,
    review,
    dataClassification,
  };
}

export function buildPlatformRevisionRequestPrompt(input = {}) {
  const normalized = normalizePlatformRevisionRequestInput(input);
  const { parentRevision, strategy, contentPiece, sourceSignal, identityContext, changeRequest, review } = normalized;
  const destination = parentRevision.destination;
  const formatRule = destination === "x"
    ? parentRevision.format === "thread"
      ? "Keep the output as an X thread with the same thread format. Return 2-8 segments, each <= 280 characters."
      : "Keep the output as one X single_post <= 280 characters."
    : "Keep the output as one LinkedIn single_post.";

  return `You are SignalFlow's bounded revision writer. Revise ONE exact ${destination === "x" ? "X" : "LinkedIn"} draft according to the user's change request.

This is NOT a new strategy or blank-page rewrite. Preserve everything that does not need to change.

USER CHANGE REQUEST:
${JSON.stringify(changeRequest)}

NON-NEGOTIABLE RULES:
- Apply only the requested change and any directly necessary wording adjustments.
- Preserve the approved NarrativeStrategy's core idea and audience takeaway.
- Do not invent or add metrics, customers, dates, integrations, outcomes, personal experiences, launch state, or other unsupported facts.
- Explicit boundaries and project prohibited claims outrank the requested change.
- Preserve the exact destination-specific Identity/Voice context unless the request asks for a compatible stylistic adjustment.
- ${formatRule}
- Do not change destination.
- Do not explain your reasoning or list what you changed.
- Return ONLY the revised publishable copy in the required JSON structure.

PARENT REVISION:
${JSON.stringify({
    revisionId: parentRevision.platformVariantRevisionId,
    revisionNumber: parentRevision.revisionNumber,
    destination: parentRevision.destination,
    format: parentRevision.format,
    content: parentRevision.content,
    segments: parentRevision.segments || [],
  }, null, 2)}

APPROVED STRATEGY CONTRACT:
${JSON.stringify({
    strategyRevision: strategy.strategyRevision,
    coreIdea: strategy.coreIdea,
    audienceTakeaway: strategy.audienceTakeaway,
    narrativeArc: strategy.narrativeArc,
    factualConstraints: strategy.factualConstraints,
    boundaryConstraints: strategy.boundaryConstraints,
  }, null, 2)}

CANONICAL CONTENT PIECE:
${JSON.stringify({
    canonicalIntent: contentPiece.canonicalIntent,
    claims: contentPiece.claims,
    evidenceRefs: contentPiece.evidenceRefs,
  }, null, 2)}

SOURCE SIGNAL:
${JSON.stringify({
    signalId: sourceSignal.signalId,
    headline: sourceSignal.headline,
    summary: sourceSignal.summary,
    boundaryNote: sourceSignal.boundaryNote || null,
  }, null, 2)}

EXACT IDENTITY CONTEXT:
${JSON.stringify({
    identityContextSnapshotId: identityContext.identityContextSnapshotId,
    identity: record(identityContext.identity),
    perception: record(identityContext.perception),
    voice: record(identityContext.voice),
    boundaries: record(identityContext.boundaries),
    platformExpression: record(identityContext.platformExpression),
    projectGuidance: record(identityContext.projectGuidance),
    campaignInstructions: Array.isArray(identityContext.campaignInstructions) ? identityContext.campaignInstructions.slice(0, 40) : [],
    effectiveRules: Array.isArray(identityContext.effectiveRules) ? identityContext.effectiveRules.slice(0, 100) : [],
  }, null, 2)}

${review ? `CURRENT USER-VISIBLE REVIEW FINDINGS (context only; do not invent additional issues):\n${JSON.stringify(review, null, 2)}\n` : ""}
Return ONLY valid JSON using the SAME format as the parent revision.
For single_post:
{"format":"single_post","content":"...","segments":[]}
For X thread:
{"format":"thread","content":"","segments":["post 1","post 2"]}`;
}

export function acceptPlatformRevisionRequest(raw, parentDestination, parentFormat) {
  const output = normalizePlatformVariantDraft(raw, parentDestination);
  if (output.format !== parentFormat) throw new TypeError("Bounded change request cannot change the current platform format.");
  return output;
}
