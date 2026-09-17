import test from "node:test";
import assert from "node:assert/strict";

import { createGithubSignalOpportunityDispatchApplication } from "../lib/application/githubSignalOpportunityDispatchApplication.mjs";
import { createPostgresSignalOpportunityJobRepository } from "../lib/infrastructure/postgresSignalOpportunityJobAdapter.mjs";

const NOW = "2026-09-18T00:00:00.000Z";

function completedJobRow(overrides = {}) {
  return {
    job_id: overrides.job_id || "signal-opportunity:signal-1",
    workspace_id: overrides.workspace_id || "workspace-1",
    signal_id: overrides.signal_id || "signal-1",
    job_type: "opportunity_evaluation",
    status: overrides.status || "completed",
    attempt_count: overrides.attempt_count ?? 1,
    available_at: NOW,
    lease_until: null,
    opportunity_id: overrides.opportunity_id || "opportunity-1",
    last_error_code: null,
    created_at: NOW,
    updated_at: NOW,
    completed_at: overrides.completed_at || NOW,
  };
}

test("duplicate enqueue cannot reopen a completed opportunity job", async () => {
  const calls = [];
  const database = {
    async query(statement, params) {
      calls.push({ statement, params });
      return [completedJobRow()];
    },
  };
  const repository = createPostgresSignalOpportunityJobRepository({ database });

  const job = await repository.enqueue({ workspaceId: "workspace-1", signalId: "signal-1", now: NOW });

  assert.equal(job.status, "completed");
  assert.equal(job.opportunityId, "opportunity-1");
  assert.equal(job.attemptCount, 1);

  const conflictClause = calls[0].statement.slice(calls[0].statement.indexOf("ON CONFLICT"));
  assert.match(conflictClause, /ON CONFLICT \(workspace_id, signal_id, job_type\) DO UPDATE SET/);
  assert.match(conflictClause, /updated_at = sf_signal_opportunity_jobs\.updated_at/);
  assert.doesNotMatch(conflictClause, /status\s*=/);
  assert.doesNotMatch(conflictClause, /attempt_count\s*=/);
  assert.doesNotMatch(conflictClause, /opportunity_id\s*=/);
  assert.doesNotMatch(conflictClause, /completed_at\s*=/);
});

test("concurrent duplicate webhook dispatch converges on one stable durable work unit", async () => {
  const jobs = new Map();
  const enqueueCalls = [];
  const result = Object.freeze({
    status: "duplicate",
    shouldEvaluateOpportunity: true,
    signal: Object.freeze({ signalId: "signal-1", workspaceId: "workspace-1" }),
  });

  const application = createGithubSignalOpportunityDispatchApplication({
    ingestionApplication: {
      async ingest() {
        return result;
      },
    },
    opportunityJobRepository: {
      async enqueue(input) {
        enqueueCalls.push(input);
        const key = `${input.workspaceId}:${input.signalId}`;
        await Promise.resolve();
        if (!jobs.has(key)) {
          jobs.set(key, Object.freeze({ jobId: `signal-opportunity:${input.signalId}`, status: "pending" }));
        }
        return jobs.get(key);
      },
    },
    clock: { now: () => NOW },
  });

  const burst = await Promise.all(Array.from({ length: 32 }, () => application.ingest({})));
  const jobIds = new Set(burst.map((item) => item.opportunityContinuation?.jobId));

  assert.equal(enqueueCalls.length, 32, "duplicate deliveries may race into the idempotent enqueue boundary");
  assert.equal(jobs.size, 1, "the durable boundary must converge on one work unit");
  assert.deepEqual([...jobIds], ["signal-opportunity:signal-1"]);
  assert.equal(burst.every((item) => item.signal.signalId === "signal-1"), true);
});
