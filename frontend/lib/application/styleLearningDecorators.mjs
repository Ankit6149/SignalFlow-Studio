import { normalizePlatformVariantRevision } from "../domain/platformVariantRevisions.mjs";

function requireMethod(owner, name, object) {
  if (!object || typeof object[name] !== "function") throw new TypeError(`${owner}.${name}() is required.`);
}

function diagnosticsBuffer(clock) {
  const entries = [];
  return {
    capture(action, error) {
      entries.unshift(Object.freeze({
        action,
        message: String(error?.message || "Style learning failed."),
        occurredAt: typeof clock?.now === "function" ? clock.now() : new Date().toISOString(),
      }));
      if (entries.length > 10) entries.length = 10;
    },
    list() { return entries.map((entry) => ({ ...entry })); },
  };
}

async function safeLearn(buffer, action, operation) {
  try {
    await operation();
  } catch (error) {
    buffer.capture(action, error);
  }
}

export function withStyleLearningReview({
  reviewApplication,
  contentPlanningRepository,
  styleMemoryApplication,
  clock = null,
} = {}) {
  for (const name of ["reviewCurrentVariant", "editCurrentVariant", "approveCurrentVariant", "rejectCurrentVariant", "getReviewBundle"]) {
    requireMethod("reviewApplication", name, reviewApplication);
  }
  requireMethod("contentPlanningRepository", "get", contentPlanningRepository);
  for (const name of ["recordApprovedRevision", "recordRejection"]) requireMethod("styleMemoryApplication", name, styleMemoryApplication);
  const diagnostics = diagnosticsBuffer(clock);

  async function approveCurrentVariant(platformVariantId, note = "") {
    const before = await reviewApplication.getReviewBundle(platformVariantId);
    const approval = await reviewApplication.approveCurrentVariant(platformVariantId, note);
    if (before.revision) {
      await safeLearn(diagnostics, "approved_revision", async () => {
        const parentRevision = before.revision.parentRevisionId
          ? await contentPlanningRepository.get(before.revision.parentRevisionId)
          : null;
        await styleMemoryApplication.recordApprovedRevision({
          approval,
          revision: before.revision,
          parentRevision,
        });
      });
    }
    return approval;
  }

  async function rejectCurrentVariant(platformVariantId, note = "") {
    const before = await reviewApplication.getReviewBundle(platformVariantId);
    const decision = await reviewApplication.rejectCurrentVariant(platformVariantId, note);
    if (before.revision) {
      await safeLearn(diagnostics, "rejected_revision", () => styleMemoryApplication.recordRejection({
        approval: decision,
        revision: before.revision,
      }));
    }
    return decision;
  }

  return Object.freeze({
    reviewCurrentVariant: (...args) => reviewApplication.reviewCurrentVariant(...args),
    editCurrentVariant: (...args) => reviewApplication.editCurrentVariant(...args),
    approveCurrentVariant,
    rejectCurrentVariant,
    getReviewBundle: (...args) => reviewApplication.getReviewBundle(...args),
    getLearningDiagnostics: () => diagnostics.list(),
  });
}

export function withStyleLearningChangeRequests({
  changeRequestApplication,
  contentPlanningRepository,
  styleMemoryApplication,
  clock = null,
} = {}) {
  requireMethod("changeRequestApplication", "requestChange", changeRequestApplication);
  requireMethod("contentPlanningRepository", "get", contentPlanningRepository);
  requireMethod("styleMemoryApplication", "recordChangeRequest", styleMemoryApplication);
  const diagnostics = diagnosticsBuffer(clock);

  async function requestChange(platformVariantId, instruction) {
    const nextRevision = normalizePlatformVariantRevision(await changeRequestApplication.requestChange(platformVariantId, instruction));
    await safeLearn(diagnostics, "changes_requested", async () => {
      const parent = nextRevision.parentRevisionId
        ? await contentPlanningRepository.get(nextRevision.parentRevisionId)
        : null;
      if (!parent) return;
      await styleMemoryApplication.recordChangeRequest({
        revision: parent,
        resultingRevisionId: nextRevision.platformVariantRevisionId,
        instruction,
        createdAt: nextRevision.createdAt,
      });
    });
    return nextRevision;
  }

  return Object.freeze({
    requestChange,
    getLearningDiagnostics: () => diagnostics.list(),
  });
}

export function withStyleLearningGeneration({
  generationApplication,
  contentPlanningRepository,
  styleMemoryApplication,
  clock = null,
} = {}) {
  for (const name of ["generateVariant", "generateReadyVariants", "regenerateVariant", "getGenerationBundle"]) {
    requireMethod("generationApplication", name, generationApplication);
  }
  requireMethod("contentPlanningRepository", "get", contentPlanningRepository);
  requireMethod("styleMemoryApplication", "recordRegeneration", styleMemoryApplication);
  const diagnostics = diagnosticsBuffer(clock);

  async function regenerateVariant(platformVariantId) {
    const variant = await contentPlanningRepository.get(platformVariantId);
    const priorRevision = variant?.currentRevisionId
      ? await contentPlanningRepository.get(variant.currentRevisionId)
      : null;
    const result = await generationApplication.regenerateVariant(platformVariantId);
    if (priorRevision) {
      await safeLearn(diagnostics, "regenerated_revision", () => styleMemoryApplication.recordRegeneration({ revision: priorRevision }));
    }
    return result;
  }

  return Object.freeze({
    generateVariant: (...args) => generationApplication.generateVariant(...args),
    generateReadyVariants: (...args) => generationApplication.generateReadyVariants(...args),
    regenerateVariant,
    getGenerationBundle: (...args) => generationApplication.getGenerationBundle(...args),
    getLearningDiagnostics: () => diagnostics.list(),
  });
}
