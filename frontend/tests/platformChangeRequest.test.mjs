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
  createRequestedPlatformVariantRevision,
} from "../lib/domain/platformVariantRevisions.mjs";
import {
  createPlatformVariantApproval,
  createPlatformVariantReview,
} from "../lib/domain/platformVariantReviews.mjs";
import { acceptPlatformRevisionRequest } from "../lib/ai/platformVariantRevisionRequest.mjs";
import { createPlatformChangeRequestApplication } from "../lib/application/platformChangeRequestApplication.mjs";
import { createIdentityApplication } from "../lib/application/identityApplication.mjs";
import { createMemoryContentPlanningRepository } from "../lib/infrastructure/contentPlanningAdapters.mjs";
import { createMemoryContentReviewRepository } from "../lib/infrastructure/contentReviewAdapters.mjs";
import { createMemoryContentOpportunityRepository } from "../lib/infrastructure/contentOpportunityAdapters.mjs";
import { createMemoryContentSignalRepository } from "../lib/infrastructure/contentSignalAdapters.mjs";
import { createMemoryIdentityRepository } from "../lib/infrastructure/identityAdapters.mjs";
import { createDeterministicIdService } from "../lib/domain/ports.mjs";

const NOW = "2026-08-17T15:30:00.000Z";

function criticProvenance(taskId) {
  return { taskId, provider: "test", model: "critic", routeKind: "remote", promptVersion: "critic_v1", reviewedAt: NOW };
}

async function fixture() {
  const ids = createDeterministicIdService("change");
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
    customBoundaryRules: "never invent customer numbers",
    linkedinRules: "Use enough context for the reasoning.",
    xRules: "Get to the observation quickly.",
  });
  const snapshot = await identityApplication.createIdentityContextSnapshot({ platform: "linkedin" });

  const sourceSignal = createManualContentSignal({
    signalId: "signal-change",
    workspaceId: "local-personal",
    headline: "Privacy belongs in model routing",
    summary: "The architecture treats data classification as a routing constraint before model selection.",
    observedAt: NOW,
    privacyClassification: "workspace_private",
  });
  const opportunity = createContentOpportunity({
    opportunityId: "opportunity-change",
    workspaceId: "local-personal",
    signalIds: [sourceSignal.signalId],
    inputFingerprint: "signal-change-fingerprint",
    evaluation: {
      recommendation: "post",
      title: "Privacy is a routing decision",
      summary: "Explain the engineering choice.",
      whyNow: "The decision is recent.",
      score: 86,
      scoreBreakdown: { freshness: 90, importance: 86, novelty: 80, audienceValue: 85, narrativeFit: 90, evidenceStrength: 78 },
      confidence: 0.9,
      evidenceReadiness: { level: "medium", reason: "Architecture decision is known." },
      narrativeFit: { level: "strong", reason: "Useful engineering story." },
      repetitionRisk: { level: "unknown", reason: "Narrative memory is not supplied." },
      candidateAngles: [
        { title: "Boundary", summary: "Explain the boundary.", approach: "Lead with the constraint." },
        { title: "Trade-off", summary: "Explain the trade-off.", approach: "Lead with the trade-off." },
        { title: "Lesson", summary: "Explain the lesson.", approach: "Lead with the lesson." },
        { title: "Flow", summary: "Explain the flow.", approach: "Lead with the architecture." },
      ],
      candidateDestinations: [{ destination: "linkedin", recommended: true, reason: "Context helps.", format: "narrative post" }],
      excludedDestinations: [], recommendedMediaTypes: [], freshnessState: "fresh", productionEffortEstimate: "low",
    },
    evaluationProvenance: { taskId: "task-opportunity", taskType: "opportunity_evaluation", provider: "test", model: "test", routeKind: "remote", evaluatedAt: NOW },
    createdAt: NOW,
  });
  const strategy = approveNarrativeStrategy(createNarrativeStrategy({
    narrativeStrategyId: "strategy-change",
    workspaceId: "local-personal",
    opportunityId: opportunity.opportunityId,
    inputFingerprint: "strategy-change-input",
    selectedAngle: { angleId: "angle-1", title: "Boundary", summary: "Explain the boundary.", approach: "Lead with the constraint." },
    identityContextSnapshotId: snapshot.identityContextSnapshotId,
    proposal: {
      coreIdea: "Privacy must be enforced in routing code.",
      audienceTakeaway: "Choose what data may move before choosing a model.",
      narrativeArc: ["Constraint", "Routing decision"],
      hookDirection: "Lead with the constraint.",
      evidencePlan: ["Use the current architecture decision only."],
      factualConstraints: ["Do not claim the whole product is local-only."],
      boundaryConstraints: ["Do not expose private repository contents."],
      destinationPlan: [{ destination: "linkedin", decision: "include", reason: "Context helps.", format: "single narrative post", adaptationNotes: [] }],
      mediaRequirements: [], sequencingNotes: [],
    },
    taskId: "task-strategy",
    createdAt: NOW,
  }), NOW);
  const piece = createPrimaryContentPiece({ contentPieceId: "piece-change", strategy, opportunityId: opportunity.opportunityId, createdAt: NOW });
  const planned = createPlannedPlatformVariant({ platformVariantId: "variant-change", contentPiece: piece, strategy, destination: "linkedin", identityContextSnapshotId: snapshot.identityContextSnapshotId, createdAt: NOW });
  const parentRevision = createPlatformVariantRevision({
    platformVariantRevisionId: "revision-change-1",
    workspaceId: "local-personal",
    platformVariantId: planned.platformVariantId,
    contentPieceId: piece.contentPieceId,
    narrativeStrategyId: strategy.narrativeStrategyId,
    destination: "linkedin",
    revisionNumber: 1,
    strategyRevision: strategy.strategyRevision,
    output: { format: "single_post", content: "Privacy became a real product boundary when the routing layer started enforcing it.", segments: [] },
    inputFingerprint: "sf-cache-v1-parent",
    identityContextSnapshotId: snapshot.identityContextSnapshotId,
    generationProvenance: { taskId: "task-write", provider: "test", model: "writer", routeKind: "remote", promptVersion: "platform_variant_v1", generatedAt: NOW },
    createdAt: NOW,
  });
  const variant = attachPlatformVariantRevision(planned, parentRevision, NOW);
  const review = createPlatformVariantReview({
    platformVariantReviewId: "review-change-1",
    workspaceId: "local-personal",
    platformVariantId: variant.platformVariantId,
    platformVariantRevisionId: parentRevision.platformVariantRevisionId,
    contentPieceId: piece.contentPieceId,
    narrativeStrategyId: strategy.narrativeStrategyId,
    sourceSignalId: sourceSignal.signalId,
    identityContextSnapshotId: snapshot.identityContextSnapshotId,
    destination: "linkedin",
    strategyRevision: strategy.strategyRevision,
    boundaryPrecheck: { blocked: [], warnings: [] },
    evidence: { verdict: "pass", summary: "Supported.", findings: [] },
    authenticity: { verdict: "warn", summary: "Opening is slightly formal.", findings: [{ code: "formal_opening", severity: "warning", message: "The opening is more formal than the saved Voice.", suggestion: "Make the first sentence more direct." }] },
    evidenceProvenance: criticProvenance("task-evidence"),
    authenticityProvenance: criticProvenance("task-auth"),
    createdAt: NOW,
  });
  const approval = createPlatformVariantApproval({
    platformVariantApprovalId: "approval-change-1",
    workspaceId: "local-personal",
    platformVariantId: variant.platformVariantId,
    platformVariantRevisionId: parentRevision.platformVariantRevisionId,
    platformVariantReviewId: review.platformVariantReviewId,
    destination: "linkedin",
    decision: "approved",
    decidedBy: "owner",
    decidedAt: NOW,
  });

  const planningRepository = createMemoryContentPlanningRepository([strategy, piece, { ...variant, status: "approved" }, parentRevision]);
  const reviewRepository = createMemoryContentReviewRepository([review, approval]);
  return {
    ids,
    identityRepository,
    planningRepository,
    reviewRepository,
    opportunityRepository: createMemoryContentOpportunityRepository([opportunity]),
    signalRepository: createMemoryContentSignalRepository([sourceSignal]),
    parentRevision,
    review,
  };
}

test("AI change-request revision is an immutable child with exact instruction and fresh model provenance", async () => {
  const setup = await fixture();
  const revised = createRequestedPlatformVariantRevision({
    platformVariantRevisionId: "revision-change-2",
    parentRevision: setup.parentRevision,
    revisionNumber: 2,
    output: { format: "single_post", content: "Privacy became real when routing code started enforcing the boundary.", segments: [] },
    changeRequest: "Make the opening more direct.",
    generationProvenance: { taskId: "task-revise", provider: "test", model: "writer", routeKind: "remote", promptVersion: "platform_variant_revision_v1", generatedAt: NOW },
    createdAt: NOW,
  });
  assert.equal(revised.origin, "ai_revised");
  assert.equal(revised.parentRevisionId, setup.parentRevision.platformVariantRevisionId);
  assert.equal(revised.changeRequest, "Make the opening more direct.");
  assert.equal(revised.identityContextSnapshotId, setup.parentRevision.identityContextSnapshotId);
  assert.equal(revised.strategyRevision, setup.parentRevision.strategyRevision);
  assert.equal(setup.parentRevision.content, "Privacy became a real product boundary when the routing layer started enforcing it.");
});

test("bounded revision output cannot silently switch platform format", () => {
  assert.throws(() => acceptPlatformRevisionRequest(
    { format: "thread", content: "", segments: ["One", "Two"] },
    "x",
    "single_post",
  ), /cannot change the current platform format/i);
});

test("change request uses exact current revision and review context, then makes old approval historical", async () => {
  const setup = await fixture();
  const seen = [];
  const application = createPlatformChangeRequestApplication({
    contentPlanningRepository: setup.planningRepository,
    contentReviewRepository: setup.reviewRepository,
    contentOpportunityRepository: setup.opportunityRepository,
    contentSignalRepository: setup.signalRepository,
    identityRepository: setup.identityRepository,
    inferenceAdapter: {
      async execute({ task, input }) {
        seen.push({ task, input });
        assert.equal(task.taskType, "platform_variant_revision");
        assert.equal(task.dataClassification, "workspace_private");
        assert.equal(input.parentRevision.platformVariantRevisionId, "revision-change-1");
        assert.equal(input.review.platformVariantReviewId, "review-change-1");
        assert.equal(input.changeRequest, "Make the opening more direct, keep the meaning.");
        assert.equal(input.identityContext.identityContextSnapshotId, input.parentRevision.identityContextSnapshotId);
        return {
          output: { format: "single_post", content: "Privacy became real when routing code started enforcing the boundary.", segments: [] },
          provenance: { taskId: task.taskId, provider: "test-provider", model: "writer-v2", routeKind: "remote", promptVersion: "platform_variant_revision_v1", generatedAt: NOW },
        };
      },
    },
    workspaceId: "local-personal",
    userId: "owner",
    clock: { now: () => NOW },
    idService: setup.ids,
  });

  const revised = await application.requestChange("variant-change", "Make the opening more direct, keep the meaning.");
  assert.equal(seen.length, 1);
  assert.equal(revised.origin, "ai_revised");
  assert.equal(revised.parentRevisionId, "revision-change-1");
  assert.equal(revised.revisionNumber, 2);
  const currentVariant = await setup.planningRepository.get("variant-change");
  assert.equal(currentVariant.currentRevisionId, revised.platformVariantRevisionId);
  assert.equal(currentVariant.status, "review");
  assert.ok(await setup.planningRepository.get("revision-change-1"));
  assert.ok((await setup.reviewRepository.list()).some((record) => record.kind === "PlatformVariantApproval" && record.platformVariantRevisionId === "revision-change-1"));
  assert.equal((await setup.reviewRepository.list()).some((record) => record.kind === "PlatformVariantReview" && record.platformVariantRevisionId === revised.platformVariantRevisionId), false);
});
