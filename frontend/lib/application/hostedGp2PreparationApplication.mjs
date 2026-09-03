export const HOSTED_GP2_PREPARATION_STATUSES = Object.freeze({
  READY_FOR_JUDGMENT: "ready_for_judgment",
  PARTIAL_FAILURE: "partial_failure",
  RECOVERY_REQUIRED: "recovery_required",
});

const TEXT_ONLY_MEDIA = new Set(["", "none", "text_only"]);
const SCREENSHOT_SOURCE = "screenshot_derivative";

function requiredService(name, value, methods = []) {
  if (!value || typeof value !== "object") throw new TypeError(`${name} is required.`);
  for (const method of methods) {
    if (typeof value[method] !== "function") throw new TypeError(`${name}.${method}() is required.`);
  }
  return value;
}

function requiredFactory(name, value) {
  if (typeof value !== "function") throw new TypeError(`${name} is required.`);
  return value;
}

function requiredId(value, field) {
  const normalized = String(value || "").trim();
  if (!normalized || /[/\\]|^[a-zA-Z]:/.test(normalized)) throw new TypeError(`${field} must be an opaque identifier.`);
  return normalized;
}

function requiredNonTextMedia(strategy) {
  return (Array.isArray(strategy?.mediaRequirements) ? strategy.mediaRequirements : [])
    .filter((item) => item?.required === true)
    .map((item) => ({ ...item, type: String(item?.type || "").trim().toLowerCase() }))
    .filter((item) => !TEXT_ONLY_MEDIA.has(item.type));
}

function hasScreenshotBinding(revision) {
  return Boolean((Array.isArray(revision?.mediaBindings) ? revision.mediaBindings : [])
    .some((binding) => String(binding?.source || "").trim().toLowerCase() === SCREENSHOT_SOURCE));
}

function screenshotAspectRatio(destination) {
  if (destination === "linkedin") return "4:5";
  if (destination === "x") return "16:9";
  return "1:1";
}

function boundedFailure({ stage, code, platformVariantId = null, platformVariantRevisionId = null, destination = null }) {
  return Object.freeze({
    stage,
    code: String(code || "gp2_preparation_failed"),
    platformVariantId: platformVariantId || null,
    platformVariantRevisionId: platformVariantRevisionId || null,
    destination: destination || null,
  });
}

function failureFromError(error, context = {}) {
  return boundedFailure({
    ...context,
    code: error?.code || context.code || "gp2_preparation_failed",
  });
}

function statusFor({ failures, completedCount, activeCount }) {
  if (!failures.length && activeCount > 0 && completedCount === activeCount) {
    return HOSTED_GP2_PREPARATION_STATUSES.READY_FOR_JUDGMENT;
  }
  if (completedCount > 0) return HOSTED_GP2_PREPARATION_STATUSES.PARTIAL_FAILURE;
  return HOSTED_GP2_PREPARATION_STATUSES.RECOVERY_REQUIRED;
}

export function createHostedGp2PreparationApplication({
  contentPlanningRepository,
  generationApplication,
  reviewPreparationApplication,
  screenshotProductionFactory,
} = {}) {
  const plans = requiredService("contentPlanningRepository", contentPlanningRepository, ["get"]);
  const generation = requiredService("generationApplication", generationApplication, ["generateReadyVariants", "getGenerationBundle"]);
  const reviews = requiredService("reviewPreparationApplication", reviewPreparationApplication, ["reviewExactRevision"]);
  const screenshots = requiredFactory("screenshotProductionFactory", screenshotProductionFactory);

  let screenshotApplication = null;
  let screenshotFactoryFailure = null;

  async function getScreenshotApplication() {
    if (screenshotApplication) return screenshotApplication;
    if (screenshotFactoryFailure) throw screenshotFactoryFailure;
    try {
      const resolved = await screenshots();
      screenshotApplication = requiredService("screenshotProductionApplication", resolved, ["produceScreenshot"]);
      return screenshotApplication;
    } catch (error) {
      screenshotFactoryFailure = error;
      throw error;
    }
  }

  async function prepareContentPiece(contentPieceIdInput) {
    const contentPieceId = requiredId(contentPieceIdInput, "contentPieceId");
    const failures = [];
    const mediaBound = [];
    const mediaReused = [];
    const reviewed = [];
    const reviewReused = [];

    let generationResult;
    try {
      generationResult = await generation.generateReadyVariants(contentPieceId);
    } catch (error) {
      return Object.freeze({
        status: HOSTED_GP2_PREPARATION_STATUSES.RECOVERY_REQUIRED,
        contentPieceId,
        narrativeStrategyId: null,
        activeDestinationCount: 0,
        generatedCount: 0,
        generationReusedCount: 0,
        mediaBoundCount: 0,
        mediaReusedCount: 0,
        reviewedCount: 0,
        reviewReusedCount: 0,
        failures: Object.freeze([failureFromError(error, { stage: "generation" })]),
        nextRoute: "/plan",
      });
    }

    for (const item of Array.isArray(generationResult?.failed) ? generationResult.failed : []) {
      failures.push(boundedFailure({
        stage: "generation",
        code: item?.code || "platform_generation_failed",
        platformVariantId: item?.platformVariantId || null,
        destination: item?.destination || null,
      }));
    }

    let bundle = generationResult?.bundle || null;
    if (!bundle) {
      try {
        bundle = await generation.getGenerationBundle(contentPieceId);
      } catch (error) {
        failures.push(failureFromError(error, { stage: "generation_bundle" }));
      }
    }

    const contentPiece = bundle?.contentPiece || null;
    const narrativeStrategyId = contentPiece?.narrativeStrategyId ? requiredId(contentPiece.narrativeStrategyId, "narrativeStrategyId") : null;
    if (!contentPiece || !narrativeStrategyId) {
      failures.push(boundedFailure({ stage: "planning", code: "gp2_content_piece_contract_missing" }));
      return Object.freeze({
        status: HOSTED_GP2_PREPARATION_STATUSES.RECOVERY_REQUIRED,
        contentPieceId,
        narrativeStrategyId,
        activeDestinationCount: 0,
        generatedCount: Array.isArray(generationResult?.generated) ? generationResult.generated.length : 0,
        generationReusedCount: 0,
        mediaBoundCount: 0,
        mediaReusedCount: 0,
        reviewedCount: 0,
        reviewReusedCount: 0,
        failures: Object.freeze(failures),
        nextRoute: "/plan",
      });
    }

    let strategy = null;
    try {
      strategy = await plans.get(narrativeStrategyId);
    } catch (error) {
      failures.push(failureFromError(error, { stage: "planning" }));
    }
    if (!strategy || strategy.kind !== "NarrativeStrategy" || strategy.status !== "approved") {
      failures.push(boundedFailure({ stage: "planning", code: "strategy_approval_required" }));
      return Object.freeze({
        status: HOSTED_GP2_PREPARATION_STATUSES.RECOVERY_REQUIRED,
        contentPieceId,
        narrativeStrategyId,
        activeDestinationCount: 0,
        generatedCount: Array.isArray(generationResult?.generated) ? generationResult.generated.length : 0,
        generationReusedCount: 0,
        mediaBoundCount: 0,
        mediaReusedCount: 0,
        reviewedCount: 0,
        reviewReusedCount: 0,
        failures: Object.freeze(failures),
        nextRoute: "/plan",
      });
    }

    const entries = (Array.isArray(bundle?.variants) ? bundle.variants : [])
      .filter((entry) => entry?.variant && entry.variant.status !== "omitted");
    const activeDestinationCount = entries.length;
    const generatedCount = Array.isArray(generationResult?.generated) ? generationResult.generated.length : 0;
    const generationReusedCount = Math.max(0, entries.filter((entry) => Boolean(entry.currentRevision)).length - generatedCount);

    const requiredMedia = requiredNonTextMedia(strategy);
    const unsupported = requiredMedia.filter((item) => item.type !== "screenshot");
    if (unsupported.length) {
      failures.push(boundedFailure({ stage: "media", code: "unsupported_required_media" }));
      return Object.freeze({
        status: HOSTED_GP2_PREPARATION_STATUSES.RECOVERY_REQUIRED,
        contentPieceId,
        narrativeStrategyId,
        activeDestinationCount,
        generatedCount,
        generationReusedCount,
        mediaBoundCount: 0,
        mediaReusedCount: 0,
        reviewedCount: 0,
        reviewReusedCount: 0,
        failures: Object.freeze(failures),
        nextRoute: "/plan",
      });
    }
    const requiresScreenshot = requiredMedia.some((item) => item.type === "screenshot");

    for (const entry of entries) {
      const variant = entry.variant;
      let revision = entry.currentRevision || null;
      const context = {
        platformVariantId: variant.platformVariantId || null,
        platformVariantRevisionId: revision?.platformVariantRevisionId || null,
        destination: variant.destination || null,
      };

      if (!revision) {
        if (!failures.some((failure) => failure.platformVariantId === variant.platformVariantId && failure.stage === "generation")) {
          failures.push(boundedFailure({ ...context, stage: "generation", code: "missing_current_revision" }));
        }
        continue;
      }

      if (requiresScreenshot) {
        if (hasScreenshotBinding(revision)) {
          mediaReused.push(revision.platformVariantRevisionId);
        } else {
          let screenshotResult = null;
          try {
            const screenshotApplication = await getScreenshotApplication();
            screenshotResult = await screenshotApplication.produceScreenshot({
              platformVariantId: variant.platformVariantId,
              expectedCurrentRevisionId: revision.platformVariantRevisionId,
              aspectRatio: screenshotAspectRatio(variant.destination),
              role: "primary_visual",
            });
          } catch (error) {
            failures.push(failureFromError(error, { ...context, stage: "media" }));
            continue;
          }

          if (screenshotResult?.status !== "bound" || !screenshotResult.boundRevision) {
            failures.push(boundedFailure({
              ...context,
              stage: "media",
              code: screenshotResult?.status || "screenshot_binding_incomplete",
            }));
            continue;
          }
          revision = screenshotResult.boundRevision;
          mediaBound.push(revision.platformVariantRevisionId);
        }
      }

      const reviewResult = await reviews.reviewExactRevision(revision, { destination: variant.destination || null });
      if (reviewResult?.status === "reviewed") {
        reviewed.push(reviewResult.review?.platformVariantReviewId || revision.platformVariantRevisionId);
        continue;
      }
      if (reviewResult?.status === "already_reviewed") {
        reviewReused.push(reviewResult.review?.platformVariantReviewId || revision.platformVariantRevisionId);
        continue;
      }
      if (reviewResult?.status === "deferred_required_media") {
        failures.push(boundedFailure({
          stage: "review",
          code: reviewResult.reason || "required_media_pending",
          platformVariantId: variant.platformVariantId,
          platformVariantRevisionId: revision.platformVariantRevisionId,
          destination: variant.destination || null,
        }));
        continue;
      }
      failures.push(boundedFailure({
        stage: "review",
        code: reviewResult?.failure?.code || "platform_review_failed",
        platformVariantId: variant.platformVariantId,
        platformVariantRevisionId: revision.platformVariantRevisionId,
        destination: variant.destination || null,
      }));
    }

    const completedCount = reviewed.length + reviewReused.length;
    const status = statusFor({ failures, completedCount, activeCount: activeDestinationCount });
    return Object.freeze({
      status,
      contentPieceId,
      narrativeStrategyId,
      activeDestinationCount,
      generatedCount,
      generationReusedCount,
      mediaBoundCount: mediaBound.length,
      mediaReusedCount: mediaReused.length,
      reviewedCount: reviewed.length,
      reviewReusedCount: reviewReused.length,
      failures: Object.freeze(failures),
      nextRoute: completedCount > 0 ? "/today" : "/plan",
    });
  }

  return Object.freeze({ prepareContentPiece });
}

export { screenshotAspectRatio };
