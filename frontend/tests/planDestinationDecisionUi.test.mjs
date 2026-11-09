import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("local campaign plan edits canonical include/optional/exclude decisions through strategy revision", async () => {
  const component = await source("../components/CampaignPlanPanel.js");
  assert.match(component, /async function setDestinationDecision\(destination, decision\)/);
  assert.match(component, /bundle\.strategy\.destinationPlan\.map/);
  assert.match(component, /application\.reviseStrategy\(bundle\.strategy\.narrativeStrategyId, \{ destinationPlan \}\)/);
  assert.match(component, /<option value="include">Include<\/option>/);
  assert.match(component, /<option value="optional">Optional<\/option>/);
  assert.match(component, /<option value="exclude">Exclude<\/option>/);
  assert.match(component, /if \(!bundle\.strategy \|\| bundle\.contentPiece\) return/);
  assert.match(component, /no hidden draft will be created for an excluded destination/);
});

test("connected-source plan edits the exact hosted strategy revision instead of creating browser-local preference state", async () => {
  const component = await source("../components/HostedCampaignPlanPanel.js");
  assert.match(component, /async function setDestinationDecision\(destination, decision\)/);
  assert.match(component, /application\.reviseHostedPlan\(entry, plan\.strategy, \{ destinationPlan \}\)/);
  assert.match(component, /plan\.strategy\.destinationPlan\.map/);
  assert.match(component, /plan\.strategy\.status === "approved"/);
  assert.match(component, /status === "revising"/);
  assert.match(component, /aria-label=\{\`Decision for/);
  assert.doesNotMatch(component, /localStorage|sessionStorage/);
});

test("destination controls are keyboard-visible and become read-only after approval", async () => {
  const local = await source("../components/CampaignPlanPanel.js");
  const localCss = await source("../components/CampaignPlanPanel.module.css");
  const hosted = await source("../components/HostedCampaignPlanPanel.js");
  const hostedCss = await source("../components/HostedCampaignPlanPanel.module.css");

  assert.match(local, /contentPiece \? \([\s\S]*?<span>\{titleCase\(item\.decision\)\}<\/span>[\s\S]*?<select/);
  assert.match(hosted, /approved \? \([\s\S]*?<span>\{label\(item\.decision\)\} · \{item\.format\}<\/span>[\s\S]*?<select/);
  assert.match(localCss, /\.panel select:focus-visible/);
  assert.match(hostedCss, /\.destinationDecision select:focus-visible/);
  assert.match(localCss, /@media \(max-width: 760px\)/);
  assert.match(hostedCss, /@media \(max-width: 760px\)/);
});
