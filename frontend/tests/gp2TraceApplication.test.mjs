import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createGp2TraceApplication } from "../lib/application/gp2TraceApplication.mjs";

const REVISION = "abcdef1234567890abcdef1234567890abcdef12";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function listPort(items) {
  return { async list() { return items; } };
}

function fixture(overrides = {}) {
  const signal = {
    signalId: "signal-1",
    sourceRevision: REVISION,
    projectId: "project-1",
    status: "interpreted",
    signalKind: "shipping",
  };
  const context = {
    projectContextSnapshotId: "context-1",
    projectId: "project-1",
    repositoryRef: { revision: REVISION },
    sourceArtifactIds: ["artifact-1", "artifact-2"],
  };
  const opportunity = {
    opportunityId: "opportunity-1",
    signalIds: ["signal-1"],
    projectContextSnapshotId: "context-1",
    recommendation: "post",
    score: 92,
    selectedAngleId: "angle-1",
    status: "selected",
  };
  const strategy = {
    kind: "NarrativeStrategy",
    narrativeStrategyId: "strategy-1",
    opportunityId: "opportunity-1",
    status: "approved",
  };
  const piece = {
    kind: "ContentPiece",
    contentPieceId: "piece-1",
    opportunityId: "opportunity-1",
    narrativeStrategyId: "strategy-1",
    status: "active",
  };
  const variant = {
    kind: "PlatformVariant",
    platformVariantId: "variant-1",
    contentPieceId: "piece-1",
    narrativeStrategyId: "strategy-1",
    destination: "linkedin",
    status: "active",
  };
  const revision = {
    kind: "PlatformVariantRevision",
    platformVariantRevisionId: "revision-1",
    platformVariantId: "variant-1",
    contentPieceId: "piece-1",
    narrativeStrategyId: "strategy-1",
    destination: "linkedin",
    mediaBindings: [{ assetId: "asset-1", assetVersionId: "asset-version-1" }],
  };
  const review = {
    kind: "PlatformVariantReview",
    platformVariantReviewId: "review-1",
    platformVariantId: "variant-1",
    platformVariantRevisionId: "revision-1",
    destination: "linkedin",
    overallVerdict: "ready",
  };
  const capture = {
    captureJobId: "capture-1",
    status: "succeeded",
    outputAssetIds: ["asset-1"],
  };

  return createGp2TraceApplication({
    contentSignalRepository: listPort(overrides.signals ?? [signal]),
    durableJobRepository: listPort(overrides.jobs ?? [{
      jobId: "job-1",
      jobType: "signal_opportunity",
      resourceId: "signal-1",
      status: "succeeded",
      attemptCount: 1,
    }]),
    projectContextRepository: {
      async get(id) { return id === "context-1" ? (overrides.context === undefined ? context : overrides.context) : null; },
    },
    contentOpportunityRepository: listPort(overrides.opportunities ?? [opportunity]),
    contentPlanningRepository: listPort(overrides.planning ?? [strategy, piece, variant, revision]),
    contentReviewRepository: listPort(overrides.reviews ?? [review]),
    captureRepository: {
      async listJobs() { return overrides.captureJobs ?? [capture]; },
    },
  });
}

test("exact source revision traces the complete GP2 durable chain without exposing content bodies", async () => {
  const result = await fixture().traceSourceRevision(REVISION);

  assert.equal(result.complete, true);
  assert.equal(result.stoppedAt, "complete");
  assert.deepEqual(result.counts, {
    signals: 1,
    jobs: 1,
    opportunities: 1,
    strategies: 1,
    contentPieces: 1,
    variants: 1,
    revisions: 1,
    reviews: 1,
    captureJobs: 1,
  });
  assert.equal(result.projectContext.revision, REVISION);
  assert.equal(result.opportunity.selectedAngleId, "angle-1");
  assert.equal(result.revisions[0].mediaBindingCount, 1);
  assert.equal(result.captureJobs[0].outputAssetCount, 1);
  assert.equal(JSON.stringify(result).includes("raw private"), false);
});

test("trace reports the first missing stage instead of inventing downstream acceptance", async () => {
  const noOpportunity = await fixture({ opportunities: [], context: null, planning: [], reviews: [], captureJobs: [] })
    .traceSourceRevision(REVISION);
  assert.equal(noOpportunity.complete, false);
  assert.equal(noOpportunity.stoppedAt, "project_context");

  const awaitingAngle = await fixture({
    opportunities: [{
      opportunityId: "opportunity-1",
      signalIds: ["signal-1"],
      projectContextSnapshotId: "context-1",
      recommendation: "post",
      score: 88,
      selectedAngleId: null,
      status: "proposed",
    }],
    planning: [],
    reviews: [],
    captureJobs: [],
  }).traceSourceRevision(REVISION);
  assert.equal(awaitingAngle.stoppedAt, "owner_angle");
});

test("duplicate canonical signals for one exact revision are surfaced as an integrity problem", async () => {
  const result = await fixture({
    signals: [
      { signalId: "signal-1", sourceRevision: REVISION, projectId: "project-1", status: "new" },
      { signalId: "signal-2", sourceRevision: REVISION, projectId: "project-1", status: "new" },
    ],
    opportunities: [],
    planning: [],
    reviews: [],
    captureJobs: [],
  }).traceSourceRevision(REVISION);

  assert.equal(result.stoppedAt, "duplicate_signal");
  assert.equal(result.counts.signals, 2);
});

test("GP2 trace route is owner-only, no-store, read-only, and revision-scoped", () => {
  const source = fs.readFileSync(path.join(ROOT, "app/api/gp2/trace/route.js"), "utf8");
  assert.match(source, /requireOwnerAccess/);
  assert.match(source, /private, no-store/);
  assert.match(source, /searchParams\.get\("revision"\)/);
  assert.match(source, /traceSourceRevision/);
  assert.doesNotMatch(source, /\.upsert\(|\.remove\(|claimNext|claimById|retry|recover/);
});
