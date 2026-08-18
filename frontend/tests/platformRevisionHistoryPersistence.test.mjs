import test from "node:test";
import assert from "node:assert/strict";

import {
  createPlatformVariantRevision,
  createEditedPlatformVariantRevision,
  createRestoredPlatformVariantRevision,
} from "../lib/domain/platformVariantRevisions.mjs";
import {
  createPlatformVariantApproval,
  createPlatformVariantReview,
} from "../lib/domain/platformVariantReviews.mjs";
import {
  createBrowserContentPlanningRepository,
  createStoreBackedContentPlanningRepository,
} from "../lib/infrastructure/contentPlanningAdapters.mjs";
import {
  createBrowserContentReviewRepository,
  createStoreBackedContentReviewRepository,
} from "../lib/infrastructure/contentReviewAdapters.mjs";

const NOW = "2026-08-18T16:25:00.000Z";

function records() {
  const first = createPlatformVariantRevision({
    platformVariantRevisionId: "revision-persist-1",
    workspaceId: "local-personal",
    platformVariantId: "variant-persist",
    contentPieceId: "piece-persist",
    narrativeStrategyId: "strategy-persist",
    destination: "linkedin",
    revisionNumber: 1,
    strategyRevision: 1,
    output: { format: "single_post", content: "The first exact revision.", segments: [] },
    inputFingerprint: "persist-1",
    identityContextSnapshotId: "snapshot-persist",
    generationProvenance: {
      taskId: "task-persist-1",
      provider: "test",
      model: "writer",
      routeKind: "remote",
      promptVersion: "platform_variant_v1",
      generatedAt: NOW,
    },
    createdAt: NOW,
  });
  const second = createEditedPlatformVariantRevision({
    platformVariantRevisionId: "revision-persist-2",
    parentRevision: first,
    revisionNumber: 2,
    content: "The second exact owner revision.",
    editedBy: "owner",
    createdAt: "2026-08-18T16:26:00.000Z",
  });
  const restored = createRestoredPlatformVariantRevision({
    platformVariantRevisionId: "revision-persist-3",
    currentRevision: second,
    sourceRevision: first,
    revisionNumber: 3,
    restoredBy: "owner",
    createdAt: "2026-08-18T16:27:00.000Z",
  });
  const review = createPlatformVariantReview({
    platformVariantReviewId: "review-persist-1",
    workspaceId: "local-personal",
    platformVariantId: "variant-persist",
    platformVariantRevisionId: first.platformVariantRevisionId,
    contentPieceId: "piece-persist",
    narrativeStrategyId: "strategy-persist",
    sourceSignalId: "signal-persist",
    identityContextSnapshotId: "snapshot-persist",
    destination: "linkedin",
    strategyRevision: 1,
    boundaryPrecheck: { blocked: [], warnings: [] },
    evidence: { verdict: "pass", summary: "Evidence matches.", findings: [] },
    authenticity: { verdict: "pass", summary: "Voice matches.", findings: [] },
    evidenceProvenance: {
      taskId: "task-evidence-persist",
      provider: "test",
      model: "critic",
      routeKind: "remote",
      promptVersion: "evidence_critic_v1",
      reviewedAt: "2026-08-18T16:28:00.000Z",
    },
    authenticityProvenance: {
      taskId: "task-auth-persist",
      provider: "test",
      model: "critic",
      routeKind: "remote",
      promptVersion: "authenticity_critic_v1",
      reviewedAt: "2026-08-18T16:28:00.000Z",
    },
    createdAt: "2026-08-18T16:28:00.000Z",
  });
  const approval = createPlatformVariantApproval({
    platformVariantApprovalId: "approval-persist-1",
    workspaceId: "local-personal",
    platformVariantId: "variant-persist",
    platformVariantRevisionId: first.platformVariantRevisionId,
    platformVariantReviewId: review.platformVariantReviewId,
    destination: "linkedin",
    decision: "approved",
    note: "Exact historical approval.",
    decidedBy: "owner",
    decidedAt: "2026-08-18T16:29:00.000Z",
  });
  return { first, second, restored, review, approval };
}

function browserStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, value); },
  };
}

function store() {
  const values = new Map();
  return {
    async list(prefix) { return [...values.keys()].filter((key) => key.startsWith(prefix)); },
    async get(key) { return values.has(key) ? values.get(key) : null; },
    async set(key, value) { values.set(key, structuredClone(value)); },
    async remove(key) { return values.delete(key); },
  };
}

async function persistAndAssert(planning, reviews, expected) {
  for (const revision of [expected.first, expected.second, expected.restored]) await planning.upsert(revision);
  await reviews.upsert(expected.review);
  await reviews.upsert(expected.approval);

  const planningRecords = await planning.list();
  const reviewRecords = await reviews.list();
  const restored = planningRecords.find((item) => item.platformVariantRevisionId === expected.restored.platformVariantRevisionId);
  const historicalApproval = reviewRecords.find((item) => item.platformVariantApprovalId === expected.approval.platformVariantApprovalId);
  const historicalReview = reviewRecords.find((item) => item.platformVariantReviewId === expected.review.platformVariantReviewId);

  assert.equal(planningRecords.filter((item) => item.kind === "PlatformVariantRevision").length, 3);
  assert.equal(restored.parentRevisionId, expected.second.platformVariantRevisionId);
  assert.equal(restored.editProvenance.restoredFromRevisionId, expected.first.platformVariantRevisionId);
  assert.equal(historicalReview.platformVariantRevisionId, expected.first.platformVariantRevisionId);
  assert.equal(historicalApproval.platformVariantRevisionId, expected.first.platformVariantRevisionId);
  assert.equal(historicalApproval.platformVariantReviewId, expected.review.platformVariantReviewId);
}

test("browser reopen preserves immutable revision lineage plus exact historical review and approval state", async () => {
  const expected = records();
  const storage = browserStorage();
  const getStorage = () => storage;
  const planningKey = "history-planning-reopen";
  const reviewKey = "history-review-reopen";

  const firstPlanning = createBrowserContentPlanningRepository({ getStorage, key: planningKey });
  const firstReviews = createBrowserContentReviewRepository({ getStorage, key: reviewKey });
  for (const revision of [expected.first, expected.second, expected.restored]) await firstPlanning.upsert(revision);
  await firstReviews.upsert(expected.review);
  await firstReviews.upsert(expected.approval);

  const reopenedPlanning = createBrowserContentPlanningRepository({ getStorage, key: planningKey });
  const reopenedReviews = createBrowserContentReviewRepository({ getStorage, key: reviewKey });
  await persistAndAssert(reopenedPlanning, reopenedReviews, expected);
});

test("store-backed persistence preserves the same immutable revision and judgment contract for future hosted adapters", async () => {
  const expected = records();
  const backingStore = store();
  const planning = createStoreBackedContentPlanningRepository({ store: backingStore, prefix: "history-plan/" });
  const reviews = createStoreBackedContentReviewRepository({ store: backingStore, prefix: "history-review/" });

  await persistAndAssert(planning, reviews, expected);

  const reopenedPlanning = createStoreBackedContentPlanningRepository({ store: backingStore, prefix: "history-plan/" });
  const reopenedReviews = createStoreBackedContentReviewRepository({ store: backingStore, prefix: "history-review/" });
  await persistAndAssert(reopenedPlanning, reopenedReviews, expected);
});
