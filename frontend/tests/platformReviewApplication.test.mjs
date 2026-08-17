import test from "node:test";
import assert from "node:assert/strict";
import { createManualContentSignal } from "../lib/domain/contentSignals.mjs";
import { createContentOpportunity } from "../lib/domain/contentOpportunities.mjs";
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
import { createPlatformReviewApplication } from "../lib/application/platformReviewApplication.mjs";
import { createIdentityApplication } from "../lib/application/identityApplication.mjs";
import { createMemoryContentPlanningRepository } from "../lib/infrastructure/contentPlanningAdapters.mjs";
import { createMemoryContentReviewRepository } from "../lib/infrastructure/contentReviewAdapters.mjs";
import { createMemoryContentOpportunityRepository } from "../lib/infrastructure/contentOpportunityAdapters.mjs";
import { createMemoryContentSignalRepository } from "../lib/infrastructure/contentSignalAdapters.mjs";
import { createMemoryIdentityRepository } from "../lib/infrastructure/identityAdapters.mjs";
import { createDeterministicIdService } from "../lib/domain/ports.mjs";

const NOW = "2026-08-17T14:30:00.000Z";

function signal() {
  return createManualContentSignal({
    signalId: "signal-review",
    workspaceId: "local-personal",
    headline: "Privacy belongs in the routing layer",
    summary: "The architecture now treats data classification as a routing constraint before choosing a permitted model route.",
    observedAt: NOW,
    privacyClassification: "workspace_private",
  });
}

function opportunity() {
  return createContentOpportunity({
    opportunityId: "opportunity-review",
    workspaceId: "local-personal",
    signalIds: ["signal-review"],
    inputFingerprint: "signal-review-fingerprint",
    evaluation: {
      recommendation: "post",
      title: "Privacy is a routing decision",
      summary: "Explain the engineering trade-off.",
      whyNow: "The architecture decision is recent.",
      score: 87,
      scoreBreakdown: { freshness: 90, importance: 88, novelty: 80, audienceValue: 87, narrativeFit: 90, evidenceStrength: 78 },
      confidence: 0.9,
      evidenceReadiness: { level: "medium", reason: "The architecture decision is known." },
      narrativeFit: { level: "strong", reason: "It supports a useful engineering story." },
      repetitionRisk: { level: "unknown", reason: "Narrative memory is not supplied." },
      candidateAngles: [
        { title: "Boundary", summary: "Explain the constraint.", approach: "Lead with the boundary." },
        { title: "Trade-off", summary: "Explain quality versus privacy.", approach: "Lead with the trade-off." },
        { title: "Lesson", summary: "Explain the engineering lesson.", approach: "Lead with the lesson." },
        { title: "Flow", summary: "Explain the routing flow.", approach: "Lead with the architecture." },
      ],
      candidateDestinations: [{ destination: "linkedin", recommended: true, reason: "Context helps.", format: "narrative post" }],
      excludedDestinations: [],
      recommendedMediaTypes: [],
      freshnessState: "fresh",
      productionEffortEstimate: "low",
    },
    evaluationProvenance: { taskId: "task-opportunity", taskType: "opportunity_evaluation", provider: "test", model: "test", routeKind: "remote", evaluatedAt: NOW },
    createdAt: NOW,
  });
}

async function fixture({ draftContent = "Privacy became a real product boundary when the routing layer started enforcing it.", inferenceAdapter } = {}) {
  const ids = createDeterministicIdService("review");
  const identityRepository = createMemoryIdentityRepository();
  const identityApplication = createIdentityApplication({
    identityRepository,
    workspaceId: "local-personal",
    userId: "owner",
    clock: { now: () => NOW },
    idService: ids,
  });
  await identityApplication.saveMinimalProfile({
    primaryTopics: "software systems\nAI products",
    desiredAudienceImpressions: "thoughtful builder",
    qualitiesToSignal: "precise\ncalm",
    qualitiesToAvoid: "hype-driven founder persona",
    writingPrinciples: "specific over impressive\nexplain trade-offs",
    dislikes: "generic launch copy\nforced engagement questions",
    blockedPhrases: "revolutionary AI platform",
    customBoundaryRules: "never invent customer numbers",
    linkedinRules: "Use enough context for the reasoning.",
    xRules: "Get to the observation quickly.",
  });
  const snapshot = await identityApplication.createIdentityContextSnapshot({ platform: "linkedin" });

  const strategy = approveNarrativeStrategy(createNarrativeStrategy({
    narrativeStrategyId: "strategy-review",
    workspaceId: "local-personal",
    opportunityId: "opportunity-review",
    inputFingerprint: "strategy-review-input",
    selectedAngle: { angleId: "angle-1", title: "Boundary", summary: "Explain the constraint.", approach: "Lead with the boundary." },
    identityContextSnapshotId: snapshot.identityContextSnapshotId,
    proposal: {
      coreIdea: "Privacy must be enforced by model routing, not left as prompt guidance.",
      audienceTakeaway: "Decide what data may move before choosing a model.",
      narrativeArc: ["The privacy constraint", "The routing decision"],
      hookDirection: "Lead with the constraint.",
      evidencePlan: ["Use the current architecture decision only."],
      factualConstraints: ["Do not claim the entire product is local-only."],
      boundaryConstraints: ["Do not expose private repository contents."],
      destinationPlan: [{ destination: "linkedin", decision: "include", reason: "Context helps.", format: "single narrative post", adaptationNotes: ["Explain the trade-off clearly."] }],
      mediaRequirements: [], sequencingNotes: [],
    },
    taskId: "task-strategy",
    createdAt: NOW,
  }), NOW);
  const piece = createPrimaryContentPiece({ contentPieceId: "piece-review", strategy, opportunityId: "opportunity-review", createdAt: NOW });
  const plannedVariant = createPlannedPlatformVariant({ platformVariantId: "variant-review", contentPiece: piece, strategy, destination: "linkedin", identityContextSnapshotId: snapshot.identityContextSnapshotId, createdAt: NOW });
  const revision = createPlatformVariantRevision({
    platformVariantRevisionId: "revision-review-1",
    workspaceId: "local-personal",
    platformVariantId: plannedVariant.platformVariantId,
    contentPieceId: piece.contentPieceId,
    narrativeStrategyId: strategy.narrativeStrategyId,
    destination: "linkedin",
    revisionNumber: 1,
    strategyRevision: strategy.strategyRevision,
    output: { format: "single_post", content: draftContent, segments: [] },
    inputFingerprint: "sf-cache-v1-review",
    identityContextSnapshotId: snapshot.identityContextSnapshotId,
    generationProvenance: { taskId: "task-write", provider: "test", model: "writer", routeKind: "remote", promptVersion: "platform_variant_v1", generatedAt: NOW },
    createdAt: NOW,
  });
  const variant = attachPlatformVariantRevision(plannedVariant, revision, NOW);
  const planningRepository = createMemoryContentPlanningRepository([strategy, piece, variant, revision]);
  const reviewRepository = createMemoryContentReviewRepository();
  const adapter = inferenceAdapter || {
    async execute({ task }) {
      return {
        output: task.taskType === "evidence_critique"
          ? { verdict: "pass", summary: "Claims are supported by supplied evidence.", findings: [] }
          : { verdict: "pass", summary: "Draft matches the saved Voice.", findings: [] },
        provenance: { taskId: task.taskId, provider: "critic-provider", model: "critic-model", routeKind: "remote", promptVersion: `${task.taskType}_v1`, reviewedAt: NOW },
      };
    },
  };
  const application = createPlatformReviewApplication({
    contentPlanningRepository: planningRepository,
    contentReviewRepository: reviewRepository,
    contentOpportunityRepository: createMemoryContentOpportunityRepository([opportunity()]),
    contentSignalRepository: createMemoryContentSignalRepository([signal()]),
    identityRepository,
    identityApplication,
    inferenceAdapter: adapter,
    workspaceId: "local-personal",
    userId: "owner",
    clock: { now: () => NOW },
    idService: ids,
  });
  return { application, planningRepository, reviewRepository, revision };
}

test("review runs evidence then authenticity as separate exact-revision tasks and caches the persisted review", async () => {
  const calls = [];
  const { application } = await fixture({
    inferenceAdapter: {
      async execute({ task, input }) {
        calls.push(task.taskType);
        assert.equal(input.revision.platformVariantRevisionId, "revision-review-1");
        assert.equal(input.variant.currentRevisionId, "revision-review-1");
        assert.equal(input.identityContext.identityContextSnapshotId, input.revision.identityContextSnapshotId);
        return {
          output: task.taskType === "evidence_critique"
            ? { verdict: "warn", summary: "One precision note.", findings: [{ code: "precision", severity: "warning", message: "Avoid implying every route is local.", suggestion: "Say permitted route instead." }] }
            : { verdict: "pass", summary: "Voice matches.", findings: [] },
          provenance: { taskId: task.taskId, provider: "test", model: "critic", routeKind: "remote", promptVersion: `${task.taskType}_v1`, reviewedAt: NOW },
        };
      },
    },
  });
  const first = await application.reviewCurrentVariant("variant-review");
  assert.deepEqual(calls, ["evidence_critique", "authenticity_critique"]);
  assert.equal(first.platformVariantRevisionId, "revision-review-1");
  assert.equal(first.overallVerdict, "warn");
  const cached = await application.reviewCurrentVariant("variant-review");
  assert.equal(cached.platformVariantReviewId, first.platformVariantReviewId);
  assert.equal(calls.length, 2);
});

test("explicit boundary precheck escalates review to block even when both remote critics pass", async () => {
  const { application } = await fixture({ draftContent: "This revolutionary AI platform changes everything about private work." });
  const review = await application.reviewCurrentVariant("variant-review");
  assert.equal(review.overallVerdict, "block");
  assert.ok(review.boundaryPrecheck.blocked.length > 0);
  await assert.rejects(() => application.approveCurrentVariant("variant-review"), (error) => error.code === "review_blocked");
});

test("warning-level reviewed revision can be approved exactly and a later edit invalidates current approval without deleting history", async () => {
  const { application, reviewRepository } = await fixture({
    inferenceAdapter: {
      async execute({ task }) {
        return {
          output: task.taskType === "evidence_critique"
            ? { verdict: "pass", summary: "Supported.", findings: [] }
            : { verdict: "warn", summary: "Minor style warning.", findings: [{ code: "slightly_formal", severity: "warning", message: "This is slightly more formal than the saved Voice." }] },
          provenance: { taskId: task.taskId, provider: "test", model: "critic", routeKind: "remote", promptVersion: `${task.taskType}_v1`, reviewedAt: NOW },
        };
      },
    },
  });
  const review = await application.reviewCurrentVariant("variant-review");
  const approval = await application.approveCurrentVariant("variant-review", "Looks right.");
  assert.equal(approval.platformVariantRevisionId, review.platformVariantRevisionId);
  assert.equal((await application.getReviewBundle("variant-review")).approvalValid, true);

  const edited = await application.editCurrentVariant("variant-review", { content: "Privacy became real only when routing code enforced the boundary." });
  assert.equal(edited.origin, "edited");
  assert.equal(edited.parentRevisionId, "revision-review-1");
  const current = await application.getReviewBundle("variant-review");
  assert.equal(current.revision.platformVariantRevisionId, edited.platformVariantRevisionId);
  assert.equal(current.review, null);
  assert.equal(current.decision, null);
  assert.equal(current.approvalValid, false);
  assert.ok((await reviewRepository.list()).some((record) => record.kind === "PlatformVariantApproval" && record.platformVariantRevisionId === "revision-review-1"));
});

test("approval is impossible before critics and rejection pins the current exact revision", async () => {
  const { application } = await fixture();
  await assert.rejects(() => application.approveCurrentVariant("variant-review"), (error) => error.code === "review_required");
  const rejection = await application.rejectCurrentVariant("variant-review", "Not the story I want to tell.");
  assert.equal(rejection.decision, "rejected");
  assert.equal(rejection.platformVariantRevisionId, "revision-review-1");
  const bundle = await application.getReviewBundle("variant-review");
  assert.equal(bundle.variant.status, "rejected");
  assert.equal(bundle.decision.platformVariantApprovalId, rejection.platformVariantApprovalId);
});
