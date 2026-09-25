import test from "node:test";
import assert from "node:assert/strict";

import { createExecutionRegistry } from "../lib/executionRegistry.mjs";

function tick() {
  return new Promise((resolve) => setImmediate(resolve));
}

test("execution registry tracks completion without blocking the caller", async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const registry = createExecutionRegistry({
    idFactory: () => "campaign-test-1",
  });

  const started = registry.start(async ({ reportProgress }) => {
    reportProgress({ phase: "generating", completedDestinations: 0, totalDestinations: 2 });
    await gate;
    return { ok: true, drafts: 2 };
  }, {
    metadata: { projectName: "SignalFlow", provider: "gemini", channels: ["linkedin", "x"] },
  });

  assert.equal(started.id, "campaign-test-1");
  assert.equal(started.status, "queued");

  await tick();
  const running = registry.get(started.id);
  assert.equal(running.status, "running");
  assert.equal(running.phase, "generating");
  assert.equal(running.progress.totalDestinations, 2);

  release();
  await tick();
  await tick();

  const completed = registry.get(started.id);
  assert.equal(completed.status, "completed");
  assert.deepEqual(completed.result, { ok: true, drafts: 2 });
});

test("execution registry cancellation aborts active work and preserves cancelled truth", async () => {
  const registry = createExecutionRegistry({
    idFactory: () => "campaign-test-cancel",
  });

  const started = registry.start(({ signal }) => new Promise((resolve, reject) => {
    signal.addEventListener("abort", () => {
      const error = new Error("cancelled");
      error.name = "AbortError";
      reject(error);
    }, { once: true });
  }));

  await tick();
  assert.equal(registry.get(started.id).status, "running");

  const cancelling = registry.cancel(started.id);
  assert.equal(cancelling.cancellationRequested, true);
  assert.equal(cancelling.phase, "cancelling");

  await tick();
  await tick();

  const cancelled = registry.get(started.id);
  assert.equal(cancelled.status, "cancelled");
  assert.equal(cancelled.phase, "cancelled");
  assert.equal(cancelled.result, null);
  assert.equal(cancelled.error, null);
});

test("execution registry returns null for unknown jobs", () => {
  const registry = createExecutionRegistry();
  assert.equal(registry.get("missing"), null);
  assert.equal(registry.cancel("missing"), null);
});


test("execution registry bounds independent campaign concurrency", async () => {
  let nextId = 0;
  const registry = createExecutionRegistry({
    maxConcurrent: 2,
    idFactory: () => `campaign-bounded-${++nextId}`,
  });
  const started = [];
  const releases = new Map();

  const run = (label) => () => new Promise((resolve) => {
    started.push(label);
    releases.set(label, resolve);
  });

  const first = registry.start(run("first"), { executionKey: "project:first" });
  const second = registry.start(run("second"), { executionKey: "project:second" });
  const third = registry.start(run("third"), { executionKey: "project:third" });

  await tick();
  assert.equal(started.length, 2);
  assert.equal(registry.get(first.id).status, "running");
  assert.equal(registry.get(second.id).status, "running");
  assert.equal(registry.get(third.id).status, "queued");

  releases.get("first")({ ok: true });
  await tick();
  await tick();

  assert.equal(started.includes("third"), true);
  assert.equal(registry.get(third.id).status, "running");

  releases.get("second")({ ok: true });
  releases.get("third")({ ok: true });
  await tick();
  await tick();

  assert.equal(registry.get(first.id).status, "completed");
  assert.equal(registry.get(second.id).status, "completed");
  assert.equal(registry.get(third.id).status, "completed");
});

test("execution registry serializes jobs sharing one execution key", async () => {
  let nextId = 0;
  const registry = createExecutionRegistry({
    maxConcurrent: 2,
    idFactory: () => `campaign-keyed-${++nextId}`,
  });
  const started = [];
  const releases = new Map();

  const run = (label) => () => new Promise((resolve) => {
    started.push(label);
    releases.set(label, resolve);
  });

  const first = registry.start(run("same-first"), { executionKey: "project:signalflow" });
  const second = registry.start(run("same-second"), { executionKey: "project:signalflow" });
  const other = registry.start(run("other"), { executionKey: "project:other" });

  await tick();
  assert.deepEqual(started, ["same-first", "other"]);
  assert.equal(registry.get(first.id).status, "running");
  assert.equal(registry.get(second.id).status, "queued");
  assert.equal(registry.get(other.id).status, "running");

  releases.get("same-first")({ ok: true });
  await tick();
  await tick();

  assert.equal(started.includes("same-second"), true);
  assert.equal(registry.get(second.id).status, "running");

  releases.get("other")({ ok: true });
  releases.get("same-second")({ ok: true });
  await tick();
  await tick();
});

test("cancelling queued work prevents its run function from starting", async () => {
  let nextId = 0;
  const registry = createExecutionRegistry({
    maxConcurrent: 1,
    idFactory: () => `campaign-cancel-queued-${++nextId}`,
  });
  let releaseFirst;
  let queuedStarted = false;

  const first = registry.start(() => new Promise((resolve) => {
    releaseFirst = resolve;
  }), { executionKey: "project:first" });
  const queued = registry.start(async () => {
    queuedStarted = true;
    return { ok: true };
  }, { executionKey: "project:second" });

  await tick();
  assert.equal(registry.get(first.id).status, "running");
  assert.equal(registry.get(queued.id).status, "queued");

  const cancelled = registry.cancel(queued.id);
  assert.equal(cancelled.status, "cancelled");
  assert.equal(cancelled.phase, "cancelled");

  releaseFirst({ ok: true });
  await tick();
  await tick();

  assert.equal(queuedStarted, false);
  assert.equal(registry.get(queued.id).status, "cancelled");
});

test("failed execution releases its slot for later queued work", async () => {
  let nextId = 0;
  const registry = createExecutionRegistry({
    maxConcurrent: 1,
    idFactory: () => `campaign-failure-${++nextId}`,
  });
  let secondStarted = false;

  const failed = registry.start(async () => {
    throw new Error("expected failure");
  }, { executionKey: "project:first" });
  const second = registry.start(async () => {
    secondStarted = true;
    return { ok: true };
  }, { executionKey: "project:second" });

  await tick();
  await tick();
  await tick();

  assert.equal(registry.get(failed.id).status, "failed");
  assert.equal(secondStarted, true);
  assert.equal(registry.get(second.id).status, "completed");
});


test("execution registry shutdown cancels active and queued work then drains", async () => {
  let nextId = 0;
  let queuedStarted = false;
  const registry = createExecutionRegistry({
    maxConcurrent: 1,
    idFactory: () => `campaign-shutdown-${++nextId}`,
  });

  const active = registry.start(({ signal }) => new Promise((resolve, reject) => {
    signal.addEventListener("abort", () => {
      const error = new Error("shutdown cancelled");
      error.name = "AbortError";
      reject(error);
    }, { once: true });
  }), { executionKey: "project:active" });

  const queued = registry.start(async () => {
    queuedStarted = true;
    return { ok: true };
  }, { executionKey: "project:queued" });

  await tick();
  assert.equal(registry.get(active.id).status, "running");
  assert.equal(registry.get(queued.id).status, "queued");

  const shutdown = await registry.shutdown({ timeoutMs: 1000 });

  assert.equal(shutdown.drained, true);
  assert.equal(shutdown.activeCount, 0);
  assert.equal(shutdown.queuedCount, 0);
  assert.equal(registry.get(active.id).status, "cancelled");
  assert.equal(registry.get(queued.id).status, "cancelled");
  assert.equal(queuedStarted, false);
});
