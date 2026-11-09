import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const componentUrl = new URL("../components/SignalsWorkspace.js", import.meta.url);

async function source() {
  return readFile(componentUrl, "utf8");
}

test("Signals keeps Prepare for review as the decision-first primary path", async () => {
  const text = await source();
  assert.match(text, /createBrowserGoldenPathAutopilotApplication/);
  assert.match(text, /autopilotApplication\.prepareSignal\(signalId\)/);
  assert.match(text, />\s*\{prepareBusyId === signal\.signalId \? "Creating…" : "Create campaign"\}\s*</);
  assert.match(text, /className=\{styles\.ideaButton\} onClick=\{\(\) => prepareForReview\(signal\.signalId\)\}/);
});

test("Create campaign keeps the existing gated autopilot path instead of bypassing Plan or Voice", async () => {
  const text = await source("../components/SignalsWorkspace.js");
  assert.match(text, /autopilotApplication\.prepareSignal\(signalId\)/);
  assert.match(text, /Create campaign/);
  assert.match(text, /stop in Plan or Voice instead of making unsafe assumptions/);
  assert.match(text, /result\.status === "needs_voice"/);
  assert.match(text, /result\.status === "needs_plan"/);
  assert.match(text, /result\.status === "blocked_privacy"/);
  assert.match(text, /result\.status === "not_worth_posting"/);
  assert.doesNotMatch(text, /approveCurrentVariant|publishNow|autoPublish/);
});

test("Signals preserves bounded escalation routes instead of guessing", async () => {
  const text = await source();
  assert.match(text, /result\.status === "ready_for_judgment"/);
  assert.match(text, /window\.location\.assign\("\/today"\)/);
  assert.match(text, /result\.status === "needs_voice"/);
  assert.match(text, /window\.location\.assign\("\/voice"\)/);
  assert.match(text, /result\.status === "needs_plan"/);
  assert.match(text, /result\.status === "blocked_privacy"/);
  assert.match(text, /result\.status === "not_worth_posting"/);
  assert.match(text, /result\.status === "partial_failure"/);
});

test("Find ideas remains an explicit manual recovery path", async () => {
  const text = await source();
  assert.match(text, /title="Open the opportunity and plan manually"/);
  assert.match(text, /ideaBusyId === signal\.signalId \? "Finding ideas…" : "Find ideas"/);
  assert.match(text, /opportunityApplication\.evaluateSignal\(signalId\)/);
});

test("Signals UI owns no provider, threshold, legacy launch-kit, or storage mutation logic", async () => {
  const text = await source();
  assert.doesNotMatch(text, /\/api\/launch_kit/);
  assert.doesNotMatch(text, /generateJSON|DEFAULT_MODEL_PROVIDER|minimumScore|minimumConfidence|AUTOPILOT_THRESHOLDS/);
  assert.doesNotMatch(text, /localStorage\.(?:setItem|removeItem|clear)\s*\(/);
  assert.match(text, /SignalFlow will stop in Plan if confidence, evidence, Voice, privacy, or strategy boundaries are not strong enough/);
});
