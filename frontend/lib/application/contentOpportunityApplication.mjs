import {
  assertPort,
  createSystemClock,
  createSystemIdService,
} from "../domain/ports.mjs";
import {
  createContentOpportunity,
  normalizeContentOpportunity,
  rejectContentOpportunity,
  reopenContentOpportunity,
  selectCustomOpportunityAngle,
  selectRecommendedAngle,
} from "../domain/contentOpportunities.mjs";
import { normalizeContentSignal } from "../domain/contentSignals.mjs";

function normalizeWorkspaceId(value) {
  const workspaceId = String(value || "").trim();
  if (!workspaceId) throw new TypeError("ContentOpportunity application requires a workspaceId.");
  return workspaceId;
}

function normalizeContext(value = {}, signal) {
  const explicitBoundaries = Array.isArray(value.explicitBoundaries)
    ? value.explicitBoundaries.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  if (signal.boundaryNote && !explicitBoundaries.includes(signal.boundaryNote)) {
    explicitBoundaries.unshift(signal.boundaryNote);
  }
  return {
    identitySummary: String(value.identitySummary || "").trim() || null,
    desiredPerception: String(value.desiredPerception || "").trim() || null,
    explicitBoundaries: explicitBoundaries.slice(0, 20),
    recentNarrativeSummaries: Array.isArray(value.recentNarrativeSummaries)
      ? value.recentNarrativeSummaries.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 20)
      : [],
  };
}

function evaluatorPayload(signal, context) {
  return {
    task: "evaluate_signal",
    signal: {
      signalId: signal.signalId,
      headline: signal.headline,
      summary: signal.summary,
      signalKind: signal.signalKind,
      occurredAt: signal.occurredAt,
      observedAt: signal.observedAt,
      projectId: signal.projectId,
      privacyClassification: signal.privacyClassification,
      sourceArtifactIds: signal.sourceArtifactIds,
      assetIds: signal.assetIds,
    },
    context,
    outputContract: {
      angles: "3-5 materially different angles",
      destinations: ["linkedin", "x"],
      formats: ["text", "single_image", "carousel", "demo", "short_video", "none"],
      explanation: ["whyNow", "evidenceQuality", "narrativeNote", "repetitionNote", "boundaryNote"],
    },
  };
}

export function createContentOpportunityApplication({
  contentOpportunityRepository,
  contentSignalRepository,
  opportunityEvaluator,
  workspaceId = "local-personal",
  clock = createSystemClock(),
  idService = createSystemIdService("signalflow"),
} = {}) {
  const opportunities = assertPort("contentOpportunityRepository", contentOpportunityRepository);
  const signals = assertPort("contentSignalRepository", contentSignalRepository);
  const evaluator = assertPort("opportunityEvaluator", opportunityEvaluator);
  const applicationClock = assertPort("clock", clock);
  const applicationIds = assertPort("idService", idService);
  const ownerWorkspaceId = normalizeWorkspaceId(workspaceId);

  function assertOwnedOpportunity(input) {
    if (!input) return null;
    const opportunity = normalizeContentOpportunity(input);
    if (opportunity.workspaceId !== ownerWorkspaceId) {
      throw new Error(`ContentOpportunity ${opportunity.opportunityId} does not belong to workspace ${ownerWorkspaceId}.`);
    }
    return opportunity;
  }

  async function requireOwnedOpportunity(opportunityId) {
    const id = String(opportunityId || "").trim();
    if (!id) throw new TypeError("An opportunityId is required.");
    const stored = await opportunities.get(id);
    if (!stored) throw new Error(`ContentOpportunity ${id} does not exist.`);
    return assertOwnedOpportunity(stored);
  }

  async function requireOwnedSignal(signalId) {
    const id = String(signalId || "").trim();
    if (!id) throw new TypeError("A signalId is required.");
    const stored = await signals.get(id);
    if (!stored) throw new Error(`ContentSignal ${id} does not exist.`);
    const signal = normalizeContentSignal(stored);
    if (signal.workspaceId !== ownerWorkspaceId) {
      throw new Error(`ContentSignal ${id} does not belong to workspace ${ownerWorkspaceId}.`);
    }
    return signal;
  }

  async function listOpportunities({ signalId = null, includeRejected = true } = {}) {
    const stored = await opportunities.list();
    return stored
      .map((item) => normalizeContentOpportunity(item))
      .filter((item) => item.workspaceId === ownerWorkspaceId)
      .filter((item) => !signalId || item.signalId === signalId)
      .filter((item) => includeRejected || item.status !== "rejected");
  }

  async function readOpportunity(opportunityId) {
    const stored = await opportunities.get(opportunityId);
    if (!stored) return null;
    return assertOwnedOpportunity(stored);
  }

  async function readOpportunityForSignal(signalId) {
    await requireOwnedSignal(signalId);
    const matches = await listOpportunities({ signalId });
    return matches[0] || null;
  }

  async function evaluateSignal(signalId, { evaluationContext = {}, force = false } = {}) {
    const signal = await requireOwnedSignal(signalId);
    if (["device_private", "restricted"].includes(signal.privacyClassification)) {
      throw new Error("This signal is marked for private processing and cannot use the current remote opportunity evaluator. Change the processing/privacy choice deliberately or use a future local/private route.");
    }

    const existing = await readOpportunityForSignal(signalId);
    if (existing && !force) return existing;

    const context = normalizeContext(evaluationContext, signal);
    const result = await evaluator.evaluate(evaluatorPayload(signal, context));
    if (!result || typeof result !== "object" || Array.isArray(result)) {
      throw new TypeError("Opportunity evaluator returned an invalid result.");
    }

    const angles = Array.isArray(result.angles)
      ? result.angles.map((angle) => ({
          ...angle,
          angleId: String(angle.angleId || "").trim() || applicationIds.create("angle"),
        }))
      : result.angles;
    const now = applicationClock.now();
    const opportunity = createContentOpportunity({
      opportunityId: existing?.opportunityId || applicationIds.create("opportunity"),
      workspaceId: ownerWorkspaceId,
      signalId: signal.signalId,
      evaluation: result.evaluation,
      angles,
      recommendedDestinations: result.recommendedDestinations,
      recommendedFormats: result.recommendedFormats,
      evaluationContext: context,
    }, now);
    return opportunities.upsert(opportunity);
  }

  async function selectAngle(opportunityId, angleId) {
    const current = await requireOwnedOpportunity(opportunityId);
    return opportunities.upsert(selectRecommendedAngle(current, angleId, applicationClock.now()));
  }

  async function selectCustomAngle(opportunityId, text) {
    const current = await requireOwnedOpportunity(opportunityId);
    return opportunities.upsert(selectCustomOpportunityAngle(current, text, applicationClock.now()));
  }

  async function rejectOpportunity(opportunityId) {
    const current = await requireOwnedOpportunity(opportunityId);
    return opportunities.upsert(rejectContentOpportunity(current, applicationClock.now()));
  }

  async function reopenOpportunity(opportunityId) {
    const current = await requireOwnedOpportunity(opportunityId);
    return opportunities.upsert(reopenContentOpportunity(current, applicationClock.now()));
  }

  return {
    listOpportunities,
    readOpportunity,
    readOpportunityForSignal,
    evaluateSignal,
    selectAngle,
    selectCustomAngle,
    rejectOpportunity,
    reopenOpportunity,
  };
}
