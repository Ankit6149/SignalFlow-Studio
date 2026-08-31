import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { JOB_STATUSES, JOB_TYPES, createDurableJob } from "../lib/domain/durableJobs.mjs";
import { PORT_CONTRACTS } from "../lib/domain/ports.mjs";
import { createMemoryDurableJobPort } from "../lib/infrastructure/productExecutionMemoryAdapters.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NOW = "2026-08-31T05:45:00.000Z";

function job(jobId, { jobType = JOB_TYPES.CAPTURE_SCREENSHOT, scheduledAt = null, priority = 50 } = {}) {
  return createDurableJob({
    jobId,
    workspaceId: "workspace-1",
    resourceType: "capture_job",
    resourceId: `capture-${jobId}`,
    jobType,
    inputVersion: 1,
    inputRef: "recipe-1",
    idempotencyKey: `idem-${jobId}`,
    priority,
    scheduledAt,
    createdAt: NOW,
  });
}

test("durable job port requires exact-ID claim in addition to worker claimNext", () => {
  assert.ok(PORT_CONTRACTS.durableJobRepository.includes("claimById"));
  assert.ok(PORT_CONTRACTS.durableJobRepository.includes("claimNext"));
});

test("memory exact claim leases only the requested runnable job and leaves older/higher-priority jobs untouched", async () => {
  const first = job("job-first", { priority: 100 });
  const target = job("job-target", { priority: 1 });
  const repository = createMemoryDurableJobPort([first, target]);

  const claimed = await repository.claimById("job-target", {
    leaseOwner: "request-worker",
    leaseSeconds: 90,
    now: "2026-08-31T05:45:01.000Z",
    jobTypes: [JOB_TYPES.CAPTURE_SCREENSHOT],
  });

  assert.equal(claimed.jobId, "job-target");
  assert.equal(claimed.status, JOB_STATUSES.RUNNING);
  assert.equal(claimed.leaseOwner, "request-worker");
  assert.equal(claimed.attemptCount, 1);
  assert.equal((await repository.get("job-first")).status, JOB_STATUSES.QUEUED);
  assert.equal((await repository.get("job-target")).status, JOB_STATUSES.RUNNING);
});

test("exact claim fails closed for wrong type, future schedule, missing job and already-claimed job", async () => {
  const future = job("job-future", { scheduledAt: "2026-08-31T06:45:00.000Z" });
  const wrongType = job("job-export", { jobType: JOB_TYPES.EXPORT });
  const runnable = job("job-once");
  const repository = createMemoryDurableJobPort([future, wrongType, runnable]);
  const options = {
    leaseOwner: "request-worker",
    leaseSeconds: 60,
    now: "2026-08-31T05:45:01.000Z",
    jobTypes: [JOB_TYPES.CAPTURE_SCREENSHOT],
  };

  assert.equal(await repository.claimById("missing", options), null);
  assert.equal(await repository.claimById("job-future", options), null);
  assert.equal(await repository.claimById("job-export", options), null);
  assert.ok(await repository.claimById("job-once", options));
  assert.equal(await repository.claimById("job-once", options), null);
});

test("Postgres exact claim is one scoped atomic UPDATE and cannot fall back to queue ordering", () => {
  const source = fs.readFileSync(path.join(ROOT, "lib", "infrastructure", "postgresDurableJobAdapter.mjs"), "utf8");
  const start = source.indexOf("async function claimById");
  const end = source.indexOf("async function claimNext", start);
  assert.ok(start >= 0 && end > start);
  const exact = source.slice(start, end);

  assert.match(exact, /UPDATE sf_durable_jobs AS jobs/);
  assert.match(exact, /jobs\.workspace_id = \$1/);
  assert.match(exact, /jobs\.job_id = \$6/);
  assert.match(exact, /jobs\.status IN \('queued', 'scheduled', 'retrying'\)/);
  assert.match(exact, /jobs\.cancellation_requested_at IS NULL/);
  assert.match(exact, /COALESCE\(jobs\.next_attempt_at, jobs\.scheduled_at, jobs\.created_at\) <= \$2::timestamptz/);
  assert.match(exact, /job_type = ANY\(\$5::text\[\]\)/);
  assert.match(exact, /RETURNING jobs\.\*/);
  assert.doesNotMatch(exact, /ORDER BY|LIMIT 1|SKIP LOCKED|candidate/);
});
