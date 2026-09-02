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
    platformVariantId: identity.platformVariantId,
    platformVariantRevisionId: identity.platformVariantRevisionId,
    destination: destination ? String(destination) : null,
    code: String(error?.code || "platform_review_failed"),
  });
}

export function createExactReviewPreparationApplication({
  generationApplication,
  reviewApplication,
} = {}) {
  const generation = requiredService("generationApplication", generationApplication, ["getGenerationBundle"]);
  const reviews = requiredService("reviewApplication", reviewApplication, ["getReviewBundle", "reviewRevision"]);

  async function reviewExactRevision(revision, { destination = null, refresh = false } = {}) {
    const identity = revisionIdentity(revision);
    try {
      const review = await reviews.reviewRevision(
        identity.platformVariantId,
        identity.platformVariantRevisionId,
        {
          expectedCurrentRevisionId: identity.platformVariantRevisionId,
          refresh: refresh === true,
        },
      );
      return Object.freeze({ status: "reviewed", review, failure: null });
    } catch (error) {
      return Object.freeze({
        status: "review_failed",
        review: null,
        failure: safeFailure(error, identity, destination),
      });
    }
  }

  async function ensureContentPieceReviewed(contentPieceId) {
    const bundle = await generation.getGenerationBundle(contentPieceId);
    const reviewed = [];
    const skipped = [];
    const failed = [];

    for (const entry of bundle?.variants || []) {
      const variant = entry?.variant;
      const revision = entry?.currentRevision;
      if (!variant || variant.status === "omitted" || !revision) continue;
      const identity = revisionIdentity(revision);
      try {
        const existing = await reviews.getReviewBundle(identity.platformVariantId);
        const alreadyReviewed = Boolean(
          existing?.review
          && existing?.revision?.platformVariantRevisionId === identity.platformVariantRevisionId
          && existing?.isCurrent
          && existing?.planningCurrent,
        );
        if (alreadyReviewed) {
          skipped.push(Object.freeze({
            platformVariantId: identity.platformVariantId,
            platformVariantRevisionId: identity.platformVariantRevisionId,
            destination: variant.destination || null,
            reason: "current_exact_review_exists",
          }));
          continue;
        }
      } catch (error) {
        failed.push(safeFailure(error, identity, variant.destination));
        continue;
      }

      const result = await reviewExactRevision(revision, { destination: variant.destination });
      if (result.review) reviewed.push(result.review);
      if (result.failure) failed.push(result.failure);
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
