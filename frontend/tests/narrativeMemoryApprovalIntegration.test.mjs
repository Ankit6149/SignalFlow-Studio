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
import { createIdentityApplication } from "../lib/application/identityApplication.mjs";
import { createNarrativeMemoryApplication } from "../lib/application/narrativeMemoryApplication.mjs";
import { createPlatformReviewApplication } from "../lib/application/platformReviewApplication.mjs";
import { createMemoryContentOpportunityRepository } from "../lib/infrastructure/contentOpportunityAdapters.mjs";
import { createMemoryContentPlanningRepository } from "../lib/infrastructure/contentPlanningAdapters.mjs";
import { createMemoryContentReviewRepository } from "../lib/infrastructure/contentReviewAdapters.mjs";
import { createMemoryContentSignalRepository } from "../lib/infrastructure/contentSignalAdapters.mjs";
import { createMemoryIdentityRepository } from "../lib/infrastructure/identityAdapters.mjs";
import { createMemoryNarrativeMemoryRepository } from "../lib/infrastructure/narrativeMemoryAdapters.mjs";
import { createDeterministicIdService } from "../lib/domain/ports.mjs";

const NOW = "2026-08-17T18:00:00.000Z";
const NEXT = "2026-08-17T18:05:00.000Z";

async function fixture() {
  const ids = createDeterministicIdService("memory-approval");
  const clock = { now: () => NOW };
  const identityRepository = createMemoryIdentityRepository();
  const identityApplication = createIdentityApplication({
    identityRepository,
    workspaceId: "local-personal",
    userId: "owner",
    clock,
    idService: ids,
  });
  await identityApplication.saveMinimalProfile({
    primaryTopics: "software systems\nAI products",
    desiredAudienceImpressions: "thoughtful builder",
    qualitiesToSignal: "precise\ncalm",
    qualitiesToAvoid: "hype",
    writingPrinciples: "specific over impressive",
    dislikes: "generic launch copy",
    blockedPhrases: "revolutionary AI platform",
    customBoundaryRules: "never invent customer numbers",
    linkedinRules: "Explain the reasoning clearly.",
    xRules: "Get to the observation quickly.",
  });
  const snapshot = await identityApplication.createIdentityContextSnapshot({ platform: "linkedin" });

  const signal = createManualContentSignal({
    signalId: "signal-memory-approval",
    workspaceId: "local-personal",
    headline: "Privacy belongs in model routing",
    summary: "Data classification now constrains model routing before model selection.",
    observedAt: NOW,
    privacyClassification: "workspace_private",
  });
  const opportunity = createContentOpportunity({
    opportunityId: "opportunity-memory-approval",
    workspaceId: "local-personal",
    signalIds: [signal.signalId],
    inputFingerprint: "memory-approval-opportunity-input",
    evaluation: {
      recommendation: "post",
      title: "Privacy belongs in model routing",
      summary: "Explain why privacy is an execution boundary.",
      whyNow: "The architecture decision is implemented.",
      score: 92,
      scoreBreakdown: { freshness: 93, importance: 90, novelty: 84, audienceValue: 90, narrativeFit: 94, evidenceStrength: 90 },
      confidence: 0.94,
      evidenceReadiness: { level: "strong", reason: "Implemented behavior is available as evidence." },
      narrativeFit: { level: "strong", reason: "The engineering trade-off is useful." },
      repetitionRisk: { level: "unknown", reason: "No story memory was supplied yet." },
      candidateAngles: [
        { title: "Architecture boundary", summary: "Explain the routing constraint.", approach: "Lead with the boundary." },
        { title: "Fail closed", summary: "Explain refusal to downgrade privacy.", approach: "Lead with the refusal." },
        { title: "Engineering lesson", summary: "Explain the system-design lesson.", approach: "Lead with the principle." },
      ],
      candidateDestinations: [{ destination: "linkedin", recommended: true, reason: "Context helps.", format: "narrative post" }],
      excludedDestinations: [],
      recommendedMediaTypes: ["text_only"],
      freshnessState: "fresh",
      productionEffortEstimate: "low",
    },
    evaluationProvenance: {
      taskId: "task-opportunity-memory-approval",
      taskType: "opportunity_evaluation",
      provider: "test",
      model: "test",
      routeKind: "remote",
      evaluatedAt: NOW,
    },
    createdAt: NOW,
  });
  const strategy = approveNarrativeStrategy(createNarrativeStrategy({
    narrativeStrategyId: "strategy-memory-approval",
    workspaceId: "local-personal",
    opportunityId: opportunity.opportunityId,
    inputFingerprint: "memory-approval-strategy-input",
    selectedAngle: {
      angleId: "angle-memory-approval",
      title: "Architecture boundary",
      summary: "Explain the routing constraint.",
      approach: "Lead with the boundary.",
    },
    identityContextSnapshotId: snapshot.identityContextSnapshotId,
    proposal: {
      coreIdea: "Privacy classification should constrain routing before model selection.",
      audienceTakeaway: "Trust boundaries belong in execution policy, not prompt wording.",
      narrativeArc: ["Constraint", "Routing", "Fail closed"],
      hookDirection: "Lead with the routing consequence.",
      evidencePlan: ["Use the implemented routing behavior."],
      factualConstraints: [],
      boundaryConstraints: [],
      destinationPlan: [{ destination: "linkedin", decision: "include", reason: "Context helps.", format: "single narrative post", adaptationNotes: [] }],
      mediaRequirements: [],
      sequencingNotes: [],
    },
    taskId: "task-strategy-memory-approval",
    createdAt: NOW,
  }), NOW);
  const contentPiece = createPrimaryContentPiece({
    contentPieceId: "piece-memory-approval",
    strategy,
    opportunityId: opportunity.opportunityId,
    createdAt: NOW,
  });
  const plannedVariant = createPlannedPlatformVariant({
    platformVariantId: "variant-memory-approval",
    contentPiece,
    strategy,
    destination: "linkedin",
    identityContextSnapshotId: snapshot.identityContextSnapshotId,
    createdAt: NOW,
  });
  const originalText = "Privacy became a real product boundary when the routing layer started enforcing data classification before model selection.";
  const revision = createPlatformVariantRevision({
    platformVariantRevisionId: "revision-memory-approval-1",
    workspaceId: "local-personal",
    platformVariantId: plannedVariant.platformVariantId,
    contentPieceId: contentPiece.contentPieceId,
    narrativeStrategyId: strategy.narrativeStrategyId,
    destination: "linkedin",
    revisionNumber: 1,
    strategyRevision: strategy.strategyRevision,
    output: { format: "single_post", content: originalText, segments: [] },
    inputFingerprint: "memory-approval-revision-input",
    identityContextSnapshotId: snapshot.identityContextSnapshotId,
    generationProvenance: {
      taskId: "task-write-memory-approval",
      provider: "test",
      model: "writer",
      routeKind: "remote",
      promptVersion: "platform_variant_v1",
      generatedAt: NOW,
    },
    createdAt: NOW,
  });
  const variant = attachPlatformVariantRevision(plannedVariant, revision, NOW);

  const planningRepository = createMemoryContentPlanningRepository([strategy, contentPiece, variant, revision]);
  const reviewRepository = createMemoryContentReviewRepository();
  const narrativeMemoryRepository = createMemoryNarrativeMemoryRepository();
  const narrativeMemoryApplication = createNarrativeMemoryApplication({
    narrativeMemoryRepository,
    workspaceId: "local-personal",
    clock,
    idService: ids,
  });
  const application = createPlatformReviewApplication({
    contentPlanningRepository: planningRepository,
    contentReviewRepository: reviewRepository,
    contentOpportunityRepository: createMemoryContentOpportunityRepository([opportunity]),
    contentSignalRepository: createMemoryContentSignalRepository([signal]),
    identityRepository,
    identityApplication,
    narrativeMemoryApplication,
    inferenceAdapter: {
      async execute({ task }) {
        return {
          output: task.taskType === "evidence_critique"
            ? { verdict: "pass", summary: "Claims are supported.", findings: [] }
            : { verdict: "pass", summary: "Voice is aligned.", findings: [] },
          provenance: {
            taskId: task.taskId,
            provider: "test-critic",
            model: "critic",
            routeKind: "remote",
            promptVersion: `${task.taskType}_v1`,
            reviewedAt: NOW,
          },
        };
      },
    },
    workspaceId: "local-personal",
    userId: "owner",
    clock,
    idService: ids,
  });

  return {
    application,
    narrativeMemoryRepository,
    planningRepository,
    originalText,
    revision,
  };
}

test("exact owner approval creates one prepared_internal NarrativeMemory and edit preserves historical binding", async () => {
  const { application, narrativeMemoryRepository, originalText, revision } = await fixture();
  await application.reviewCurrentVariant("variant-memory-approval");
  const approval = await application.approveCurrentVariant("variant-memory-approval", "Approved for handoff.");

  const memories = await narrativeMemoryRepository.list();
  assert.equal(memories.length, 1);
  const [memory] = memories;
  assert.equal(memory.platformVariantApprovalId, approval.platformVariantApprovalId);
  assert.equal(memory.platformVariantRevisionId, revision.platformVariantRevisionId);
  assert.equal(memory.historyStrength, "prepared_internal");
  assert.equal(memory.publishedAt, null);
  assert.equal(JSON.stringify(memory).includes(originalText), false, "NarrativeMemory must not duplicate raw approved draft text");

  const edited = await application.editCurrentVariant("variant-memory-approval", {
    content: "The routing layer now treats privacy classification as an execution constraint before selecting a model.",
  });
  assert.notEqual(edited.platformVariantRevisionId, revision.platformVariantRevisionId);
  const afterEdit = await narrativeMemoryRepository.list();
  assert.equal(afterEdit.length, 1);
  assert.equal(afterEdit[0].platformVariantRevisionId, revision.platformVariantRevisionId, "historical memory stays bound to the exact revision that was approved");
});

test("rejection never creates positive NarrativeMemory", async () => {
  const { application, narrativeMemoryRepository } = await fixture();
  await application.reviewCurrentVariant("variant-memory-approval");
  const rejection = await application.rejectCurrentVariant("variant-memory-approval", "Not the story to tell.");
  assert.equal(rejection.decision, "rejected");
  assert.deepEqual(await narrativeMemoryRepository.list(), []);
});
