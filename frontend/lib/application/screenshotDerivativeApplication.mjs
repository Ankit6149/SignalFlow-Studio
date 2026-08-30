import { assertPort } from "../domain/ports.mjs";
import {
  assertAssetOperationAllowed,
  createDerivedAssetLineage,
} from "../domain/mediaIntelligence.mjs";
import {
  DERIVATIVE_VARIANT_STATES,
  SCREENSHOT_QUALITY_STATES,
  ScreenshotProductionError,
  createScreenshotQualityReview,
  normalizeImageDerivativePlan,
  normalizeScreenshotQualityReview,
  planScreenshotDerivatives,
} from "../domain/screenshotProduction.mjs";

function assertPrivateAssetStorage(service) {
  if (!service || typeof service !== "object" || typeof service.readAsset !== "function" || typeof service.storeAsset !== "function") {
    throw new TypeError("privateAssetStorage must expose readAsset() and storeAsset().");
  }
  return service;
}

function isAutomaticCapture(asset) {
  return Array.isArray(asset?.provenance) && asset.provenance.some((event) => event?.eventType === "automatic_capture");
}

function assertDerivativePermission(asset, assetRoleBinding = null) {
  if (assetRoleBinding) {
    if (assetRoleBinding.assetId !== asset.assetId || (assetRoleBinding.assetVersionId && assetRoleBinding.assetVersionId !== asset.assetVersionId)) {
      throw new ScreenshotProductionError("stale_media_permission", "Crop permission must reference the exact source Asset version when a version is bound.");
    }
    assertAssetOperationAllowed(assetRoleBinding, "crop");
    return true;
  }
  if (!isAutomaticCapture(asset) || asset.privacy?.processingAllowed !== true) {
    throw new ScreenshotProductionError("media_policy_required", "Screenshot derivatives require explicit crop permission unless the source is an authorized automatic capture output.");
  }
  return true;
}

function mergeObservations(analysis = {}, context = {}) {
  return {
    decodeOk: analysis.decodeOk,
    blankLike: analysis.blankLike,
    blankConfidence: analysis.blankConfidence,
    legible: analysis.legible,
    legibilityConfidence: analysis.legibilityConfidence,
    errorDetected: context.errorDetected,
    errorConfidence: context.errorConfidence,
    loadingDetected: context.loadingDetected,
    loadingConfidence: context.loadingConfidence,
    subjectVisible: context.subjectVisible,
    subjectConfidence: context.subjectConfidence,
    privacyState: context.privacyState,
  };
}

function safeProcessorRef(description = {}) {
  const name = String(description.adapterKind || description.name || "image_processor").trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "_") || "image_processor";
  const version = String(description.adapterVersion || description.version || 1).trim();
  return { name, version, ref: `${name}@${version}` };
}

export function createScreenshotDerivativeApplication({
  mediaIntelligenceRepository,
  imageProcessorAdapter,
  privateAssetStorage,
  clock,
  idService,
} = {}) {
  const media = assertPort("mediaIntelligenceRepository", mediaIntelligenceRepository);
  const processor = assertPort("imageProcessorAdapter", imageProcessorAdapter);
  const storage = assertPrivateAssetStorage(privateAssetStorage);
  const time = assertPort("clock", clock);
  const ids = assertPort("idService", idService);

  async function inspectAndPlan({
    workspaceId,
    sourceAssetId,
    aspectRatios = ["16:9", "9:16", "1:1", "4:5"],
    focalRegion = null,
    evidenceRegions = [],
    qualityContext = {},
    assetRoleBinding = null,
  } = {}) {
    const { asset, bytes } = await storage.readAsset({ workspaceId, assetId: sourceAssetId });
    if (asset.assetType !== "image") throw new ScreenshotProductionError("invalid_screenshot_asset", "Screenshot production requires an image Asset.");
    assertDerivativePermission(asset, assetRoleBinding);

    const description = await processor.describe();
    if (!description?.available) throw new ScreenshotProductionError("image_processor_unavailable", "Configured screenshot image processor is unavailable.");
    const analysis = await processor.analyze({ bytes, mimeType: asset.mimeType, expectedDimensions: asset.dimensions });
    const now = time.now();
    const review = createScreenshotQualityReview({
      screenshotQualityReviewId: ids.create("screenshot-quality-review"),
      workspaceId,
      asset,
      observations: mergeObservations(analysis, qualityContext),
      evaluator: {
        name: safeProcessorRef(description).name,
        version: safeProcessorRef(description).version,
      },
      createdAt: now,
    });
    const persistedReview = await media.upsert(review);
    const plan = planScreenshotDerivatives({
      imageDerivativePlanId: ids.create("image-derivative-plan"),
      workspaceId,
      sourceAsset: asset,
      qualityReview: persistedReview,
      aspectRatios,
      focalRegion,
      evidenceRegions,
      idFactory: (aspectRatio) => ids.create(`image-derivative-${aspectRatio.replace(":", "x")}`),
      createdAt: now,
    });
    const persistedPlan = await media.upsert(plan);
    return { asset, qualityReview: persistedReview, plan: persistedPlan, analysis };
  }

  async function renderPlan({ workspaceId, imageDerivativePlanId, assetRoleBinding = null } = {}) {
    const storedPlan = await media.get(imageDerivativePlanId);
    if (!storedPlan || storedPlan.kind !== "ImageDerivativePlan") throw new ScreenshotProductionError("derivative_plan_not_found", "Screenshot derivative plan was not found.");
    const plan = normalizeImageDerivativePlan(storedPlan);
    if (plan.workspaceId !== workspaceId) throw new ScreenshotProductionError("cross_workspace_screenshot", "Screenshot derivative plan belongs to another workspace.");
    const quality = normalizeScreenshotQualityReview(await media.get(plan.screenshotQualityReviewId));
    if (quality.status === SCREENSHOT_QUALITY_STATES.BLOCKED) throw new ScreenshotProductionError("source_quality_blocked", "Blocked screenshot quality cannot be rendered into derivatives.");

    const { asset: sourceAsset, bytes } = await storage.readAsset({ workspaceId, assetId: plan.sourceAssetId });
    if (sourceAsset.assetVersionId !== plan.sourceAssetVersionId || quality.assetVersionId !== sourceAsset.assetVersionId) {
      throw new ScreenshotProductionError("stale_derivative_source", "Derivative render requires the exact quality-reviewed source Asset version.");
    }
    assertDerivativePermission(sourceAsset, assetRoleBinding);

    const description = await processor.describe();
    if (!description?.available) throw new ScreenshotProductionError("image_processor_unavailable", "Configured screenshot image processor is unavailable.");
    const processorRef = safeProcessorRef(description);
    const now = time.now();
    const outputs = [];
    const variants = [];

    for (const variant of plan.variants) {
      if (variant.status !== DERIVATIVE_VARIANT_STATES.READY_FOR_RENDER) {
        variants.push(variant);
        continue;
      }
      const rendered = await processor.render({
        bytes,
        mimeType: sourceAsset.mimeType,
        crop: variant.crop,
        targetDimensions: variant.targetDimensions,
        aspectRatio: variant.aspectRatio,
      });
      if (!rendered?.bytes || !Number(rendered.bytes.byteLength || rendered.bytes.length || 0)) {
        throw new ScreenshotProductionError("derivative_render_failed", `Image processor returned no bytes for ${variant.aspectRatio}.`);
      }
      const stored = await storage.storeAsset({
        workspaceId,
        projectId: sourceAsset.projectId,
        campaignId: sourceAsset.campaignId,
        bytes: rendered.bytes,
        originalName: rendered.originalName || `screenshot-${variant.aspectRatio.replace(":", "x")}.png`,
        mimeType: rendered.mimeType || "image/png",
        privacy: sourceAsset.privacy,
        lifecycle: "derived",
        dimensions: rendered.dimensions || variant.targetDimensions,
        provenance: [{
          eventType: "derived",
          method: "api",
          occurredAt: now,
          actorType: "worker",
          actorId: null,
          parentSourceArtifactIds: [],
          parentAssetIds: [sourceAsset.assetId],
          processor: {
            name: processorRef.name,
            version: processorRef.version,
            model: `${plan.imageDerivativePlanId}:${variant.variantId}`,
          },
          issueCodes: [],
        }],
        userMetadata: {
          description: `Deterministic ${variant.aspectRatio} derivative of captured product evidence.`,
          tags: ["screenshot-derivative", variant.aspectRatio.replace(":", "x")],
          intendedUse: ["capture_derivative"],
        },
      });
      const lineage = createDerivedAssetLineage({
        assetLineageId: `lineage:${plan.imageDerivativePlanId}:${variant.variantId}`,
        workspaceId,
        assetId: stored.asset.assetId,
        assetVersionId: stored.asset.assetVersionId,
        parentAssetVersionIds: [sourceAsset.assetVersionId],
        transformation: "crop_resize",
        processorRef: processorRef.ref,
        createdAt: now,
      });
      await media.upsert(lineage);
      outputs.push({ variantId: variant.variantId, aspectRatio: variant.aspectRatio, asset: stored.asset, lineage });
      variants.push({
        ...variant,
        status: DERIVATIVE_VARIANT_STATES.RENDERED,
        outputAssetId: stored.asset.assetId,
        outputAssetVersionId: stored.asset.assetVersionId,
      });
    }

    const updatedPlan = normalizeImageDerivativePlan({ ...plan, variants, updatedAt: time.now() });
    await media.upsert(updatedPlan);
    return { plan: updatedPlan, sourceAsset, qualityReview: quality, outputs };
  }

  return { inspectAndPlan, renderPlan };
}
