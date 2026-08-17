import test from "node:test";
import assert from "node:assert/strict";
import {
  createEditedPlatformVariantRevision,
  createPlatformVariantRevision,
} from "../lib/domain/platformVariantRevisions.mjs";
import {
  APPROVAL_DECISIONS,
  createPlatformVariantApproval,
  createPlatformVariantReview,
  reviewAllowsApproval,
} from "../lib/domain/platformVariantReviews.mjs";
import {
  createBrowserContentReviewRepository,
  createMemoryContentReviewRepository,
} from "../lib/infrastructure/contentReviewAdapters.mjs";

const NOW = "2026-08-17T14:00:00.000Z";

function generatedRevision() {
  return createPlatformVariantRevision({
    platformVariantRevisionId: "revision-generated-1",
    workspaceId: "local-personal",
    platformVariantId: "variant-linkedin",
    contentPieceId: "piece-1",
    narrativeStrategyId: "strategy-1",
    destination: "linkedin",
    revisionNumber: 1,
    strategyRevision: 2,
    output: { format: "single_post", content: "Privacy became a real boundary when routing code started enforcing it.", segments: [] },
    inputFingerprint: "sf-cache-v1-abc",
    identityContextSnapshotId: "snapshot-linkedin",
    generationProvenance: { taskId: "task-write", provider: "test", model: "model-a", routeKind: "remote", promptVersion: "platform_variant_v1", generatedAt: NOW },
    createdAt: NOW,
  });
}

function criticProvenance(taskId) {
  return { taskId, provider: "test", model: "critic-model", routeKind: "remote", promptVersion: "critic_v1", reviewedAt: NOW };
}

function review(overrides = {}) {
  return createPlatformVariantReview({
    platformVariantReviewId: "review-1",
    workspaceId: "local-personal",
    platformVariantId: "variant-linkedin",
    platformVariantRevisionId: "revision-generated-1",
    contentPieceId: "piece-1",
    narrativeStrategyId: "strategy-1",
    sourceSignalId: "signal-1",
    identityContextSnapshotId: "snapshot-linkedin",
    destination: "linkedin",
    strategyRevision: 2,
    boundaryPrecheck: { blocked: [], warnings: [] },
    evidence: { verdict: "pass", summary: "Claims are supported by supplied evidence.", findings: [] },
    authenticity: { verdict: "warn", summary: "One phrase sounds more promotional than the saved Voice.", findings: [{ code: "promotional_phrase", severity: "warning", message: "The opening sounds more promotional than the saved Voice.", suggestion: "State the architecture observation directly." }] },
    evidenceProvenance: criticProvenance("task-evidence"),
    authenticityProvenance: criticProvenance("task-auth"),
    createdAt: NOW,
    ...overrides,
  });
}

test("user edit creates an immutable child revision without mutating generated provenance", () => {
  const parent = generatedRevision();
  const edited = createEditedPlatformVariantRevision({
    platformVariantRevisionId: "revision-edited-2",
    parentRevision: parent,
    revisionNumber: 2,
    content: "Privacy became a real boundary only when the routing layer enforced it.",
    editedBy: "owner",
    createdAt: NOW,
  });
  assert.equal(parent.origin, "generated");
  assert.equal(parent.content, "Privacy became a real boundary when routing code started enforcing it.");
  assert.equal(edited.origin, "edited");
  assert.equal(edited.parentRevisionId, parent.platformVariantRevisionId);
  assert.equal(edited.generationProvenance, null);
  assert.equal(edited.editProvenance.editedBy, "owner");
  assert.equal(edited.identityContextSnapshotId, parent.identityContextSnapshotId);
  assert.equal(edited.strategyRevision, parent.strategyRevision);
});

test("review verdict escalates to the strongest concise finding and blocks exact approval when required", () => {
  const warning = review();
  assert.equal(warning.overallVerdict, "warn");
  assert.equal(reviewAllowsApproval(warning), true);

  const blocked = review({
    platformVariantReviewId: "review-blocked",
    boundaryPrecheck: { blocked: [{ code: "explicit_boundary", message: "This exact phrase is explicitly blocked." }], warnings: [] },
  });
  assert.equal(blocked.overallVerdict, "block");
  assert.equal(reviewAllowsApproval(blocked), false);
});

test("approval pins one exact revision and requires its exact review", () => {
  const currentReview = review();
  const approval = createPlatformVariantApproval({
    platformVariantApprovalId: "approval-1",
    workspaceId: "local-personal",
    platformVariantId: "variant-linkedin",
    platformVariantRevisionId: currentReview.platformVariantRevisionId,
    platformVariantReviewId: currentReview.platformVariantReviewId,
    destination: "linkedin",
    decision: APPROVAL_DECISIONS.APPROVED,
    decidedBy: "owner",
    decidedAt: NOW,
  });
  assert.equal(approval.platformVariantRevisionId, "revision-generated-1");
  assert.equal(approval.platformVariantReviewId, "review-1");
  assert.throws(() => createPlatformVariantApproval({ ...approval, platformVariantApprovalId: "approval-invalid", platformVariantReviewId: null }), /requires the exact PlatformVariantReview/i);
});

test("review repository preserves review and approval as independent immutable records across browser reopen", async () => {
  const backing = new Map();
  const localStorage = {
    getItem(key) { return backing.has(key) ? backing.get(key) : null; },
    setItem(key, value) { backing.set(key, value); },
  };
  const first = createBrowserContentReviewRepository({ getStorage: () => localStorage });
  const currentReview = await first.upsert(review());
  await first.upsert(createPlatformVariantApproval({
    platformVariantApprovalId: "approval-browser",
    workspaceId: "local-personal",
    platformVariantId: "variant-linkedin",
    platformVariantRevisionId: currentReview.platformVariantRevisionId,
    platformVariantReviewId: currentReview.platformVariantReviewId,
    destination: "linkedin",
    decision: "approved",
    decidedBy: "owner",
    decidedAt: NOW,
  }));

  const reopened = createBrowserContentReviewRepository({ getStorage: () => localStorage });
  assert.equal((await reopened.get("review-1")).overallVerdict, "warn");
  assert.equal((await reopened.get("approval-browser")).platformVariantRevisionId, "revision-generated-1");
  assert.equal((await reopened.list()).length, 2);
});

test("memory review repository rejects unsupported review records", async () => {
  const repository = createMemoryContentReviewRepository();
  await assert.rejects(() => repository.upsert({ kind: "Approval", approvalId: "legacy", status: "approved" }), /Unsupported content review record/);
});
