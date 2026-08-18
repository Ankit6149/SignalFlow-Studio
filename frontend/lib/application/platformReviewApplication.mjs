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
  createRestoredPlatformVariantRevision,
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
  narrativeMemoryApplication = null,
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
  if (narrativeMemoryApplication && (typeof narrativeMemoryApplication.recordApprovedVariant !== "function" || typeof narrativeMemoryApplication.removeMemory !== "function")) {
    throw new TypeError("Narrative memory application must expose recordApprovedVariant() and removeMemory().");
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

  function assertExpectedCurrent(variant, expectedCurrentRevisionId) {
    const expected = required(expectedCurrentRevisionId, "expectedCurrentRevisionId");
    if (variant.currentRevisionId !== expected) {
      const error = new Error("This review surface is stale because a newer current revision exists. Reload before making a judgment.");
      error.code = "stale_revision_context";
      throw error;
    }
  }

  async function opportunityForStrategy(strategy) {
    const storedOpportunity = await opportunities.get(strategy.opportunityId);
    if (!storedOpportunity) throw new Error(`ContentOpportunity ${strategy.opportunityId} does not exist.`);
    return assertOwned(normalizeContentOpportunity(storedOpportunity));
  }

  async function sourceForStrategy(strategy) {
    const opportunity = await opportunityForStrategy(strategy);
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

  async function contextForRevision(platformVariantId, revisionId, { expectedCurrentRevisionId = null } = {}) {
    const variant = await requireVariant(platformVariantId);
    if (variant.status === VARIANT_STATUSES.OMITTED) throw new Error("An omitted destination has no draft to review.");
    if (expectedCurrentRevisionId) assertExpectedCurrent(variant, expectedCurrentRevisionId);
    const revision = await requireRevision(revisionId);
    if (revision.platformVariantId !== variant.platformVariantId) throw new Error("Selected revision does not belong to the PlatformVariant.");
    const piece = await planningRecord(variant.contentPieceId, "ContentPiece", normalizeContentPiece);
    const strategy = await planningRecord(variant.narrativeStrategyId, "NarrativeStrategy", normalizeNarrativeStrategy);
    if (revision.contentPieceId !== piece.contentPieceId
      || revision.narrativeStrategyId !== strategy.narrativeStrategyId
      || revision.strategyRevision !== strategy.strategyRevision) {
      const error = new Error("This revision belongs to an older planning contract and cannot be judged as the current story without rebuilding the plan.");
      error.code = "stale_planning_contract";
      throw error;
    }
    const sourceSignal = await sourceForStrategy(strategy);
    const identityContext = await exactIdentitySnapshot(revision);
    return { variant, revision, piece, strategy, sourceSignal, identityContext };
  }

  async function contextForCurrentVariant(platformVariantId) {
    const variant = await requireVariant(platformVariantId);
    const revision = await requireCurrentRevision(variant);
    return contextForRevision(platformVariantId, revision.platformVariantRevisionId, { expectedCurrentRevisionId: revision.platformVariantRevisionId });
  }

  async function reviewRevision(platformVariantId, platformVariantRevisionId, { refresh = false, expectedCurrentRevisionId } = {}) {
    const context = await contextForRevision(platformVariantId, platformVariantRevisionId, { expectedCurrentRevisionId });
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

  async function reviewCurrentVariant(platformVariantId, { refresh = false } = {}) {
    const variant = await requireVariant(platformVariantId);
    const revision = await requireCurrentRevision(variant);
    return reviewRevision(platformVariantId, revision.platformVariantRevisionId, {
      refresh,
      expectedCurrentRevisionId: revision.platformVariantRevisionId,
    });
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

  async function persistApproval(context, decision, note = "") {
    const review = await latestReviewForRevision(context.revision.platformVariantRevisionId);
    if (decision === APPROVAL_DECISIONS.APPROVED) {
      if (!review) {
        const error = new Error("Run the evidence and authenticity checks on this exact revision before approving it.");
        error.code = "review_required";
        throw error;
      }
      if (!reviewAllowsApproval(review)) {
        const error = new Error("This revision has blocking review findings. Edit, restore, or regenerate before approval.");
        error.code = "review_blocked";
        throw error;
      }
    }
    const now = appClock.now();
    const approvalRecord = createPlatformVariantApproval({
      platformVariantApprovalId: appIds.create("variant-approval"),
      workspaceId: ownerWorkspaceId,
      platformVariantId: context.variant.platformVariantId,
      platformVariantRevisionId: context.revision.platformVariantRevisionId,
      platformVariantReviewId: review?.platformVariantReviewId || null,
      destination: context.variant.destination,
      decision,
      note,
      decidedBy: ownerUserId,
      decidedAt: now,
    });

    let derivedMemory = null;
    if (decision === APPROVAL_DECISIONS.APPROVED && narrativeMemoryApplication) {
      const opportunity = await opportunityForStrategy(context.strategy);
      derivedMemory = await narrativeMemoryApplication.recordApprovedVariant({
        approval: approvalRecord,
        variant: context.variant,
        revision: context.revision,
        strategy: context.strategy,
        contentPiece: context.piece,
        opportunity,
      });
    }

    let persisted;
    try {
      persisted = await reviews.upsert(approvalRecord);
    } catch (error) {
      if (derivedMemory?.narrativeMemoryId && narrativeMemoryApplication) {
        try { await narrativeMemoryApplication.removeMemory(derivedMemory.narrativeMemoryId); } catch {}
      }
      throw error;
    }

    if (context.variant.currentRevisionId === context.revision.platformVariantRevisionId) {
      await plans.upsert(normalizePlatformVariant({
        ...context.variant,
        status: decision === APPROVAL_DECISIONS.APPROVED ? VARIANT_STATUSES.APPROVED : VARIANT_STATUSES.REJECTED,
        updatedAt: now,
      }));
    }
    return persisted;
  }

  async function approveRevision(platformVariantId, platformVariantRevisionId, { expectedCurrentRevisionId, note = "" } = {}) {
    const context = await contextForRevision(platformVariantId, platformVariantRevisionId, { expectedCurrentRevisionId });
    return persistApproval(context, APPROVAL_DECISIONS.APPROVED, note);
  }

  async function approveCurrentVariant(platformVariantId, note = "") {
    const variant = await requireVariant(platformVariantId);
    const revision = await requireCurrentRevision(variant);
    return approveRevision(platformVariantId, revision.platformVariantRevisionId, {
      expectedCurrentRevisionId: revision.platformVariantRevisionId,
      note,
    });
  }

  async function rejectRevision(platformVariantId, platformVariantRevisionId, { expectedCurrentRevisionId, note = "" } = {}) {
    const context = await contextForRevision(platformVariantId, platformVariantRevisionId, { expectedCurrentRevisionId });
    return persistApproval(context, APPROVAL_DECISIONS.REJECTED, note);
  }

  async function rejectCurrentVariant(platformVariantId, note = "") {
    const variant = await requireVariant(platformVariantId);
    const revision = await requireCurrentRevision(variant);
    return rejectRevision(platformVariantId, revision.platformVariantRevisionId, {
      expectedCurrentRevisionId: revision.platformVariantRevisionId,
      note,
    });
  }

  async function restoreRevision(platformVariantId, sourceRevisionId, { expectedCurrentRevisionId } = {}) {
    const variant = await requireVariant(platformVariantId);
    assertExpectedCurrent(variant, expectedCurrentRevisionId);
    if (!variant.currentRevisionId) throw new Error("There is no current revision to restore against.");
    if (sourceRevisionId === variant.currentRevisionId) {
      const error = new Error("That revision is already current.");
      error.code = "revision_already_current";
      throw error;
    }
    const currentRevision = await requireRevision(variant.currentRevisionId);
    const sourceRevision = await requireRevision(sourceRevisionId);
    if (sourceRevision.platformVariantId !== variant.platformVariantId) throw new Error("The selected historical revision belongs to another PlatformVariant.");
    const strategy = await planningRecord(variant.narrativeStrategyId, "NarrativeStrategy", normalizeNarrativeStrategy);
    if (sourceRevision.strategyRevision !== strategy.strategyRevision || currentRevision.strategyRevision !== strategy.strategyRevision) {
      const error = new Error("A revision from an older campaign-plan revision cannot be restored into the current story contract.");
      error.code = "stale_planning_contract";
      throw error;
    }
    const history = (await plans.list())
      .filter((record) => record.kind === "PlatformVariantRevision" && record.platformVariantId === variant.platformVariantId)
      .map(normalizePlatformVariantRevision);
    const now = appClock.now();
    const restored = createRestoredPlatformVariantRevision({
      platformVariantRevisionId: appIds.create("variant-revision"),
      currentRevision,
      sourceRevision,
      revisionNumber: Math.max(0, ...history.map((item) => item.revisionNumber)) + 1,
      restoredBy: ownerUserId,
      createdAt: now,
    });
    const persisted = await plans.upsert(restored);
    await plans.upsert(attachPlatformVariantRevision(variant, persisted, now));
    return persisted;
  }

  async function getReviewBundleForRevision(platformVariantId, platformVariantRevisionId) {
    const variant = await requireVariant(platformVariantId);
    const revision = await requireRevision(platformVariantRevisionId);
    if (revision.platformVariantId !== variant.platformVariantId) throw new Error("Selected revision does not belong to the PlatformVariant.");
    const review = await latestReviewForRevision(revision.platformVariantRevisionId);
    const decision = await latestDecisionForRevision(revision.platformVariantRevisionId);
    const currentStrategy = await planningRecord(variant.narrativeStrategyId, "NarrativeStrategy", normalizeNarrativeStrategy);
    const approvalValid = Boolean(decision?.decision === APPROVAL_DECISIONS.APPROVED
      && review
      && decision.platformVariantReviewId === review.platformVariantReviewId
      && reviewAllowsApproval(review));
    return {
      variant,
      revision,
      review,
      decision,
      approvalValid,
      isCurrent: variant.currentRevisionId === revision.platformVariantRevisionId,
      planningCurrent: revision.strategyRevision === currentStrategy.strategyRevision,
    };
  }

  async function getReviewBundle(platformVariantId) {
    const variant = await requireVariant(platformVariantId);
    if (!variant.currentRevisionId) return { variant, revision: null, review: null, decision: null, approvalValid: false, isCurrent: false, planningCurrent: false };
    return getReviewBundleForRevision(platformVariantId, variant.currentRevisionId);
  }

  async function getRevisionHistory(platformVariantId) {
    const variant = await requireVariant(platformVariantId);
    const history = (await plans.list())
      .filter((record) => record.kind === "PlatformVariantRevision" && record.workspaceId === ownerWorkspaceId && record.platformVariantId === variant.platformVariantId)
      .map(normalizePlatformVariantRevision)
      .sort((left, right) => right.revisionNumber - left.revisionNumber || right.createdAt.localeCompare(left.createdAt));
    const records = await reviewRecords();
    const currentStrategy = await planningRecord(variant.narrativeStrategyId, "NarrativeStrategy", normalizeNarrativeStrategy);
    return history.map((revision) => {
      const review = records
        .filter((record) => record.kind === "PlatformVariantReview" && record.platformVariantRevisionId === revision.platformVariantRevisionId)
        .map(normalizePlatformVariantReview)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] || null;
      const decision = records
        .filter((record) => record.kind === "PlatformVariantApproval" && record.platformVariantRevisionId === revision.platformVariantRevisionId)
        .map(normalizePlatformVariantApproval)
        .sort((a, b) => b.decidedAt.localeCompare(a.decidedAt))[0] || null;
      return {
        revision,
        review,
        decision,
        isCurrent: variant.currentRevisionId === revision.platformVariantRevisionId,
        planningCurrent: revision.strategyRevision === currentStrategy.strategyRevision,
        approvalValid: Boolean(decision?.decision === APPROVAL_DECISIONS.APPROVED
          && review
          && decision.platformVariantReviewId === review.platformVariantReviewId
          && reviewAllowsApproval(review)),
      };
    });
  }

  return {
    reviewRevision,
    reviewCurrentVariant,
    editCurrentVariant,
    approveRevision,
    approveCurrentVariant,
    rejectRevision,
    rejectCurrentVariant,
    restoreRevision,
    getReviewBundleForRevision,
    getReviewBundle,
    getRevisionHistory,
  };
}
