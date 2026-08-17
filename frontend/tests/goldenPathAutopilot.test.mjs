import test from "node:test";
import assert from "node:assert/strict";

import { createBrowserContentSignalApplication } from "../lib/application/browserContentSignalApplication.mjs";
import { createBrowserIdentityApplication } from "../lib/application/browserIdentityApplication.mjs";
import { createBrowserGoldenPathAutopilotApplication } from "../lib/application/browserGoldenPathAutopilotApplication.mjs";
import { createBrowserTodayDecisionApplication } from "../lib/application/browserTodayDecisionApplication.mjs";
import { createBrowserContentPlanningRepository } from "../lib/infrastructure/contentPlanningAdapters.mjs";
import { createBrowserContentOpportunityRepository } from "../lib/infrastructure/contentOpportunityAdapters.mjs";
import { createBrowserContentReviewRepository } from "../lib/infrastructure/contentReviewAdapters.mjs";

const NOW = "2026-08-17T16:45:00.000Z";

function createStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
    clear() {
      values.clear();
    },
  };
}

function response(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return JSON.stringify(payload);
    },
  };
}

function opportunityOutput() {
  return {
    recommendation: "post",
    title: "Privacy is an execution boundary",
    summary: "Explain why privacy changed routing architecture rather than becoming another settings toggle.",
    whyNow: "The implementation decision is recent, concrete, and useful to builders designing private AI systems.",
    score: 91,
    scoreBreakdown: {
      freshness: 92,
      importance: 88,
      novelty: 84,
      audienceValue: 89,
      narrativeFit: 92,
      evidenceStrength: 90,
    },
    confidence: 0.93,
    evidenceReadiness: { level: "strong", reason: "The architectural decision is directly described in the source Signal." },
    narrativeFit: { level: "strong", reason: "The Signal contains a concrete constraint, decision, and engineering trade-off." },
    repetitionRisk: { level: "unknown", reason: "NarrativeMemory was not supplied." },
    candidateAngles: [
      { title: "Architecture boundary", summary: "Show how privacy changes routing architecture.", approach: "Lead with the constraint, then the architectural consequence." },
      { title: "Fail-closed lesson", summary: "Explain why private processing must fail closed.", approach: "Lead with what the system refuses to do silently." },
      { title: "Local-first implication", summary: "Show where local-first architecture becomes necessary.", approach: "Lead with the processing boundary and device implications." },
      { title: "Product principle", summary: "Explain privacy as a product behavior rather than a settings label.", approach: "Lead with the user promise and trace it into implementation." },
    ],
    recommendedAngleTitle: "Architecture boundary",
    candidateDestinations: [
      { destination: "linkedin", recommended: true, reason: "The reasoning benefits from context.", format: "single narrative post" },
      { destination: "x", recommended: true, reason: "The core lesson can be concise.", format: "single post" },
    ],
    excludedDestinations: [],
    recommendedMediaTypes: ["text_only"],
    freshnessState: "fresh",
    productionEffortEstimate: "low",
  };
}

function strategyOutput() {
  return {
    title: "Privacy changes the execution architecture",
    coreIdea: "Privacy is an execution boundary: when a Signal is protected, the system must change where inference can run instead of quietly weakening the policy.",
    audienceTakeaway: "A trustworthy AI workflow treats privacy as routing logic and fails closed when an allowed route is unavailable.",
    narrativeArc: [
      "Start with the temptation to treat privacy as a settings toggle.",
      "Show why the classification has to participate in inference routing.",
      "End with the fail-closed product behavior and what it protects.",
    ],
    hookDirection: "Open with the engineering consequence of a privacy promise rather than a generic privacy claim.",
    evidencePlan: ["Use only the persisted Signal and its explicit boundary as factual evidence."],
    factualConstraints: ["Do not claim production scale, customer usage, or unimplemented local-model capability."],
    boundaryConstraints: ["Do not expose private repository details or credentials."],
    destinationPlan: [
      { destination: "linkedin", decision: "include", reason: "The trade-off benefits from a little context.", format: "single narrative post", adaptationNotes: ["Explain the reasoning before implementation detail."] },
      { destination: "x", decision: "include", reason: "The core lesson works as one compact observation.", format: "single post", adaptationNotes: ["Keep the claim narrow and concrete."] },
    ],
    mediaRequirements: [{ type: "text_only", reason: "The architecture lesson is understandable without fabricated visuals.", required: false }],
    sequencingNotes: [],
  };
}

function createInferenceFetch(callLog) {
  return async (url, options = {}) => {
    const body = JSON.parse(options.body || "{}");
    const taskType = body?.task?.taskType;
    const destination = body?.input?.variant?.destination || body?.input?.revision?.destination || null;
    callLog.push({ url, taskType, destination });

    const provenance = {
      taskId: body?.task?.taskId || "task-test",
      taskType,
      provider: "test-provider",
      model: "test-model",
      routeKind: "remote",
      evaluatedAt: NOW,
      generatedAt: NOW,
    };

    if (taskType === "opportunity_evaluation") {
      return response({ ok: true, output: opportunityOutput(), provenance });
    }
    if (taskType === "narrative_strategy") {
      return response({ ok: true, output: strategyOutput(), provenance });
    }
    if (taskType === "platform_variant") {
      const output = destination === "x"
        ? { format: "single_post", content: "Privacy is not a settings toggle. If protected context cannot use an allowed inference route, the system should stop—not silently downgrade the boundary.", segments: [] }
        : { format: "single_post", content: "A privacy promise changes the architecture.\n\nIf a piece of context is classified as protected, that classification has to participate in inference routing. The system should use a permitted route or stop. Quietly falling back to a remote model would turn privacy into decoration.\n\nThat is the engineering lesson I keep coming back to: privacy is not only a setting. It is an execution boundary.", segments: [] };
      return response({ ok: true, output, provenance });
    }
    if (taskType === "evidence_critique") {
      return response({ ok: true, output: { verdict: "pass", summary: "The draft stays within the supplied Signal and strategy evidence.", findings: [] }, provenance });
    }
    if (taskType === "authenticity_critique") {
      return response({ ok: true, output: { verdict: "pass", summary: "The draft is compatible with the saved Voice and platform expression.", findings: [] }, provenance });
    }
    return response({ ok: false, code: "unexpected_test_task", error: `Unexpected test inference task: ${taskType || url}` }, 400);
  };
}

async function seedOwnerContext({ storage, fetchImpl }) {
  const getStorage = () => storage;
  const identity = createBrowserIdentityApplication({ getStorage });
  await identity.saveMinimalProfile({
    primaryTopics: ["software architecture", "AI systems"],
    expertise: ["software engineering"],
    personalityTraits: ["calm", "specific"],
    qualitiesToSignal: ["thoughtful systems reasoning"],
    desiredAudienceImpressions: ["careful builder who explains trade-offs"],
    writingPrinciples: ["Explain the decision before implementation detail.", "Prefer concrete reasoning over hype."],
    dislikes: ["generic launch language", "engagement bait"],
    blockedPhrases: ["revolutionary AI platform"],
    linkedinRules: ["Use enough context to make the trade-off understandable."],
    xRules: ["Get to the engineering observation quickly."],
  });

  const signals = createBrowserContentSignalApplication({
    getStorage,
    validateCanonicalReferences: false,
  });
  const signal = await signals.createManualSignal({
    headline: "Privacy changed the inference routing design",
    summary: "I changed the inference architecture so protected context cannot silently fall back to a remote provider. If a permitted route is unavailable, the system should fail closed. The useful lesson is that privacy has to be part of execution routing, not only a UI setting.",
    signalKind: "lesson",
    privacyClassification: "workspace_private",
    boundaryNote: "Do not expose private repository details, credentials, customers, metrics, or unimplemented capabilities.",
  });

  return {
    signal,
    autopilot: createBrowserGoldenPathAutopilotApplication({ getStorage, fetchImpl }),
    today: createBrowserTodayDecisionApplication({ getStorage }),
    getStorage,
  };
}

test("browser-local Golden Path autopilot prepares reviewed LinkedIn/X decisions and is idempotent on retry", async () => {
  const storage = createStorage();
  const calls = [];
  const fetchImpl = createInferenceFetch(calls);
  const { signal, autopilot, today, getStorage } = await seedOwnerContext({ storage, fetchImpl });

  const first = await autopilot.prepareSignal(signal.signalId);
  assert.equal(first.status, "ready_for_judgment");
  assert.equal(first.nextRoute, "/today");
  assert.equal(first.reviewedCount, 2);
  assert.equal(first.records.platformVariantIds.length, 2);
  assert.equal(first.records.platformVariantRevisionIds.length, 2);
  assert.equal(first.records.platformVariantReviewIds.length, 2);

  const decisions = await today.listDecisions();
  assert.equal(decisions.length, 2);
  assert.deepEqual(new Set(decisions.map((item) => item.destination)), new Set(["linkedin", "x"]));
  assert.ok(decisions.every((item) => item.reviewVerdict === "pass"));
  assert.ok(decisions.every((item) => item.recommendedAction === "approve"));

  const firstInferenceCount = calls.length;
  assert.equal(firstInferenceCount, 8, "first preparation should use opportunity + strategy + two writers + four critic calls");

  const planningRepository = createBrowserContentPlanningRepository({ getStorage });
  const opportunityRepository = createBrowserContentOpportunityRepository({ getStorage });
  const reviewRepository = createBrowserContentReviewRepository({ getStorage });
  const before = {
    planning: (await planningRepository.list()).length,
    opportunities: (await opportunityRepository.list()).length,
    reviews: (await reviewRepository.list()).length,
  };

  const reopenedAutopilot = createBrowserGoldenPathAutopilotApplication({ getStorage, fetchImpl });
  const second = await reopenedAutopilot.prepareSignal(signal.signalId);
  assert.equal(second.status, "ready_for_judgment");
  assert.equal(second.reviewedCount, 2);
  assert.equal(calls.length, firstInferenceCount, "retry should reuse persisted opportunity, strategy, drafts, and exact reviews");

  const after = {
    planning: (await planningRepository.list()).length,
    opportunities: (await opportunityRepository.list()).length,
    reviews: (await reviewRepository.list()).length,
  };
  assert.deepEqual(after, before, "retry/reopen must not duplicate canonical planning, opportunity, or review records");
  assert.equal((await today.listDecisions()).length, 2, "Today should still project each exact reviewed revision once");
});

test("autopilot surfaces missing Voice before strategy/generation work", async () => {
  const storage = createStorage();
  const calls = [];
  const fetchImpl = createInferenceFetch(calls);
  const getStorage = () => storage;
  const signals = createBrowserContentSignalApplication({ getStorage, validateCanonicalReferences: false });
  const signal = await signals.createManualSignal({
    headline: "A useful architecture lesson",
    summary: "This is enough evidence for opportunity evaluation, but no Voice profile has been configured yet.",
    signalKind: "lesson",
    privacyClassification: "workspace_private",
  });
  const autopilot = createBrowserGoldenPathAutopilotApplication({ getStorage, fetchImpl });

  const result = await autopilot.prepareSignal(signal.signalId);
  assert.equal(result.status, "needs_voice");
  assert.equal(result.nextRoute, "/voice");
  assert.equal(calls.length, 1, "missing Voice should stop immediately after opportunity evaluation");
});

test("autopilot reports privacy denial without advancing the story", async () => {
  const opportunityApplication = {
    async evaluateSignal() {
      const error = new Error("restricted content cannot be sent to a remote inference provider");
      error.code = "inference_privacy_route_denied";
      throw error;
    },
  };
  const unused = new Proxy({}, {
    get() {
      return async () => { throw new Error("downstream service should not be called after privacy denial"); };
    },
  });
  const application = (await import("../lib/application/goldenPathAutopilotApplication.mjs")).createGoldenPathAutopilotApplication({
    opportunityApplication,
    planningApplication: { buildStrategy: unused.buildStrategy, approveStrategy: unused.approveStrategy },
    generationApplication: { generateReadyVariants: unused.generateReadyVariants },
    reviewApplication: { reviewCurrentVariant: unused.reviewCurrentVariant },
    identityApplication: { getMinimalProfile: unused.getMinimalProfile, evaluateBoundaries: unused.evaluateBoundaries },
  });

  const result = await application.prepareSignal("signal-private");
  assert.equal(result.status, "blocked_privacy");
  assert.equal(result.nextRoute, "/signals");
  assert.equal(result.code, "inference_privacy_route_denied");
});
