import test from "node:test";
import assert from "node:assert/strict";

import { createExactReviewPreparationApplication } from "../lib/application/exactReviewPreparationApplication.mjs";

function revision(overrides = {}) {
  return {
    platformVariantId: "variant-1",
    platformVariantRevisionId: "revision-1",
    narrativeStrategyId: "strategy-1",
    mediaBindings: [],
    ...overrides,
  };
}

function strategy({ required = false } = {}) {
  return {
    kind: "NarrativeStrategy",
    narrativeStrategyId: "strategy-1",
    mediaRequirements: required
      ? [{ type: "screenshot", required: true, reason: "Visible proof is required." }]
      : [],
  };
}

function fixture({
  currentRevision = revision(),
  requiredMedia = false,
  existingReview = null,
  reviewError = null,
  bundleError = null,
} = {}) {
  const calls = [];
  const planning = {
    async get(id) {
      calls.push(["planning.get", id]);
      return id === "strategy-1" ? strategy({ required: requiredMedia }) : null;
    },
  };
  const generation = {
    async getGenerationBundle(contentPieceId) {
      calls.push(["generation.getGenerationBundle", contentPieceId]);
      if (bundleError) throw bundleError;
      return {
        contentPiece: { contentPieceId },
        variants: [{
          variant: { platformVariantId: "variant-1", destination: "linkedin", status: "drafted" },
          currentRevision,
        }],
      };
    },
  };
  const reviews = {
    async getReviewBundle(platformVariantId) {
      calls.push(["reviews.getReviewBundle", platformVariantId]);
      return existingReview;
    },
    async reviewRevision(platformVariantId, platformVariantRevisionId, options) {
      calls.push(["reviews.reviewRevision", platformVariantId, platformVariantRevisionId, options]);
      if (reviewError) throw reviewError;
      return {
        platformVariantReviewId: "review-1",
        platformVariantId,
        platformVariantRevisionId,
      };
    },
  };
  const application = createExactReviewPreparationApplication({
    contentPlanningRepository: planning,
    generationApplication: generation,
    reviewApplication: reviews,
  });
  return { application, calls };
}

test("automatic exact review pins critics to the exact current revision", async () => {
  const { application, calls } = fixture();
  const result = await application.reviewExactRevision(revision(), { destination: "linkedin" });
  assert.equal(result.status, "reviewed");
  assert.equal(result.review.platformVariantReviewId, "review-1");
  assert.deepEqual(calls.find((call) => call[0] === "reviews.reviewRevision"), [
    "reviews.reviewRevision",
    "variant-1",
    "revision-1",
    { expectedCurrentRevisionId: "revision-1", refresh: false },
  ]);
});

test("automatic exact review reuses an existing current exact review without another critic call", async () => {
  const current = revision();
  const { application, calls } = fixture({
    currentRevision: current,
    existingReview: {
      review: { platformVariantReviewId: "review-existing" },
      revision: current,
      isCurrent: true,
      planningCurrent: true,
    },
  });
  const result = await application.reviewExactRevision(current);
  assert.equal(result.status, "already_reviewed");
  assert.equal(result.review.platformVariantReviewId, "review-existing");
  assert.equal(calls.some((call) => call[0] === "reviews.reviewRevision"), false);
});

test("required non-text media defers critics until the exact media-bound revision exists", async () => {
  const { application, calls } = fixture({ requiredMedia: true });
  const deferred = await application.reviewExactRevision(revision());
  assert.equal(deferred.status, "deferred_required_media");
  assert.equal(deferred.reason, "required_media_pending");
  assert.equal(calls.some((call) => call[0] === "reviews.getReviewBundle"), false);
  assert.equal(calls.some((call) => call[0] === "reviews.reviewRevision"), false);

  const bound = revision({
    platformVariantRevisionId: "revision-media-2",
    mediaBindings: [{ role: "primary_visual", assetId: "asset-1", assetVersionId: "version-1" }],
  });
  const boundFixture = fixture({ currentRevision: bound, requiredMedia: true });
  const reviewed = await boundFixture.application.reviewExactRevision(bound);
  assert.equal(reviewed.status, "reviewed");
  assert.deepEqual(boundFixture.calls.find((call) => call[0] === "reviews.reviewRevision")?.slice(1, 3), ["variant-1", "revision-media-2"]);
});

test("critic failure is fail-soft and preserves a bounded recovery code", async () => {
  const error = new Error("provider unavailable");
  error.code = "inference_provider_unavailable";
  const { application } = fixture({ reviewError: error });
  const result = await application.reviewExactRevision(revision(), { destination: "linkedin" });
  assert.equal(result.status, "review_failed");
  assert.equal(result.review, null);
  assert.equal(result.failure.code, "inference_provider_unavailable");
  assert.equal(result.failure.platformVariantId, "variant-1");
  assert.equal(result.failure.platformVariantRevisionId, "revision-1");
});

test("content-piece preparation reports reviewed, deferred and failed work without throwing", async () => {
  const deferredFixture = fixture({ requiredMedia: true });
  const deferred = await deferredFixture.application.ensureContentPieceReviewed("piece-1");
  assert.equal(deferred.reviewed.length, 0);
  assert.equal(deferred.skipped.length, 1);
  assert.equal(deferred.skipped[0].reason, "required_media_pending");
  assert.equal(deferred.failed.length, 0);

  const reviewedFixture = fixture();
  const reviewed = await reviewedFixture.application.ensureContentPieceReviewed("piece-1");
  assert.equal(reviewed.reviewed.length, 1);
  assert.equal(reviewed.skipped.length, 0);
  assert.equal(reviewed.failed.length, 0);

  const bundleError = new Error("database temporarily unavailable");
  bundleError.code = "planning_read_failed";
  const failedFixture = fixture({ bundleError });
  const failed = await failedFixture.application.ensureContentPieceReviewed("piece-1");
  assert.equal(failed.reviewed.length, 0);
  assert.equal(failed.skipped.length, 0);
  assert.equal(failed.failed.length, 1);
  assert.equal(failed.failed[0].code, "planning_read_failed");
  assert.equal(failed.failed[0].platformVariantId, null);
});
