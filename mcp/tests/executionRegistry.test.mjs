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
