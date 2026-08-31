import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createPlatformVariantApproval,
  createPlatformVariantReview,
} from "../lib/domain/platformVariantReviews.mjs";
import { createPostgresContentReviewRepository } from "../lib/infrastructure/postgresContentReviewAdapter.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NOW = "2026-08-31T04:15:00.000Z";

function review(overrides = {}) {
  return createPlatformVariantReview({
    platformVariantReviewId: "review-1",
    workspaceId: "workspace-1",
    platformVariantId: "variant-1",
    platformVariantRevisionId: "revision-1",
    contentPieceId: "piece-1",
    narrativeStrategyId: "strategy-1",
    sourceSignalId: "signal-1",
    identityContextSnapshotId: "identity-context-1",
    destination: "linkedin",
    strategyRevision: 1,
    boundaryPrecheck: { blocked: [], warnings: [] },
    evidence: { verdict: "pass", summary: "Evidence is grounded.", findings: [] },
    authenticity: { verdict: "pass", summary: "Voice is authentic.", findings: [] },
    evidenceProvenance: {
      taskId: "task-evidence-1",
      provider: "test",
      model: "test-model",
      routeKind: "remote",
      promptVersion: "evidence_critic_v1",
      reviewedAt: NOW,
    },
    authenticityProvenance: {
      taskId: "task-authenticity-1",
      provider: "test",
      model: "test-model",
      routeKind: "remote",
      promptVersion: "authenticity_critic_v1",
      reviewedAt: NOW,
    },
    createdAt: NOW,
    ...overrides,
  });
}

function approval(exactReview = review(), overrides = {}) {
  return createPlatformVariantApproval({
    platformVariantApprovalId: "approval-1",
    workspaceId: exactReview.workspaceId,
    platformVariantId: exactReview.platformVariantId,
    platformVariantRevisionId: exactReview.platformVariantRevisionId,
    platformVariantReviewId: exactReview.platformVariantReviewId,
    destination: exactReview.destination,
    decision: "approved",
    decidedBy: "owner",
    decidedAt: NOW,
    ...overrides,
  });
}

function row(record) {
  const isReview = record.kind === "PlatformVariantReview";
  return {
    record_id: isReview ? record.platformVariantReviewId : record.platformVariantApprovalId,
    workspace_id: record.workspaceId,
    record_kind: record.kind,
    platform_variant_id: record.platformVariantId,
    platform_variant_revision_id: record.platformVariantRevisionId,
    platform_variant_review_id: isReview ? null : record.platformVariantReviewId,
    destination: record.destination,
    status: isReview ? record.overallVerdict : record.decision,
    record,
    schema_version: record.schemaVersion,
    created_at: isReview ? record.createdAt : record.decidedAt,
    updated_at: isReview ? record.createdAt : record.decidedAt,
  };
}

function database(responses = []) {
  const calls = [];
  return {
    calls,
    async query(statement, params) {
      calls.push({ statement, params });
      const next = responses.shift();
      if (typeof next === "function") return next(statement, params);
      return { rows: next || [] };
    },
  };
}

test("hosted review repository scopes reads to one workspace", async () => {
  const stored = review();
  const db = database([[row(stored)]]);
  const repository = createPostgresContentReviewRepository({ database: db, workspaceId: "workspace-1" });

  const resolved = await repository.get(stored.platformVariantReviewId);

  assert.equal(resolved.platformVariantReviewId, stored.platformVariantReviewId);
  assert.match(db.calls[0].statement, /record_id = \$1 AND workspace_id = \$2/);
  assert.deepEqual(db.calls[0].params, [stored.platformVariantReviewId, "workspace-1"]);
});

test("hosted review and approval records are insert-only immutable judgments", async () => {
  const storedReview = review();
  const storedApproval = approval(storedReview);
  const db = database([
    [], [row(storedReview)],
    [], [row(storedApproval)],
  ]);
  const repository = createPostgresContentReviewRepository({ database: db, workspaceId: "workspace-1" });

  const savedReview = await repository.upsert(storedReview);
  const savedApproval = await repository.upsert(storedApproval);

  assert.equal(savedReview.overallVerdict, "pass");
  assert.equal(savedApproval.platformVariantReviewId, storedReview.platformVariantReviewId);
  assert.match(db.calls[1].statement, /ON CONFLICT \(record_id\) DO NOTHING/);
  assert.match(db.calls[3].statement, /ON CONFLICT \(record_id\) DO NOTHING/);
});

test("hosted review repository fails closed on cross-workspace writes", async () => {
  const repository = createPostgresContentReviewRepository({ database: database(), workspaceId: "workspace-1" });
  const foreign = review({ workspaceId: "workspace-2" });

  await assert.rejects(
    () => repository.upsert(foreign),
    (error) => error.code === "postgres_workspace_scope_mismatch",
  );
});

test("an existing review id cannot be silently rewritten", async () => {
  const stored = review();
  const changed = review({
    evidence: { verdict: "warn", summary: "Changed result", findings: [{ code: "changed", severity: "warning", message: "Changed" }] },
  });
  const db = database([[row(stored)]]);
  const repository = createPostgresContentReviewRepository({ database: db, workspaceId: "workspace-1" });

  await assert.rejects(
    () => repository.upsert(changed),
    (error) => error.code === "content_review_immutable_conflict",
  );
});

test("hosted review history cannot be removed through the repository", async () => {
  const repository = createPostgresContentReviewRepository({ database: database(), workspaceId: "workspace-1" });
  await assert.rejects(
    () => repository.remove("review-1"),
    (error) => error.code === "content_review_remove_forbidden",
  );
});

test("hosted review migration pins judgments to exact variant revisions", () => {
  const migration = fs.readFileSync(path.join(ROOT, "db", "migrations", "0007_hosted_platform_reviews.sql"), "utf8");
  assert.match(migration, /PlatformVariantReview/);
  assert.match(migration, /PlatformVariantApproval/);
  assert.match(migration, /platform_variant_revision_id text NOT NULL/);
  assert.match(migration, /sf_content_review_records_revision_fk/);
  assert.match(migration, /sf_content_review_records_review_fk/);
  assert.match(migration, /ON DELETE RESTRICT/);
});
