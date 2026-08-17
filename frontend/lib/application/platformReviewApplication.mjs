import { assertPort, createSystemClock, createSystemIdService } from "../domain/ports.mjs";
import { normalizeContentOpportunity } from "../domain/contentOpportunities.mjs";
import { normalizeContentSignal } from "../domain/contentSignals.mjs";
import {
  normalizeContentPiece,
  normalizeNarrativeStrategy,
  normalizePlatformVariant,
  VARIANT_STATUSES,
} from "../domain/contentPlanning.mjs";
import {
  attachPlatformVariantRevision,
  createEditedPlatformVariantRevision,
  normalizePlatformVariantRevision,
} from "../domain/platformVariantRevisions.mjs";
import {
  APPROVAL_DECISIONS,
  createPlatformVariantApproval,
  createPlatformVariantReview,
  normalizePlatformVariantApproval,
  normalizePlatformVariantReview,
  reviewAllowsApproval,
} from "../domain/platformVariantReviews.mjs";
import { IDENTITY_RECORD_KINDS, normalizeIdentityContextSnapshot } from "../domain/identityProfiles.mjs";
import { createInferenceTask, INFERENCE_TASK_TYPES } from "../inference/inferenceTasks.mjs";

function required(value, field) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new TypeError(`${field} is required.`);
  return normalized;
}

function criticProvenance(task, result, promptVersion, fallbackTime) {
  return {
    taskId: task.taskId,
    provider: result.provenance?.provider || "unknown",
    model: result.provenance?.model || "unknown",
    routeKind: result.provenance?.routeKind || "remote",
    promptVersion: result.provenance?.promptVersion || promptVersion,
    reviewedAt: result.provenance?.reviewedAt || fallbackTime,
  };
}

export function createPlatformReviewApplication({
  contentPlanningRepository,
  contentReviewRepository,
  contentOpportunityRepository,
  contentSignalRepository,
  identityRepository,
  identityApplication,
  inferenceAdapter,
  workspaceId = "local-personal",
  userId = "owner",
  clock = createSystemClock(),
  idService = createSystemIdService("signalflow"),
} = {}) {
  const plans = assertPort("contentPlanningRepository", contentPlanningRepository);
  const reviews = assertPort("contentReviewRepository", contentReviewRepository);
  const opportunities = assertPort("contentOpportunityRepository", contentOpportunityRepository);
  const signals = assertPort("contentSignalRepository", contentSignalRepository);
  const identities = assertPort("identityRepository", identityRepository);
  const inference = assertPort("inferenceAdapter", inferenceAdapter);
  const appClock = assertPort("clock", clock);
  const appIds = assertPort("idService", idService);
  const ownerWorkspaceId = required(workspaceId, "workspaceId");
  const ownerUserId = required(userId, "userId");
  if (!identityApplication || typeof identityApplication.evaluateBoundaries !== "function") {
    throw new TypeError("Platform review requires the Identity application service.");
  }

  function assertOwned(record) {
    if (record.workspaceId !== ownerWorkspaceId) throw new Error(`${record.kind} belongs to another workspace.`);
    return record;
  }

  async function planningRecord(id, kind, normalize) {
    const stored = await plans.get(required(id, `${kind}Id`));
    if (!stored || stored.kind !== kind) throw new Error(`${kind} ${id} does not exist.`);
    return assertOwned(normalize(stored));
  }

  async function requireVariant(platformVariantId) {
    return planningRecord(platformVariantId, "PlatformVariant", normalizePlatformVariant);
  }

  async function requireRevision(platformVariantRevisionId) {
    return planningRecord(platformVariantRevisionId, "PlatformVariantRevision", normalizePlatformVariantRevision);
  }

  async function requireCurrentRevision(variant) {
    if (!variant.currentRevisionId) throw new Error(`${variant.destination === "x" ? "X" : "LinkedIn"} has no current draft revision to review.`);
    const revision = await requireRevision(variant.currentRevisionId);
    if (revision.platformVariantId !== variant.platformVariantId) throw new Error("Current revision does not belong to the PlatformVariant.");
    return revision;
  }

  async function sourceForStrategy(strategy) {
    const storedOpportunity = await opportunities.get(strategy.opportunityId);
    if (!storedOpportunity) throw new Error(`ContentOpportunity ${strategy.opportunityId} does not exist.`);
    const opportunity = assertOwned(normalizeContentOpportunity(storedOpportunity));
    const signalId = opportunity.signalIds?.[0];
    if (!signalId) throw new Error("The reviewed strategy has no canonical source Signal.");
    const storedSignal = await signals.get(signalId);
    if (!storedSignal) throw new Error(`ContentSignal ${signalId} does not exist.`);
    return assertOwned(normalizeContentSignal(storedSignal));
  }

  async function exactIdentitySnapshot(revision) {
    const stored = await identities.get(revision.identityContextSnapshotId);
    if (!stored || stored.kind !== IDENTITY_RECORD_KINDS.CONTEXT_SNAPSHOT) {
      throw new Error(`Identity Context Snapshot ${revision.identityContextSnapshotId} does not exist.`);
    }
    const snapshot = normalizeIdentityContextSnapshot(stored);
    if (snapshot.workspaceId !== ownerWorkspaceId || snapshot.userId !== ownerUserId) throw new Error("Identity Context Snapshot belongs to another owner/workspace.");
    if (snapshot.platform !== revision.destination) throw new Error("Identity Context Snapshot platform does not match the reviewed revision.");
    return snapshot;
  }

  async function reviewRecords() {
    return (await reviews.list()).filter((record) => record.workspaceId === ownerWorkspaceId);
  }

  async function latestReviewForRevision(revisionId) {
    return (await reviewRecords())
      .filter((record) => record.kind === "PlatformVariantReview" && record.platformVariantRevisionId === revisionId)
      .map(normalizePlatformVariantReview)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] || null;
  }

  async function latestDecisionForRevision(revisionId) {
    return (await reviewRecords())
      .filter((record) => record.kind === "PlatformVariantApproval" && record.platformVariantRevisionId === revisionId)
      .map(normalizePlatformVariantApproval)
      .sort((a, b) => b.decidedAt.localeCompare(a.decidedAt))[0] || null;
  }

  async function contextForCurrentVariant(platformVariantId) {
    const variant = await requireVariant(platformVariantId);
    if (variant.status === VARIANT_STATUSES.OMITTED) throw new Error("An omitted destination has no draft to review.");
    const revision = await requireCurrentRevision(variant);
    const piece = await planningRecord(variant.contentPieceId, "ContentPiece", normalizeContentPiece);
    const strategy = await planningRecord(variant.narrativeStrategyId, "NarrativeStrategy", normalizeNarrativeStrategy);
    if (revision.contentPieceId !== piece.contentPieceId || revision.narrativeStrategyId !== strategy.narrativeStrategyId || revision.strategyRevision !== strategy.strategyRevision) {
      throw new Error("The current revision is stale against its planning dependencies.");
    }
    const sourceSignal = await sourceForStrategy(strategy);
    const identityContext = await exactIdentitySnapshot(revision);
    return { variant, revision, piece, strategy, sourceSignal, identityContext };
  }

  async function reviewCurrentVariant(platformVariantId, { refresh = false } = {}) {
    const context = await contextForCurrentVariant(platformVariantId);
    const existing = await latestReviewForRevision(context.revision.platformVariantRevisionId);
    if (existing && !refresh) return existing;

    const now = appClock.now();
    const boundaryPrecheck = await identityApplication.evaluateBoundaries({
      text: context.revision.content,
      snapshotId: context.revision.identityContextSnapshotId,
    });
    const commonInput = {
      revision: context.revision,
      variant: context.variant,
      strategy: context.strategy,
      contentPiece: context.piece,
      sourceSignal: {
        signalId: context.sourceSignal.signalId,
        workspaceId: context.sourceSignal.workspaceId,
        headline: context.sourceSignal.headline,
        summary: context.sourceSignal.summary,
        boundaryNote: context.sourceSignal.boundaryNote || null,
        privacyClassification: context.sourceSignal.privacyClassification,
      },
      identityContext: context.identityContext,
      dataClassification: context.sourceSignal.privacyClassification,
    };

    const evidenceTask = createInferenceTask({
      taskId: appIds.create("task"),
      workspaceId: ownerWorkspaceId,
      taskType: INFERENCE_TASK_TYPES.EVIDENCE_CRITIQUE,
      dataClassification: context.sourceSignal.privacyClassification,
      inputRefs: [context.revision.platformVariantRevisionId, context.strategy.narrativeStrategyId, context.sourceSignal.signalId],
      requirements: ["structured_output", "exact_revision", "evidence_grounding"],
      createdAt: now,
    });
    const evidenceResult = await inference.execute({ task: evidenceTask, input: commonInput });

    const authenticityTask = createInferenceTask({
      taskId: appIds.create("task"),
      workspaceId: ownerWorkspaceId,
      taskType: INFERENCE_TASK_TYPES.AUTHENTICITY_CRITIQUE,
      dataClassification: context.sourceSignal.privacyClassification,
      inputRefs: [context.revision.platformVariantRevisionId, context.revision.identityContextSnapshotId],
      requirements: ["structured_output", "exact_revision", "identity_context"],
      createdAt: now,
    });
    const authenticityResult = await inference.execute({ task: authenticityTask, input: commonInput });

    return reviews.upsert(createPlatformVariantReview({
      platformVariantReviewId: appIds.create("variant-review"),
      workspaceId: ownerWorkspaceId,
      platformVariantId: context.variant.platformVariantId,
      platformVariantRevisionId: context.revision.platformVariantRevisionId,
      contentPieceId: context.piece.contentPieceId,
      narrativeStrategyId: context.strategy.narrativeStrategyId,
      sourceSignalId: context.sourceSignal.signalId,
      identityContextSnapshotId: context.revision.identityContextSnapshotId,
      destination: context.variant.destination,
      strategyRevision: context.revision.strategyRevision,
      boundaryPrecheck,
      evidence: evidenceResult.output,
      authenticity: authenticityResult.output,
      evidenceProvenance: criticProvenance(evidenceTask, evidenceResult, "evidence_critic_v1", now),
      authenticityProvenance: criticProvenance(authenticityTask, authenticityResult, "authenticity_critic_v1", now),
      createdAt: now,
    }));
  }

  async function editCurrentVariant(platformVariantId, { content, segments = [], format = null } = {}) {
    const { variant, revision } = await contextForCurrentVariant(platformVariantId);
    const normalizedContent = String(content ?? "").replace(/\r\n?/g, "\n").trim();
    if (!normalizedContent && !(variant.destination === "x" && format === "thread" && Array.isArray(segments) && segments.length >= 2)) {
      throw new TypeError("Edited draft content is required.");
    }
    const history = (await plans.list())
      .filter((record) => record.kind === "PlatformVariantRevision" && record.platformVariantId === variant.platformVariantId)
      .map(normalizePlatformVariantRevision);
    const nextRevision = createEditedPlatformVariantRevision({
      platformVariantRevisionId: appIds.create("variant-revision"),
      parentRevision: revision,
      revisionNumber: Math.max(0, ...history.map((item) => item.revisionNumber)) + 1,
      content: normalizedContent,
      segments,
      format: format || revision.format,
      editedBy: ownerUserId,
      createdAt: appClock.now(),
    });
    const persisted = await plans.upsert(nextRevision);
    await plans.upsert(attachPlatformVariantRevision(variant, persisted, appClock.now()));
    return persisted;
  }

  async function approveCurrentVariant(platformVariantId, note = "") {
    const { variant, revision } = await contextForCurrentVariant(platformVariantId);
    const review = await latestReviewForRevision(revision.platformVariantRevisionId);
    if (!review) {
      const error = new Error("Run the evidence and authenticity checks on this exact revision before approving it.");
      error.code = "review_required";
      throw error;
    }
    if (!reviewAllowsApproval(review)) {
      const error = new Error("This revision has blocking review findings. Edit or regenerate it before approval.");
      error.code = "review_blocked";
      throw error;
    }
    const now = appClock.now();
    const approval = await reviews.upsert(createPlatformVariantApproval({
      platformVariantApprovalId: appIds.create("variant-approval"),
      workspaceId: ownerWorkspaceId,
      platformVariantId: variant.platformVariantId,
      platformVariantRevisionId: revision.platformVariantRevisionId,
      platformVariantReviewId: review.platformVariantReviewId,
      destination: variant.destination,
      decision: APPROVAL_DECISIONS.APPROVED,
      note,
      decidedBy: ownerUserId,
      decidedAt: now,
    }));
    await plans.upsert(normalizePlatformVariant({ ...variant, status: VARIANT_STATUSES.APPROVED, updatedAt: now }));
    return approval;
  }

  async function rejectCurrentVariant(platformVariantId, note = "") {
    const { variant, revision } = await contextForCurrentVariant(platformVariantId);
    const review = await latestReviewForRevision(revision.platformVariantRevisionId);
    const now = appClock.now();
    const decision = await reviews.upsert(createPlatformVariantApproval({
      platformVariantApprovalId: appIds.create("variant-approval"),
      workspaceId: ownerWorkspaceId,
      platformVariantId: variant.platformVariantId,
      platformVariantRevisionId: revision.platformVariantRevisionId,
      platformVariantReviewId: review?.platformVariantReviewId || null,
      destination: variant.destination,
      decision: APPROVAL_DECISIONS.REJECTED,
      note,
      decidedBy: ownerUserId,
      decidedAt: now,
    }));
    await plans.upsert(normalizePlatformVariant({ ...variant, status: VARIANT_STATUSES.REJECTED, updatedAt: now }));
    return decision;
  }

  async function getReviewBundle(platformVariantId) {
    const variant = await requireVariant(platformVariantId);
    const revision = variant.currentRevisionId ? await requireRevision(variant.currentRevisionId) : null;
    if (!revision) return { variant, revision: null, review: null, decision: null, approvalValid: false };
    const review = await latestReviewForRevision(revision.platformVariantRevisionId);
    const decision = await latestDecisionForRevision(revision.platformVariantRevisionId);
    return {
      variant,
      revision,
      review,
      decision,
      approvalValid: Boolean(decision?.decision === APPROVAL_DECISIONS.APPROVED
        && decision.platformVariantRevisionId === variant.currentRevisionId
        && review
        && decision.platformVariantReviewId === review.platformVariantReviewId
        && reviewAllowsApproval(review)),
    };
  }

  return {
    reviewCurrentVariant,
    editCurrentVariant,
    approveCurrentVariant,
    rejectCurrentVariant,
    getReviewBundle,
  };
}
