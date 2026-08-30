import test from "node:test";
import assert from "node:assert/strict";

import { normalizeCaptureJob } from "../lib/domain/captureRecipes.mjs";

const BASE = {
  captureJobId: "capture-job-1",
  workspaceId: "workspace-1",
  projectId: "project-1",
  captureRecipeId: "recipe-1",
  captureRecipeVersion: 2,
  jobId: "job-1",
  captureKind: "screenshot",
  requestedCheckpoint: "hero",
  status: "succeeded",
  outputAssetIds: ["asset-1"],
  createdAt: "2026-08-30T12:00:00.000Z",
  updatedAt: "2026-08-30T12:00:10.000Z",
  completedAt: "2026-08-30T12:00:10.000Z",
};

test("capture output provenance is structured, bounded, and strips query/hash data from source URLs", () => {
  const job = normalizeCaptureJob({
    ...BASE,
    outputProvenance: [{
      assetId: "asset-1",
      assetVersionId: "asset-version-1",
      checkpoint: "hero",
      sourceUrl: "https://preview.example.test/demo?token=must-not-persist#private-fragment",
      environment: "preview",
      viewport: { width: 1440, height: 900, deviceScaleFactor: 2 },
      dimensions: { width: 2880, height: 1800 },
      capturedAt: "2026-08-30T12:00:08.000Z",
      contentHash: `sha256:${"a".repeat(64)}`,
      privacyReviewState: "passed",
      privacyIssueCodes: [],
      privacyWarningCodes: ["manual-layout-review"],
      qualitySignals: {
        documentReady: true,
        errorDetected: false,
        loadingDetected: false,
        subjectVisible: true,
        issueCodes: [],
      },
      workerAdapter: "cdp_remote_browser",
      workerAdapterVersion: "1",
    }],
  });

  assert.deepEqual(job.outputProvenance[0], {
    assetId: "asset-1",
    assetVersionId: "asset-version-1",
    checkpoint: "hero",
    sourceUrl: "https://preview.example.test/demo",
    environment: "preview",
    viewport: { width: 1440, height: 900, deviceScaleFactor: 2 },
    dimensions: { width: 2880, height: 1800 },
    capturedAt: "2026-08-30T12:00:08.000Z",
    contentHash: `sha256:${"a".repeat(64)}`,
    privacyReviewState: "passed",
    privacyIssueCodes: [],
    privacyWarningCodes: ["manual-layout-review"],
    qualitySignals: {
      documentReady: true,
      errorDetected: false,
      loadingDetected: false,
      subjectVisible: true,
      issueCodes: [],
    },
    workerAdapter: "cdp_remote_browser",
    workerAdapterVersion: "1",
  });
  assert.doesNotMatch(JSON.stringify(job), /must-not-persist|private-fragment/);
});

test("capture output provenance rejects credential-bearing source URLs", () => {
  assert.throws(() => normalizeCaptureJob({
    ...BASE,
    outputProvenance: [{
      assetId: "asset-1",
      checkpoint: "hero",
      sourceUrl: "https://user:password@preview.example.test/demo",
      environment: "preview",
      capturedAt: "2026-08-30T12:00:08.000Z",
      privacyReviewState: "passed",
    }],
  }), (error) => error.code === "unsafe_capture_provenance");
});