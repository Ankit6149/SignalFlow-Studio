import test from "node:test";
import assert from "node:assert/strict";
import {
  createContentOpportunity,
  normalizeContentOpportunity,
  opportunityInputFingerprint,
} from "../lib/domain/contentOpportunities.mjs";
import { createManualContentSignal } from "../lib/domain/contentSignals.mjs";
import {
  assertInferenceRouteAllowed,
  createInferenceTask,
  INFERENCE_TASK_TYPES,
} from "../lib/inference/inferenceTasks.mjs";
import { createContentOpportunityApplication } from "../lib/application/contentOpportunityApplication.mjs";
import { createMemoryContentSignalRepository } from "../lib/infrastructure/contentSignalAdapters.mjs";
import {
  createBrowserContentOpportunityRepository,
  createMemoryContentOpportunityRepository,
} from "../lib/infrastructure/contentOpportunityAdapters.mjs";
import { createDeterministicIdService } from "../lib/domain/ports.mjs";

const NOW = "2026-08-17T10:00:00.000Z";

function signal(overrides = {}) {
  return createManualContentSignal({
    signalId: "signal-1",
    workspaceId: "local-personal",
    headline: "We changed the privacy architecture after realizing raw private repos should not leave the device.",
    summary: "The important part is the trade-off: local preprocessing first, remote reasoning only on minimized evidence.",
    observedAt: NOW,
    privacyClassification: "workspace_private",
    ...overrides,
  });
}

function evaluation(overrides = {}) {
  return {
    recommendation: "post",
    title: "The privacy boundary changed the product architecture",
    summary: "Explain the design decision rather than announce a feature.",
    whyNow: "The architecture decision is recent and teaches a reusable product lesson.",
    score: 82,
    scoreBreakdown: {
      freshness: 88,
      importance: 84,
      novelty: 75,
      audienceValue: 86,
      narrativeFit: 80,
      evidenceStrength: 72,
    },
    confidence: 0.86,
    evidenceReadiness: { level: "medium", reason: "The decision is clear but supporting examples would strengthen it." },
    narrativeFit: { level: "strong", reason: "The topic supports a thoughtful product/engineering story." },
    repetitionRisk: { level: "unknown", reason: "Narrative memory was not supplied." },
    candidateAngles: [
      { title: "The boundary", summary: "Why raw private context should not leave the device.", approach: "Lead with the constraint." },
      { title: "The trade-off", summary: "What quality/cost trade-off Private Hybrid introduces.", approach: "Lead with the architectural choice." },
      { title: "The lesson", summary: "What changed after treating privacy as code instead of policy text.", approach: "Lead with the lesson." },
      { title: "The implementation", summary: "How bounded evidence moves through the pipeline.", approach: "Lead with the system flow." },
    ],
    candidateDestinations: [
      { destination: "linkedin", recommended: true, reason: "The reasoning supports a professional narrative.", format: "narrative post" },
      { destination: "x", recommended: true, reason: "The architecture can be explained concisely.", format: "short thread" },
    ],
    excludedDestinations: [],
    recommendedMediaTypes: ["diagram"],
    freshnessState: "fresh",
    productionEffortEstimate: "low",
    ...overrides,
  };
}

test("ContentOpportunity is portable, versioned, and preserves signal identity", () => {
  const source = signal();
  const record = createContentOpportunity({
    opportunityId: "opportunity-1",
    workspaceId: source.workspaceId,
    signalIds: [source.signalId],
    inputFingerprint: opportunityInputFingerprint(source),
    evaluation: evaluation(),
    evaluationProvenance: {
      taskId: "task-1",
      taskType: "opportunity_evaluation",
      provider: "gemini",
      model: "test-model",
      routeKind: "remote",
      evaluatedAt: NOW,
    },
    createdAt: NOW,
  });
  assert.equal(record.kind, "ContentOpportunity");
  assert.equal(record.signalIds[0], source.signalId);
  assert.equal(record.candidateAngles.length, 4);
  assert.equal(record.repetitionRisk.level, "unknown");
  assert.deepEqual(normalizeContentOpportunity(JSON.parse(JSON.stringify(record))), record);
});

test("post-worthy evaluation rejects fewer than three angles", () => {
  assert.throws(() => createContentOpportunity({
    opportunityId: "opportunity-bad",
    workspaceId: "local-personal",
    signalIds: ["signal-1"],
    inputFingerprint: "fingerprint",
    evaluation: evaluation({ candidateAngles: evaluation().candidateAngles.slice(0, 2) }),
    evaluationProvenance: {
      taskId: "task-bad",
      taskType: "opportunity_evaluation",
      provider: "test",
      model: "test",
      routeKind: "local",
      evaluatedAt: NOW,
    },
    createdAt: NOW,
  }), /at least three materially distinct candidate angles/);
});

test("protected signals cannot silently downgrade to remote inference", () => {
  const task = createInferenceTask({
    taskId: "task-private",
    workspaceId: "local-personal",
    taskType: INFERENCE_TASK_TYPES.OPPORTUNITY_EVALUATION,
    dataClassification: "device_private",
    inputRefs: ["signal-1"],
    createdAt: NOW,
  });
  assert.throws(
    () => assertInferenceRouteAllowed(task, { provider: "openai", isLocal: false }),
    (error) => error.code === "inference_privacy_route_denied",
  );
  assert.equal(assertInferenceRouteAllowed(task, { provider: "ollama", isLocal: true }).routeKind, "local");
});

test("application evaluates once, persists, caches unchanged input, and saves angle decisions", async () => {
  const source = signal();
  const signalRepository = createMemoryContentSignalRepository([source]);
  const opportunityRepository = createMemoryContentOpportunityRepository();
  let calls = 0;
  const app = createContentOpportunityApplication({
    contentOpportunityRepository: opportunityRepository,
    contentSignalRepository: signalRepository,
    inferenceAdapter: {
      async execute({ task }) {
        calls += 1;
        return {
          output: evaluation(),
          provenance: {
            taskId: task.taskId,
            taskType: task.taskType,
            provider: "test-provider",
            model: "test-model",
            routeKind: "remote",
            evaluatedAt: NOW,
          },
        };
      },
    },
    workspaceId: "local-personal",
    clock: { now: () => NOW },
    idService: createDeterministicIdService("test"),
  });

  const first = await app.evaluateSignal(source.signalId);
  const second = await app.evaluateSignal(source.signalId);
  assert.equal(first.opportunityId, second.opportunityId);
  assert.equal(calls, 1);
  assert.equal((await signalRepository.get(source.signalId)).status, "interpreted");

  const selected = await app.selectAngle(first.opportunityId, first.candidateAngles[1].angleId);
  assert.equal(selected.status, "selected");
  assert.equal(selected.selectedAngleId, "angle-2");

  const custom = await app.setCustomAngle(first.opportunityId, { summary: "Explain the constraint through one concrete engineering decision." });
  assert.equal(custom.selectedAngleId, "custom");
  assert.match(custom.customAngle.summary, /engineering decision/);
});

test("browser opportunity repository survives reopen and keeps workspace ownership", async () => {
  const storage = new Map();
  const localStorage = {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, value); },
  };
  const repository = createBrowserContentOpportunityRepository({ getStorage: () => localStorage });
  const record = createContentOpportunity({
    opportunityId: "opportunity-browser",
    workspaceId: "local-personal",
    signalIds: ["signal-browser"],
    inputFingerprint: "fp-browser",
    evaluation: evaluation(),
    evaluationProvenance: {
      taskId: "task-browser",
      taskType: "opportunity_evaluation",
      provider: "test",
      model: "test",
      routeKind: "local",
      evaluatedAt: NOW,
    },
    createdAt: NOW,
  });
  await repository.upsert(record);
  const reopened = createBrowserContentOpportunityRepository({ getStorage: () => localStorage });
  assert.equal((await reopened.get(record.opportunityId)).opportunityId, record.opportunityId);
  await assert.rejects(() => reopened.upsert({ ...record, workspaceId: "other-workspace" }), /another workspace/);
});
