import test from "node:test";
import assert from "node:assert/strict";

import { createDeterministicIdService } from "../lib/domain/ports.mjs";
import { createPrivateAssetStorageApplication } from "../lib/application/privateAssetStorageApplication.mjs";
import { createScreenshotDerivativeApplication } from "../lib/application/screenshotDerivativeApplication.mjs";
import { createMemoryAssetRepository } from "../lib/infrastructure/transferAdapters.mjs";
import { createMemoryMediaIntelligenceRepository } from "../lib/infrastructure/productExecutionMemoryAdapters.mjs";

const T0 = "2026-08-30T02:00:00.000Z";

function clock() {
  let tick = 0;
  return {
    now() {
      const value = new Date(Date.parse(T0) + tick * 1000).toISOString();
      tick += 1;
      return value;
    },
  };
}

function blobStorage() {
  const records = new Map();
  return {
    async put(blobId, value, options = {}) {
      records.set(blobId, { value: new Uint8Array(value), ...options });
      return { provider: "test-private", blobId, objectKey: options.objectKey, region: "test" };
    },
    async get(blobId) {
      const record = records.get(blobId);
      return record ? new Uint8Array(record.value) : null;
    },
    async remove(blobId) { return records.delete(blobId); },
    async head(blobId) {
      const record = records.get(blobId);
      if (!record) return null;
      return {
        provider: "test-private",
        blobId,
        objectKey: record.objectKey,
        region: "test",
        byteSize: record.value.byteLength,
        contentHash: record.contentHash,
      };
    },
  };
}

function processor() {
  return {
    async describe() {
      return { available: true, adapterKind: "deterministic_image_processor", adapterVersion: 1 };
    },
    async analyze() {
      return {
        decodeOk: true,
        dimensions: { width: 2880, height: 1800 },
        blankLike: false,
        blankConfidence: 0.99,
        legible: true,
        legibilityConfidence: 0.96,
      };
    },
    async render({ crop, targetDimensions, aspectRatio }) {
      const marker = `${aspectRatio}:${crop.x},${crop.y},${crop.width},${crop.height}->${targetDimensions.width}x${targetDimensions.height}`;
      return {
        bytes: new TextEncoder().encode(marker),
        mimeType: "image/png",
        dimensions: targetDimensions,
        originalName: `proof-${aspectRatio.replace(":", "x")}.png`,
      };
    },
  };
}

async function fixture() {
  const assetRepository = createMemoryAssetRepository();
  const mediaRepository = createMemoryMediaIntelligenceRepository();
  const time = clock();
  const storage = createPrivateAssetStorageApplication({
    blobStorage: blobStorage(),
    assetRepository,
    clock: time,
  });
  const raw = await storage.storeAsset({
    workspaceId: "workspace-1",
    projectId: "project-1",
    bytes: new TextEncoder().encode("raw screenshot bytes with enough detail"),
    originalName: "raw-proof.png",
    mimeType: "image/png",
    privacy: { classification: "workspace_private", exportAllowed: true, processingAllowed: true },
    lifecycle: "original",
    dimensions: { width: 2880, height: 1800 },
    provenance: [{
      eventType: "automatic_capture",
      method: "api",
      occurredAt: T0,
      actorType: "worker",
      parentSourceArtifactIds: [],
      parentAssetIds: [],
      issueCodes: [],
    }],
  });
  const application = createScreenshotDerivativeApplication({
    mediaIntelligenceRepository: mediaRepository,
    imageProcessorAdapter: processor(),
    privateAssetStorage: storage,
    clock: time,
    idService: createDeterministicIdService("derivative-test"),
  });
  return { application, storage, assetRepository, mediaRepository, raw: raw.asset };
}

const qualityContext = {
  errorDetected: false,
  errorConfidence: 1,
  loadingDetected: false,
  loadingConfidence: 1,
  subjectVisible: true,
  subjectConfidence: 1,
  privacyState: "passed",
};

test("quality review and derivative plan persist against the exact private raw Asset version", async () => {
  const { application, mediaRepository, raw } = await fixture();
  const result = await application.inspectAndPlan({
    workspaceId: "workspace-1",
    sourceAssetId: raw.assetId,
    aspectRatios: ["16:9", "1:1", "4:5"],
    focalRegion: { x: 0.28, y: 0.18, width: 0.44, height: 0.55 },
    evidenceRegions: [{ x: 0.35, y: 0.3, width: 0.22, height: 0.25 }],
    qualityContext,
  });

  assert.equal(result.qualityReview.status, "ready");
  assert.equal(result.qualityReview.assetVersionId, raw.assetVersionId);
  assert.equal(result.plan.sourceAssetVersionId, raw.assetVersionId);
  assert.equal(result.plan.status, "ready");
  assert.equal((await mediaRepository.get(result.qualityReview.screenshotQualityReviewId)).kind, "ScreenshotQualityReview");
  assert.equal((await mediaRepository.get(result.plan.imageDerivativePlanId)).kind, "ImageDerivativePlan");
});

test("ready variants render into immutable derived Assets with exact parent AssetVersion lineage", async () => {
  const { application, storage, assetRepository, mediaRepository, raw } = await fixture();
  const planned = await application.inspectAndPlan({
    workspaceId: "workspace-1",
    sourceAssetId: raw.assetId,
    aspectRatios: ["16:9", "1:1"],
    focalRegion: { x: 0.25, y: 0.2, width: 0.5, height: 0.5 },
    evidenceRegions: [{ x: 0.4, y: 0.35, width: 0.2, height: 0.2 }],
    qualityContext,
  });
  const result = await application.renderPlan({
    workspaceId: "workspace-1",
    imageDerivativePlanId: planned.plan.imageDerivativePlanId,
  });

  assert.equal(result.outputs.length, 2);
  for (const output of result.outputs) {
    assert.equal(output.asset.lifecycle, "derived");
    assert.notEqual(output.asset.assetId, raw.assetId);
    assert.deepEqual(output.lineage.parentAssetVersionIds, [raw.assetVersionId]);
    assert.equal(output.lineage.transformation, "crop_resize");
    assert.equal(output.lineage.assetVersionId, output.asset.assetVersionId);
    const read = await storage.readAsset({ workspaceId: "workspace-1", assetId: output.asset.assetId });
    assert.ok(read.bytes.byteLength > 0);
    assert.equal((await mediaRepository.get(output.lineage.assetLineageId)).kind, "AssetLineage");
  }
  const persistedRaw = await assetRepository.get(raw.assetId);
  assert.equal(persistedRaw.lifecycle, "original");
  assert.equal(persistedRaw.assetVersionId, raw.assetVersionId);
  assert.ok(result.plan.variants.every((variant) => variant.status === "rendered"));
});

test("unsafe portrait crop remains unrendered while safe variants can proceed independently", async () => {
  const { application, raw } = await fixture();
  const planned = await application.inspectAndPlan({
    workspaceId: "workspace-1",
    sourceAssetId: raw.assetId,
    aspectRatios: ["16:9", "9:16"],
    evidenceRegions: [{ x: 0.05, y: 0.3, width: 0.9, height: 0.2 }],
    qualityContext,
  });
  assert.equal(planned.plan.status, "needs_review");
  const portrait = planned.plan.variants.find((variant) => variant.aspectRatio === "9:16");
  assert.equal(portrait.status, "needs_alternate_layout");

  const rendered = await application.renderPlan({
    workspaceId: "workspace-1",
    imageDerivativePlanId: planned.plan.imageDerivativePlanId,
  });
  assert.equal(rendered.outputs.length, 1);
  assert.equal(rendered.outputs[0].aspectRatio, "16:9");
  assert.equal(rendered.plan.variants.find((variant) => variant.aspectRatio === "9:16").status, "needs_alternate_layout");
});

test("non-capture image processing fails closed without an explicit crop permission binding", async () => {
  const assetRepository = createMemoryAssetRepository();
  const mediaRepository = createMemoryMediaIntelligenceRepository();
  const time = clock();
  const storage = createPrivateAssetStorageApplication({ blobStorage: blobStorage(), assetRepository, clock: time });
  const uploaded = await storage.storeAsset({
    workspaceId: "workspace-1",
    bytes: new TextEncoder().encode("uploaded image"),
    originalName: "upload.png",
    mimeType: "image/png",
    privacy: { classification: "workspace_private", processingAllowed: true },
    dimensions: { width: 1600, height: 900 },
    provenance: [{ eventType: "uploaded", method: "api", occurredAt: T0, actorType: "user" }],
  });
  const application = createScreenshotDerivativeApplication({
    mediaIntelligenceRepository: mediaRepository,
    imageProcessorAdapter: processor(),
    privateAssetStorage: storage,
    clock: time,
    idService: createDeterministicIdService("permission-test"),
  });
  await assert.rejects(
    () => application.inspectAndPlan({ workspaceId: "workspace-1", sourceAssetId: uploaded.asset.assetId, qualityContext }),
    (error) => error.code === "media_policy_required",
  );
});
