import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const plan = fs.readFileSync(path.join(here, "../components/PlanWorkspace.js"), "utf8");
const planApp = fs.readFileSync(path.join(here, "../lib/application/browserPlanOpportunityApplication.mjs"), "utf8");

test("Plan surfaces connected-source Opportunities through the shared editorial inbox", () => {
  assert.match(plan, /createBrowserPlanOpportunityApplication/);
  assert.match(plan, /Connected source/);
  assert.match(plan, /Direct create/);
  assert.doesNotMatch(plan, /createBrowserContentOpportunityApplication/);
});

test("owner first judgment exposes Start here, Something else, and Not now without guessing a direction", () => {
  assert.match(plan, />Start here</);
  assert.match(plan, />Something else…</);
  assert.match(plan, />Not now</);
  assert.match(plan, /active\.recommendedAngleId/);
  assert.match(planApp, /opportunity_recommended_angle_required/);
  assert.match(planApp, /recommendedAngleId/);
  assert.doesNotMatch(planApp, /candidateAngles\[0\]/);
});

test("Not now is an Opportunity snooze and does not mutate retained project context", () => {
  assert.match(planApp, /DEFAULT_SNOOZE_DAYS = 7/);
  assert.match(planApp, /snoozeOpportunity/);
  assert.doesNotMatch(planApp, /projectContext.*(?:upsert|remove|delete|mutate)/i);
});

test("hosted connected-source judgment never falls through to the browser-local campaign planner", () => {
  assert.match(plan, /activeEntry\.origin === "local"\s*\?\s*\([\s\S]*?<CampaignPlanPanel/);
  assert.match(plan, /:\s*selectedAngle\s*\?\s*\([\s\S]*?<HostedCampaignPlanPanel/);
  assert.match(plan, /application=\{application\}/);
  assert.match(plan, /entry=\{activeEntry\}/);
});
