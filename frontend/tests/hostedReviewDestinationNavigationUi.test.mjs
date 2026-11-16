import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("hosted exact Review exposes deliberate destination navigation over real rows", async () => {
  const component = await source("../components/HostedPlatformDraftsPanel.js");
  assert.match(component, /aria-label="Destination review navigation"/);
  assert.match(component, /destinationReviewStatus\(entry, requiredScreenshot\)/);
  assert.match(component, />Previous<\/button>/);
  assert.match(component, />Next<\/button>/);
  assert.match(component, /aria-pressed=\{active\}/);
  assert.match(component, /data-active=\{active\}/);
});

test("destination navigation moves focus instead of unmounting exact review rows", async () => {
  const component = await source("../components/HostedPlatformDraftsPanel.js");
  assert.match(component, /function focusDestination\(platformVariantId\)/);
  assert.match(component, /document\.getElementById/);
  assert.match(component, /hosted-review-/);
  assert.match(component, /target\.focus\(\{ preventScroll: true \}\)/);
  assert.match(component, /target\.scrollIntoView\(\{ block: "start" \}\)/);
  assert.match(component, /rows\.map\(\(entry\) => \{/);
  assert.match(component, /tabIndex=\{-1\}/);
  assert.match(component, /onFocusCapture=\{\(\) => setActiveVariantId/);
  assert.doesNotMatch(component, /rows\.filter\([^\n]*activeVariantId/);
});

test("destination status navigation reports exact review readiness without creating empty global tabs", async () => {
  const component = await source("../components/HostedPlatformDraftsPanel.js");
  for (const label of ["Omitted", "Generation failed", "Draft pending", "Media pending", "Approved", "Rejected", "Blocked", "Needs judgment", "Draft ready"]) {
    assert.ok(component.includes(`"${label}"`), `missing status: ${label}`);
  }
  assert.match(component, /rows\.length > 1/);
  assert.doesNotMatch(component, /instagram|threads|reddit|youtube|tiktok/i);
});

test("hosted destination navigator remains keyboard-visible and reflows on narrow screens", async () => {
  const css = await source("../components/CampaignPlanPanel.module.css");
  assert.match(css, /\.reviewNavigator[\s\S]*display: flex/);
  assert.match(css, /\.reviewNavList[\s\S]*overflow-x: auto/);
  assert.match(css, /\.reviewNavList button\[data-active="true"\]/);
  assert.match(css, /\.draftRow:focus-visible/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.reviewNavigator[\s\S]*flex-direction: column/);
});
