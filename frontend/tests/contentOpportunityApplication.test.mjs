import test from "node:test";
import assert from "node:assert/strict";

import { createContentSignalApplication } from "../lib/application/contentSignalApplication.mjs";
import { createContentOpportunityApplication } from "../lib/application/contentOpportunityApplication.mjs";
import { createMemoryContentSignalRepository, createBrowserContentSignalRepository } from "../lib/infrastructure/contentSignalAdapters.mjs";
import { createMemoryContentOpportunityRepository, createBrowserContentOpportunityRepository } from "../lib/infrastructure/contentOpportunityAdapters.mjs";
import { createMemoryOpportunityEvaluator } from "../lib/infrastructure/opportunityEvaluatorAdapters.mjs";
import { createDeterministicIdService } from "../lib/domain/ports.mjs";

function clock() {
  let tick = 0;
  return {
    now() {
      tick += 1;
      return new Date(Date.UTC(2026, 7, 17, 7, 0, tick)).toISOString();
    },
  };
}

function evaluationResult() {
  return {
    evaluation: {
      recommendation: "discuss",
      score: 82,
      whyNow: "The implementation changed a meaningful product boundary and the reason behind it is useful beyond the changelog.",
      evidenceQuality: { level: "strong", note: "The signal states the decision and its reason; exact implementation evidence can be attached later." },
      narrativeNote: "This fits a builder explaining tradeoffs rather than announcing a feature.",
      repetitionNote: "No recent narrative summary repeats this boundary decision.",
      boundaryNote: "Keep private repository details out of the story.",
      factors: [
        { key: "relevance", label: "Story relevance", score: 88, note: "A real decision with a transferable lesson." },
        { key: "evidence", label: "Evidence strength", score: 76, note: "Good decision context; screenshots are optional." },
      ],
    },
    angles: [
      { family: "problem_reason", title: "Why the boundary exists", summary: "Explain the problem that made the privacy boundary necessary.", rationale: "Starts from user risk rather than product promotion." },
      { family: "technical_decision", title: "The architecture decision", summary: "Walk through the decision to separate raw private context from remote reasoning.", rationale: "Useful to technical readers who care about system boundaries." },
      { family: "lesson_observation", title: "Privacy is behavior, not copy", summary: "Frame the change as a lesson about enforcing privacy in code rather than policy text.", rationale: "Makes the point broader than one implementation." },
      { family: "concise_update", title: "What changed and what did not", summary: "Give a compact progress update with the exact boundary and non-goals.", rationale: "Works when the owner wants a factual update rather than an essay." },
    ],
    recommendedDestinations: ["linkedin", "x"],
    recommendedFormats: ["text"],
  };
}

async function createSignal({ privacyClassification = "workspace_private", workspaceId = "local-personal" } = {}) {
  const repository = createMemoryContentSignalRepository();
  const app = createContentSignalApplication({
    contentSignalRepository: repository,
    workspaceId,
    clock: clock(),
    idService: createDeterministicIdService("test-signal"),
  });
  const signal = await app.createManualSignal({
    headline: "Private repository processing boundary is now explicit",
    summary: "I changed the architecture so protected repository evidence has an explicit processing boundary before remote reasoning.",
    privacyClassification,
    boundaryNote: "Do not reveal private repository content.",
  });
  return { repository, signal };
}

test("signal evaluation persists an explainable opportunity and is idempotent by default", async () => {
  const { repository: signalRepository, signal } = await createSignal();
  const opportunityRepository = createMemoryContentOpportunityRepository();
  let calls = 0;
  const evaluator = createMemoryOpportunityEvaluator(async () => {
    calls += 1;
    return evaluationResult();
  });
  const app = createContentOpportunityApplication({
    contentSignalRepository: signalRepository,
    contentOpportunityRepository: opportunityRepository,
    opportunityEvaluator: evaluator,
    workspaceId: "local-personal",
    clock: clock(),
    idService: createDeterministicIdService("test-opportunity"),
  });

  const first = await app.evaluateSignal(signal.signalId, {
    evaluationContext: {
      identitySummary: "A builder who explains real product and engineering decisions without hype.",
      desiredPerception: "Thoughtful, specific, technically grounded.",
      recentNarrativeSummaries: ["Previously discussed provider-neutral inference routing."],
    },
  });
  const second = await app.evaluateSignal(signal.signalId);

  assert.equal(calls, 1);
  assert.equal(second.opportunityId, first.opportunityId);
  assert.equal(first.signalId, signal.signalId);
  assert.equal(first.angles.length, 4);
  assert.deepEqual(first.recommendedDestinations, ["linkedin", "x"]);
  assert.equal(first.evaluationContext.explicitBoundaries[0], "Do not reveal private repository content.");
  assert.equal(first.evaluation.recommendation, "discuss");
});

test("recommended and custom angle choices are durable owner decisions", async () => {
  const { repository: signalRepository, signal } = await createSignal();
  const opportunityRepository = createMemoryContentOpportunityRepository();
  const app = createContentOpportunityApplication({
    contentSignalRepository: signalRepository,
    contentOpportunityRepository: opportunityRepository,
    opportunityEvaluator: createMemoryOpportunityEvaluator(async () => evaluationResult()),
    workspaceId: "local-personal",
    clock: clock(),
    idService: createDeterministicIdService("test-opportunity"),
  });

  const opportunity = await app.evaluateSignal(signal.signalId);
  const selected = await app.selectAngle(opportunity.opportunityId, opportunity.angles[1].angleId);
  assert.equal(selected.status, "accepted");
  assert.equal(selected.selectedAngle.type, "recommended");
  assert.equal(selected.selectedAngle.angleId, opportunity.angles[1].angleId);

  const custom = await app.selectCustomAngle(opportunity.opportunityId, "Focus on the tension between convenience and confidentiality, without announcing a launch.");
  assert.equal(custom.selectedAngle.type, "custom");
  assert.match(custom.selectedAngle.text, /confidentiality/);

  const reopened = await app.reopenOpportunity((await app.rejectOpportunity(opportunity.opportunityId)).opportunityId);
  assert.equal(reopened.status, "proposed");
  assert.equal(reopened.selectedAngle, null);
});

test("private-route signals fail closed before any remote-style evaluator is called", async () => {
  const { repository: signalRepository, signal } = await createSignal({ privacyClassification: "device_private" });
  let calls = 0;
  const app = createContentOpportunityApplication({
    contentSignalRepository: signalRepository,
    contentOpportunityRepository: createMemoryContentOpportunityRepository(),
    opportunityEvaluator: createMemoryOpportunityEvaluator(async () => {
      calls += 1;
      return evaluationResult();
    }),
    workspaceId: "local-personal",
    clock: clock(),
    idService: createDeterministicIdService("test-opportunity"),
  });

  await assert.rejects(() => app.evaluateSignal(signal.signalId), /local\/private processing route/i);
  assert.equal(calls, 0);
});

test("browser repositories recover the signal-to-opportunity decision after reopen", async () => {
  const data = new Map();
  const storage = {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); },
    removeItem(key) { data.delete(key); },
  };
  const getStorage = () => storage;
  const signalRepository = createBrowserContentSignalRepository({ getStorage });
  const signalApp = createContentSignalApplication({
    contentSignalRepository: signalRepository,
    workspaceId: "local-personal",
    clock: clock(),
    idService: createDeterministicIdService("browser-signal"),
  });
  const signal = await signalApp.createManualSignal({ headline: "A saved thought", summary: "A saved thought with enough context." });

  const firstApp = createContentOpportunityApplication({
    contentSignalRepository: signalRepository,
    contentOpportunityRepository: createBrowserContentOpportunityRepository({ getStorage }),
    opportunityEvaluator: createMemoryOpportunityEvaluator(async () => evaluationResult()),
    workspaceId: "local-personal",
    clock: clock(),
    idService: createDeterministicIdService("browser-opportunity"),
  });
  const created = await firstApp.evaluateSignal(signal.signalId);
  await firstApp.selectAngle(created.opportunityId, created.angles[0].angleId);

  const reopenedApp = createContentOpportunityApplication({
    contentSignalRepository: createBrowserContentSignalRepository({ getStorage }),
    contentOpportunityRepository: createBrowserContentOpportunityRepository({ getStorage }),
    opportunityEvaluator: createMemoryOpportunityEvaluator(async () => { throw new Error("should not re-evaluate"); }),
    workspaceId: "local-personal",
    clock: clock(),
    idService: createDeterministicIdService("reopened"),
  });
  const recovered = await reopenedApp.readOpportunityForSignal(signal.signalId);
  assert.equal(recovered.opportunityId, created.opportunityId);
  assert.equal(recovered.status, "accepted");
  assert.equal(recovered.selectedAngle.angleId, created.angles[0].angleId);
});

test("opportunity angles reject duplicate titles and wrong cardinality", async () => {
  const { repository: signalRepository, signal } = await createSignal();
  const bad = evaluationResult();
  bad.angles = [bad.angles[0], { ...bad.angles[1], title: bad.angles[0].title }, bad.angles[2]];
  const app = createContentOpportunityApplication({
    contentSignalRepository: signalRepository,
    contentOpportunityRepository: createMemoryContentOpportunityRepository(),
    opportunityEvaluator: createMemoryOpportunityEvaluator(async () => bad),
    workspaceId: "local-personal",
    clock: clock(),
    idService: createDeterministicIdService("test-opportunity"),
  });
  await assert.rejects(() => app.evaluateSignal(signal.signalId), /materially distinct|duplicate title/i);
});
