import test from "node:test";
import assert from "node:assert/strict";

import { createBrowserContentSignalApplication } from "../lib/application/browserContentSignalApplication.mjs";
import { createBrowserContentPlanningApplication } from "../lib/application/browserContentPlanningApplication.mjs";
import { createBrowserIdentityApplication } from "../lib/application/browserIdentityApplication.mjs";
import { createBrowserContentOpportunityRepository } from "../lib/infrastructure/contentOpportunityAdapters.mjs";
import { createContentOpportunity } from "../lib/domain/contentOpportunities.mjs";

const NOW = "2026-08-17T16:50:00.000Z";

function createStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
}

function response(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() { return JSON.stringify(payload); },
  };
}

function strategyOutput() {
  return {
    title: "Privacy as an execution boundary",
    coreIdea: "Privacy classification changes which inference routes are allowed instead of acting as a decorative setting.",
    audienceTakeaway: "A trustworthy private AI workflow changes execution behavior and fails closed when no allowed route exists.",
    narrativeArc: [
      "Start with the privacy promise.",
      "Show how it changes routing.",
      "End with fail-closed behavior.",
    ],
    hookDirection: "Lead with the architectural consequence.",
    evidencePlan: ["Use the source Signal only."],
    factualConstraints: ["Do not invent users, metrics, or production claims."],
    boundaryConstraints: ["Do not expose private repository details."],
    destinationPlan: [
      { destination: "linkedin", decision: "include", reason: "Reasoning benefits from context.", format: "single narrative post", adaptationNotes: [] },
      { destination: "x", decision: "include", reason: "The core lesson can be concise.", format: "single post", adaptationNotes: [] },
    ],
    mediaRequirements: [{ type: "text_only", reason: "No visual is required.", required: false }],
    sequencingNotes: [],
  };
}

function identityCount(storage) {
  const raw = storage.getItem("signalflow_identity_profiles_v1");
  return raw ? JSON.parse(raw).length : 0;
}

test("cached strategy reuse does not create duplicate IdentityContextSnapshot records", async () => {
  const storage = createStorage();
  const getStorage = () => storage;

  const identity = createBrowserIdentityApplication({ getStorage });
  await identity.saveMinimalProfile({
    primaryTopics: ["software architecture"],
    expertise: ["software engineering"],
    qualitiesToSignal: ["careful systems reasoning"],
    writingPrinciples: ["Explain the decision before implementation detail."],
    blockedPhrases: ["revolutionary AI platform"],
    linkedinRules: ["Give enough context for the trade-off."],
    xRules: ["State the observation directly."],
  });
  assert.equal(identityCount(storage), 6, "minimal Voice setup should create six versioned profile records");

  const signals = createBrowserContentSignalApplication({ getStorage, validateCanonicalReferences: false });
  const signal = await signals.createManualSignal({
    headline: "Privacy changed inference routing",
    summary: "Protected context must use an allowed route or fail closed instead of silently falling back to a remote provider.",
    signalKind: "lesson",
    privacyClassification: "workspace_private",
  });

  const opportunityRepository = createBrowserContentOpportunityRepository({ getStorage });
  const opportunity = await opportunityRepository.upsert(createContentOpportunity({
    opportunityId: "opportunity-cache-test",
    workspaceId: "local-personal",
    signalIds: [signal.signalId],
    inputFingerprint: "fnv1a:cachetest",
    evaluation: {
      recommendation: "post",
      title: "Privacy is an execution boundary",
      summary: "Explain the routing consequence of privacy classification.",
      whyNow: "The decision is concrete and recent.",
      score: 90,
      scoreBreakdown: { freshness: 90, importance: 90, novelty: 80, audienceValue: 85, narrativeFit: 90, evidenceStrength: 90 },
      confidence: 0.92,
      evidenceReadiness: { level: "strong", reason: "Directly known architectural decision." },
      narrativeFit: { level: "strong", reason: "Clear constraint and trade-off." },
      repetitionRisk: { level: "unknown", reason: "NarrativeMemory is not implemented." },
      candidateAngles: [
        { title: "Architecture boundary", summary: "Explain the routing boundary.", approach: "Lead with the constraint." },
        { title: "Fail-closed lesson", summary: "Explain fail-closed behavior.", approach: "Lead with the refusal to downgrade." },
        { title: "Local-first implication", summary: "Explain local-first implications.", approach: "Lead with processing location." },
        { title: "Product promise", summary: "Explain privacy as behavior.", approach: "Lead with the user promise." },
      ],
      recommendedAngleTitle: "Architecture boundary",
      candidateDestinations: [
        { destination: "linkedin", recommended: true, reason: "Needs context.", format: "single narrative post" },
        { destination: "x", recommended: true, reason: "Works concisely.", format: "single post" },
      ],
      recommendedMediaTypes: ["text_only"],
      freshnessState: "fresh",
      productionEffortEstimate: "low",
    },
    evaluationProvenance: {
      taskId: "task-opportunity-cache",
      taskType: "opportunity_evaluation",
      provider: "test",
      model: "test-model",
      routeKind: "remote",
      evaluatedAt: NOW,
    },
    createdAt: NOW,
  }));

  let strategyCalls = 0;
  const fetchImpl = async (url, options = {}) => {
    const body = JSON.parse(options.body || "{}");
    assert.equal(body.task.taskType, "narrative_strategy");
    strategyCalls += 1;
    return response({
      ok: true,
      output: strategyOutput(),
      provenance: {
        taskId: body.task.taskId,
        taskType: body.task.taskType,
        provider: "test-provider",
        model: "test-model",
        routeKind: "remote",
        evaluatedAt: NOW,
      },
    });
  };

  const angleDecision = {
    angleId: opportunity.recommendedAngleId,
    policyVersion: "owner-alpha-v1",
    reason: "High-confidence test path.",
  };

  const planning = createBrowserContentPlanningApplication({ getStorage, fetchImpl });
  const first = await planning.buildStrategy(opportunity.opportunityId, { angleDecision });
  assert.equal(strategyCalls, 1);
  assert.equal(identityCount(storage), 7, "first strategy generation should add exactly one immutable context snapshot");

  const reopenedPlanning = createBrowserContentPlanningApplication({ getStorage, fetchImpl });
  const second = await reopenedPlanning.buildStrategy(opportunity.opportunityId, { angleDecision });
  assert.equal(second.narrativeStrategyId, first.narrativeStrategyId);
  assert.equal(strategyCalls, 1, "cached strategy reuse must not call inference again");
  assert.equal(identityCount(storage), 7, "cached strategy reuse must not create another IdentityContextSnapshot");
});
