import test from "node:test";
import assert from "node:assert/strict";

import {
  JOB_STATUSES,
  JOB_TYPES,
  acknowledgeDurableJobCancellation,
  claimDurableJob,
  createDurableJob,
  enqueueDurableJob,
  failDurableJob,
  heartbeatDurableJob,
  recoverExpiredLease,
  requestDurableJobCancellation,
  succeedDurableJob,
} from "../lib/domain/durableJobs.mjs";
import { createMemoryDurableJobPort } from "../lib/infrastructure/productExecutionMemoryAdapters.mjs";

const T0 = "2026-08-23T00:00:00.000Z";
const T1 = "2026-08-23T00:00:10.000Z";

function job(overrides = {}) {
  return createDurableJob({
    jobId: overrides.jobId || "job-1",
    workspaceId: "workspace-1",
    resourceType: overrides.resourceType || "capture_job",
    resourceId: overrides.resourceId || "capture-1",
    jobType: overrides.jobType || JOB_TYPES.CAPTURE_SCREENSHOT,
    inputVersion: overrides.inputVersion || 1,
    inputRef: overrides.inputRef || "recipe-1",
    idempotencyKey: overrides.idempotencyKey || "capture-1-v1",
    priority: overrides.priority ?? 50,
    retryPolicy: overrides.retryPolicy || { maxAttempts: 3, initialBackoffSeconds: 10, maxBackoffSeconds: 60 },
    scheduledAt: overrides.scheduledAt || null,
    createdAt: overrides.createdAt || T0,
  });
}

test("enqueue is idempotent for the same durable input", async () => {
  const repository = createMemoryDurableJobPort();
  const first = await enqueueDurableJob(repository, job());
  const second = await enqueueDurableJob(repository, job({ jobId: "job-2" }));
  assert.equal(first.deduplicated, false);
  assert.equal(second.deduplicated, true);
  assert.equal(second.job.jobId, "job-1");
  assert.equal((await repository.list()).length, 1);
});

test("reusing an idempotency key for a different input is rejected", async () => {
  const repository = createMemoryDurableJobPort();
  await enqueueDurableJob(repository, job());
  await assert.rejects(
    () => enqueueDurableJob(repository, job({ jobId: "job-2", resourceId: "capture-2" })),
    (error) => error.code === "job_idempotency_conflict",
  );
});

test("claim heartbeat and success preserve one lease owner", () => {
  const claimed = claimDurableJob(job(), { leaseOwner: "worker-a", leaseSeconds: 30, now: T0 });
  assert.equal(claimed.status, JOB_STATUSES.RUNNING);
  assert.equal(claimed.attemptCount, 1);
  assert.equal(claimed.leaseOwner, "worker-a");

  const heartbeat = heartbeatDurableJob(claimed, {
    leaseOwner: "worker-a",
    leaseSeconds: 30,
    progress: { stage: "capturing", completedUnits: 1, totalUnits: 2 },
    now: T1,
  });
  assert.equal(heartbeat.progress.stage, "capturing");

  const completed = succeedDurableJob(heartbeat, { leaseOwner: "worker-a", outputRefs: ["asset-1"], now: "2026-08-23T00:00:20.000Z" });
  assert.equal(completed.status, JOB_STATUSES.SUCCEEDED);
  assert.equal(completed.leaseOwner, null);
  assert.deepEqual(completed.outputRefs, ["asset-1"]);
});

test("safe transient failures retry with bounded exponential backoff", () => {
  const claimed = claimDurableJob(job(), { leaseOwner: "worker-a", now: T0 });
  const retry = failDurableJob(claimed, {
    leaseOwner: "worker-a",
    error: { code: "browser_crash", retryable: true, message: "browser crash" },
    now: T1,
  });
  assert.equal(retry.status, JOB_STATUSES.RETRYING);
  assert.equal(retry.nextAttemptAt, "2026-08-23T00:00:20.000Z");
});

test("retryable jobs dead-letter after max attempts", () => {
  let current = job({ retryPolicy: { maxAttempts: 2, initialBackoffSeconds: 1, maxBackoffSeconds: 5 } });
  current = claimDurableJob(current, { leaseOwner: "worker-a", now: T0 });
  current = failDurableJob(current, { leaseOwner: "worker-a", error: { code: "browser_crash", retryable: true }, now: "2026-08-23T00:00:01.000Z" });
  current = claimDurableJob(current, { leaseOwner: "worker-a", now: "2026-08-23T00:00:03.000Z" });
  current = failDurableJob(current, { leaseOwner: "worker-a", error: { code: "browser_crash", retryable: true }, now: "2026-08-23T00:00:04.000Z" });
  assert.equal(current.status, JOB_STATUSES.DEAD_LETTERED);
  assert.equal(current.nextAttemptAt, null);
});

test("publication with unknown external outcome is never blindly retried", () => {
  const publication = job({ jobType: JOB_TYPES.PUBLICATION, resourceType: "publication_request", resourceId: "publication-1" });
  const claimed = claimDurableJob(publication, { leaseOwner: "publisher-a", now: T0 });
  const failed = failDurableJob(claimed, {
    leaseOwner: "publisher-a",
    error: { code: "provider_timeout", retryable: true, externalOutcomeUnknown: true },
    now: T1,
  });
  assert.equal(failed.status, JOB_STATUSES.FAILED);
  assert.equal(failed.nextAttemptAt, null);
});

test("queued cancellation is terminal immediately while active cancellation is cooperative", () => {
  const queuedCancelled = requestDurableJobCancellation(job(), T1);
  assert.equal(queuedCancelled.status, JOB_STATUSES.CANCELLED);

  const running = claimDurableJob(job({ jobId: "job-running" }), { leaseOwner: "worker-a", now: T0 });
  const requested = requestDurableJobCancellation(running, T1);
  assert.equal(requested.status, JOB_STATUSES.CANCEL_REQUESTED);
  const acknowledged = acknowledgeDurableJobCancellation(requested, { leaseOwner: "worker-a", now: "2026-08-23T00:00:20.000Z" });
  assert.equal(acknowledged.status, JOB_STATUSES.CANCELLED);
});

test("expired worker leases recover to retry or dead-letter without losing job identity", () => {
  const claimed = claimDurableJob(job(), { leaseOwner: "worker-a", leaseSeconds: 5, now: T0 });
  const recovered = recoverExpiredLease(claimed, "2026-08-23T00:00:06.000Z");
  assert.equal(recovered.jobId, claimed.jobId);
  assert.equal(recovered.status, JOB_STATUSES.RETRYING);
  assert.equal(recovered.leaseOwner, null);
  assert.equal(recovered.lastError.code, "worker_lease_expired");
});

test("memory durable repository claims the highest priority due job once", async () => {
  const repository = createMemoryDurableJobPort([
    job({ jobId: "low", idempotencyKey: "low", resourceId: "low", priority: 10 }),
    job({ jobId: "high", idempotencyKey: "high", resourceId: "high", priority: 90 }),
  ]);
  const claimed = await repository.claimNext({ leaseOwner: "worker-a", now: T0, jobTypes: [JOB_TYPES.CAPTURE_SCREENSHOT] });
  assert.equal(claimed.jobId, "high");
  assert.equal(claimed.status, JOB_STATUSES.RUNNING);
  const next = await repository.claimNext({ leaseOwner: "worker-b", now: T0, jobTypes: [JOB_TYPES.CAPTURE_SCREENSHOT] });
  assert.equal(next.jobId, "low");
});
