import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { createGenerationProgressReporter } from "../lib/ai/generationProgress.mjs";

test("generation progress reports truthful strategy and destination transitions", () => {
  const events = [];
  const reporter = createGenerationProgressReporter({
    channels: ["linkedin", "x", "reddit"],
    onProgress: (event) => events.push(event),
  });

  reporter.setStrategy("generating");
  reporter.setStrategy("complete");
  reporter.queueDestinations();
  reporter.setDestination("linkedin", "generating");
  reporter.setDestination("x", "generating");
  reporter.setDestination("linkedin", "complete");
  reporter.setDestination("x", "revising");
  reporter.setDestination("x", "needs_review");
  reporter.setDestination("reddit", "failed");
  reporter.complete();

  assert.equal(events[0].phase, "strategy");
  assert.equal(events[0].strategy, "generating");
  assert.equal(events[2].destinations.linkedin, "queued");
  const last = events.at(-1);
  assert.equal(last.phase, "complete");
  assert.equal(last.completedDestinations, 3);
  assert.equal(last.totalDestinations, 3);
  assert.deepEqual(last.destinations, {
    linkedin: "complete",
    x: "needs_review",
    reddit: "failed",
  });
  assert.deepEqual(events.map((event) => event.sequence), events.map((_, index) => index + 1));
});

test("cancellation marks only unfinished destinations cancelled", () => {
  const reporter = createGenerationProgressReporter({
    channels: ["linkedin", "x", "reddit"],
  });
  reporter.setStrategy("complete");
  reporter.queueDestinations();
  reporter.setDestination("linkedin", "complete");
  reporter.setDestination("x", "generating");
  const cancelled = reporter.cancelOutstanding();

  assert.equal(cancelled.phase, "cancelled");
  assert.deepEqual(cancelled.destinations, {
    linkedin: "complete",
    x: "cancelled",
    reddit: "cancelled",
  });
  assert.equal(cancelled.completedDestinations, 3);
});

test("progress observers cannot break generation state transitions", () => {
  const reporter = createGenerationProgressReporter({
    channels: ["linkedin"],
    onProgress() {
      throw new Error("observer unavailable");
    },
  });
  assert.doesNotThrow(() => reporter.setStrategy("generating"));
  assert.doesNotThrow(() => reporter.setDestination("linkedin", "complete"));
  assert.equal(reporter.snapshot().destinations.linkedin, "complete");
});

test("progress contract contains no draft, prompt, source, or provider response content", () => {
  const reporter = createGenerationProgressReporter({ channels: ["linkedin"] });
  reporter.setDestination("linkedin", "generating");
  const serialized = JSON.stringify(reporter.snapshot());
  assert.doesNotMatch(serialized, /prompt|draft|source|responseBody|repository/i);
});

test("orchestration emits progress from strategy through destination repair and cancellation", async () => {
  const source = await readFile(new URL("../lib/ai/generateStudioPackage.js", import.meta.url), "utf8");
  assert.match(source, /createGenerationProgressReporter/);
  assert.match(source, /progressReporter\.setStrategy\("generating"\)/);
  assert.match(source, /progressReporter\.queueDestinations\(\)/);
  assert.match(source, /setDestination\?\.\(channel, "generating"\)/);
  assert.match(source, /setDestination\?\.\(channel, "revising"\)/);
  assert.match(source, /progressReporter\.cancelOutstanding\(\)/);
  assert.match(source, /progressReporter\.complete\(\)/);
});

test("launch kit keeps JSON compatibility and streams progress only when requested", async () => {
  const route = await readFile(new URL("../app/api/launch_kit/route.js", import.meta.url), "utf8");
  assert.match(route, /request\.headers\.get\("accept"\)\?\.includes\("application\/x-ndjson"\)/);
  assert.match(route, /onProgress: \(progress\) => write\(\{ type: "progress", progress \}\)/);
  assert.match(route, /write\(\{ type: "result", data:/);
  assert.match(route, /write\(\{ type: "error", data: safeGenerationFailure\(error\) \}\)/);
  assert.match(route, /"Content-Type": "application\/x-ndjson; charset=utf-8"/);
  assert.match(route, /const result = await generateStudioPackage/);
  assert.match(route, /"Content-Type": "application\/json"/);
});

test("Studio consumes live progress with JSON fallback and accessible status semantics", async () => {
  const page = await readFile(new URL("../app/page.js", import.meta.url), "utf8");
  assert.match(page, /Accept: "application\/x-ndjson"/);
  assert.match(page, /readGenerationResponse\(/);
  assert.match(page, /response\.body\.getReader\(\)/);
  assert.match(page, /event\.type === "progress"/);
  assert.match(page, /setGenerationProgress/);
  assert.match(page, /className="generation-progress-list"/);
  assert.match(page, /aria-label="Destination generation progress"/);
  assert.match(page, /aria-live=\{busy && generationProgress \? "polite" : undefined\}/);
  assert.match(page, /Cancel generation/);
});
