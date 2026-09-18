import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  inspectGp2Acceptance,
  __testables,
} from "../lib/server/gp2AcceptanceInspector.mjs";

const SHA = "1470d5c4643a12ad95ea30eaf48cf61f8a146cda";
const WORKSPACE = "owner-local";

function fullChainDatabase() {
  const queries = [];
  return {
    queries,
    async query(sql, params) {
      queries.push({ sql, params });
      if (sql.includes("FROM sf_content_signals")) {
        return { rows: [{
          signal_id: "signal-1",
          project_id: "project-1",
          source_connection_id: "connection-1",
          source_revision: SHA,
          status: "interpreted",
        }] };
      }
      if (sql.includes("FROM sf_durable_jobs") && sql.includes("opportunity_evaluation")) {
        return { rows: [{
          job_id: "job-opportunity-1",
          job_type: "opportunity_evaluation",
          resource_type: "ContentSignal",
          resource_id: "signal-1",
          status: "succeeded",
          attempt_count: 1,
        }] };
      }
      if (sql.includes("FROM sf_content_opportunities o")) {
        return { rows: [{
          opportunity_id: "opportunity-1",
          project_context_snapshot_id: "context-1",
          status: "selected",
          recommendation: "post",
          score: 92,
          repository_ref: { provider: "github", revision: SHA },
          source_artifact_count: 3,
        }] };
      }
      if (sql.includes("FROM sf_content_planning_records") && sql.includes("opportunity_id = $2")) {
        return { rows: [
          {
            record_id: "strategy-1",
            record_kind: "NarrativeStrategy",
            opportunity_id: "opportunity-1",
            narrative_strategy_id: null,
            content_piece_id: null,
            destination: null,
            status: "approved",
            record: {
              strategyRevision: 1,
              mediaRequirements: [{ type: "screenshot", required: true }],
            },
          },
          {
            record_id: "piece-1",
            record_kind: "ContentPiece",
            opportunity_id: "opportunity-1",
            narrative_strategy_id: "strategy-1",
            content_piece_id: null,
            destination: null,
            status: "planned",
            record: {},
          },
        ] };
      }
      if (sql.includes("FROM sf_content_planning_records") && sql.includes("narrative_strategy_id = ANY")) {
        return { rows: [
          {
            record_id: "variant-linkedin",
            record_kind: "PlatformVariant",
            narrative_strategy_id: "strategy-1",
            content_piece_id: "piece-1",
            destination: "linkedin",
            status: "review",
            record: { currentRevisionId: "revision-linkedin" },
          },
          {
            record_id: "variant-x",
            record_kind: "PlatformVariant",
            narrative_strategy_id: "strategy-1",
            content_piece_id: "piece-1",
            destination: "x",
            status: "review",
            record: { currentRevisionId: "revision-x" },
          },
          {
            record_id: "revision-linkedin",
            record_kind: "PlatformVariantRevision",
            narrative_strategy_id: "strategy-1",
            content_piece_id: "piece-1",
            destination: "linkedin",
            status: "review",
            record: {
              revisionNumber: 2,
              origin: "media_rebound",
              mediaBindings: [{
                assetId: "asset-proof",
                assetVersionId: "asset-version-proof",
                screenshotQualityReviewId: "quality-proof",
                imageDerivativePlanId: "plan-proof",
                imageDerivativeVariantId: "variant-proof-linkedin",
              }],
            },
          },
          {
            record_id: "revision-x",
            record_kind: "PlatformVariantRevision",
            narrative_strategy_id: "strategy-1",
            content_piece_id: "piece-1",
            destination: "x",
            status: "review",
            record: {
              revisionNumber: 2,
              origin: "media_rebound",
              mediaBindings: [{
                assetId: "asset-proof",
                assetVersionId: "asset-version-proof",
                screenshotQualityReviewId: "quality-proof",
                imageDerivativePlanId: "plan-proof",
                imageDerivativeVariantId: "variant-proof-x",
              }],
            },
          },
        ] };
      }
      if (sql.includes("FROM sf_media_records")) {
        return { rows: [
          { record_id: "asset-proof", record_kind: "Asset", status: "available", destination: null },
          { record_id: "quality-proof", record_kind: "ScreenshotQualityReview", status: "ready", destination: null },
          { record_id: "plan-proof", record_kind: "ImageDerivativePlan", status: "ready", destination: null },
        ] };
      }
      if (sql.includes("FROM sf_durable_jobs") && sql.includes("capture_screenshot")) {
        return { rows: [
          { job_id: "capture-job-li", status: "succeeded", attempt_count: 1, resource_id: "capture-record-li" },
          { job_id: "capture-job-x", status: "succeeded", attempt_count: 1, resource_id: "capture-record-x" },
        ] };
      }
      if (sql.includes("FROM sf_capture_jobs")) {
        return { rows: [
          { capture_job_id: "capture-record-li", durable_job_id: "capture-job-li", capture_recipe_id: "recipe-1", capture_recipe_version: 1, status: "succeeded" },
          { capture_job_id: "capture-record-x", durable_job_id: "capture-job-x", capture_recipe_id: "recipe-1", capture_recipe_version: 1, status: "succeeded" },
        ] };
      }
      if (sql.includes("FROM sf_content_review_records")) {
        return { rows: [
          { record_id: "review-li", record_kind: "PlatformVariantReview", platform_variant_revision_id: "revision-linkedin", destination: "linkedin", status: "pass" },
          { record_id: "approval-li", record_kind: "PlatformVariantApproval", platform_variant_revision_id: "revision-linkedin", destination: "linkedin", status: "approved" },
          { record_id: "review-x", record_kind: "PlatformVariantReview", platform_variant_revision_id: "revision-x", destination: "x", status: "pass" },
          { record_id: "approval-x", record_kind: "PlatformVariantApproval", platform_variant_revision_id: "revision-x", destination: "x", status: "approved" },
        ] };
      }
      throw new Error(`Unexpected inspector query: ${sql}`);
    },
  };
}

test("GP2 inspector traces one exact Git revision through signal, planning, media, review, and approval without writes", async () => {
  const database = fullChainDatabase();
  const inspection = await inspectGp2Acceptance({
    database,
    workspaceId: WORKSPACE,
    sourceRevision: SHA,
  });

  assert.equal(inspection.sourceRevision, SHA);
  assert.equal(inspection.stoppedAt, null);
  assert.deepEqual(inspection.stages.map((item) => [item.id, item.status]), [
    ["signal", "ready"],
    ["opportunity_job", "ready"],
    ["opportunity", "ready"],
    ["exact_context", "ready"],
    ["planning", "ready"],
    ["media", "ready"],
    ["review", "ready"],
    ["approval", "ready"],
  ]);
  assert.equal(inspection.context.repositoryRevision, SHA);
  assert.equal(inspection.context.sourceArtifactCount, 3);
  assert.deepEqual(
    inspection.planning.filter((item) => item.kind === "PlatformVariantRevision").map((item) => item.mediaBindingCount),
    [1, 1],
  );
  assert.equal(inspection.media.captureJobs.length, 2);
  assert.equal(inspection.reviews.filter((item) => item.kind === "PlatformVariantApproval").length, 2);
  assert.ok(database.queries.length >= 8);
  assert.equal(database.queries.every(({ sql }) => /^\s*SELECT\b/i.test(sql)), true, "inspector must remain read-only");
});

test("GP2 inspector rejects non-exact revision identifiers", async () => {
  await assert.rejects(
    () => inspectGp2Acceptance({
      database: { query: async () => ({ rows: [] }) },
      workspaceId: WORKSPACE,
      sourceRevision: "master",
    }),
    (error) => error?.code === "gp2_inspector_revision_invalid" && error?.status === 400,
  );
  assert.throws(() => __testables.requiredSourceRevision("abc123"), /exact Git commit SHA/);
});

test("GP2 inspector fails closed when one revision maps to more than one canonical signal", async () => {
  let calls = 0;
  const database = {
    async query(sql) {
      calls += 1;
      assert.match(sql, /FROM sf_content_signals/);
      return { rows: [
        { signal_id: "signal-a", source_revision: SHA, status: "new" },
        { signal_id: "signal-b", source_revision: SHA, status: "new" },
      ] };
    },
  };
  const inspection = await inspectGp2Acceptance({ database, workspaceId: WORKSPACE, sourceRevision: SHA });
  assert.equal(calls, 1);
  assert.equal(inspection.stoppedAt, "signal");
  assert.equal(inspection.stages[0].status, "blocked");
  assert.equal(inspection.stages[0].reason, "ambiguous_source_revision");
});

test("owner GP2 inspector route is GET-only, no-store, revision-scoped, and does not expose mutating actions", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const route = fs.readFileSync(path.join(here, "../app/api/gp2/inspect/route.js"), "utf8");
  assert.match(route, /requireOwnerAccess/);
  assert.match(route, /source_revision/);
  assert.match(route, /inspectGp2Acceptance/);
  assert.match(route, /cache-control": "private, no-store, max-age=0"/);
  assert.doesNotMatch(route, /export async function (POST|PATCH|PUT|DELETE)/);
});
