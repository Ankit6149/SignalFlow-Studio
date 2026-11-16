import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("direct-create exact Review exposes destination navigation over canonical planned rows", async () => {
  const component = await source("../components/CampaignPlanPanel.js");
  assert.match(component, /aria-label="Direct-create destination review navigation"/);
  assert.match(component, /destinationReviewStatus\(entry\)/);
  assert.match(component, />Previous<\/button>/);
  assert.match(component, />Next<\/button>/);
  assert.match(component, /aria-pressed=\{active\}/);
});

test("direct-create review navigation preserves mounted PlatformReviewPanel state", async () => {
  const component = await source("../components/CampaignPlanPanel.js");
  assert.match(component, /function focusDestination\(platformVariantId\)/);
  assert.match(component, /local-review-/);
  assert.match(component, /target\.focus\(\{ preventScroll: true \}\)/);
  assert.match(component, /target\.scrollIntoView\(\{ block: "start" \}\)/);
  assert.match(component, /rows\.map\(\(\{ variant, currentRevision, history \}\) => \(/);
  assert.doesNotMatch(component, /rows\.filter\([^\n]*activeVariantId/);
  assert.match(component, /<PlatformReviewPanel variant=\{variant\} revision=\{currentRevision\}/);
  assert.match(component, /tabIndex=\{-1\}/);
});

test("direct-create navigator reports only real destination states", async () => {
  const component = await source("../components/CampaignPlanPanel.js");
  for (const label of ["Omitted", "Generation failed", "Draft pending", "Approved", "Rejected", "Review"]) {
    assert.ok(component.includes(`"${label}"`), `missing status: ${label}`);
  }
  assert.match(component, /rows\.length > 1/);
  assert.doesNotMatch(component, /instagram|threads|reddit|youtube|tiktok/i);
});

test("direct-create navigation reuses keyboard-visible responsive review navigator styles", async () => {
  const css = await source("../components/CampaignPlanPanel.module.css");
  assert.match(css, /\.reviewNavigator/);
  assert.match(css, /\.reviewNavList button\[data-active="true"\]/);
  assert.match(css, /\.draftRow:focus-visible/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.reviewNavigator/);
});
