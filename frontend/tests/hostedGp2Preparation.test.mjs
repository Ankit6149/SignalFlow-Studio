import test from "node:test";
import assert from "node:assert/strict";

import {
  HOSTED_GP2_PREPARATION_STATUSES,
  createHostedGp2PreparationApplication,
} from "../lib/application/hostedGp2PreparationApplication.mjs";

function strategy({ mediaRequirements = [{ type: "screenshot", required: true }] } = {}) {
  return {
    kind: "NarrativeStrategy",
    status: "approved",
    narrativeStrategyId: "strategy-1",
    mediaRequirements,
  };
}

function revision(destination, suffix, { screenshotBound = false } = {}) {
  return {
    platformVariantId: `variant-${destination}`,
    platformVariantRevisionId: `revision-${suffix}`,
    narrativeStrategyId: "strategy-1",
    mediaBindings: screenshotBound ? [{ source: "screenshot_derivative", role: "primary_visual" }] : [],
  };
}

function variant(destination, currentRevision) {
  return {
    variant: {
      platformVariantId: `variant-${destination}`,
      destination,
      status: "review",
    },
    currentRevision,
  };
}

function fixture({
  mediaRequirements,
  entries = [variant("linkedin", revision("linkedin", "linkedin-1"))],
  generated = null,
  generationFailures = [],
  screenshotStatus = "bound",
  screenshotFactoryError = null,
  reviewStatus = "reviewed",
} = {}) {
  const calls = [];
  const generatedRevisions = generated || entries.map((entry) => entry.currentRevision).filter(Boolean);
  const application = createHostedGp2PreparationApplication({
    contentPlanningRepository: {
      async get(id) {
        calls.push(["planning.get", id]);
        return id === "strategy-1" ? strategy({ mediaRequirements }) : null;
      },
    },
    generationApplication: {
      async generateReadyVariants(contentPieceId) {
        calls.push(["generation.generateReadyVariants", contentPieceId]);
        return {
          generated: generatedRevisions,
          failed: generationFailures,
          bundle: {
            contentPiece: { contentPieceId, narrativeStrategyId: "strategy-1" },
            variants: entries,
          },
        };
      },
      async getGenerationBundle(contentPieceId) {
        calls.push(["generation.getGenerationBundle", contentPieceId]);
        return {
          contentPiece: { contentPieceId, narrativeStrategyId: "strategy-1" },
          variants: entries,
        };
      },
    },
    screenshotProductionFactory: async () => {
      calls.push(["screenshot.factory"]);
      if (screenshotFactoryError) throw screenshotFactoryError;
      return {
        async produceScreenshot(input) {
          calls.push(["screenshot.produceScreenshot", input]);
          if (screenshotStatus !== "bound") return { status: screenshotStatus };
          const destination = input.platformVariantId.replace("variant-", "");
          return {
            status: "bound",
            boundRevision: revision(destination, `${destination}-media`, { screenshotBound: true }),
          };
        },
      };
    },
    reviewPreparationApplication: {
      async reviewExactRevision(currentRevision, options) {
        calls.push(["review.reviewExactRevision", currentRevision.platformVariantRevisionId, options]);
        if (reviewStatus === "already_reviewed") {
          return { status: "already_reviewed", review: { platformVariantReviewId: `review-${currentRevision.platformVariantRevisionId}` } };
        }
        if (reviewStatus === "review_failed") {
          return { status: "review_failed", failure: { code: "critic_temporarily_unavailable" } };
        }
        return { status: "reviewed", review: { platformVariantReviewId: `review-${currentRevision.platformVariantRevisionId}` } };
      },
    },
  });
  return { application, calls };
}

test("required screenshot production binds media before exact review and routes success to Today", async () => {
  const { application, calls } = fixture();
  const result = await application.prepareContentPiece("piece-1");

  assert.equal(result.status, HOSTED_GP2_PREPARATION_STATUSES.READY_FOR_JUDGMENT);
  assert.equal(result.mediaBoundCount, 1);
  assert.equal(result.reviewedCount, 1);
  assert.equal(result.nextRoute, "/today");
  const capture = calls.find((call) => call[0] === "screenshot.produceScreenshot");
  assert.equal(capture[1].expectedCurrentRevisionId, "revision-linkedin-1");
  assert.equal(capture[1].aspectRatio, "4:5");
  assert.deepEqual(calls.find((call) => call[0] === "review.reviewExactRevision"), [
    "review.reviewExactRevision",
    "revision-linkedin-media",
    { destination: "linkedin" },
  ]);
});

test("current screenshot derivatives and current exact reviews are reused without duplicate production", async () => {
  const entry = variant("x", revision("x", "x-1", { screenshotBound: true }));
  const { application, calls } = fixture({ entries: [entry], generated: [], reviewStatus: "already_reviewed" });
  const result = await application.prepareContentPiece("piece-1");

  assert.equal(result.status, HOSTED_GP2_PREPARATION_STATUSES.READY_FOR_JUDGMENT);
  assert.equal(result.generationReusedCount, 1);
  assert.equal(result.mediaReusedCount, 1);
  assert.equal(result.reviewReusedCount, 1);
  assert.equal(calls.some((call) => call[0] === "screenshot.factory"), false);
});

test("text-only approved stories do not require screenshot infrastructure", async () => {
  const unavailable = new Error("CDP is intentionally unavailable for this test");
  unavailable.code = "hosted_capture_worker_unconfigured";
  const { application, calls } = fixture({ mediaRequirements: [], screenshotFactoryError: unavailable });
  const result = await application.prepareContentPiece("piece-1");

  assert.equal(result.status, HOSTED_GP2_PREPARATION_STATUSES.READY_FOR_JUDGMENT);
  assert.equal(result.reviewedCount, 1);
  assert.equal(calls.some((call) => call[0] === "screenshot.factory"), false);
});

test("durable capture retry remains recovery work and critics do not run against text-only revision", async () => {
  const { application, calls } = fixture({ screenshotStatus: "capture_retrying" });
  const result = await application.prepareContentPiece("piece-1");

  assert.equal(result.status, HOSTED_GP2_PREPARATION_STATUSES.RECOVERY_REQUIRED);
  assert.equal(result.failures.some((failure) => failure.stage === "media" && failure.code === "capture_retrying"), true);
  assert.equal(calls.some((call) => call[0] === "review.reviewExactRevision"), false);
  assert.equal(result.nextRoute, "/plan");
});

test("one destination can become judgment-ready while another generation failure is preserved", async () => {
  const linkedin = variant("linkedin", revision("linkedin", "linkedin-1", { screenshotBound: true }));
  const x = variant("x", null);
  const { application } = fixture({
    entries: [linkedin, x],
    generated: [],
    generationFailures: [{ platformVariantId: "variant-x", destination: "x", code: "inference_provider_unavailable" }],
  });
  const result = await application.prepareContentPiece("piece-1");

  assert.equal(result.status, HOSTED_GP2_PREPARATION_STATUSES.PARTIAL_FAILURE);
  assert.equal(result.reviewedCount, 1);
  assert.equal(result.failures.some((failure) => failure.platformVariantId === "variant-x" && failure.code === "inference_provider_unavailable"), true);
  assert.equal(result.nextRoute, "/today");
});

test("unsupported required media cannot be mistaken for a completed GP2 owner judgment state", async () => {
  const { application, calls } = fixture({ mediaRequirements: [{ type: "video", required: true }] });
  const result = await application.prepareContentPiece("piece-1");

  assert.equal(result.status, HOSTED_GP2_PREPARATION_STATUSES.RECOVERY_REQUIRED);
  assert.equal(result.failures.some((failure) => failure.code === "unsupported_required_media"), true);
  assert.equal(calls.some((call) => call[0] === "review.reviewExactRevision"), false);
  assert.equal(result.nextRoute, "/plan");
});
