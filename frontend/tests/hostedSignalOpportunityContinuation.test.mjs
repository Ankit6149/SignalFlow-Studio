import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createGithubSignalOpportunityDispatchApplication } from "../lib/application/githubSignalOpportunityDispatchApplication.mjs";
import { createSignalOpportunityWorkerApplication } from "../lib/application/signalOpportunityWorkerApplication.mjs";
import { createContentOpportunity } from "../lib/domain/contentOpportunities.mjs";
import { createPostgresContentOpportunityRepository, opportunityFromRow } from "../lib/infrastructure/postgresContentOpportunityAdapter.mjs";

const NOW = "2026-08-21T16:30:00.000Z";

function fixedClock() {
  return { now: () => NOW };
}

function opportunity(overrides = {}) {
  return createContentOpportunity({
    opportunityId: overrides.opportunityId || "opportunity-1",
    workspaceId: overrides.workspaceId || "workspace-1",
    projectId: "project-1",
    projectContextSnapshotId: "project-context-1",
    signalIds: ["signal-1"],
    inputFingerprint: "fnv1a:12345678",
    evaluation: {
      recommendation: "hold",
      title: "Worth reviewing",
      summary: "A bounded hosted opportunity.",
      whyNow: "A verified work event arrived.",
      score: 61,
      confidence: 0.7,
    },
    evaluationProvenance: {
      taskId: "task-1",
      taskType: "opportunity_evaluation",
      provider: "deterministic",
      model: "fixture",
      routeKind: "local",
      evaluatedAt: NOW,
    },
    createdAt: NOW,
  });
}

function rowFromOpportunity(record) {
  return {
    opportunity_id: record.opportunityId,
    workspace_id: record.workspaceId,
    input_fingerprint: record.inputFingerprint,
    record: JSON.stringify(record),
  };
}

test("hosted continuation migration keeps canonical Opportunity and retry work in Neon without provider payloads", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const migration = fs.readFileSync(path.join(here, "../db/migrations/0004_hosted_opportunity_continuation.sql"), "utf8");
  assert.match(migration, /CREATE TABLE IF NOT EXISTS sf_content_opportunities/);
  assert.match(migration, /UNIQUE \(workspace_id, input_fingerprint\)/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS sf_signal_opportunity_jobs/);
  assert.match(migration, /UNIQUE \(workspace_id, signal_id, job_type\)/);
  assert.match(migration, /FOR UPDATE|SKIP LOCKED|pending|processing/);
  assert.doesNotMatch(migration, /webhook_payload|raw_payload|access_token|private_key|repository_contents/i);
});

test("Postgres ContentOpportunity row mapping preserves the canonical portable record", () => {
  const record = opportunity();
  assert.deepEqual(opportunityFromRow(rowFromOpportunity(record)), record);
});

test("hosted ContentOpportunity repository is workspace scoped and race-safe by input fingerprint", async () => {
  const record = opportunity();
  const calls = [];
  const database = {
    async query(statement, params) {
      calls.push({ statement, params });
      return [rowFromOpportunity(record)];
    },
  };
  const repository = createPostgresContentOpportunityRepository({ database, workspaceId: "workspace-1" });
  const stored = await repository.upsert(record);
  assert.equal(stored.opportunityId, record.opportunityId);
  assert.match(calls[0].statement, /ON CONFLICT \(workspace_id, input_fingerprint\)/);
  assert.match(calls[0].statement, /sf_content_opportunities\.opportunity_id = EXCLUDED\.opportunity_id/);

  const unscoped = createPostgresContentOpportunityRepository({ database });
  await assert.rejects(() => unscoped.list(), (error) => error?.code === "postgres_workspace_scope_required");
  await assert.rejects(
    () => createPostgresContentOpportunityRepository({ database, workspaceId: "workspace-2" }).upsert(record),
    (error) => error?.code === "postgres_workspace_scope_mismatch",
  );
});

test("GitHub ingestion dispatches eligible signals to one durable continuation boundary including duplicate retries", async () => {
  const enqueued = [];
  const result = {
    status: "duplicate",
    shouldEvaluateOpportunity: true,
    signal: { signalId: "signal-1", workspaceId: "workspace-1" },
  };
  const app = createGithubSignalOpportunityDispatchApplication({
    ingestionApplication: { ingest: async () => result },
    opportunityJobRepository: {
      async enqueue(input) {
        enqueued.push(input);
        return { jobId: "signal-opportunity:signal-1", status: "pending" };
      },
    },
    clock: fixedClock(),
  });
  const dispatched = await app.ingest({});
  assert.equal(dispatched.opportunityContinuation.jobId, "signal-opportunity:signal-1");
  assert.deepEqual(enqueued, [{ workspaceId: "workspace-1", signalId: "signal-1", now: NOW }]);
});

test("cheap dependency-noise gate never creates hosted Opportunity work", async () => {
  let enqueueCalls = 0;
  const app = createGithubSignalOpportunityDispatchApplication({
    ingestionApplication: {
      ingest: async () => ({ status: "created", shouldEvaluateOpportunity: false, signal: { signalId: "signal-1", workspaceId: "workspace-1" } }),
    },
    opportunityJobRepository: { enqueue: async () => { enqueueCalls += 1; } },
    clock: fixedClock(),
  });
  const result = await app.ingest({});
  assert.equal(result.shouldEvaluateOpportunity, false);
  assert.equal(enqueueCalls, 0);
});

test("worker completes canonical Opportunity jobs and persists bounded retry state on failure", async () => {
  const completed = [];
  const failed = [];
  const baseJob = {
    jobId: "signal-opportunity:signal-1",
    workspaceId: "workspace-1",
    signalId: "signal-1",
    status: "processing",
  };
  let mode = "success";
  const jobs = {
    async claimNext() { return baseJob; },
    async complete(jobId, input) {
      completed.push({ jobId, input });
      return { ...baseJob, status: "completed", opportunityId: input.opportunityId };
    },
    async fail(jobId, input) {
      failed.push({ jobId, input });
      return { ...baseJob, status: "pending", lastErrorCode: input.errorCode };
    },
  };
  const worker = createSignalOpportunityWorkerApplication({
    opportunityJobRepository: jobs,
    createContinuationApplication: async () => ({
      async continueToOpportunity() {
        if (mode === "failure") {
          const error = new Error("provider unavailable");
          error.code = "inference_route_unavailable";
          throw error;
        }
        return { opportunity: opportunity() };
      },
    }),
    clock: fixedClock(),
  });

  const success = await worker.processNext();
  assert.equal(success.status, "completed");
  assert.equal(completed[0].input.opportunityId, "opportunity-1");

  mode = "failure";
  const retry = await worker.processNext();
  assert.equal(retry.status, "retry_scheduled");
  assert.equal(failed[0].input.errorCode, "inference_route_unavailable");
});

test("GitHub webhook acknowledges persistence before scheduling model continuation", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const route = fs.readFileSync(path.join(here, "../app/api/sources/github/webhook/route.js"), "utf8");
  assert.match(route, /from "next\/server"/);
  assert.match(route, /after\(async \(\) =>/);
  assert.match(route, /const response = await handler\(request\)/);
  assert.match(route, /if \(response\.status === 202\)/);
  assert.doesNotMatch(route, /continueToOpportunity\(/);
});
