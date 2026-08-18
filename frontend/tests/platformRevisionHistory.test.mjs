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

const NOW = "2026-08-18T16:10:00.000Z";

function signal() {
  return createManualContentSignal({
    signalId: "signal-history",
    workspaceId: "local-personal",
    headline: "Privacy belongs in routing",
    summary: "The product now chooses permitted data movement before selecting a model route.",
    observedAt: NOW,
    privacyClassification: "workspace_private",
  });
}

function opportunity() {
  return createContentOpportunity({
    opportunityId: "opportunity-history",
    workspaceId: "local-personal",
    signalIds: ["signal-history"],
    inputFingerprint: "signal-history-fingerprint",
    evaluation: {
      recommendation: "post",
      title: "Privacy is a routing decision",
      summary: "Explain the engineering trade-off.",
      whyNow: "The decision is recent.",
      score: 88,
      scoreBreakdown: { freshness: 90, importance: 88, novelty: 82, audienceValue: 87, narrativeFit: 91, evidenceStrength: 79 },
      confidence: 0.91,
      evidenceReadiness: { level: "medium", reason: "The architecture decision is known." },
      narrativeFit: { level: "strong", reason: "It is a useful engineering story." },
      repetitionRisk: { level: "low", reason: "No matching prepared story." },
      candidateAngles: [
        { title: "Boundary", summary: "Explain the constraint.", approach: "Lead with the boundary." },
        { title: "Trade-off", summary: "Explain privacy versus model choice.", approach: "Lead with the trade-off." },
        { title: "Lesson", summary: "Explain the engineering lesson.", approach: "Lead with the lesson." },
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

async function fixture() {
  const ids = createDeterministicIdService("history");
  const identityRepository = createMemoryIdentityRepository();
  const identityApplication = createIdentityApplication({
    identityRepository,
    workspaceId: "local-personal",
    userId: "owner",
    clock: { now: () => NOW },
    idService: ids,
  });
  await identityApplication.saveMinimalProfile({
    primaryTopics: "software systems",
    desiredAudienceImpressions: "thoughtful builder",
    qualitiesToSignal: "precise\ncalm",
    qualitiesToAvoid: "hype",
    writingPrinciples: "specific over impressive",
    dislikes: "generic launch copy",
    blockedPhrases: "revolutionary AI platform",
    customBoundaryRules: "never invent customer numbers",
    linkedinRules: "Use enough context for the reasoning.",
    xRules: "Get to the observation quickly.",
  });
  const snapshot = await identityApplication.createIdentityContextSnapshot({ platform: "linkedin" });

  const strategy = approveNarrativeStrategy(createNarrativeStrategy({
    narrativeStrategyId: "strategy-history",
    workspaceId: "local-personal",
    opportunityId: "opportunity-history",
    inputFingerprint: "strategy-history-input",
    selectedAngle: { angleId: "angle-history", title: "Boundary", summary: "Explain the constraint.", approach: "Lead with the boundary." },
    identityContextSnapshotId: snapshot.identityContextSnapshotId,
    proposal: {
      coreIdea: "Privacy must be enforced by routing, not left as prompt guidance.",
      audienceTakeaway: "Decide what data may move before choosing a model.",
      narrativeArc: ["Constraint", "Decision"],
      hookDirection: "Lead with the constraint.",
      evidencePlan: ["Use the current architecture decision."],
      factualConstraints: [],
      boundaryConstraints: [],
      destinationPlan: [{ destination: "linkedin", decision: "include", reason: "Context helps.", format: "single narrative post", adaptationNotes: [] }],
      mediaRequirements: [],
      sequencingNotes: [],
    },
    taskId: "task-strategy",
    createdAt: NOW,
  }), NOW);
  const piece = createPrimaryContentPiece({ contentPieceId: "piece-history", strategy, opportunityId: "opportunity-history", createdAt: NOW });
  const plannedVariant = createPlannedPlatformVariant({
    platformVariantId: "variant-history",
    contentPiece: piece,
    strategy,
    destination: "linkedin",
    identityContextSnapshotId: snapshot.identityContextSnapshotId,
    createdAt: NOW,
  });
  const revision1 = createPlatformVariantRevision({
    platformVariantRevisionId: "revision-history-1",
    workspaceId: "local-personal",
    platformVariantId: plannedVariant.platformVariantId,
    contentPieceId: piece.contentPieceId,
    narrativeStrategyId: strategy.narrativeStrategyId,
    destination: "linkedin",
    revisionNumber: 1,
    strategyRevision: strategy.strategyRevision,
    output: { format: "single_post", content: "Privacy became a product boundary when routing code started enforcing it.", segments: [] },
    inputFingerprint: "history-fingerprint-1",
    identityContextSnapshotId: snapshot.identityContextSnapshotId,
    generationProvenance: { taskId: "task-write-1", provider: "test", model: "writer", routeKind: "remote", promptVersion: "platform_variant_v1", generatedAt: NOW },
    createdAt: NOW,
  });
  const variant = attachPlatformVariantRevision(plannedVariant, revision1, NOW);
  const planningRepository = createMemoryContentPlanningRepository([strategy, piece, variant, revision1]);
  const reviewRepository = createMemoryContentReviewRepository();
  const application = createPlatformReviewApplication({
    contentPlanningRepository: planningRepository,
    contentReviewRepository: reviewRepository,
    contentOpportunityRepository: createMemoryContentOpportunityRepository([opportunity()]),
    contentSignalRepository: createMemoryContentSignalRepository([signal()]),
    identityRepository,
    identityApplication,
    inferenceAdapter: {
      async execute({ task }) {
        return {
          output: task.taskType === "evidence_critique"
            ? { verdict: "pass", summary: "Evidence matches the exact revision.", findings: [] }
            : { verdict: "pass", summary: "Voice matches the exact identity context.", findings: [] },
          provenance: { taskId: task.taskId, provider: "critic", model: "critic", routeKind: "remote", promptVersion: `${task.taskType}_v1`, reviewedAt: NOW },
        };
      },
    },
    workspaceId: "local-personal",
    userId: "owner",
    clock: { now: () => NOW },
    idService: ids,
  });
  return { application, planningRepository, reviewRepository, revision1 };
}

test("revision history returns current and prior immutable revisions with their exact review and judgment state", async () => {
  const { application, revision1 } = await fixture();
  const review1 = await application.reviewCurrentVariant("variant-history");
  await application.approveCurrentVariant("variant-history");
  const revision2 = await application.editCurrentVariant("variant-history", {
    content: "Privacy only becomes a real boundary when the routing layer enforces where data may go.",
  });

  const history = await application.getRevisionHistory("variant-history");
  assert.equal(history.length, 2);
  assert.equal(history[0].revision.platformVariantRevisionId, revision2.platformVariantRevisionId);
  assert.equal(history[0].isCurrent, true);
  assert.equal(history[0].review, null);
  assert.equal(history[1].revision.platformVariantRevisionId, revision1.platformVariantRevisionId);
  assert.equal(history[1].isCurrent, false);
  assert.equal(history[1].review.platformVariantReviewId, review1.platformVariantReviewId);
  assert.equal(history[1].decision.decision, "approved");
  assert.equal(history[1].approvalValid, true);
});

test("owner can review and explicitly judge an older exact revision without changing the current pointer", async () => {
  const { application, planningRepository, revision1 } = await fixture();
  await application.reviewCurrentVariant("variant-history");
  const revision2 = await application.editCurrentVariant("variant-history", {
    content: "Privacy only becomes a real boundary when routing decides where data may move.",
  });

  const approval = await application.approveRevision("variant-history", revision1.platformVariantRevisionId, {
    expectedCurrentRevisionId: revision2.platformVariantRevisionId,
    note: "I still prefer the earlier reviewed wording.",
  });
  assert.equal(approval.platformVariantRevisionId, revision1.platformVariantRevisionId);
  assert.equal((await planningRepository.get("variant-history")).currentRevisionId, revision2.platformVariantRevisionId);
  assert.equal((await application.getReviewBundleForRevision("variant-history", revision1.platformVariantRevisionId)).approvalValid, true);
});

test("restore creates a new immutable child from the current pointer and copies the selected prior content with explicit provenance", async () => {
  const { application, planningRepository, revision1 } = await fixture();
  await application.reviewCurrentVariant("variant-history");
  const revision2 = await application.editCurrentVariant("variant-history", {
    content: "Privacy only becomes real when routing code enforces the permitted path.",
  });
  const restored = await application.restoreRevision("variant-history", revision1.platformVariantRevisionId, {
    expectedCurrentRevisionId: revision2.platformVariantRevisionId,
  });

  assert.equal(restored.revisionNumber, 3);
  assert.equal(restored.parentRevisionId, revision2.platformVariantRevisionId);
  assert.equal(restored.content, revision1.content);
  assert.equal(restored.editProvenance.restoredFromRevisionId, revision1.platformVariantRevisionId);
  assert.equal(restored.identityContextSnapshotId, revision1.identityContextSnapshotId);
  assert.equal((await planningRepository.get("variant-history")).currentRevisionId, restored.platformVariantRevisionId);

  const current = await application.getReviewBundle("variant-history");
  assert.equal(current.revision.platformVariantRevisionId, restored.platformVariantRevisionId);
  assert.equal(current.review, null);
  assert.equal(current.approvalValid, false);
});

test("stale clients cannot review, approve, reject, or restore against an unseen newer current revision", async () => {
  const { application, revision1 } = await fixture();
  await application.reviewCurrentVariant("variant-history");
  const revision2 = await application.editCurrentVariant("variant-history", {
    content: "A second immutable working revision.",
  });

  for (const operation of [
    () => application.reviewRevision("variant-history", revision1.platformVariantRevisionId, { expectedCurrentRevisionId: revision1.platformVariantRevisionId }),
    () => application.approveRevision("variant-history", revision1.platformVariantRevisionId, { expectedCurrentRevisionId: revision1.platformVariantRevisionId }),
    () => application.rejectRevision("variant-history", revision1.platformVariantRevisionId, { expectedCurrentRevisionId: revision1.platformVariantRevisionId }),
    () => application.restoreRevision("variant-history", revision1.platformVariantRevisionId, { expectedCurrentRevisionId: revision1.platformVariantRevisionId }),
  ]) {
    await assert.rejects(operation, (error) => error.code === "stale_revision_context");
  }

  assert.notEqual(revision2.platformVariantRevisionId, revision1.platformVariantRevisionId);
});

test("historical revisions from an older strategy revision remain inspectable but cannot be restored or newly judged under a newer plan", async () => {
  const { application, planningRepository, revision1 } = await fixture();
  await application.reviewCurrentVariant("variant-history");
  const variant = await planningRepository.get("variant-history");
  const strategy = await planningRepository.get("strategy-history");
  await planningRepository.upsert({ ...strategy, strategyRevision: 2, updatedAt: NOW });

  const bundle = await application.getReviewBundleForRevision("variant-history", revision1.platformVariantRevisionId);
  assert.equal(bundle.planningCurrent, false);
  await assert.rejects(
    () => application.approveRevision("variant-history", revision1.platformVariantRevisionId, { expectedCurrentRevisionId: variant.currentRevisionId }),
    (error) => error.code === "stale_planning_contract",
  );
});
