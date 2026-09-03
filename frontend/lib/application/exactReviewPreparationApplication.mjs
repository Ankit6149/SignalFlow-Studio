function requiredService(name, value, methods = []) {
  if (!value || typeof value !== "object") throw new TypeError(`${name} is required.`);
  for (const method of methods) {
    if (typeof value[method] !== "function") throw new TypeError(`${name}.${method}() is required.`);
  }
  return value;
}

function revisionIdentity(revision) {
  const platformVariantId = String(revision?.platformVariantId || "").trim();
  const platformVariantRevisionId = String(revision?.platformVariantRevisionId || "").trim();
  if (!platformVariantId || !platformVariantRevisionId) {
    throw new TypeError("Automatic exact review requires a persisted PlatformVariantRevision identity.");
  }
  return { platformVariantId, platformVariantRevisionId };
}

function safeFailure(error, identity, destination = null) {
  return Object.freeze({
    platformVariantId: identity?.platformVariantId || null,
    platformVariantRevisionId: identity?.platformVariantRevisionId || null,
    destination: destination ? String(destination) : null,
    code: String(error?.code || "platform_review_failed"),
  });
}

function result(status, { review = null, failure = null, reason = null } = {}) {
  return Object.freeze({ status, review, failure, reason });
}

function requiresBoundMedia(strategy) {
  return Boolean((strategy?.mediaRequirements || []).some((item) => {
    const type = String(item?.type || "").trim().toLowerCase();
    return item?.required === true && !["", "none", "text_only"].includes(type);
  }));
}

export function createExactReviewPreparationApplication({
  contentPlanningRepository,
  generationApplication,
  reviewApplication,
} = {}) {
  const plans = requiredService("contentPlanningRepository", contentPlanningRepository, ["get"]);
  const generation = requiredService("generationApplication", generationApplication, ["getGenerationBundle"]);
  const reviews = requiredService("reviewApplication", reviewApplication, ["getReviewBundle", "reviewRevision"]);

  async function requiredMediaPending(revision) {
    if (Array.isArray(revision?.mediaBindings) && revision.mediaBindings.length) return false;
    const strategyId = String(revision?.narrativeStrategyId || "").trim();
    if (!strategyId) return false;
    const strategy = await plans.get(strategyId);
    if (!strategy || strategy.kind !== "NarrativeStrategy") return false;
    return requiresBoundMedia(strategy);
  }

  async function reviewExactRevision(revision, { destination = null, refresh = false } = {}) {
    let identity = null;
    try {
      identity = revisionIdentity(revision);
      if (await requiredMediaPending(revision)) {
        return result("deferred_required_media", { reason: "required_media_pending" });
      }

      if (!refresh) {
        const existing = await reviews.getReviewBundle(identity.platformVariantId);
        const alreadyReviewed = Boolean(
          existing?.review
          && existing?.revision?.platformVariantRevisionId === identity.platformVariantRevisionId
          && existing?.isCurrent
          && existing?.planningCurrent,
        );
        if (alreadyReviewed) {
          return result("already_reviewed", { review: existing.review, reason: "current_exact_review_exists" });
        }
      }

      const review = await reviews.reviewRevision(
        identity.platformVariantId,
        identity.platformVariantRevisionId,
        {
          expectedCurrentRevisionId: identity.platformVariantRevisionId,
          refresh: refresh === true,
        },
      );
      return result("reviewed", { review });
    } catch (error) {
      return result("review_failed", {
        failure: safeFailure(error, identity, destination),
      });
    }
  }

  async function ensureContentPieceReviewed(contentPieceId) {
    const reviewed = [];
    const skipped = [];
    const failed = [];
    let bundle = null;

    try {
      bundle = await generation.getGenerationBundle(contentPieceId);
    } catch (error) {
      failed.push(safeFailure(error, null));
      return Object.freeze({
        reviewed: Object.freeze(reviewed),
        skipped: Object.freeze(skipped),
        failed: Object.freeze(failed),
      });
    }

    for (const entry of bundle?.variants || []) {
      const variant = entry?.variant;
      const revision = entry?.currentRevision;
      if (!variant || variant.status === "omitted" || !revision) continue;
      const identity = revisionIdentity(revision);
      const reviewResult = await reviewExactRevision(revision, { destination: variant.destination });

      if (reviewResult.status === "reviewed") {
        reviewed.push(reviewResult.review);
        continue;
      }
      if (reviewResult.status === "already_reviewed" || reviewResult.status === "deferred_required_media") {
        skipped.push(Object.freeze({
          platformVariantId: identity.platformVariantId,
          platformVariantRevisionId: identity.platformVariantRevisionId,
          destination: variant.destination || null,
          reason: reviewResult.reason,
        }));
        continue;
      }
      if (reviewResult.failure) failed.push(reviewResult.failure);
    }

    return Object.freeze({
      reviewed: Object.freeze(reviewed),
      skipped: Object.freeze(skipped),
      failed: Object.freeze(failed),
    });
  }

  return Object.freeze({
    reviewExactRevision,
    ensureContentPieceReviewed,
  });
}
