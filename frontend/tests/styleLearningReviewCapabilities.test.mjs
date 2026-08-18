import test from "node:test";
import assert from "node:assert/strict";

import { withStyleLearningReview } from "../lib/application/styleLearningDecorators.mjs";

function coreReviewApplication() {
  return {
    async reviewCurrentVariant() {},
    async editCurrentVariant() {},
    async approveCurrentVariant() { return { decision: "approved" }; },
    async rejectCurrentVariant() { return { decision: "rejected" }; },
    async getReviewBundle() { return { revision: null }; },
  };
}

function dependencies() {
  return {
    contentPlanningRepository: { async get() { return null; } },
    styleMemoryApplication: {
      async recordApprovedRevision() {},
      async recordRejection() {},
    },
  };
}

test("StyleMemory decoration keeps the established current-revision review contract valid", () => {
  const decorated = withStyleLearningReview({ reviewApplication: coreReviewApplication(), ...dependencies() });

  assert.equal(typeof decorated.reviewCurrentVariant, "function");
  assert.equal(typeof decorated.approveCurrentVariant, "function");
  assert.equal(typeof decorated.getRevisionHistory, "undefined");
});

test("a partial historical review capability fails explicitly instead of creating a half-working product surface", () => {
  const partial = {
    ...coreReviewApplication(),
    async reviewRevision() {},
  };

  assert.throws(
    () => withStyleLearningReview({ reviewApplication: partial, ...dependencies() }),
    /historical revision capability must be complete/i,
  );
});

test("a complete historical review capability is preserved through StyleMemory decoration", () => {
  const complete = {
    ...coreReviewApplication(),
    async reviewRevision() {},
    async approveRevision() { return { decision: "approved" }; },
    async rejectRevision() { return { decision: "rejected" }; },
    async restoreRevision() {},
    async getReviewBundleForRevision() { return { revision: null }; },
    async getRevisionHistory() { return []; },
  };

  const decorated = withStyleLearningReview({ reviewApplication: complete, ...dependencies() });
  for (const name of ["reviewRevision", "approveRevision", "rejectRevision", "restoreRevision", "getReviewBundleForRevision", "getRevisionHistory"]) {
    assert.equal(typeof decorated[name], "function", `${name} should remain available`);
  }
});
