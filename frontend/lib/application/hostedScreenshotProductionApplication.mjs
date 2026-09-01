import { assertPort } from "../domain/ports.mjs";
import {
  CAPTURE_JOB_STATUSES,
  CAPTURE_RECIPE_STATUSES,
  createCaptureJob,
  normalizeCaptureJob,
  normalizeCaptureRecipe,
} from "../domain/captureRecipes.mjs";
import { JOB_STATUSES, JOB_TYPES, enqueueDurableJob, normalizeDurableJob } from "../domain/durableJobs.mjs";
import { normalizeNarrativeStrategy, normalizePlatformVariant } from "../domain/contentPlanning.mjs";
import { normalizePlatformVariantRevision } from "../domain/platformVariantRevisions.mjs";
import {
  DERIVATIVE_VARIANT_STATES,
  SCREENSHOT_ASPECT_TARGETS,
  SCREENSHOT_QUALITY_STATES,
  normalizeImageDerivativePlan,
  normalizeScreenshotQualityReview,
} from "../domain/screenshotProduction.mjs";

const ASPECT_RATIOS = new Set(Object.keys(SCREENSHOT_ASPECT_TARGETS));

function required(value, field, maxLength = 320) {
  const normalized = String(value || "").trim();
  if (!normalized || normalized.length > maxLength || /[/\\]|^[a-zA-Z]:/.test(normalized)) {
    const error = new Error(`${field} must be an opaque identifier.`);
    error.code = "hosted_screenshot_invalid_request";
    error.status = 400;
    throw error;
  }
  return normalized;
}

function exactPositiveInteger(value, field, requiredValue = false) {
  if ((value === null || value === undefined || value === "") && !requiredValue) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    const error = new Error(`${field} must be a positive integer.`);
    error.code = "hosted_screenshot_invalid_request";
    error.status = 400;
    throw error;
  }
  return parsed;
}

function aspectRatio(value) {
  const normalized = String(value || "").trim();
  if (!ASPECT_RATIOS.has(normalized)) {
    const error = new Error(`Unsupported screenshot aspect ratio: ${normalized || "missing"}.`);
    error.code = "hosted_screenshot_aspect_ratio_invalid";
    error.status = 400;
    throw error;
  }
  return normalized;
}

function compactFingerprint(value) {
  const source = JSON.stringify(value);
  let left = 0x811c9dc5;
  let right = 0x9e3779b9;
  for (let index = 0; index < source.length; index += 1) {
    const code = source.charCodeAt(index);
    left ^= code;
    left = Math.imul(left, 0x01000193) >>> 0;
    right ^= code + index;
    right = Math.imul(right, 0x85ebca6b) >>> 0;
  }
  return `${left.toString(16).padStart(8, "0")}${right.toString(16).padStart(8, "0")}${source.length.toString(16)}`;
}

function terminalCaptureSucceeded(job) {
  return job?.status === JOB_STATUSES.SUCCEEDED || job?.status === JOB_STATUSES.PARTIALLY_SUCCEEDED;
}

function sortNewest(items) {
  return [...items].sort((left, right) => String(right.updatedAt || right.createdAt || "").localeCompare(String(left.updatedAt || left.createdAt || "")));
}

export function createHostedScreenshotProductionApplication({
  workspaceId,
  userId = "owner",
  contentPlanningRepository,
  durableJobRepository,
  captureRepository,
  mediaIntelligenceRepository,
  privateAssetStorage,
  exactCaptureExecutionApplication,
  screenshotDerivativeApplication,
  platformMediaBindingApplication,
  clock,
} = {}) {
  const ownerWorkspaceId = required(workspaceId, "workspaceId");
  const ownerUserId = required(userId, "userId");
  const plans = assertPort("contentPlanningRepository", contentPlanningRepository);
  const jobs = assertPort("durableJobRepository", durableJobRepository);
  const captures = assertPort("captureRepository", captureRepository);
  const media = assertPort("mediaIntelligenceRepository", mediaIntelligenceRepository);
  const time = assertPort("clock", clock);
  if (!privateAssetStorage || typeof privateAssetStorage.readAsset !== "function") throw new TypeError("Hosted screenshot production requires privateAssetStorage.readAsset().");
  if (!exactCaptureExecutionApplication || typeof exactCaptureExecutionApplication.runJob !== "function") throw new TypeError("Hosted screenshot production requires exactCaptureExecutionApplication.runJob().");
  if (!screenshotDerivativeApplication || typeof screenshotDerivativeApplication.inspectAndPlan !== "function" || typeof screenshotDerivativeApplication.renderPlan !== "function") {
    throw new TypeError("Hosted screenshot production requires screenshot derivative application methods.");
  }
  if (!platformMediaBindingApplication || typeof platformMediaBindingApplication.bindRenderedScreenshot !== "function") {
    throw new TypeError("Hosted screenshot production requires platform media binding application.");
  }

  function assertOwned(record, label) {
    if (!record || record.workspaceId !== ownerWorkspaceId) {
      const error = new Error(`${label} belongs to another workspace or does not exist.`);
      error.code = "cross_workspace_screenshot";
      error.status = 403;
      throw error;
    }
    return record;
  }

  async function currentContext(platformVariantIdInput, expectedCurrentRevisionIdInput) {
    const platformVariantId = required(platformVariantIdInput, "platformVariantId");
    const expectedCurrentRevisionId = required(expectedCurrentRevisionIdInput, "expectedCurrentRevisionId");
    const storedVariant = await plans.get(platformVariantId);
    if (!storedVariant || storedVariant.kind !== "PlatformVariant") {
      const error = new Error("PlatformVariant does not exist.");
      error.code = "platform_variant_not_found";
      error.status = 404;
      throw error;
    }
    const variant = assertOwned(normalizePlatformVariant(storedVariant), "PlatformVariant");
    if (variant.currentRevisionId !== expectedCurrentRevisionId) {
      const error = new Error("The platform review surface is stale because a newer current revision exists.");
      error.code = "stale_revision_context";
      error.status = 409;
      throw error;
    }
    const storedRevision = await plans.get(expectedCurrentRevisionId);
    if (!storedRevision || storedRevision.kind !== "PlatformVariantRevision") {
      const error = new Error("Current PlatformVariantRevision does not exist.");
      error.code = "platform_variant_revision_not_found";
      error.status = 404;
      throw error;
    }
    const revision = assertOwned(normalizePlatformVariantRevision(storedRevision), "PlatformVariantRevision");
    if (revision.platformVariantId !== variant.platformVariantId) {
      const error = new Error("Current revision does not belong to the requested PlatformVariant.");
      error.code = "stale_revision_context";
      error.status = 409;
      throw error;
    }
    const storedStrategy = await plans.get(variant.narrativeStrategyId);
    if (!storedStrategy || storedStrategy.kind !== "NarrativeStrategy") {
      const error = new Error("NarrativeStrategy does not exist for this PlatformVariant.");
      error.code = "narrative_strategy_not_found";
      error.status = 409;
      throw error;
    }
    const strategy = assertOwned(normalizeNarrativeStrategy(storedStrategy), "NarrativeStrategy");
    if (revision.strategyRevision !== strategy.strategyRevision) {
      const error = new Error("Current revision belongs to an older planning contract.");
      error.code = "stale_planning_contract";
      error.status = 409;
      throw error;
    }
    if (!strategy.projectId) {
      const error = new Error("Hosted screenshot production requires the canonical story to be associated with a project.");
      error.code = "capture_project_context_required";
      error.status = 409;
      throw error;
    }
    return { platformVariantId, expectedCurrentRevisionId, variant, revision, strategy };
  }

  async function resolveRecipe(strategy, { captureRecipeId = null, captureRecipeVersion = null, checkpoint = null } = {}) {
    let recipe = null;
    if (captureRecipeId) {
      recipe = await captures.getRecipe(required(captureRecipeId, "captureRecipeId"), exactPositiveInteger(captureRecipeVersion, "captureRecipeVersion"));
      if (!recipe) {
        const error = new Error("Requested CaptureRecipe does not exist.");
        error.code = "capture_recipe_not_found";
        error.status = 404;
        throw error;
      }
      recipe = assertOwned(normalizeCaptureRecipe(recipe), "CaptureRecipe");
    } else {
      const available = (await captures.listRecipes({ projectId: strategy.projectId }))
        .map(normalizeCaptureRecipe)
        .filter((item) => item.workspaceId === ownerWorkspaceId && item.projectId === strategy.projectId && item.status === CAPTURE_RECIPE_STATUSES.ACTIVE);
      const latestByIdentity = new Map();
      for (const candidate of sortNewest(available)) {
        if (!latestByIdentity.has(candidate.captureRecipeId)) latestByIdentity.set(candidate.captureRecipeId, candidate);
      }
      const candidates = [...latestByIdentity.values()].filter((candidate) => !checkpoint || candidate.expectedCheckpoints.includes(checkpoint));
      if (candidates.length !== 1) {
        const error = new Error(candidates.length ? "More than one active CaptureRecipe can serve this project; configure one canonical recipe." : "No active CaptureRecipe is configured for this project.");
        error.code = candidates.length ? "capture_recipe_ambiguous" : "capture_recipe_not_configured";
        error.status = 409;
        throw error;
      }
      [recipe] = candidates;
    }

    if (recipe.status !== CAPTURE_RECIPE_STATUSES.ACTIVE) {
      const error = new Error("Hosted screenshot production requires an active CaptureRecipe.");
      error.code = "capture_recipe_not_active";
      error.status = 409;
      throw error;
    }
    if (recipe.projectId !== strategy.projectId) {
      const error = new Error("CaptureRecipe project does not match the exact story project.");
      error.code = "capture_recipe_project_mismatch";
      error.status = 409;
      throw error;
    }
    const requestedCheckpoint = checkpoint ? String(checkpoint).trim() : (recipe.expectedCheckpoints.length === 1 ? recipe.expectedCheckpoints[0] : "");
    if (!requestedCheckpoint || !recipe.expectedCheckpoints.includes(requestedCheckpoint)) {
      const error = new Error("CaptureRecipe must resolve one exact declared checkpoint for hosted screenshot production.");
      error.code = "capture_checkpoint_ambiguous";
      error.status = 409;
      throw error;
    }
    return { recipe, requestedCheckpoint };
  }

  function captureIdentity({ revision, recipe, requestedCheckpoint }) {
    const fingerprint = compactFingerprint({
      workspaceId: ownerWorkspaceId,
      platformVariantRevisionId: revision.platformVariantRevisionId,
      captureRecipeId: recipe.captureRecipeId,
      captureRecipeVersion: recipe.version,
      requestedCheckpoint,
    });
    return {
      fingerprint,
      jobId: `gp2-capture-${fingerprint}`,
      captureJobId: `gp2-capture-job-${fingerprint}`,
      idempotencyKey: `gp2-capture-idem-${fingerprint}`,
    };
  }

  async function ensureCaptureJob(context, recipe, requestedCheckpoint) {
    const identity = captureIdentity({ revision: context.revision, recipe, requestedCheckpoint });
    const existing = await jobs.findByIdempotency(ownerWorkspaceId, JOB_TYPES.CAPTURE_SCREENSHOT, identity.idempotencyKey);
    if (existing) {
      const durableJob = normalizeDurableJob(existing);
      if (durableJob.jobId !== identity.jobId || durableJob.resourceId !== identity.captureJobId || durableJob.inputRef !== recipe.captureRecipeId || durableJob.inputVersion !== recipe.version || durableJob.correlationId !== context.revision.platformVariantRevisionId) {
        const error = new Error("Existing screenshot job does not match the exact requested revision/recipe contract.");
        error.code = "capture_job_idempotency_conflict";
        error.status = 409;
        throw error;
      }
      const captureJob = await captures.getJob(identity.captureJobId);
      if (!captureJob) {
        const error = new Error("Durable screenshot job exists without its canonical CaptureJob.");
        error.code = "capture_job_missing";
        error.status = 409;
        throw error;
      }
      return { durableJob, captureJob: normalizeCaptureJob(captureJob), identity, deduplicated: true };
    }

    const pair = createCaptureJob({
      captureJobId: identity.captureJobId,
      jobId: identity.jobId,
      recipe,
      captureKind: "screenshot",
      requestedCheckpoint,
      createdAt: time.now(),
      idempotencyKey: identity.idempotencyKey,
      actorRef: ownerUserId,
      correlationId: context.revision.platformVariantRevisionId,
    });
    const captureJob = await captures.upsertJob(pair.captureJob);
    const queued = await enqueueDurableJob(jobs, pair.durableJob);
    return { durableJob: queued.job, captureJob, identity, deduplicated: queued.deduplicated };
  }

  async function resolveCapturedAsset(captureJobInput, durableJobInput, requestedCheckpoint) {
    const captureJob = normalizeCaptureJob(captureJobInput);
    const durableJob = normalizeDurableJob(durableJobInput);
    if (!terminalCaptureSucceeded(durableJob) || captureJob.status !== CAPTURE_JOB_STATUSES.SUCCEEDED) return null;
    const output = (captureJob.outputProvenance || []).find((item) => item.checkpoint === requestedCheckpoint);
    if (!output?.assetId || !output?.assetVersionId) {
      const error = new Error("Succeeded screenshot job has no exact output provenance for the requested checkpoint.");
      error.code = "capture_output_missing";
      error.status = 409;
      throw error;
    }
    const stored = await privateAssetStorage.readAsset({ workspaceId: ownerWorkspaceId, assetId: output.assetId });
    if (stored.asset.assetVersionId !== output.assetVersionId) {
      const error = new Error("Captured screenshot AssetVersion no longer matches CaptureJob provenance.");
      error.code = "stale_capture_asset";
      error.status = 409;
      throw error;
    }
    return { asset: stored.asset, provenance: output };
  }

  async function existingPlanFor(sourceAsset, targetAspectRatio) {
    const records = await media.list();
    const plansForSource = sortNewest(records
      .filter((record) => record.kind === "ImageDerivativePlan")
      .map(normalizeImageDerivativePlan)
      .filter((plan) => plan.workspaceId === ownerWorkspaceId && plan.sourceAssetId === sourceAsset.assetId && plan.sourceAssetVersionId === sourceAsset.assetVersionId)
      .filter((plan) => plan.variants.length === 1 && plan.variants[0].aspectRatio === targetAspectRatio));
    for (const plan of plansForSource) {
      const qualityRecord = await media.get(plan.screenshotQualityReviewId);
      if (!qualityRecord || qualityRecord.kind !== "ScreenshotQualityReview") continue;
      const qualityReview = normalizeScreenshotQualityReview(qualityRecord);
      if (qualityReview.assetId === sourceAsset.assetId && qualityReview.assetVersionId === sourceAsset.assetVersionId) {
        return { plan, qualityReview };
      }
    }
    return null;
  }

  async function produceScreenshot({
    platformVariantId,
    expectedCurrentRevisionId,
    aspectRatio: requestedAspectRatio,
    role = "primary_visual",
    captureRecipeId = null,
    captureRecipeVersion = null,
    checkpoint = null,
  } = {}) {
    const context = await currentContext(platformVariantId, expectedCurrentRevisionId);
    const targetAspectRatio = aspectRatio(requestedAspectRatio);
    const { recipe, requestedCheckpoint } = await resolveRecipe(context.strategy, { captureRecipeId, captureRecipeVersion, checkpoint });
    const capture = await ensureCaptureJob(context, recipe, requestedCheckpoint);

    let durableJob = capture.durableJob;
    let captureJob = capture.captureJob;
    if (!terminalCaptureSucceeded(durableJob)) {
      const execution = await exactCaptureExecutionApplication.runJob(durableJob.jobId);
      durableJob = execution.durableJob || await jobs.get(durableJob.jobId);
      captureJob = execution.captureJob || await captures.getJob(captureJob.captureJobId);
    }

    if (!terminalCaptureSucceeded(durableJob)) {
      return Object.freeze({
        status: durableJob?.status === JOB_STATUSES.RETRYING ? "capture_retrying" : "capture_pending",
        platformVariantId: context.platformVariantId,
        platformVariantRevisionId: context.revision.platformVariantRevisionId,
        captureJob,
        durableJob,
      });
    }

    const captured = await resolveCapturedAsset(captureJob, durableJob, requestedCheckpoint);
    if (!captured) {
      const error = new Error("Screenshot capture completed without an exact usable Asset.");
      error.code = "capture_output_missing";
      error.status = 409;
      throw error;
    }

    let production = await existingPlanFor(captured.asset, targetAspectRatio);
    if (!production) {
      production = await screenshotDerivativeApplication.inspectAndPlan({
        workspaceId: ownerWorkspaceId,
        sourceAssetId: captured.asset.assetId,
        aspectRatios: [targetAspectRatio],
        captureJob,
      });
    }

    if (production.qualityReview.status !== SCREENSHOT_QUALITY_STATES.READY) {
      return Object.freeze({
        status: production.qualityReview.status === SCREENSHOT_QUALITY_STATES.BLOCKED ? "quality_blocked" : "quality_needs_review",
        platformVariantId: context.platformVariantId,
        platformVariantRevisionId: context.revision.platformVariantRevisionId,
        captureJob,
        durableJob,
        sourceAsset: captured.asset,
        qualityReview: production.qualityReview,
        derivativePlan: production.plan,
      });
    }

    const rendered = await screenshotDerivativeApplication.renderPlan({
      workspaceId: ownerWorkspaceId,
      imageDerivativePlanId: production.plan.imageDerivativePlanId,
    });
    const derivative = rendered.plan.variants.find((item) => item.aspectRatio === targetAspectRatio);
    if (!derivative || derivative.status !== DERIVATIVE_VARIANT_STATES.RENDERED) {
      return Object.freeze({
        status: derivative?.status === DERIVATIVE_VARIANT_STATES.BLOCKED ? "derivative_blocked" : "derivative_needs_review",
        platformVariantId: context.platformVariantId,
        platformVariantRevisionId: context.revision.platformVariantRevisionId,
        captureJob,
        durableJob,
        sourceAsset: captured.asset,
        qualityReview: rendered.qualityReview,
        derivativePlan: rendered.plan,
      });
    }

    const boundRevision = await platformMediaBindingApplication.bindRenderedScreenshot(context.platformVariantId, {
      imageDerivativePlanId: rendered.plan.imageDerivativePlanId,
      imageDerivativeVariantId: derivative.variantId,
      expectedCurrentRevisionId: context.expectedCurrentRevisionId,
      role,
      reason: `Bind automatic hosted screenshot derivative ${targetAspectRatio} from ${recipe.captureRecipeId}@${recipe.version}:${requestedCheckpoint}.`,
    });

    return Object.freeze({
      status: "bound",
      platformVariantId: context.platformVariantId,
      sourceRevisionId: context.revision.platformVariantRevisionId,
      boundRevision,
      captureRecipeId: recipe.captureRecipeId,
      captureRecipeVersion: recipe.version,
      checkpoint: requestedCheckpoint,
      captureJob,
      durableJob,
      sourceAsset: captured.asset,
      qualityReview: rendered.qualityReview,
      derivativePlan: rendered.plan,
      derivative: rendered.plan.variants.find((item) => item.variantId === derivative.variantId),
    });
  }

  return Object.freeze({ produceScreenshot });
}
