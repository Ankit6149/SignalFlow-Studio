import test from "node:test";
import assert from "node:assert/strict";
import { createManualContentSignal } from "../lib/domain/contentSignals.mjs";
import { createDeterministicIdService } from "../lib/domain/ports.mjs";
import { createContentOpportunityApplication } from "../lib/application/contentOpportunityApplication.mjs";
import { createProjectContextApplication } from "../lib/application/projectContextApplication.mjs";
import { createSignalOpportunityContinuationApplication } from "../lib/application/signalOpportunityContinuationApplication.mjs";
import { createMemoryContentSignalRepository } from "../lib/infrastructure/contentSignalAdapters.mjs";
import { createMemoryContentOpportunityRepository } from "../lib/infrastructure/contentOpportunityAdapters.mjs";
import { createMemoryProjectContextRepository } from "../lib/infrastructure/projectContextAdapters.mjs";
import { buildOpportunityEvaluationPrompt, normalizeOpportunityTaskInput } from "../lib/ai/opportunityEvaluation.mjs";

const NOW = "2026-08-20T00:00:00.000Z";

function evaluation() {
  return {
    recommendation: "post",
    title: "A meaningful product change",
    summary: "Explain the decision and what changed.",
    whyNow: "The work is recent and supported by project context.",
    score: 82,
    scoreBreakdown: { freshness: 90, importance: 82, novelty: 75, audienceValue: 78, narrativeFit: 84, evidenceStrength: 80 },
    confidence: 0.88,
    evidenceReadiness: { level: "strong", reason: "The signal and project context support the direction." },
    narrativeFit: { level: "strong", reason: "The change is relevant to the project story." },
    repetitionRisk: { level: "unknown", reason: "Narrative memory was not supplied." },
    candidateAngles: [
      { title: "Decision", summary: "Explain the product decision.", approach: "Lead with the trade-off." },
      { title: "Architecture", summary: "Explain the architecture consequence.", approach: "Lead with the system change." },
      { title: "User impact", summary: "Explain what becomes easier for users.", approach: "Lead with the user outcome." },
      { title: "Lesson", summary: "Explain the reusable lesson.", approach: "Lead with what changed in thinking." },
    ],
    recommendedAngleTitle: "Decision",
    candidateDestinations: [{ destination: "linkedin", recommended: true, reason: "Fits a thoughtful update.", format: "narrative post" }],
    excludedDestinations: [],
    recommendedMediaTypes: ["diagram"],
    freshnessState: "fresh",
    productionEffortEstimate: "low",
  };
}

function signal(id = "signal-project-1", overrides = {}) {
  return createManualContentSignal({
    signalId: id,
    workspaceId: "local-personal",
    projectId: "project-1",
    headline: "The repository connection now preserves durable project understanding.",
    summary: "Later work should be judged using the same project context instead of starting from zero.",
    observedAt: NOW,
    privacyClassification: "workspace_private",
    ...overrides,
  });
}

async function bootstrapContext(app, revision, privacyClass = "workspace_private", projectId = "project-1") {
  return (await app.bootstrapProjectContext({
    projectId,
    repositoryRef: { provider: "github", owner: "Ankit6149", repository: "SignalFlow-Studio", revision },
    sourceArtifactIds: [`artifact-${revision}`],
    privacyClass,
    synthesis: {
      projectName: "SignalFlow Studio",
      purpose: "Turn meaningful work into evidence-backed content decisions.",
      problem: "People doing real work should not manually reconstruct every story from scratch.",
      capabilities: ["persistent project understanding", "connected work signals"],
      audiences: ["builders", "content owners"],
      safeClaims: ["Project context is versioned and provenance-backed."],
      uncertainties: ["Production GitHub App authorization is not yet complete."],
    },
    synthesisProvenance: { mode: "deterministic" },
  })).context;
}

function createHarness(initialSignals) {
  const signalRepository = createMemoryContentSignalRepository(initialSignals);
  const contextRepository = createMemoryProjectContextRepository();
  const opportunityRepository = createMemoryContentOpportunityRepository();
  const contextApplication = createProjectContextApplication({
    workspaceId: "local-personal",
    repository: contextRepository,
    clock: { now: () => NOW },
    idService: createDeterministicIdService("context-test"),
  });
  const calls = [];
  const opportunityApplication = createContentOpportunityApplication({
    contentOpportunityRepository: opportunityRepository,
    contentSignalRepository: signalRepository,
    inferenceAdapter: {
      async execute({ task, input }) {
        calls.push({ task, input });
        return {
          output: evaluation(),
          provenance: { taskId: task.taskId, taskType: task.taskType, provider: "test", model: "test", routeKind: "remote", evaluatedAt: NOW },
        };
      },
    },
    workspaceId: "local-personal",
    clock: { now: () => NOW },
    idService: createDeterministicIdService("opportunity-test"),
  });
  const continuation = createSignalOpportunityContinuationApplication({
    workspaceId: "local-personal",
    contentSignalRepository: signalRepository,
    projectContextApplication: contextApplication,
    contentOpportunityApplication: opportunityApplication,
  });
  return { signalRepository, contextApplication, opportunityApplication, continuation, calls };
}

test("continuation resolves latest ProjectContext, pins it on Opportunity, and sends only minimized project understanding", async () => {
  const source = signal();
  const harness = createHarness([source]);
  const context = await bootstrapContext(harness.contextApplication, "abc123");

  const first = await harness.continuation.continueToOpportunity(source.signalId);
  const second = await harness.continuation.continueToOpportunity(source.signalId);

  assert.equal(first.projectContext.projectContextSnapshotId, context.projectContextSnapshotId);
  assert.equal(first.opportunity.projectContextSnapshotId, context.projectContextSnapshotId);
  assert.equal(first.opportunity.opportunityId, second.opportunity.opportunityId);
  assert.equal(harness.calls.length, 1);
  assert.ok(harness.calls[0].task.inputRefs.includes(source.signalId));
  assert.ok(harness.calls[0].task.inputRefs.includes(context.projectContextSnapshotId));
  assert.equal(harness.calls[0].input.projectContext.projectName, "SignalFlow Studio");
  assert.deepEqual(harness.calls[0].input.projectContext.safeClaims, ["Project context is versioned and provenance-backed."]);
  assert.equal("repositoryRef" in harness.calls[0].input.projectContext, false);
  assert.equal("sourceArtifactIds" in harness.calls[0].input.projectContext, false);
});

test("a newer ProjectContext version changes the Opportunity fingerprint instead of silently reusing stale judgment", async () => {
  const source = signal();
  const harness = createHarness([source]);
  const firstContext = await bootstrapContext(harness.contextApplication, "abc123");
  const first = await harness.continuation.continueToOpportunity(source.signalId);
  const secondContext = await bootstrapContext(harness.contextApplication, "def456");
  const second = await harness.continuation.continueToOpportunity(source.signalId);

  assert.notEqual(firstContext.projectContextSnapshotId, secondContext.projectContextSnapshotId);
  assert.notEqual(first.opportunity.inputFingerprint, second.opportunity.inputFingerprint);
  assert.notEqual(first.opportunity.opportunityId, second.opportunity.opportunityId);
  assert.equal(second.opportunity.projectContextSnapshotId, secondContext.projectContextSnapshotId);
  assert.equal(harness.calls.length, 2);
});

test("later project signals reuse retained ProjectContext while project-less signals keep legacy no-context behavior", async () => {
  const firstSignal = signal("signal-project-1");
  const laterSignal = signal("signal-project-2", { headline: "A later repository event arrived." });
  const manualSignal = createManualContentSignal({
    signalId: "signal-manual-no-project",
    workspaceId: "local-personal",
    headline: "A standalone thought",
    summary: "This does not belong to a project.",
    observedAt: NOW,
  });
  const harness = createHarness([firstSignal, laterSignal, manualSignal]);
  const context = await bootstrapContext(harness.contextApplication, "abc123");

  const later = await harness.continuation.continueToOpportunity(laterSignal.signalId);
  const manual = await harness.continuation.continueToOpportunity(manualSignal.signalId);

  assert.equal(later.projectContext.projectContextSnapshotId, context.projectContextSnapshotId);
  assert.equal(later.opportunity.projectContextSnapshotId, context.projectContextSnapshotId);
  assert.equal(manual.projectContext, null);
  assert.equal(manual.opportunity.projectContextSnapshotId, null);
});

test("context ownership/project mismatch fails closed and more restrictive context privacy controls inference", async () => {
  const source = signal();
  const harness = createHarness([source]);
  const privateContext = await bootstrapContext(harness.contextApplication, "private123", "device_private");
  await harness.opportunityApplication.evaluateSignal(source.signalId, { projectContext: privateContext, refresh: true });
  assert.equal(harness.calls.at(-1).task.dataClassification, "device_private");

  await assert.rejects(
    () => harness.opportunityApplication.evaluateSignal(source.signalId, { projectContext: { ...privateContext, workspaceId: "other-workspace" }, refresh: true }),
    /another workspace/,
  );

  const otherProjectContext = await bootstrapContext(harness.contextApplication, "other123", "workspace_private", "project-2");
  await assert.rejects(
    () => harness.opportunityApplication.evaluateSignal(source.signalId, { projectContext: otherProjectContext, refresh: true }),
    /does not match the ContentSignal project/,
  );
});

test("opportunity prompt treats ProjectContext as project facts, keeps uncertainties non-claiming, and excludes raw repo evidence", async () => {
  const source = signal();
  const harness = createHarness([source]);
  const context = await bootstrapContext(harness.contextApplication, "abc123");
  await harness.continuation.continueToOpportunity(source.signalId, { refresh: true });
  const normalized = normalizeOpportunityTaskInput(harness.calls.at(-1).input);
  const prompt = buildOpportunityEvaluationPrompt(normalized);

  assert.match(prompt, /ProjectContext describes the project, not the person/);
  assert.match(prompt, /uncertainties as unresolved/);
  assert.match(prompt, /Production GitHub App authorization is not yet complete/);
  assert.doesNotMatch(prompt, /artifact-abc123/);
  assert.doesNotMatch(prompt, /repositoryRef/);
  assert.equal(normalized.projectContext.projectContextSnapshotId, context.projectContextSnapshotId);
});
