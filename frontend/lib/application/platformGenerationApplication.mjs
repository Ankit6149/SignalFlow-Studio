import { assertPort, createSystemClock, createSystemIdService } from "../domain/ports.mjs";
import { stableStringify } from "../domain/contracts.mjs";
import { normalizeContentOpportunity } from "../domain/contentOpportunities.mjs";
import { normalizeContentSignal } from "../domain/contentSignals.mjs";
import {
  normalizeContentPiece,
  normalizeNarrativeStrategy,
  normalizePlatformVariant,
  STRATEGY_STATUSES,
  VARIANT_STATUSES,
} from "../domain/contentPlanning.mjs";
import {
  attachPlatformVariantRevision,
  createPlatformVariantRevision,
  markPlatformVariantGenerationFailed,
  normalizePlatformVariantRevision,
} from "../domain/platformVariantRevisions.mjs";
import { createInferenceTask, INFERENCE_TASK_TYPES } from "../inference/inferenceTasks.mjs";

function required(value, field) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new TypeError(`${field} is required.`);
  return normalized;
}

function profileRef(record) {
  if (!record) return null;
  const idEntry = Object.entries(record).find(([key, value]) => key.endsWith("ProfileId") && value);
  return idEntry ? { id: idEntry[1], version: Number(record.version || 0) } : null;
}

function activeIdentityRefs(bundle = {}) {
  return Object.fromEntries(
    Object.entries(bundle)
      .map(([key, record]) => [key, profileRef(record)])
      .filter(([, value]) => value),
  );
}

function styleMemoryRefs(memory = []) {
  return (Array.isArray(memory) ? memory : []).slice(0, 20).map((item) => ({
    styleMemoryId: item.styleMemoryId,
    updatedAt: item.updatedAt,
  }));
}

function compactFingerprint(value) {
  const source = stableStringify(value);
  let left = 0x811c9dc5;
  let right = 0x9e3779b9;
  for (let index = 0; index < source.length; index += 1) {
    const code = source.charCodeAt(index);
    left ^= code;
    left = Math.imul(left, 0x01000193) >>> 0;
    right ^= code + index;
    right = Math.imul(right, 0x85ebca6b) >>> 0;
  }
  return `sf-cache-v1-${left.toString(16).padStart(8, "0")}${right.toString(16).padStart(8, "0")}-${source.length}`;
}

function generationFingerprint({ strategy, contentPiece, variant, sourceSignal, identityBundle, styleMemory = [] }) {
  return compactFingerprint({
    narrativeStrategyId: strategy.narrativeStrategyId,
    strategyRevision: strategy.strategyRevision,
    strategyUpdatedAt: strategy.updatedAt,
    contentPieceId: contentPiece.contentPieceId,
    canonicalIntent: contentPiece.canonicalIntent,
    claims: contentPiece.claims,
    evidenceRefs: contentPiece.evidenceRefs,
    platformVariantId: variant.platformVariantId,
    destination: variant.destination,
    adaptationIntent: variant.adaptationIntent,
    sourceSignal: {
      signalId: sourceSignal.signalId,
      updatedAt: sourceSignal.updatedAt,
      headline: sourceSignal.headline,
      summary: sourceSignal.summary,
      boundaryNote: sourceSignal.boundaryNote,
      privacyClassification: sourceSignal.privacyClassification,
    },
    identityProfileRefs: activeIdentityRefs(identityBundle),
    styleMemoryRefs: styleMemoryRefs(styleMemory),
  });
}

function minimizedSignal(signal) {
  return {
    signalId: signal.signalId,
    workspaceId: signal.workspaceId,
    signalKind: signal.signalKind,
    headline: signal.headline,
    summary: signal.summary,
    boundaryNote: signal.boundaryNote || null,
    privacyClassification: signal.privacyClassification,
  };
}

export function createPlatformGenerationApplication({
  contentPlanningRepository,
  contentOpportunityRepository,
  contentSignalRepository,
  identityApplication,
  styleMemoryApplication = null,
  inferenceAdapter,
  workspaceId = "local-personal",
  clock = createSystemClock(),
  idService = createSystemIdService("signalflow"),
} = {}) {
  const plans = assertPort("contentPlanningRepository", contentPlanningRepository);
  const opportunities = assertPort("contentOpportunityRepository", contentOpportunityRepository);
  const signals = assertPort("contentSignalRepository", contentSignalRepository);
  const inference = assertPort("inferenceAdapter", inferenceAdapter);
  const appClock = assertPort("clock", clock);
  const appIds = assertPort("idService", idService);
  const ownerWorkspaceId = required(workspaceId, "workspaceId");
  if (!identityApplication || typeof identityApplication.getActiveBundle !== "function" || typeof identityApplication.createIdentityContextSnapshot !== "function") {
    throw new TypeError("Platform generation requires the Identity application service.");
  }
  if (styleMemoryApplication && typeof styleMemoryApplication.relevantMemory !== "function") {
    throw new TypeError("Platform generation StyleMemory integration requires relevantMemory().");
  }

  function assertOwned(record) {
    if (record.workspaceId !== ownerWorkspaceId) throw new Error(`${record.kind} belongs to another workspace.`);
    return record;
  }

  async function requireRecord(recordId, kind, normalize) {
    const stored = await plans.get(required(recordId, `${kind}Id`));
    if (!stored || stored.kind !== kind) throw new Error(`${kind} ${recordId} does not exist.`);
    return assertOwned(normalize(stored));
  }

  async function requireVariant(platformVariantId) {
    return requireRecord(platformVariantId, "PlatformVariant", normalizePlatformVariant);
  }

  async function requirePiece(contentPieceId) {
    return requireRecord(contentPieceId, "ContentPiece", normalizeContentPiece);
  }

  async function requireStrategy(narrativeStrategyId) {
    return requireRecord(narrativeStrategyId, "NarrativeStrategy", normalizeNarrativeStrategy);
  }

  async function sourceForStrategy(strategy) {
    const storedOpportunity = await opportunities.get(strategy.opportunityId);
    if (!storedOpportunity) throw new Error(`ContentOpportunity ${strategy.opportunityId} does not exist.`);
    const opportunity = assertOwned(normalizeContentOpportunity(storedOpportunity));
    const signalId = opportunity.signalIds?.[0];
    if (!signalId) throw new Error("The approved strategy has no canonical source Signal.");
    const storedSignal = await signals.get(signalId);
    if (!storedSignal) throw new Error(`ContentSignal ${signalId} does not exist.`);
    return assertOwned(normalizeContentSignal(storedSignal));
  }

  async function revisionsForVariant(platformVariantId) {
    return (await plans.list())
      .filter((record) => record.kind === "PlatformVariantRevision" && record.platformVariantId === platformVariantId && record.workspaceId === ownerWorkspaceId)
      .map(normalizePlatformVariantRevision)
      .sort((a, b) => b.revisionNumber - a.revisionNumber);
  }

  async function currentRevisionForVariant(variant) {
    if (!variant.currentRevisionId) return null;
    const stored = await plans.get(variant.currentRevisionId);
    if (!stored || stored.kind !== "PlatformVariantRevision") return null;
    return assertOwned(normalizePlatformVariantRevision(stored));
  }

  async function generateVariant(platformVariantId, { refresh = false } = {}) {
    const variant = await requireVariant(platformVariantId);
    if (variant.status === VARIANT_STATUSES.OMITTED) {
      const error = new Error(`${variant.destination === "x" ? "X" : "LinkedIn"} is explicitly omitted by the approved campaign plan.`);
      error.code = "platform_variant_omitted";
      throw error;
    }
    if (!["linkedin", "x"].includes(variant.destination)) throw new Error("Golden Path generation only supports LinkedIn and X.");

    const contentPiece = await requirePiece(variant.contentPieceId);
    const strategy = await requireStrategy(variant.narrativeStrategyId);
    if (strategy.status !== STRATEGY_STATUSES.APPROVED) {
      const error = new Error("Approve the current NarrativeStrategy before generating platform drafts.");
      error.code = "strategy_approval_required";
      throw error;
    }
    if (contentPiece.narrativeStrategyId !== strategy.narrativeStrategyId || variant.narrativeStrategyId !== strategy.narrativeStrategyId) {
      throw new Error("Platform generation dependencies do not point to the same NarrativeStrategy.");
    }

    const sourceSignal = await sourceForStrategy(strategy);
    const identityBundle = await identityApplication.getActiveBundle({ platform: variant.destination, projectId: strategy.projectId || null });
    if (!identityBundle.identity || !identityBundle.voice || !identityBundle.boundary || !identityBundle.platformExpression) {
      const error = new Error(`Set up Voice including ${variant.destination === "x" ? "X" : "LinkedIn"} expression before generating this draft.`);
      error.code = "voice_profile_required";
      throw error;
    }
    const styleMemory = styleMemoryApplication
      ? await styleMemoryApplication.relevantMemory({ platform: variant.destination, projectId: strategy.projectId || null, limit: 8 })
      : [];

    const inputFingerprint = generationFingerprint({ strategy, contentPiece, variant, sourceSignal, identityBundle, styleMemory });
    const current = await currentRevisionForVariant(variant);
    if (!refresh && current?.inputFingerprint === inputFingerprint && current.strategyRevision === strategy.strategyRevision) return current;

    const now = appClock.now();
    const identityContext = await identityApplication.createIdentityContextSnapshot({
      platform: variant.destination,
      projectId: strategy.projectId || null,
      campaignInstructions: [
        `Preserve this approved core idea: ${strategy.coreIdea}`,
        `The intended audience takeaway is: ${strategy.audienceTakeaway}`,
        variant.adaptationIntent ? `Destination adaptation: ${variant.adaptationIntent}` : "",
      ].filter(Boolean),
    });
    const memoryRefs = styleMemoryRefs(styleMemory);

    const task = createInferenceTask({
      taskId: appIds.create("task"),
      workspaceId: ownerWorkspaceId,
      taskType: INFERENCE_TASK_TYPES.PLATFORM_VARIANT,
      dataClassification: sourceSignal.privacyClassification,
      inputRefs: [
        strategy.narrativeStrategyId,
        contentPiece.contentPieceId,
        variant.platformVariantId,
        sourceSignal.signalId,
        identityContext.identityContextSnapshotId,
        ...memoryRefs.map((ref) => ref.styleMemoryId),
      ],
      requirements: ["structured_output", "destination_native_copy", "identity_context", "exact_strategy_revision", "bounded_style_memory"],
      createdAt: now,
    });

    await plans.upsert(normalizePlatformVariant({ ...variant, status: VARIANT_STATUSES.GENERATING, updatedAt: now }));
    try {
      const result = await inference.execute({
        task,
        input: {
          strategy,
          contentPiece,
          variant,
          sourceSignal: minimizedSignal(sourceSignal),
          identityContext,
          styleMemory,
          dataClassification: sourceSignal.privacyClassification,
        },
      });
      const history = await revisionsForVariant(variant.platformVariantId);
      const revision = createPlatformVariantRevision({
        platformVariantRevisionId: appIds.create("variant-revision"),
        workspaceId: ownerWorkspaceId,
        platformVariantId: variant.platformVariantId,
        contentPieceId: contentPiece.contentPieceId,
        narrativeStrategyId: strategy.narrativeStrategyId,
        destination: variant.destination,
        revisionNumber: (history[0]?.revisionNumber || 0) + 1,
        strategyRevision: strategy.strategyRevision,
        output: result.output,
        inputFingerprint,
        identityContextSnapshotId: identityContext.identityContextSnapshotId,
        styleMemoryRefs: memoryRefs,
        generationProvenance: {
          taskId: task.taskId,
          provider: result.provenance?.provider || "unknown",
          model: result.provenance?.model || "unknown",
          routeKind: result.provenance?.routeKind || "remote",
          promptVersion: "platform_variant_v1",
          generatedAt: result.provenance?.generatedAt || result.provenance?.evaluatedAt || now,
        },
        createdAt: now,
      });
      const persistedRevision = await plans.upsert(revision);
      await plans.upsert(attachPlatformVariantRevision(variant, persistedRevision, now));
      return persistedRevision;
    } catch (error) {
      await plans.upsert(markPlatformVariantGenerationFailed(variant, appClock.now()));
      throw error;
    }
  }

  async function generateReadyVariants(contentPieceId) {
    const piece = await requirePiece(contentPieceId);
    const all = await plans.list();
    const variants = all
      .filter((record) => record.kind === "PlatformVariant" && record.contentPieceId === piece.contentPieceId && record.workspaceId === ownerWorkspaceId)
      .map(normalizePlatformVariant)
      .filter((variant) => variant.status !== VARIANT_STATUSES.OMITTED && !variant.currentRevisionId);
    const generated = [];
    const failed = [];
    for (const variant of variants) {
      try {
        generated.push(await generateVariant(variant.platformVariantId));
      } catch (error) {
        failed.push({ platformVariantId: variant.platformVariantId, destination: variant.destination, code: error?.code || "platform_generation_failed", message: error?.message || "Platform generation failed." });
      }
    }
    return { generated, failed, bundle: await getGenerationBundle(piece.contentPieceId) };
  }

  async function regenerateVariant(platformVariantId) {
    return generateVariant(platformVariantId, { refresh: true });
  }

  async function getGenerationBundle(contentPieceId) {
    const piece = await requirePiece(contentPieceId);
    const all = await plans.list();
    const variants = all
      .filter((record) => record.kind === "PlatformVariant" && record.contentPieceId === piece.contentPieceId && record.workspaceId === ownerWorkspaceId)
      .map(normalizePlatformVariant);
    const revisions = all
      .filter((record) => record.kind === "PlatformVariantRevision" && record.contentPieceId === piece.contentPieceId && record.workspaceId === ownerWorkspaceId)
      .map(normalizePlatformVariantRevision);
    return {
      contentPiece: piece,
      variants: variants.map((variant) => ({
        variant,
        currentRevision: variant.currentRevisionId ? revisions.find((revision) => revision.platformVariantRevisionId === variant.currentRevisionId) || null : null,
        history: revisions.filter((revision) => revision.platformVariantId === variant.platformVariantId).sort((a, b) => b.revisionNumber - a.revisionNumber),
      })),
    };
  }

  return {
    generateVariant,
    generateReadyVariants,
    regenerateVariant,
    getGenerationBundle,
  };
}
