import test from "node:test";
import assert from "node:assert/strict";

import { normalizeAsset } from "../lib/domain/sourceArtifacts.mjs";
import {
  DERIVATIVE_PLAN_STATES,
  DERIVATIVE_VARIANT_STATES,
  SCREENSHOT_QUALITY_STATES,
  ScreenshotProductionError,
  createScreenshotQualityReview,
  planScreenshotDerivatives,
} from "../lib/domain/screenshotProduction.mjs";

const NOW = "2026-08-30T01:00:00.000Z";

function screenshot(overrides = {}) {
  return normalizeAsset({
    assetId: overrides.assetId || "capture-asset-1",
    assetVersionId: overrides.assetVersionId || "capture-asset-version-1",
    workspaceId: overrides.workspaceId || "workspace-1",
    projectId: "project-1",
    lifecycle: "original",
    originalName: "capture.png",
    mimeType: "image/png",
    byteSize: 250000,
    dimensions: overrides.dimensions || { width: 2880, height: 1800 },
    contentHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    storageRef: {
      provider: "test-private",
      blobId: "blob-1",
      objectKey: "workspaces/test/assets/sha256/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    },
    privacy: { classification: "workspace_private", exportAllowed: true, processingAllowed: true },
    createdAt: NOW,
    updatedAt: NOW,
  }, { workspaceId: overrides.workspaceId || "workspace-1", projectId: "project-1", now: NOW });
}

function readyReview(asset, overrides = {}) {
  return createScreenshotQualityReview({
    screenshotQualityReviewId: overrides.id || "quality-1",
    workspaceId: asset.workspaceId,
    asset,
    observations: {
      decodeOk: true,
      blankLike: false,
      blankConfidence: 0.99,
      errorDetected: false,
      errorConfidence: 1,
      loadingDetected: false,
      loadingConfidence: 1,
      subjectVisible: true,
      subjectConfidence: 1,
      privacyState: "passed",
      legible: true,
      legibilityConfidence: 0.95,
      ...overrides.observations,
    },
    evaluator: { name: "deterministic_quality", version: "1" },
    createdAt: NOW,
  });
}

test("a fully verified screenshot can become ready for derivative production", () => {
  const asset = screenshot();
  const review = readyReview(asset);
  assert.equal(review.status, SCREENSHOT_QUALITY_STATES.READY);
  assert.deepEqual(review.issueCodes, []);
});

test("blank, error, loading, missing-subject, privacy and legibility uncertainty never become ready silently", () => {
  const asset = screenshot();
  const cases = [
    { observations: { blankLike: true }, expected: "blank_or_uniform_capture" },
    { observations: { errorDetected: true }, expected: "error_state_visible" },
    { observations: { loadingDetected: true }, expected: "loading_state_visible" },
    { observations: { subjectVisible: false }, expected: "intended_subject_missing" },
    { observations: { privacyState: "blocked" }, expected: "privacy_review_blocked", blocked: true },
    { observations: { legible: null }, expected: "target_legibility_unverified" },
  ];

  for (const [index, item] of cases.entries()) {
    const review = readyReview(asset, { id: `quality-${index + 2}`, observations: item.observations });
    assert.notEqual(review.status, SCREENSHOT_QUALITY_STATES.READY);
    assert.ok(review.issueCodes.includes(item.expected));
    if (item.blocked) assert.equal(review.status, SCREENSHOT_QUALITY_STATES.BLOCKED);
  }
});

test("derivative plan produces semantic crops for 16:9, 1:1 and 4:5 without mutating the raw Asset", () => {
  const asset = screenshot();
  const original = structuredClone(asset);
  const review = readyReview(asset);
  const plan = planScreenshotDerivatives({
    imageDerivativePlanId: "plan-1",
    workspaceId: "workspace-1",
    sourceAsset: asset,
    qualityReview: review,
    aspectRatios: ["16:9", "1:1", "4:5"],
    focalRegion: { x: 0.3, y: 0.2, width: 0.4, height: 0.5 },
    evidenceRegions: [{ x: 0.35, y: 0.28, width: 0.25, height: 0.3 }],
    idFactory: (ratio) => `variant-${ratio.replace(":", "x")}`,
    createdAt: NOW,
  });

  assert.equal(plan.status, DERIVATIVE_PLAN_STATES.READY);
  assert.equal(plan.variants.length, 3);
  assert.ok(plan.variants.every((variant) => variant.status === DERIVATIVE_VARIANT_STATES.READY_FOR_RENDER));
  assert.ok(plan.variants.every((variant) => variant.crop.width > 0 && variant.crop.height > 0));
  assert.deepEqual(asset, original, "planning must never mutate the raw capture Asset");
});

test("portrait derivative refuses a crop that would remove required evidence", () => {
  const asset = screenshot();
  const review = readyReview(asset);
  const plan = planScreenshotDerivatives({
    imageDerivativePlanId: "plan-wide-evidence",
    workspaceId: "workspace-1",
    sourceAsset: asset,
    qualityReview: review,
    aspectRatios: ["9:16"],
    evidenceRegions: [{ x: 0.05, y: 0.3, width: 0.9, height: 0.25 }],
    createdAt: NOW,
  });

  assert.equal(plan.status, DERIVATIVE_PLAN_STATES.NEEDS_REVIEW);
  assert.equal(plan.variants[0].status, DERIVATIVE_VARIANT_STATES.NEEDS_ALTERNATE_LAYOUT);
  assert.equal(plan.variants[0].crop, null);
  assert.deepEqual(plan.variants[0].issueCodes, ["required_evidence_would_be_cropped"]);
});

test("derivative plan is bound to the exact quality-reviewed Asset version", () => {
  const asset = screenshot();
  const review = readyReview(asset);
  const changed = screenshot({ assetVersionId: "capture-asset-version-2" });
  assert.throws(() => planScreenshotDerivatives({
    imageDerivativePlanId: "plan-stale",
    workspaceId: "workspace-1",
    sourceAsset: changed,
    qualityReview: review,
    aspectRatios: ["16:9"],
    createdAt: NOW,
  }), (error) => error instanceof ScreenshotProductionError && error.code === "stale_screenshot_quality_review");
});

test("cross-workspace screenshot quality and derivative planning fail closed", () => {
  const asset = screenshot();
  assert.throws(() => createScreenshotQualityReview({
    screenshotQualityReviewId: "quality-cross-workspace",
    workspaceId: "workspace-2",
    asset,
    observations: { decodeOk: true },
    createdAt: NOW,
  }), (error) => error.code === "cross_workspace_screenshot");
});
