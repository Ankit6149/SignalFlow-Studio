import { assertPort, createSystemClock, createSystemIdService } from "../domain/ports.mjs";
import { normalizeContentOpportunity } from "../domain/contentOpportunities.mjs";
import { normalizeContentSignal } from "../domain/contentSignals.mjs";
import { normalizeContentPiece, normalizeNarrativeStrategy, normalizePlatformVariant, VARIANT_STATUSES } from "../domain/contentPlanning.mjs";
import {
  attachPlatformVariantRevision,
  createRequestedPlatformVariantRevision,
  normalizePlatformVariantRevision,
} from "../domain/platformVariantRevisions.mjs";
import { normalizePlatformVariantReview } from "../domain/platformVariantReviews.mjs";
import { IDENTITY_RECORD_KINDS, normalizeIdentityContextSnapshot } from "../domain/identityProfiles.mjs";
import { createInferenceTask, INFERENCE_TASK_TYPES } from "../inference/inferenceTasks.mjs";

function required(value, field, maxLength = 240) {
  const normalized = String(value ?? "").replace(/\r\n?/g, "\n").trim();
  if (!normalized) throw new TypeError(`${field} is required.`);
  if (normalized.length > maxLength) throw new TypeError(`${field} exceeds ${maxLength} characters.`);
  return normalized;
}

function styleMemoryRefs(memory = []) {
  return (Array.isArray(memory) ? memory : []).slice(0, 20).map((item) => ({
    styleMemoryId: item.styleMemoryId,
    updatedAt: item.updatedAt,
  }));
}

export function createPlatformChangeRequestApplication({
  contentPlanningRepository,
  contentReviewRepository,
  contentOpportunityRepository,
  contentSignalRepository,
  identityRepository,
  styleMemoryApplication = null,
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
  if (styleMemoryApplication && typeof styleMemoryApplication.relevantMemory !== "function") {
    throw new TypeError("Platform change requests StyleMemory integration requires relevantMemory().");
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

  async function sourceForStrategy(strategy) {
    const storedOpportunity = await opportunities.get(strategy.opportunityId);
    if (!storedOpportunity) throw new Error(`ContentOpportunity ${strategy.opportunityId} does not exist.`);
    const opportunity = assertOwned(normalizeContentOpportunity(storedOpportunity));
    const signalId = opportunity.signalIds?.[0];
    if (!signalId) throw new Error("The current strategy has no canonical source Signal.");
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
    if (snapshot.platform !== revision.destination) throw new Error("Identity Context Snapshot platform does not match the current revision.");
    return snapshot;
  }

  async function latestReviewForRevision(revisionId) {
    return (await reviews.list())
      .filter((record) => record.workspaceId === ownerWorkspaceId && record.kind === "PlatformVariantReview" && record.platformVariantRevisionId === revisionId)
      .map(normalizePlatformVariantReview)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] || null;
  }

  async function contextForCurrentVariant(platformVariantId) {
    const variant = await planningRecord(platformVariantId, "PlatformVariant", normalizePlatformVariant);
    if (variant.status === VARIANT_STATUSES.OMITTED) throw new Error("An omitted destination has no draft to revise.");
    if (!variant.currentRevisionId) throw new Error("Generate a draft before requesting a change.");
    const parentRevision = await planningRecord(variant.currentRevisionId, "PlatformVariantRevision", normalizePlatformVariantRevision);
    if (parentRevision.platformVariantId !== variant.platformVariantId) throw new Error("Current revision does not belong to the target PlatformVariant.");
    const contentPiece = await planningRecord(variant.contentPieceId, "ContentPiece", normalizeContentPiece);
    const strategy = await planningRecord(variant.narrativeStrategyId, "NarrativeStrategy", normalizeNarrativeStrategy);
    if (parentRevision.contentPieceId !== contentPiece.contentPieceId
      || parentRevision.narrativeStrategyId !== strategy.narrativeStrategyId
      || parentRevision.strategyRevision !== strategy.strategyRevision) {
      throw new Error("The current revision is stale against the approved planning dependencies.");
    }
    const sourceSignal = await sourceForStrategy(strategy);
    const identityContext = await exactIdentitySnapshot(parentRevision);
    const review = await latestReviewForRevision(parentRevision.platformVariantRevisionId);
    return { variant, parentRevision, contentPiece, strategy, sourceSignal, identityContext, review };
  }

  async function requestChange(platformVariantId, instruction) {
    const changeRequest = required(instruction, "changeRequest", 2000);
    const context = await contextForCurrentVariant(platformVariantId);
    const styleMemory = styleMemoryApplication
      ? await styleMemoryApplication.relevantMemory({
        platform: context.variant.destination,
        projectId: context.strategy.projectId || null,
        limit: 8,
      })
      : [];
    const memoryRefs = styleMemoryRefs(styleMemory);
    const now = appClock.now();
    const task = createInferenceTask({
      taskId: appIds.create("task"),
      workspaceId: ownerWorkspaceId,
      taskType: INFERENCE_TASK_TYPES.PLATFORM_VARIANT_REVISION,
      dataClassification: context.sourceSignal.privacyClassification,
      inputRefs: [
        context.parentRevision.platformVariantRevisionId,
        context.variant.platformVariantId,
        context.strategy.narrativeStrategyId,
        context.sourceSignal.signalId,
        context.identityContext.identityContextSnapshotId,
        ...memoryRefs.map((ref) => ref.styleMemoryId),
      ],
      requirements: ["structured_output", "exact_revision", "bounded_change_request", "identity_context", "bounded_style_memory"],
      createdAt: now,
    });

    const result = await inference.execute({
      task,
      input: {
        parentRevision: context.parentRevision,
        variant: context.variant,
        strategy: context.strategy,
        contentPiece: context.contentPiece,
        sourceSignal: {
          signalId: context.sourceSignal.signalId,
          workspaceId: context.sourceSignal.workspaceId,
          headline: context.sourceSignal.headline,
          summary: context.sourceSignal.summary,
          boundaryNote: context.sourceSignal.boundaryNote || null,
          privacyClassification: context.sourceSignal.privacyClassification,
        },
        identityContext: context.identityContext,
        styleMemory,
        review: context.review,
        changeRequest,
        dataClassification: context.sourceSignal.privacyClassification,
      },
    });

    const history = (await plans.list())
      .filter((record) => record.kind === "PlatformVariantRevision" && record.platformVariantId === context.variant.platformVariantId)
      .map(normalizePlatformVariantRevision);
    const nextRevision = createRequestedPlatformVariantRevision({
      platformVariantRevisionId: appIds.create("variant-revision"),
      parentRevision: context.parentRevision,
      revisionNumber: Math.max(0, ...history.map((item) => item.revisionNumber)) + 1,
      output: result.output,
      changeRequest,
      styleMemoryRefs: memoryRefs,
      generationProvenance: {
        taskId: task.taskId,
        provider: result.provenance?.provider || "unknown",
        model: result.provenance?.model || "unknown",
        routeKind: result.provenance?.routeKind || "remote",
        promptVersion: result.provenance?.promptVersion || "platform_variant_revision_v1",
        generatedAt: result.provenance?.generatedAt || now,
      },
      createdAt: now,
    });
    const persisted = await plans.upsert(nextRevision);
    await plans.upsert(attachPlatformVariantRevision(context.variant, persisted, now));
    return persisted;
  }

  return { requestChange };
}
