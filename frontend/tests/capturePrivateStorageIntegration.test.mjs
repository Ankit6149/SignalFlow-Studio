import test from "node:test";
import assert from "node:assert/strict";

import { createCaptureExecutionApplication } from "../lib/application/captureExecutionApplication.mjs";
import { createPrivateAssetStorageApplication } from "../lib/application/privateAssetStorageApplication.mjs";
import { createDeterministicIdService } from "../lib/domain/ports.mjs";
import {
  activateCaptureRecipe,
  createCaptureJob,
  createCaptureRecipe,
} from "../lib/domain/captureRecipes.mjs";
import { JOB_STATUSES, enqueueDurableJob } from "../lib/domain/durableJobs.mjs";
import { createDeterministicCaptureWorkerAdapter } from "../lib/infrastructure/deterministicCaptureWorkerAdapter.mjs";
import {
  createMemoryCaptureRepository,
  createMemoryDurableJobPort,
} from "../lib/infrastructure/productExecutionMemoryAdapters.mjs";
import { createMemoryAssetRepository } from "../lib/infrastructure/transferAdapters.mjs";

const T0 = "2026-08-30T12:00:00.000Z";

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
  const calls = { put: 0, head: 0, get: 0, remove: 0 };
  return {
    calls,
    records,
    async put(blobId, value, options = {}) {
      calls.put += 1;
      const bytes = new Uint8Array(value);
      records.set(blobId, {
        bytes,
        objectKey: options.objectKey,
        contentType: options.contentType,
        contentHash: options.contentHash,
      });
      return {
        provider: "test-private",
        blobId,
        objectKey: options.objectKey,
        region: "test-region",
        byteSize: bytes.byteLength,
        contentHash: options.contentHash,
      };
    },
    async head(blobId) {
      calls.head += 1;
      const record = records.get(blobId);
      if (!record) return null;
      return {
        provider: "test-private",
        blobId,
        objectKey: record.objectKey,
        region: "test-region",
        byteSize: record.bytes.byteLength,
        contentHash: record.contentHash,
      };
    },
    async get(blobId) {
      calls.get += 1;
      const record = records.get(blobId);
      return record ? new Uint8Array(record.bytes) : null;
    },
    async remove(blobId) {
      calls.remove += 1;
      return records.delete(blobId);
    },
  };
}

function activeRecipe() {
  return activateCaptureRecipe(createCaptureRecipe({
    captureRecipeId: "recipe-private-proof",
    workspaceId: "workspace-1",
    projectId: "project-1",
    name: "GP2 product proof",
    targetOrigin: "https://preview.example.test",
    allowedEnvironment: "demo",
    requiredCapabilities: ["screenshot"],
    secretReferenceIds: [],
    fixturePolicy: { allowedKeys: [], realUserDataAllowed: false },
    privacyRules: [{ code: "private-data-visible", severity: "block", selector: "[data-private]" }],
    expectedCheckpoints: ["hero"],
    steps: [
      { stepId: "open-demo", action: "navigate", path: "/demo" },
      { stepId: "wait-app", action: "assert_visible", selector: "#app" },
      { stepId: "capture-hero", action: "capture_checkpoint", checkpoint: "hero" },
    ],
    createdAt: T0,
    updatedAt: T0,
  }), "2026-08-30T12:00:01.000Z");
}

async function createQueuedFixture({ blockedPrivacyCodes = [] } = {}) {
  const recipe = activeRecipe();
  const captureRepository = createMemoryCaptureRepository({ recipes: [recipe] });
  const durableJobs = createMemoryDurableJobPort();
  const assetRepository = createMemoryAssetRepository();
  const blobStorage = privateBlobStorage();
  const time = clock();
  const privateAssetStorage = createPrivateAssetStorageApplication({
    blobStorage,
    assetRepository,
    clock: time,
  });
  const pair = createCaptureJob({
    captureJobId: "capture-job-private-proof",
    jobId: "job-private-proof",
    recipe,
    captureKind: "screenshot",
    requestedCheckpoint: "hero",
    idempotencyKey: "capture-job-private-proof-v1",
    createdAt: time.now(),
  });
  await captureRepository.upsertJob(pair.captureJob);
  await enqueueDurableJob(durableJobs, pair.durableJob);

  const application = createCaptureExecutionApplication({
    durableJobRepository: durableJobs,
    captureRepository,
    captureWorkerAdapter: createDeterministicCaptureWorkerAdapter({
      visibleSelectors: ["#app"],
      blockedPrivacyCodes,
    }),
    privateAssetStorage,
    clock: time,
    idService: createDeterministicIdService("capture-private-proof"),
    environment: "demo",
    leaseOwner: "capture-private-worker",
  });

  return {
    application,
    assetRepository,
    blobStorage,
    captureRepository,
    durableJobs,
  };
}

test("CaptureJob screenshot bytes flow through private immutable storage into one canonical Asset", async () => {
  const fixture = await createQueuedFixture();
  const result = await fixture.application.runNext();

  assert.equal(result.durableJob.status, JOB_STATUSES.SUCCEEDED);
  assert.equal(result.captureJob.status, "succeeded");
  assert.equal(result.assets.length, 1);

  const asset = result.assets[0];
  assert.equal(asset.kind, "Asset");
  assert.equal(asset.assetType, "image");
  assert.equal(asset.lifecycle, "original");
  assert.equal(asset.mimeType, "image/png");
  assert.equal(asset.privacy.classification, "workspace_private");
  assert.equal(asset.storageRef.provider, "test-private");
  assert.match(asset.storageRef.objectKey, /^workspaces\/[a-f0-9]{20}\/assets\/sha256\/[a-f0-9]{64}$/);
  assert.match(asset.contentHash, /^sha256:[a-f0-9]{64}$/);
  assert.deepEqual(result.durableJob.outputRefs, [asset.assetId]);
  assert.deepEqual(result.captureJob.outputAssetIds, [asset.assetId]);
  assert.equal(fixture.blobStorage.calls.put, 1);

  assert.equal(result.captureJob.outputProvenance.length, 1);
  assert.deepEqual(result.captureJob.outputProvenance[0], {
    assetId: asset.assetId,
    assetVersionId: asset.assetVersionId,
    checkpoint: "hero",
    sourceUrl: null,
    environment: "demo",
    viewport: null,
    dimensions: { width: 1, height: 1 },
    capturedAt: result.captureJob.outputProvenance[0].capturedAt,
    contentHash: asset.contentHash,
    privacyReviewState: "passed",
    privacyIssueCodes: [],
    privacyWarningCodes: [],
    workerAdapter: "signalflow_capture_worker",
    workerAdapterVersion: null,
  });
  assert.match(result.captureJob.outputProvenance[0].capturedAt, /^2026-08-30T12:00:\d{2}\.000Z$/);

  const stored = fixture.blobStorage.records.get(asset.storageRef.blobId);
  assert.ok(stored);
  assert.deepEqual(Array.from(stored.bytes.slice(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10]);

  const persisted = await fixture.assetRepository.get(asset.assetId);
  assert.equal(persisted.assetVersionId, asset.assetVersionId);
  assert.equal(persisted.provenance[0].eventType, "automatic_capture");
  assert.equal(persisted.provenance[0].provenanceEventId, "capture-capture-job-private-proof-hero");
  assert.equal(persisted.provenance[0].processor.model, "recipe-private-proof@1:capture-job-private-proof");
  assert.doesNotMatch(JSON.stringify({ asset: persisted, captureJob: result.captureJob }), /signed[_-]?url|authorization|cookie|secret-ref|devtools\/browser/i);
});

test("privacy blocking happens before the private object store receives screenshot bytes", async () => {
  const fixture = await createQueuedFixture({ blockedPrivacyCodes: ["private-data-visible"] });

  await assert.rejects(
    () => fixture.application.runNext(),
    (error) => error.code === "privacy_rule_triggered",
  );

  assert.equal(fixture.blobStorage.calls.put, 0);
  assert.equal((await fixture.assetRepository.list()).length, 0);
  assert.equal((await fixture.durableJobs.get("job-private-proof")).status, JOB_STATUSES.FAILED);
  assert.equal((await fixture.captureRepository.getJob("capture-job-private-proof")).status, "failed");
});
