import test from "node:test";
import assert from "node:assert/strict";
import { createManualContentSignal } from "../lib/domain/contentSignals.mjs";
import { createContentOpportunity, selectOpportunityAngle } from "../lib/domain/contentOpportunities.mjs";
import {
  approveNarrativeStrategy,
  createNarrativeStrategy,
  createPlannedPlatformVariant,
  createPrimaryContentPiece,
} from "../lib/domain/contentPlanning.mjs";
import {
  attachPlatformVariantRevision,
  createPlatformVariantRevision,
} from "../lib/domain/platformVariantRevisions.mjs";
import { createPlatformGenerationApplication } from "../lib/application/platformGenerationApplication.mjs";
import { createIdentityApplication } from "../lib/application/identityApplication.mjs";
import { createMemoryContentPlanningRepository } from "../lib/infrastructure/contentPlanningAdapters.mjs";
import { createMemoryContentOpportunityRepository } from "../lib/infrastructure/contentOpportunityAdapters.mjs";
import { createMemoryContentSignalRepository } from "../lib/infrastructure/contentSignalAdapters.mjs";
import { createMemoryIdentityRepository } from "../lib/infrastructure/identityAdapters.mjs";
import { createDeterministicIdService } from "../lib/domain/ports.mjs";

const NOW = "2026-08-17T13:00:00.000Z";

function signal(overrides = {}) {
  return createManualContentSignal({
    signalId: "signal-1",
    workspaceId: "local-personal",
    headline: "Privacy changed how the inference layer is designed",
    summary: "Raw private repository context should stay local unless a policy explicitly permits a minimized remote request.",
    observedAt: NOW,
    privacyClassification: "workspace_private",
    ...overrides,
  });
}

function opportunity() {
  const created = createContentOpportunity({
    opportunityId: "opportunity-1",
    workspaceId: "local-personal",
    signalIds: ["signal-1"],
    inputFingerprint: "signal-fingerprint",
    evaluation: {
      recommendation: "post",
      title: "Privacy is an architecture boundary",
      summary: "Explain the implementation decision instead of making a launch claim.",
      whyNow: "The decision is recent and useful.",
      score: 88,
      scoreBreakdown: { freshness: 90, importance: 90, novelty: 80, audienceValue: 88, narrativeFit: 90, evidenceStrength: 80 },
      confidence: 0.9,
      evidenceReadiness: { level: "medium", reason: "The architecture decision is known." },
      narrativeFit: { level: "strong", reason: "It supports a useful engineering story." },
      repetitionRisk: { level: "unknown", reason: "Narrative memory is not supplied." },
      candidateAngles: [
        { title: "The boundary", summary: "Explain what stays local.", approach: "Lead with the constraint." },
        { title: "The trade-off", summary: "Explain quality versus confidentiality.", approach: "Lead with the trade-off." },
        { title: "The lesson", summary: "Privacy belongs in routing code.", approach: "Lead with the lesson." },
        { title: "The flow", summary: "Explain minimized evidence flow.", approach: "Lead with the architecture." },
      ],
      candidateDestinations: [
        { destination: "linkedin", recommended: true, reason: "Context helps.", format: "narrative post" },
        { destination: "x", recommended: true, reason: "The insight can be concise.", format: "single post" },
      ],
      excludedDestinations: [],
      recommendedMediaTypes: [],
      freshnessState: "fresh",
      productionEffortEstimate: "low",
    },
    evaluationProvenance: { taskId: "task-opportunity", taskType: "opportunity_evaluation", provider: "test", model: "test", routeKind: "remote", evaluatedAt: NOW },
    createdAt: NOW,
  });
  return selectOpportunityAngle(created, "angle-1", NOW);
}

function approvedStrategy({ xDecision = "include" } = {}) {
  return approveNarrativeStrategy(createNarrativeStrategy({
    narrativeStrategyId: "strategy-1",
    workspaceId: "local-personal",
    opportunityId: "opportunity-1",
    inputFingerprint: "strategy-input",
    selectedAngle: { angleId: "angle-1", title: "The boundary", summary: "Explain what stays local.", approach: "Lead with the constraint." },
    identityContextSnapshotId: "strategy-snapshot",
    proposal: {
      title: "Privacy boundary",
      coreIdea: "Privacy must be enforced by routing, not left as prompt guidance.",
      audienceTakeaway: "Choose what data may move before choosing the strongest model.",
      narrativeArc: ["Convenience-first routing", "The confidentiality constraint", "The policy-aware routing decision"],
      hookDirection: "Open with the constraint rather than a launch statement.",
      evidencePlan: ["Use only the known architecture decision."],
      factualConstraints: ["Do not claim local-only inference is fully shipped."],
      boundaryConstraints: ["Do not expose private repository contents."],
      destinationPlan: [
        { destination: "linkedin", decision: "include", reason: "The reasoning benefits from context.", format: "single narrative post", adaptationNotes: ["Explain the trade-off clearly."] },
        { destination: "x", decision: xDecision, reason: xDecision === "exclude" ? "Skip X for this story." : "The insight can stand alone concisely.", format: "single post", adaptationNotes: ["Get to the observation quickly."] },
      ],
      mediaRequirements: [],
      sequencingNotes: [],
    },
    taskId: "task-strategy",
    createdAt: NOW,
  }), NOW);
}

async function identityApplication(ids = createDeterministicIdService("identity")) {
  const application = createIdentityApplication({
    identityRepository: createMemoryIdentityRepository(),
    workspaceId: "local-personal",
    userId: "owner",
    clock: { now: () => NOW },
    idService: ids,
  });
  await application.saveMinimalProfile({
    primaryTopics: "software systems\nAI products",
    desiredAudienceImpressions: "thoughtful builder",
    qualitiesToSignal: "precise\ncalm",
    qualitiesToAvoid: "hype-driven persona",
    writingPrinciples: "specific over impressive\nexplain trade-offs",
    dislikes: "generic launch language\nforced engagement questions",
    customBoundaryRules: "never expose private repository contents",
    linkedinRules: "Use enough context for the reasoning.",
    xRules: "Get to the observation quickly.",
  });
  return application;
}

async function fixture({ xDecision = "include", inferenceAdapter } = {}) {
  const strategy = approvedStrategy({ xDecision });
  const piece = createPrimaryContentPiece({ contentPieceId: "piece-1", strategy, opportunityId: "opportunity-1", createdAt: NOW });
  const linkedin = createPlannedPlatformVariant({ platformVariantId: "variant-linkedin", contentPiece: piece, strategy, destination: "linkedin", createdAt: NOW });
  const x = createPlannedPlatformVariant({ platformVariantId: "variant-x", contentPiece: piece, strategy, destination: "x", createdAt: NOW });
  const ids = createDeterministicIdService("generation");
  const planningRepository = createMemoryContentPlanningRepository([strategy, piece, linkedin, x]);
  const identity = await identityApplication(ids);
  const application = createPlatformGenerationApplication({
    contentPlanningRepository: planningRepository,
    contentOpportunityRepository: createMemoryContentOpportunityRepository([opportunity()]),
    contentSignalRepository: createMemoryContentSignalRepository([signal()]),
    identityApplication: identity,
    inferenceAdapter: inferenceAdapter || {
      async execute({ task, input }) {
        const destination = input.variant.destination;
        return {
          output: destination === "x"
            ? { format: "single_post", content: "Privacy belongs in the routing layer, not just the prompt.", segments: [] }
            : { format: "single_post", content: "A privacy rule is easy to write down. The harder part is making the architecture enforce it.\n\nThat changed how I think about model routing: decide what data is allowed to move first, then choose the strongest permitted route.", segments: [] },
          provenance: { taskId: task.taskId, provider: "test-provider", model: "test-model", routeKind: "remote", generatedAt: NOW },
        };
      },
    },
    workspaceId: "local-personal",
    clock: { now: () => NOW },
    idService: ids,
  });
  return { application, planningRepository, strategy, piece, linkedin, x };
}

function revisionInput(overrides = {}) {
  return {
    platformVariantRevisionId: "revision-1",
    workspaceId: "local-personal",
    platformVariantId: "variant-x",
    contentPieceId: "piece-1",
    narrativeStrategyId: "strategy-1",
    destination: "x",
    revisionNumber: 1,
    strategyRevision: 1,
    output: { format: "thread", content: "", segments: ["First post", "Second post"] },
    inputFingerprint: "fingerprint",
    identityContextSnapshotId: "snapshot-x",
    generationProvenance: { taskId: "task-1", provider: "test", model: "model", routeKind: "remote", promptVersion: "platform_variant_v1", generatedAt: NOW },
    createdAt: NOW,
    ...overrides,
  };
}

test("PlatformVariantRevision is immutable review-state output and rejects oversized X segments", () => {
  const revision = createPlatformVariantRevision(revisionInput());
  assert.equal(revision.kind, "PlatformVariantRevision");
  assert.equal(revision.status, "review");
  assert.equal(revision.strategyRevision, 1);
  assert.equal(revision.segments.length, 2);
  assert.equal(revision.generationProvenance.provider, "test");
  assert.equal("rawResponse" in revision.generationProvenance, false);

  assert.throws(() => createPlatformVariantRevision(revisionInput({
    platformVariantRevisionId: "revision-long",
    output: { format: "thread", content: "", segments: ["a".repeat(281), "Second post"] },
  })), /280 characters/);
});

test("generated revision can attach only to its exact PlatformVariant", async () => {
  const { x } = await fixture();
  const revision = createPlatformVariantRevision(revisionInput());
  const attached = attachPlatformVariantRevision(x, revision, NOW);
  assert.equal(attached.currentRevisionId, revision.platformVariantRevisionId);
  assert.equal(attached.status, "review");
  assert.throws(() => attachPlatformVariantRevision({ ...x, platformVariantId: "other" }, revision, NOW), /does not belong/);
});

test("approved ContentPiece generates only persisted LinkedIn/X variants with destination-specific Voice snapshots", async () => {
  const seen = [];
  const { application } = await fixture({
    inferenceAdapter: {
      async execute({ task, input }) {
        seen.push({ task, input });
        assert.equal(task.taskType, "platform_variant");
        assert.equal(task.dataClassification, "workspace_private");
        assert.equal(input.strategy.strategyRevision, 1);
        assert.equal(input.identityContext.platform, input.variant.destination);
        return {
          output: input.variant.destination === "x"
            ? { format: "single_post", content: "Privacy belongs in routing code, not only in prompt text.", segments: [] }
            : { format: "single_post", content: "Privacy became a real product boundary only when the routing layer started enforcing it.\n\nThe order matters: decide what data may move first, then choose the strongest route that policy allows.", segments: [] },
          provenance: { taskId: task.taskId, provider: "test-provider", model: "model-a", routeKind: "remote", generatedAt: NOW },
        };
      },
    },
  });
  const result = await application.generateReadyVariants("piece-1");
  assert.equal(result.failed.length, 0);
  assert.equal(result.generated.length, 2);
  assert.deepEqual(seen.map((entry) => entry.input.variant.destination).sort(), ["linkedin", "x"]);
  assert.ok(result.bundle.variants.every((entry) => entry.variant.status === "review"));
  assert.ok(result.bundle.variants.every((entry) => entry.currentRevision?.strategyRevision === 1));
  assert.ok(result.bundle.variants.every((entry) => entry.currentRevision?.generationProvenance.provider === "test-provider"));
});

test("unchanged generation reuses current revision while explicit regeneration appends immutable history", async () => {
  let calls = 0;
  const { application } = await fixture({
    inferenceAdapter: {
      async execute({ task, input }) {
        calls += 1;
        return {
          output: { format: "single_post", content: input.variant.destination === "x" ? `Revision ${calls}` : `LinkedIn revision ${calls}`, segments: [] },
          provenance: { taskId: task.taskId, provider: "test", model: "test", routeKind: "remote", generatedAt: NOW },
        };
      },
    },
  });
  const first = await application.generateVariant("variant-linkedin");
  const cached = await application.generateVariant("variant-linkedin");
  assert.equal(cached.platformVariantRevisionId, first.platformVariantRevisionId);
  assert.equal(calls, 1);

  const second = await application.regenerateVariant("variant-linkedin");
  assert.equal(calls, 2);
  assert.equal(second.revisionNumber, 2);
  assert.notEqual(second.platformVariantRevisionId, first.platformVariantRevisionId);
  const bundle = await application.getGenerationBundle("piece-1");
  const linkedin = bundle.variants.find((entry) => entry.variant.destination === "linkedin");
  assert.equal(linkedin.history.length, 2);
  assert.equal(linkedin.currentRevision.platformVariantRevisionId, second.platformVariantRevisionId);
  assert.ok(linkedin.history.some((revision) => revision.platformVariantRevisionId === first.platformVariantRevisionId));
});

test("one platform failure does not delete or invalidate the successful platform revision", async () => {
  const { application } = await fixture({
    inferenceAdapter: {
      async execute({ task, input }) {
        if (input.variant.destination === "x") {
          const error = new Error("X provider stage failed.");
          error.code = "provider_failed";
          throw error;
        }
        return {
          output: { format: "single_post", content: "LinkedIn remains reviewable even if X fails.", segments: [] },
          provenance: { taskId: task.taskId, provider: "test", model: "test", routeKind: "remote", generatedAt: NOW },
        };
      },
    },
  });
  const result = await application.generateReadyVariants("piece-1");
  assert.equal(result.generated.length, 1);
  assert.equal(result.failed.length, 1);
  const linkedin = result.bundle.variants.find((entry) => entry.variant.destination === "linkedin");
  const x = result.bundle.variants.find((entry) => entry.variant.destination === "x");
  assert.equal(linkedin.variant.status, "review");
  assert.ok(linkedin.currentRevision);
  assert.equal(x.variant.status, "failed");
  assert.equal(x.currentRevision, null);
});

test("explicitly omitted destination never invokes the platform writer", async () => {
  let calls = 0;
  const { application } = await fixture({
    xDecision: "exclude",
    inferenceAdapter: {
      async execute({ task }) {
        calls += 1;
        return {
          output: { format: "single_post", content: "LinkedIn only.", segments: [] },
          provenance: { taskId: task.taskId, provider: "test", model: "test", routeKind: "remote", generatedAt: NOW },
        };
      },
    },
  });
  const result = await application.generateReadyVariants("piece-1");
  assert.equal(calls, 1);
  assert.equal(result.generated.length, 1);
  assert.equal(result.bundle.variants.find((entry) => entry.variant.destination === "x").variant.status, "omitted");
});
