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

function safeList(values, maxItems, maxLength) {
  return Array.isArray(values)
    ? values.map((value) => clean(value, maxLength)).filter(Boolean).slice(0, maxItems)
    : [];
}

function safeProjectContext(input = null) {
  if (!input) return null;
  if (typeof input !== "object" || Array.isArray(input)) throw new TypeError("Opportunity project context must be an object.");
  return {
    projectContextSnapshotId: clean(input.projectContextSnapshotId, 240),
    workspaceId: clean(input.workspaceId, 240),
    projectId: clean(input.projectId, 240),
    version: Number(input.version || 0),
    fingerprint: clean(input.fingerprint, 240),
    privacyClass: clean(input.privacyClass, 80),
    projectName: input.projectName ? clean(input.projectName, 500) : null,
    purpose: input.purpose ? clean(input.purpose, 4000) : null,
    problem: input.problem ? clean(input.problem, 4000) : null,
    capabilities: safeList(input.capabilities, 24, 800),
    audiences: safeList(input.audiences, 16, 600),
    terminology: safeList(input.terminology, 30, 300),
    maturityStage: input.maturityStage ? clean(input.maturityStage, 800) : null,
    architectureNotes: safeList(input.architectureNotes, 20, 1000),
    constraints: safeList(input.constraints, 20, 1000),
    safeClaims: safeList(input.safeClaims, 30, 1000),
    uncertainties: safeList(input.uncertainties, 20, 1000),
  };
}

export function normalizeOpportunityTaskInput(input = {}) {
  const signal = safeSignal(input.signal || {});
  if (!signal.signalId || !signal.workspaceId || !signal.headline) {
    throw new TypeError("Opportunity evaluation requires a minimized ContentSignal with stable ID, workspace, and headline.");
  }
  const projectContext = safeProjectContext(input.projectContext || null);
  if (projectContext) {
    if (!projectContext.projectContextSnapshotId || !projectContext.workspaceId || !projectContext.projectId || !projectContext.fingerprint || projectContext.version < 1) {
      throw new TypeError("Opportunity evaluation requires complete ProjectContext identity when project context is supplied.");
    }
    if (projectContext.workspaceId !== signal.workspaceId) {
      throw new Error("Opportunity ProjectContext belongs to another workspace.");
    }
    if (!signal.projectId || projectContext.projectId !== signal.projectId) {
      throw new Error("Opportunity ProjectContext does not match the signal project.");
    }
  }
  return { signal, projectContext };
}

export function buildOpportunityEvaluationPrompt(input = {}) {
  const { signal, projectContext } = normalizeOpportunityTaskInput(input);
  const boundary = signal.boundaryNote
    ? `\nHARD USER BOUNDARY (must not be crossed):\n${signal.boundaryNote}\n`
    : "";
  const projectContextBlock = projectContext
    ? `\nPROJECT CONTEXT (evidence-backed project understanding; not person identity or narrative memory):\n${JSON.stringify(projectContext, null, 2)}\n`
    : "";

  return `You are SignalFlow's editorial opportunity evaluator. Decide whether a captured signal is worth turning into public content now. This is editorial judgment, not engagement bait.

NON-NEGOTIABLE RULES:
- Use ONLY the supplied signal and, when present, the supplied ProjectContext. Do not invent product facts, metrics, customers, dates, outcomes, personal history, expertise, or prior publications.
- ProjectContext describes the project, not the person. Never infer the owner's identity, voice, personal beliefs, employment, expertise, or audience history from it.
- Treat ProjectContext.safeClaims as bounded established project claims for this evaluation. Treat ProjectContext.uncertainties as unresolved; never turn them into claims.
- The signal may describe a new event not yet present in ProjectContext. You may discuss that event only to the extent the signal itself supports it; do not expand it into unsupported project-wide claims.
- The user explicitly captured or authorized this signal, so treat that as intent evidence, but you may still recommend HOLD or SKIP when substance is weak.
- Do not pretend you know narrative history. Set repetitionRisk.level to "unknown" and say that NarrativeMemory is not supplied.
- Recommend only LinkedIn and/or X in candidateDestinations for this current Personal Alpha compatibility proof. Destination generalization is a separate downstream capability.
- Angles must be materially different editorial directions, not paraphrases.
- If recommendation is POST, return exactly 4 useful candidateAngles and choose exactly one of their titles as recommendedAngleTitle.
- recommendedAngleTitle must exactly match one returned candidateAngles.title.
- Prefer real evidence, reflection, trade-offs, lessons, decisions, or concrete updates over generic launch language.
- Never recommend fabricated vulnerability or exaggerated marketing language.
${boundary}${projectContextBlock}
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
  "recommendedAngleTitle": "exact title copied from one candidateAngles item when recommendation is post; otherwise empty string",
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
