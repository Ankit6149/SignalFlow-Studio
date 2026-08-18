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
  for (const name of [
    "reviewRevision",
    "reviewCurrentVariant",
    "editCurrentVariant",
    "approveRevision",
    "approveCurrentVariant",
    "rejectRevision",
    "rejectCurrentVariant",
    "restoreRevision",
    "getReviewBundleForRevision",
    "getReviewBundle",
    "getRevisionHistory",
  ]) {
    requireMethod("reviewApplication", name, reviewApplication);
  }
  requireMethod("contentPlanningRepository", "get", contentPlanningRepository);
  for (const name of ["recordApprovedRevision", "recordRejection"]) requireMethod("styleMemoryApplication", name, styleMemoryApplication);
  const diagnostics = diagnosticsBuffer(clock);

  async function learnApproved(approval, before) {
    if (!before?.revision) return;
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

  async function learnRejected(decision, before) {
    if (!before?.revision) return;
    await safeLearn(diagnostics, "rejected_revision", () => styleMemoryApplication.recordRejection({
      approval: decision,
      revision: before.revision,
    }));
  }

  async function approveRevision(platformVariantId, platformVariantRevisionId, options = {}) {
    const before = await reviewApplication.getReviewBundleForRevision(platformVariantId, platformVariantRevisionId);
    const approval = await reviewApplication.approveRevision(platformVariantId, platformVariantRevisionId, options);
    await learnApproved(approval, before);
    return approval;
  }

  async function approveCurrentVariant(platformVariantId, note = "") {
    const before = await reviewApplication.getReviewBundle(platformVariantId);
    const approval = await reviewApplication.approveCurrentVariant(platformVariantId, note);
    await learnApproved(approval, before);
    return approval;
  }

  async function rejectRevision(platformVariantId, platformVariantRevisionId, options = {}) {
    const before = await reviewApplication.getReviewBundleForRevision(platformVariantId, platformVariantRevisionId);
    const decision = await reviewApplication.rejectRevision(platformVariantId, platformVariantRevisionId, options);
    await learnRejected(decision, before);
    return decision;
  }

  async function rejectCurrentVariant(platformVariantId, note = "") {
    const before = await reviewApplication.getReviewBundle(platformVariantId);
    const decision = await reviewApplication.rejectCurrentVariant(platformVariantId, note);
    await learnRejected(decision, before);
    return decision;
  }

  return Object.freeze({
    reviewRevision: (...args) => reviewApplication.reviewRevision(...args),
    reviewCurrentVariant: (...args) => reviewApplication.reviewCurrentVariant(...args),
    editCurrentVariant: (...args) => reviewApplication.editCurrentVariant(...args),
    approveRevision,
    approveCurrentVariant,
    rejectRevision,
    rejectCurrentVariant,
    restoreRevision: (...args) => reviewApplication.restoreRevision(...args),
    getReviewBundleForRevision: (...args) => reviewApplication.getReviewBundleForRevision(...args),
    getReviewBundle: (...args) => reviewApplication.getReviewBundle(...args),
    getRevisionHistory: (...args) => reviewApplication.getRevisionHistory(...args),
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
