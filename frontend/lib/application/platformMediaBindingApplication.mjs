import { assertPort, createSystemClock, createSystemIdService } from "../domain/ports.mjs";
import { normalizePlatformVariant } from "../domain/contentPlanning.mjs";
import {
  PLATFORM_VARIANT_MEDIA_SOURCES,
  attachPlatformVariantRevision,
  createMediaReboundPlatformVariantRevision,
  normalizePlatformVariantMediaBindings,
  normalizePlatformVariantRevision,
} from "../domain/platformVariantRevisions.mjs";
import { normalizeAsset } from "../domain/sourceArtifacts.mjs";
import {
  DERIVATIVE_VARIANT_STATES,
  SCREENSHOT_QUALITY_STATES,
  normalizeImageDerivativePlan,
  normalizeScreenshotQualityReview,
} from "../domain/screenshotProduction.mjs";

export class PlatformMediaBindingError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "PlatformMediaBindingError";
    this.code = code;
    this.details = { ...details };
  }
}

function required(value, field) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new TypeError(`${field} is required.`);
  return normalized;
}

function sameBindings(left = [], right = []) {
  return JSON.stringify(normalizePlatformVariantMediaBindings(left)) === JSON.stringify(normalizePlatformVariantMediaBindings(right));
}

export function createPlatformMediaBindingApplication({
  contentPlanningRepository,
  assetRepository,
  mediaIntelligenceRepository = null,
  workspaceId = "local-personal",
  userId = "owner",
  clock = createSystemClock(),
  idService = createSystemIdService("signalflow"),
} = {}) {
  const plans = assertPort("contentPlanningRepository", contentPlanningRepository);
  const assets = assertPort("assetRepository", assetRepository);
  const media = mediaIntelligenceRepository ? assertPort("mediaIntelligenceRepository", mediaIntelligenceRepository) : null;
  const appClock = assertPort("clock", clock);
  const appIds = assertPort("idService", idService);
  const ownerWorkspaceId = required(workspaceId, "workspaceId");
  const ownerUserId = required(userId, "userId");

  async function requireVariant(platformVariantId) {
    const stored = await plans.get(required(platformVariantId, "platformVariantId"));
    if (!stored || stored.kind !== "PlatformVariant") throw new PlatformMediaBindingError("platform_variant_not_found", "PlatformVariant was not found.");
    const variant = normalizePlatformVariant(stored);
    if (variant.workspaceId !== ownerWorkspaceId) throw new PlatformMediaBindingError("cross_workspace_media_binding", "PlatformVariant belongs to another workspace.");
    return variant;
  }

  async function requireRevision(platformVariantRevisionId) {
    const stored = await plans.get(required(platformVariantRevisionId, "platformVariantRevisionId"));
    if (!stored || stored.kind !== "PlatformVariantRevision") throw new PlatformMediaBindingError("platform_variant_revision_not_found", "PlatformVariantRevision was not found.");
    const revision = normalizePlatformVariantRevision(stored);
    if (revision.workspaceId !== ownerWorkspaceId) throw new PlatformMediaBindingError("cross_workspace_media_binding", "PlatformVariantRevision belongs to another workspace.");
    return revision;
  }

  function assertExpectedCurrent(variant, expectedCurrentRevisionId) {
    const expected = required(expectedCurrentRevisionId, "expectedCurrentRevisionId");
    if (variant.currentRevisionId !== expected) {
      throw new PlatformMediaBindingError(
        "stale_revision_context",
        "The visible review is stale because a newer current revision exists. Reload before changing media.",
      );
    }
  }

  async function requireExactAsset(binding) {
    const stored = await assets.get(binding.assetId);
    if (!stored || stored.kind !== "Asset") throw new PlatformMediaBindingError("media_asset_not_found", "The selected media Asset does not exist.", { assetId: binding.assetId });
    const asset = normalizeAsset(stored, {
      workspaceId: stored.workspaceId || ownerWorkspaceId,
      projectId: stored.projectId || null,
      campaignId: stored.campaignId || null,
      now: stored.updatedAt || stored.createdAt,
    });
    if (asset.workspaceId !== ownerWorkspaceId) throw new PlatformMediaBindingError("cross_workspace_media_binding", "Media Asset belongs to another workspace.");
    if (asset.assetVersionId !== binding.assetVersionId) {
      throw new PlatformMediaBindingError("stale_media_asset", "Media binding must reference the exact current immutable Asset version.", {
        assetId: asset.assetId,
        expectedAssetVersionId: asset.assetVersionId,
        requestedAssetVersionId: binding.assetVersionId,
      });
    }
    if (asset.assetType !== "image") throw new PlatformMediaBindingError("unsupported_review_media", "GP2 exact media review currently accepts image Assets only.");
    if (asset.deletion?.state === "deleted" || asset.availability === "deleted") {
      throw new PlatformMediaBindingError("media_asset_deleted", "Deleted media cannot be bound to a review revision.");
    }
    return asset;
  }

  async function requireScreenshotDerivative(binding, asset) {
    if (binding.source !== PLATFORM_VARIANT_MEDIA_SOURCES.SCREENSHOT_DERIVATIVE) return null;
    if (!media) {
      throw new PlatformMediaBindingError("media_lineage_unavailable", "Screenshot derivative binding requires the media-intelligence repository so exact lineage can be verified.");
    }
    const storedPlan = await media.get(binding.imageDerivativePlanId);
    if (!storedPlan || storedPlan.kind !== "ImageDerivativePlan") {
      throw new PlatformMediaBindingError("derivative_plan_not_found", "The screenshot derivative plan does not exist.");
    }
    const plan = normalizeImageDerivativePlan(storedPlan);
    if (plan.workspaceId !== ownerWorkspaceId) throw new PlatformMediaBindingError("cross_workspace_media_binding", "Screenshot derivative plan belongs to another workspace.");
    if (plan.screenshotQualityReviewId !== binding.screenshotQualityReviewId) {
      throw new PlatformMediaBindingError("stale_screenshot_lineage", "Media binding quality-review reference does not match the derivative plan.");
    }
    const variant = plan.variants.find((item) => item.variantId === binding.imageDerivativeVariantId);
    if (!variant) throw new PlatformMediaBindingError("derivative_variant_not_found", "The exact screenshot derivative variant does not exist.");
    if (variant.status !== DERIVATIVE_VARIANT_STATES.RENDERED) {
      throw new PlatformMediaBindingError("derivative_not_rendered", "Only a rendered platform derivative can be bound for exact review.");
    }
    if (variant.outputAssetId !== asset.assetId || variant.outputAssetVersionId !== asset.assetVersionId) {
      throw new PlatformMediaBindingError("stale_screenshot_lineage", "Derivative plan output does not match the exact bound Asset version.");
    }

    const storedQuality = await media.get(binding.screenshotQualityReviewId);
    if (!storedQuality || storedQuality.kind !== "ScreenshotQualityReview") {
      throw new PlatformMediaBindingError("screenshot_quality_review_not_found", "The exact screenshot quality review does not exist.");
    }
    const quality = normalizeScreenshotQualityReview(storedQuality);
    if (quality.workspaceId !== ownerWorkspaceId) throw new PlatformMediaBindingError("cross_workspace_media_binding", "Screenshot quality review belongs to another workspace.");
    if (quality.status !== SCREENSHOT_QUALITY_STATES.READY) {
      throw new PlatformMediaBindingError("screenshot_quality_not_ready", "Only a screenshot with ready quality state may be bound as platform review media.");
    }
    if (quality.assetId !== plan.sourceAssetId || quality.assetVersionId !== plan.sourceAssetVersionId) {
      throw new PlatformMediaBindingError("stale_screenshot_lineage", "Screenshot quality review does not match the exact derivative source Asset version.");
    }
    return { plan, quality, derivativeVariant: variant };
  }

  async function validateBindings(mediaBindings) {
    const bindings = normalizePlatformVariantMediaBindings(mediaBindings);
    const resolved = [];
    for (const binding of bindings) {
      const asset = await requireExactAsset(binding);
      const screenshot = await requireScreenshotDerivative(binding, asset);
      resolved.push({ binding, asset, screenshot });
    }
    return { bindings, resolved };
  }

  async function bindCurrentMedia(platformVariantId, {
    mediaBindings = [],
    expectedCurrentRevisionId,
    reason = null,
  } = {}) {
    const variant = await requireVariant(platformVariantId);
    assertExpectedCurrent(variant, expectedCurrentRevisionId);
    if (!variant.currentRevisionId) throw new PlatformMediaBindingError("platform_variant_revision_not_found", "PlatformVariant has no current revision to bind media to.");
    const currentRevision = await requireRevision(variant.currentRevisionId);
    if (currentRevision.platformVariantId !== variant.platformVariantId) {
      throw new PlatformMediaBindingError("platform_variant_revision_mismatch", "Current revision does not belong to the PlatformVariant.");
    }

    const { bindings } = await validateBindings(mediaBindings);
    if (sameBindings(currentRevision.mediaBindings, bindings)) return currentRevision;

    const history = (await plans.list())
      .filter((record) => record.kind === "PlatformVariantRevision" && record.workspaceId === ownerWorkspaceId && record.platformVariantId === variant.platformVariantId)
      .map(normalizePlatformVariantRevision);
    const now = appClock.now();
    const nextRevision = createMediaReboundPlatformVariantRevision({
      platformVariantRevisionId: appIds.create("variant-revision"),
      parentRevision: currentRevision,
      revisionNumber: Math.max(0, ...history.map((item) => item.revisionNumber)) + 1,
      mediaBindings: bindings,
      changedBy: ownerUserId,
      reason,
      createdAt: now,
    });
    const persisted = await plans.upsert(nextRevision);
    await plans.upsert(attachPlatformVariantRevision(variant, persisted, now));
    return persisted;
  }

  async function getRevisionMedia(platformVariantRevisionId) {
    const revision = await requireRevision(platformVariantRevisionId);
    const { resolved } = await validateBindings(revision.mediaBindings);
    return {
      revision,
      items: resolved.map(({ binding, asset, screenshot }) => ({
        binding,
        asset,
        screenshot: screenshot ? {
          screenshotQualityReviewId: screenshot.quality.screenshotQualityReviewId,
          imageDerivativePlanId: screenshot.plan.imageDerivativePlanId,
          imageDerivativeVariantId: screenshot.derivativeVariant.variantId,
          aspectRatio: screenshot.derivativeVariant.aspectRatio,
        } : null,
      })),
    };
  }

  return {
    bindCurrentMedia,
    getRevisionMedia,
    validateBindings,
  };
}
