import test from "node:test";
import assert from "node:assert/strict";

import { createBrowserContentSignalApplication } from "../lib/application/browserContentSignalApplication.mjs";
import { createBrowserGoldenPathAutopilotApplication } from "../lib/application/browserGoldenPathAutopilotApplication.mjs";
import { createPreparedNarrativeMemory } from "../lib/domain/narrativeMemory.mjs";
import { createBrowserNarrativeMemoryRepository } from "../lib/infrastructure/narrativeMemoryAdapters.mjs";
import { createBrowserContentOpportunityRepository } from "../lib/infrastructure/contentOpportunityAdapters.mjs";

const NOW = "2026-08-17T18:45:00.000Z";

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

function repeatedOpportunityOutput() {
  return {
    recommendation: "post",
    title: "Privacy is an execution boundary",
    summary: "Explain why privacy classification changes routing architecture instead of becoming another settings toggle.",
    whyNow: "The implementation decision is recent and concrete.",
    score: 92,
    scoreBreakdown: {
      freshness: 94,
      importance: 90,
      novelty: 86,
      audienceValue: 90,
      narrativeFit: 93,
      evidenceStrength: 91,
    },
    confidence: 0.94,
    evidenceReadiness: { level: "strong", reason: "The Signal directly describes the architecture decision." },
    narrativeFit: { level: "strong", reason: "The story contains a concrete constraint and consequence." },
    repetitionRisk: { level: "unknown", reason: "The evaluator does not own NarrativeMemory." },
    candidateAngles: [
      { title: "Architecture boundary", summary: "Show how privacy changes routing architecture.", approach: "Lead with the constraint, then the architectural consequence." },
      { title: "Fail-closed lesson", summary: "Explain why protected processing must stop safely.", approach: "Lead with what the system refuses to do silently." },
      { title: "Local-first implication", summary: "Show where local execution becomes necessary.", approach: "Lead with the processing boundary." },
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

test("browser autopilot persists high NarrativeMemory risk and stops before strategy or generation", async () => {
  const storage = createStorage();
  const getStorage = () => storage;
  const calls = [];
  const fetchImpl = async (_url, options = {}) => {
    const body = JSON.parse(options.body || "{}");
    const taskType = body?.task?.taskType;
    calls.push(taskType);
    if (taskType !== "opportunity_evaluation") {
      throw new Error(`NarrativeMemory gate should stop before ${taskType || "unknown inference"}.`);
    }
    return response({
      ok: true,
      output: repeatedOpportunityOutput(),
      provenance: {
        taskId: body.task.taskId,
        taskType,
        provider: "test-provider",
        model: "test-model",
        routeKind: "remote",
        evaluatedAt: NOW,
      },
    });
  };

  const memoryRepository = createBrowserNarrativeMemoryRepository({
    getStorage,
    key: "signalflow_narrative_memory_v1",
  });
  await memoryRepository.upsert(createPreparedNarrativeMemory({
    narrativeMemoryId: "memory-prior-privacy-story",
    workspaceId: "local-personal",
    opportunityId: "opportunity-prior",
    narrativeStrategyId: "strategy-prior",
    contentPieceId: "piece-prior",
    platformVariantId: "variant-prior-linkedin",
    platformVariantRevisionId: "revision-prior-linkedin",
    platformVariantApprovalId: "approval-prior-linkedin",
    platform: "linkedin",
    topic: "Privacy is an execution boundary",
    angle: "Architecture boundary",
    coreIdea: "Privacy classification changes routing architecture instead of becoming another settings toggle.",
    approvedContent: "Privacy is an execution boundary. Protected context changes routing architecture rather than becoming another settings toggle.",
    approvedAt: "2026-08-12T18:45:00.000Z",
    createdAt: "2026-08-12T18:45:00.000Z",
  }));

  const signals = createBrowserContentSignalApplication({ getStorage, validateCanonicalReferences: false });
  const signal = await signals.createManualSignal({
    headline: "Privacy changed model routing again",
    summary: "Protected context must change where inference can run. Privacy is part of execution routing, not only a UI setting.",
    signalKind: "lesson",
    privacyClassification: "workspace_private",
  });

  const autopilot = createBrowserGoldenPathAutopilotApplication({ getStorage, fetchImpl });
  const result = await autopilot.prepareSignal(signal.signalId);

  assert.equal(result.status, "needs_plan");
  assert.equal(result.gate, "repetition_risk");
  assert.match(result.nextRoute, /^\/plan\?opportunity=/);
  assert.match(result.explanation, /overlap|same narrative|prepared story|differentiate|postpone/i);
  assert.deepEqual(calls, ["opportunity_evaluation"], "repetition must stop the Golden Path before strategy, platform generation, or critics");

  const opportunityRepository = createBrowserContentOpportunityRepository({ getStorage });
  const persisted = await opportunityRepository.get(result.records.opportunityId);
  assert.equal(persisted.repetitionRisk.level, "high");
  assert.equal(persisted.repetitionRisk.reason, result.explanation);

  const reopenedRepository = createBrowserContentOpportunityRepository({ getStorage });
  const reopened = await reopenedRepository.get(result.records.opportunityId);
  assert.equal(reopened.repetitionRisk.level, "high");
  assert.equal(reopened.repetitionRisk.reason, persisted.repetitionRisk.reason);
});
