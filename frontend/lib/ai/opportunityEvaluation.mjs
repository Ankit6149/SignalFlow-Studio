import { normalizeOpportunityEvaluation } from "../domain/contentOpportunities.mjs";

function clean(value, maxLength) {
  return String(value ?? "").replace(/\r\n?/g, "\n").trim().slice(0, maxLength);
}

function safeSignal(input = {}) {
  return {
    signalId: clean(input.signalId, 240),
    workspaceId: clean(input.workspaceId, 240),
    projectId: input.projectId ? clean(input.projectId, 240) : null,
    signalKind: clean(input.signalKind, 80) || "thought",
    headline: clean(input.headline, 240),
    summary: clean(input.summary, 12000),
    importanceHints: Array.isArray(input.importanceHints)
      ? input.importanceHints.map((item) => clean(item, 120)).filter(Boolean).slice(0, 16)
      : [],
    boundaryNote: input.boundaryNote ? clean(input.boundaryNote, 4000) : null,
    privacyClassification: clean(input.privacyClassification, 80),
    occurredAt: input.occurredAt || null,
    observedAt: input.observedAt || null,
    sourceArtifactCount: Math.max(0, Math.min(1000, Number(input.sourceArtifactCount || 0))),
    assetCount: Math.max(0, Math.min(1000, Number(input.assetCount || 0))),
  };
}

export function normalizeOpportunityTaskInput(input = {}) {
  const signal = safeSignal(input.signal || {});
  if (!signal.signalId || !signal.workspaceId || !signal.headline) {
    throw new TypeError("Opportunity evaluation requires a minimized ContentSignal with stable ID, workspace, and headline.");
  }
  return { signal };
}

export function buildOpportunityEvaluationPrompt(input = {}) {
  const { signal } = normalizeOpportunityTaskInput(input);
  const boundary = signal.boundaryNote
    ? `\nHARD USER BOUNDARY (must not be crossed):\n${signal.boundaryNote}\n`
    : "";

  return `You are SignalFlow's editorial opportunity evaluator. Decide whether a user-captured signal is worth turning into public content now. This is editorial judgment, not engagement bait.

NON-NEGOTIABLE RULES:
- Use ONLY the supplied signal. Do not invent product facts, metrics, customers, dates, outcomes, personal history, expertise, or prior publications.
- The user explicitly captured this signal, so treat that as intent evidence, but you may still recommend HOLD or SKIP when substance is weak.
- Do not pretend you know the user's identity profile or narrative history. Set repetitionRisk.level to "unknown" and say that narrative memory is not yet supplied.
- Recommend only LinkedIn and/or X in candidateDestinations for this Personal Alpha proof.
- Angles must be materially different editorial directions, not paraphrases.
- If recommendation is POST, return exactly 4 useful candidateAngles.
- Prefer real evidence, reflection, trade-offs, lessons, decisions, or concrete updates over generic launch language.
- Never recommend fabricated vulnerability or exaggerated marketing language.
${boundary}
SIGNAL:
${JSON.stringify(signal, null, 2)}

Return ONLY valid JSON matching this shape:
{
  "recommendation": "post|hold|skip",
  "title": "short opportunity title",
  "summary": "what the opportunity is really about",
  "whyNow": "why this is or is not worth discussing now",
  "score": 0,
  "scoreBreakdown": {
    "freshness": 0,
    "importance": 0,
    "novelty": 0,
    "audienceValue": 0,
    "narrativeFit": 0,
    "evidenceStrength": 0
  },
  "confidence": 0.0,
  "evidenceReadiness": { "level": "strong|medium|weak|unknown", "reason": "..." },
  "narrativeFit": { "level": "strong|medium|weak|unknown", "reason": "..." },
  "repetitionRisk": { "level": "unknown", "reason": "Narrative memory was not supplied for this evaluation." },
  "candidateAngles": [
    { "title": "...", "summary": "...", "approach": "..." }
  ],
  "candidateDestinations": [
    { "destination": "linkedin", "recommended": true, "reason": "...", "format": "..." },
    { "destination": "x", "recommended": true, "reason": "...", "format": "..." }
  ],
  "excludedDestinations": [],
  "recommendedMediaTypes": ["text_only|single_image|screenshot|diagram|carousel|short_video|none"],
  "freshnessState": "fresh|still_relevant|evergreen|expiring|expired",
  "productionEffortEstimate": "none|low|medium|high"
}`;
}

export function acceptOpportunityEvaluation(raw) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  return normalizeOpportunityEvaluation({
    ...source,
    repetitionRisk: {
      level: "unknown",
      reason: "Narrative memory was not supplied for this evaluation, so repetition is not assumed either way.",
    },
  });
}
