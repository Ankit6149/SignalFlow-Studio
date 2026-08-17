import test from "node:test";
import assert from "node:assert/strict";

import {
  NARRATIVE_HISTORY_STRENGTHS,
  REPETITION_ACTIONS,
  REPETITION_RISK_LEVELS,
  buildNarrativeRepetitionReport,
  createPreparedNarrativeMemory,
  normalizeNarrativeMemory,
} from "../lib/domain/narrativeMemory.mjs";
import { createNarrativeMemoryApplication } from "../lib/application/narrativeMemoryApplication.mjs";
import { createMemoryNarrativeMemoryRepository } from "../lib/infrastructure/narrativeMemoryAdapters.mjs";
import { createDeterministicIdService } from "../lib/domain/ports.mjs";
import { createPlatformVariantApproval } from "../lib/domain/platformVariantReviews.mjs";
import { createContentOpportunity } from "../lib/domain/contentOpportunities.mjs";
import {
  approveNarrativeStrategy,
  createNarrativeStrategy,
  createPlannedPlatformVariant,
  createPrimaryContentPiece,
} from "../lib/domain/contentPlanning.mjs";
import { createPlatformVariantRevision } from "../lib/domain/platformVariantRevisions.mjs";

const NOW = "2026-08-17T17:30:00.000Z";

function storyFixture({ revisionId = "revision-memory-1", approvalId = "approval-memory-1", content = "Privacy became a product boundary when model routing began enforcing data classification." } = {}) {
  const opportunity = createContentOpportunity({
    opportunityId: "opportunity-memory",
    workspaceId: "local-personal",
    signalIds: ["signal-memory"],
    inputFingerprint: "memory-opportunity-input",
    evaluation: {
      recommendation: "post",
      title: "Privacy belongs in model routing",
      summary: "Explain why privacy changes which model route is permitted.",
      whyNow: "The routing boundary was just implemented.",
      score: 91,
      scoreBreakdown: { freshness: 92, importance: 90, novelty: 84, audienceValue: 89, narrativeFit: 93, evidenceStrength: 88 },
      confidence: 0.93,
      evidenceReadiness: { level: "strong", reason: "The architecture decision is implemented." },
      narrativeFit: { level: "strong", reason: "The trade-off is useful to explain." },
      repetitionRisk: { level: "unknown", reason: "No memory was supplied yet." },
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
    evaluationProvenance: { taskId: "task-opportunity-memory", taskType: "opportunity_evaluation", provider: "test", model: "test", routeKind: "remote", evaluatedAt: NOW },
    createdAt: NOW,
  });
  const strategy = approveNarrativeStrategy(createNarrativeStrategy({
    narrativeStrategyId: "strategy-memory",
    workspaceId: "local-personal",
    opportunityId: opportunity.opportunityId,
    inputFingerprint: "strategy-memory-input",
    selectedAngle: { angleId: "angle-memory", title: "Architecture boundary", summary: "Explain the routing constraint.", approach: "Lead with the boundary." },
    identityContextSnapshotId: "snapshot-memory",
    proposal: {
      coreIdea: "Privacy classification should constrain routing before model selection.",
      audienceTakeaway: "Trust boundaries belong in execution policy, not prompt wording.",
      narrativeArc: ["Constraint", "Routing", "Fail closed"],
      hookDirection: "Lead with the routing consequence.",
      evidencePlan: ["Use the implemented privacy-routing behavior."],
      factualConstraints: [],
      boundaryConstraints: [],
      destinationPlan: [{ destination: "linkedin", decision: "include", reason: "Context helps.", format: "single narrative post", adaptationNotes: [] }],
      mediaRequirements: [],
      sequencingNotes: [],
    },
    taskId: "task-strategy-memory",
    createdAt: NOW,
  }), NOW);
  const contentPiece = createPrimaryContentPiece({ contentPieceId: "piece-memory", strategy, opportunityId: opportunity.opportunityId, createdAt: NOW });
  const variant = createPlannedPlatformVariant({ platformVariantId: "variant-memory", contentPiece, strategy, destination: "linkedin", identityContextSnapshotId: "snapshot-memory", createdAt: NOW });
  const revision = createPlatformVariantRevision({
    platformVariantRevisionId: revisionId,
    workspaceId: "local-personal",
    platformVariantId: variant.platformVariantId,
    contentPieceId: contentPiece.contentPieceId,
    narrativeStrategyId: strategy.narrativeStrategyId,
    destination: "linkedin",
    revisionNumber: 1,
    strategyRevision: strategy.strategyRevision,
    output: { format: "single_post", content, segments: [] },
    inputFingerprint: "memory-revision-input",
    identityContextSnapshotId: "snapshot-memory",
    generationProvenance: { taskId: "task-write-memory", provider: "test", model: "writer", routeKind: "remote", promptVersion: "platform_variant_v1", generatedAt: NOW },
    createdAt: NOW,
  });
  const approval = createPlatformVariantApproval({
    platformVariantApprovalId: approvalId,
    workspaceId: "local-personal",
    platformVariantId: variant.platformVariantId,
    platformVariantRevisionId: revision.platformVariantRevisionId,
    platformVariantReviewId: "review-memory",
    destination: "linkedin",
    decision: "approved",
    decidedBy: "owner",
    decidedAt: NOW,
  });
  return { opportunity, strategy, contentPiece, variant, revision, approval };
}

test("prepared NarrativeMemory stores exact refs and hashes wording without copying approved draft text", () => {
  const raw = "This exact private approved draft should not be copied into NarrativeMemory.";
  const memory = createPreparedNarrativeMemory({
    narrativeMemoryId: "memory-privacy",
    workspaceId: "local-personal",
    opportunityId: "opportunity-1",
    narrativeStrategyId: "strategy-1",
    contentPieceId: "piece-1",
    platformVariantId: "variant-1",
    platformVariantRevisionId: "revision-1",
    platformVariantApprovalId: "approval-1",
    platform: "linkedin",
    topic: "Privacy routing",
    angle: "Architecture boundary",
    coreIdea: "Privacy constrains model routing.",
    approvedContent: raw,
    approvedAt: NOW,
    createdAt: NOW,
  });
  assert.equal(memory.historyStrength, NARRATIVE_HISTORY_STRENGTHS.PREPARED_INTERNAL);
  assert.equal(memory.publishedAt, null);
  assert.ok(memory.lexicalHashes.length > 0);
  assert.equal(JSON.stringify(memory).includes(raw), false);
  assert.equal(Object.hasOwn(memory, "approvedContent"), false);
});

test("prepared_internal memory cannot fabricate publication evidence", () => {
  const memory = createPreparedNarrativeMemory({
    narrativeMemoryId: "memory-no-publish",
    workspaceId: "local-personal",
    opportunityId: "opportunity-1",
    narrativeStrategyId: "strategy-1",
    contentPieceId: "piece-1",
    platformVariantId: "variant-1",
    platformVariantRevisionId: "revision-1",
    platformVariantApprovalId: "approval-1",
    platform: "linkedin",
    topic: "Privacy routing",
    angle: "Architecture boundary",
    coreIdea: "Privacy constrains model routing.",
    approvedAt: NOW,
    createdAt: NOW,
  });
  assert.throws(() => normalizeNarrativeMemory({ ...memory, publishedAt: NOW }), /cannot claim publishedAt/i);
});

test("exact approved revision creates one idempotent prepared_internal memory record", async () => {
  const repository = createMemoryNarrativeMemoryRepository();
  const application = createNarrativeMemoryApplication({
    narrativeMemoryRepository: repository,
    workspaceId: "local-personal",
    clock: { now: () => NOW },
    idService: createDeterministicIdService("memory"),
  });
  const chain = storyFixture();
  const first = await application.recordApprovedVariant(chain);
  const second = await application.recordApprovedVariant(chain);
  assert.equal(first.narrativeMemoryId, second.narrativeMemoryId);
  assert.equal(first.platformVariantRevisionId, chain.revision.platformVariantRevisionId);
  assert.equal(first.platformVariantApprovalId, chain.approval.platformVariantApprovalId);
  assert.equal(first.historyStrength, "prepared_internal");
  assert.equal(first.publishedAt, null);
  assert.equal((await repository.list()).length, 1);
});

test("rejected decisions cannot create positive NarrativeMemory", async () => {
  const repository = createMemoryNarrativeMemoryRepository();
  const application = createNarrativeMemoryApplication({ narrativeMemoryRepository: repository, workspaceId: "local-personal" });
  const chain = storyFixture();
  await assert.rejects(
    () => application.recordApprovedVariant({ ...chain, approval: { ...chain.approval, decision: "rejected" } }),
    /requires an exact approved revision/i,
  );
  assert.equal((await repository.list()).length, 0);
});

test("recent same-angle story produces high repetition while evidence-backed follow-up is explicit", () => {
  const memory = createPreparedNarrativeMemory({
    narrativeMemoryId: "memory-repeat",
    workspaceId: "local-personal",
    opportunityId: "opportunity-old",
    narrativeStrategyId: "strategy-old",
    contentPieceId: "piece-old",
    platformVariantId: "variant-old",
    platformVariantRevisionId: "revision-old",
    platformVariantApprovalId: "approval-old",
    platform: "linkedin",
    topic: "Privacy belongs in model routing",
    angle: "Architecture boundary",
    coreIdea: "Privacy classification should constrain routing before model selection.",
    approvedContent: "Privacy became a product boundary when model routing began enforcing data classification.",
    approvedAt: "2026-08-12T17:30:00.000Z",
    createdAt: "2026-08-12T17:30:00.000Z",
  });
  const candidate = {
    title: "Privacy belongs in model routing",
    summary: "Explain why privacy classification constrains routing before model selection.",
    angle: "Architecture boundary",
    coreIdea: "Privacy classification should constrain routing before model selection.",
    destinations: ["linkedin"],
    occurredAt: NOW,
  };
  const repeated = buildNarrativeRepetitionReport(candidate, [memory], { now: NOW });
  assert.equal(repeated.historyAvailable, true);
  assert.equal(repeated.riskLevel, REPETITION_RISK_LEVELS.HIGH);
  assert.equal(repeated.recommendedAction, REPETITION_ACTIONS.POSTPONE);

  const followUp = buildNarrativeRepetitionReport({ ...candidate, hasFollowUpEvidence: true }, [memory], { now: NOW });
  assert.equal(followUp.riskLevel, REPETITION_RISK_LEVELS.HIGH);
  assert.equal(followUp.recommendedAction, REPETITION_ACTIONS.FOLLOW_UP);
});
