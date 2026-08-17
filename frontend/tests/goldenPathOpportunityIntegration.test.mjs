import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(testDir, "..");
const read = (relative) => fs.readFileSync(path.join(frontendRoot, relative), "utf8");

test("Signals can enter real opportunity evaluation without owning scoring rules", () => {
  const signals = read("components/SignalsWorkspace.js");
  assert.match(signals, /createBrowserContentOpportunityApplication/);
  assert.match(signals, /evaluateSignal\(signalId\)/);
  assert.match(signals, /Find ideas/);
  assert.match(signals, /\/plan\?opportunity=/);
  assert.doesNotMatch(signals, /score\s*=|scoreBreakdown|candidateAngles\s*=/);
});

test("Plan is a real shared-shell route with persisted angle and Something else decisions", () => {
  const shell = read("components/WorkspaceShell.js");
  const plan = read("components/PlanWorkspace.js");
  const route = read("app/plan/page.js");
  assert.match(shell, /id: "plan", label: "Plan", href: "\/plan", status: "available"/);
  assert.match(route, /<PlanWorkspace \/>/);
  assert.match(plan, /activeItem="plan"/);
  assert.match(plan, /application\.selectAngle/);
  assert.match(plan, /application\.setCustomAngle/);
  assert.match(plan, /SOMETHING ELSE/);
  assert.match(plan, /Not worth posting/);
});

test("opportunity inference is task-scoped, minimized, and privacy checked server-side", () => {
  const route = read("app/api/intelligence/opportunity/route.js");
  const task = read("lib/inference/inferenceTasks.mjs");
  const prompt = read("lib/ai/opportunityEvaluation.mjs");
  assert.match(route, /normalizeInferenceTask/);
  assert.match(route, /assertInferenceRouteAllowed/);
  assert.match(route, /input\.signal\.workspaceId !== task\.workspaceId/);
  assert.match(route, /privacyClassification !== task\.dataClassification/);
  assert.match(task, /DEVICE_PRIVATE/);
  assert.match(task, /RESTRICTED/);
  assert.match(task, /sourceArtifactCount/);
  assert.match(task, /assetCount/);
  assert.doesNotMatch(task, /sourceArtifactText|repositoryContents|rawRepository/);
  assert.match(prompt, /Do not pretend you know the user's identity profile or narrative history/);
});

test("Golden Path opportunity UI follows the shared restrained design system", () => {
  const css = read("components/PlanWorkspace.module.css");
  assert.match(css, /#f5f0e5|rgba\(255,253,248/);
  assert.match(css, /border-radius: \.7rem/);
  assert.match(css, /@media \(max-width: 900px\)/);
  assert.match(css, /@media \(max-width: 620px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(css, /border-radius:\s*(?:2[0-9]|[3-9][0-9])px/);
});
