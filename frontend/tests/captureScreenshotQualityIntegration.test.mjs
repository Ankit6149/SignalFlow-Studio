import test from "node:test";
import assert from "node:assert/strict";

import { createDeterministicIdService } from "../lib/domain/ports.mjs";
import {
  activateCaptureRecipe,
  createCaptureJob,
  createCaptureRecipe,
} from "../lib/domain/captureRecipes.mjs";
import { enqueueDurableJob } from "../lib/domain/durableJobs.mjs";
import { createCaptureExecutionApplication } from "../lib/application/captureExecutionApplication.mjs";
import { createPrivateAssetStorageApplication } from "../lib/application/privateAssetStorageApplication.mjs";
import { createScreenshotDerivativeApplication } from "../lib/application/screenshotDerivativeApplication.mjs";
import {
  createMemoryCaptureRepository,
  createMemoryDurableJobPort,
  createMemoryMediaIntelligenceRepository,
} from "../lib/infrastructure/productExecutionMemoryAdapters.mjs";
import { createDeterministicCaptureWorkerAdapter } from "../lib/infrastructure/deterministicCaptureWorkerAdapter.mjs";
import { createMemoryAssetRepository } from "../lib/infrastructure/transferAdapters.mjs";

const T0 = "2026-08-30T03:00:00.000Z";

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

function privateBlobStorage() {
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

function recipe() {
  return activateCaptureRecipe(createCaptureRecipe({
    captureRecipeId: "quality-recipe-1",
    workspaceId: "workspace-1",
    projectId: "project-1",
    name: "Quality-aware product proof",
    targetOrigin: "https://preview.example.test",
    allowedEnvironment: "demo",
    requiredCapabilities: ["screenshot"],
    fixturePolicy: { allowedKeys: [], realUserDataAllowed: false },
    privacyRules: [],
    expectedCheckpoints: ["hero"],
    steps: [
      { stepId: "open", action: "navigate", path: "/demo" },
      {
        stepId: "capture",
        action: "capture_checkpoint",
        checkpoint: "hero",
        qualitySelectors: {
          error: ["[data-error-state]"],
          loading: ["[data-loading-state]"],
          requiredSubject: ["#app"],
        },
      },
    ],
    createdAt: T0,
    updatedAt: T0,
  }), "2026-08-30T03:00:01.000Z");
}

async function executeCapture({
  visibleSelectors = ["#app"],
  screenshotDimensions = { width: 1, height: 1 },
} = {}) {
  const captureRecipe = recipe();
  assert.deepEqual(captureRecipe.steps[1].qualitySelectors, {
    error: ["[data-error-state]"],
    loading: ["[data-loading-state]"],
    requiredSubject: ["#app"],
  });
  const captureRepository = createMemoryCaptureRepository({ recipes: [captureRecipe] });
  const jobs = createMemoryDurableJobPort();
  const assetRepository = createMemoryAssetRepository();
  const time = clock();
  const storage = createPrivateAssetStorageApplication({
    blobStorage: privateBlobStorage(),
    assetRepository,
    clock: time,
  });
  const pair = createCaptureJob({
    captureJobId: "capture-quality-1",
    jobId: "job-quality-1",
    recipe: captureRecipe,
    captureKind: "screenshot",
    requestedCheckpoint: "hero",
    idempotencyKey: "capture-quality-1-v1",
    createdAt: time.now(),
  });
  await captureRepository.upsertJob(pair.captureJob);
  await enqueueDurableJob(jobs, pair.durableJob);
  const application = createCaptureExecutionApplication({
    durableJobRepository: jobs,
    captureRepository,
    captureWorkerAdapter: createDeterministicCaptureWorkerAdapter({
      visibleSelectors,
      screenshotDimensions,
    }),
    privateAssetStorage: storage,
    clock: time,
    idService: createDeterministicIdService("capture-quality"),
    environment: "demo",
    leaseOwner: "quality-worker",
  });
  const result = await application.runNext();
  return { ...result, storage, assetRepository, time };
}

function deterministicImageProcessor() {
  let renderCalls = 0;
  return {
    get renderCalls() { return renderCalls; },
    async describe() { return { available: true, adapterKind: "deterministic_quality_processor", adapterVersion: 1 }; },
    async analyze() {
      return {
        decodeOk: true,
        dimensions: { width: 1440, height: 900 },
        blankLike: false,
        blankConfidence: 1,
        legible: true,
        legibilityConfidence: 1,
      };
    },
    async render({ aspectRatio, targetDimensions }) {
      renderCalls += 1;
      return {
        bytes: new TextEncoder().encode(`render:${aspectRatio}`),
        mimeType: "image/png",
        dimensions: targetDimensions,
        originalName: `render-${aspectRatio.replace(":", "x")}.png`,
      };
    },
  };
}

test("capture checkpoint persists real bounded DOM quality signals in exact output provenance", async () => {
  const result = await executeCapture({ visibleSelectors: ["#app"] });
  assert.equal(result.captureJob.outputProvenance.length, 1);
  assert.deepEqual(result.captureJob.outputProvenance[0].qualitySignals, {
    documentReady: null,
    errorDetected: false,
    loadingDetected: false,
    subjectVisible: true,
    issueCodes: [],
  });
  assert.equal(result.captureJob.outputProvenance[0].privacyReviewState, "passed");
  assert.equal(result.captureJob.outputProvenance[0].assetId, result.assets[0].assetId);
  assert.equal(result.captureJob.outputProvenance[0].assetVersionId, result.assets[0].assetVersionId);
});

test("capture-time loading/error/subject truth is authoritative for screenshot quality review", async () => {
  const result = await executeCapture({ visibleSelectors: ["#app", "[data-loading-state]"] });
  const mediaRepository = createMemoryMediaIntelligenceRepository();
  const processor = deterministicImageProcessor();
  const application = createScreenshotDerivativeApplication({
    mediaIntelligenceRepository: mediaRepository,
    imageProcessorAdapter: processor,
    privateAssetStorage: result.storage,
    clock: result.time,
    idService: createDeterministicIdService("quality-plan"),
  });
  const planned = await application.inspectAndPlan({
    workspaceId: "workspace-1",
    sourceAssetId: result.assets[0].assetId,
    captureJob: result.captureJob,
    aspectRatios: ["16:9"],
    qualityContext: {
      loadingDetected: false,
      loadingConfidence: 1,
      errorDetected: false,
      subjectVisible: true,
      privacyState: "passed",
    },
  });
  assert.equal(planned.qualityReview.status, "needs_review");
  assert.equal(planned.qualityReview.checks.loadingState.state, "failed");
  assert.ok(planned.qualityReview.issueCodes.includes("loading_state_visible"));
});

test("all verified capture signals can make the exact screenshot quality review ready", async () => {
  const result = await executeCapture({ visibleSelectors: ["#app"] });
  const application = createScreenshotDerivativeApplication({
    mediaIntelligenceRepository: createMemoryMediaIntelligenceRepository(),
    imageProcessorAdapter: deterministicImageProcessor(),
    privateAssetStorage: result.storage,
    clock: result.time,
    idService: createDeterministicIdService("ready-quality"),
  });
  const planned = await application.inspectAndPlan({
    workspaceId: "workspace-1",
    sourceAssetId: result.assets[0].assetId,
    captureJob: result.captureJob,
    aspectRatios: ["16:9"],
  });
  assert.equal(planned.qualityReview.status, "ready");
  assert.equal(planned.qualityReview.checks.errorState.state, "passed");
  assert.equal(planned.qualityReview.checks.loadingState.state, "passed");
  assert.equal(planned.qualityReview.checks.subjectVisible.state, "passed");
  assert.equal(planned.qualityReview.checks.privacy.state, "passed");
});

test("derivative rendering is retry-idempotent after a variant is already rendered", async () => {
  const result = await executeCapture({
    visibleSelectors: ["#app"],
    screenshotDimensions: { width: 1600, height: 900 },
  });
  const mediaRepository = createMemoryMediaIntelligenceRepository();
  const processor = deterministicImageProcessor();
  const application = createScreenshotDerivativeApplication({
    mediaIntelligenceRepository: mediaRepository,
    imageProcessorAdapter: processor,
    privateAssetStorage: result.storage,
    clock: result.time,
    idService: createDeterministicIdService("retry-safe"),
  });
  const planned = await application.inspectAndPlan({
    workspaceId: "workspace-1",
    sourceAssetId: result.assets[0].assetId,
    captureJob: result.captureJob,
    aspectRatios: ["16:9"],
  });
  assert.equal(planned.plan.status, "ready");
  assert.equal(planned.plan.variants[0].status, "ready_for_render");

  const first = await application.renderPlan({ workspaceId: "workspace-1", imageDerivativePlanId: planned.plan.imageDerivativePlanId });
  const callsAfterFirst = processor.renderCalls;
  const second = await application.renderPlan({ workspaceId: "workspace-1", imageDerivativePlanId: planned.plan.imageDerivativePlanId });

  assert.equal(first.outputs.length, 1);
  assert.equal(callsAfterFirst, 1);
  assert.equal(second.outputs.length, 0);
  assert.equal(processor.renderCalls, 1, "already-rendered variant must not invoke the processor again");
  assert.equal(second.plan.variants[0].outputAssetId, first.plan.variants[0].outputAssetId);
  assert.equal(second.plan.variants[0].outputAssetVersionId, first.plan.variants[0].outputAssetVersionId);
});
