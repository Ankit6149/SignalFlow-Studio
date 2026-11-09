import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("hosted Review compares the full current revision against a selected immutable historical revision", async () => {
  const component = await source("../components/HostedPlatformRevisionReviewPanel.js");
  assert.match(component, /selectedHistoryId/);
  assert.match(component, /historicalRevisions = \(entry\?\.history \|\| \[\]\)/);
  assert.match(component, /right\.revisionNumber - left\.revisionNumber/);
  assert.match(component, /aria-label="Current and selected hosted revision comparison"/);
  assert.match(component, /CURRENT · r\{revision\.revisionNumber\}/);
  assert.match(component, /SELECTED · r\{selectedHistorical\.revisionNumber\}/);
  assert.match(component, /<p>\{revisionText\(revision\)\}<\/p>/);
  assert.match(component, /<p>\{revisionText\(selectedHistorical\)\}<\/p>/);
  assert.doesNotMatch(component, /revisionText\(item\)\.slice\(0, 240\)/);
});

test("hosted revision comparison keeps exact media identity and change provenance visible", async () => {
  const component = await source("../components/HostedPlatformRevisionReviewPanel.js");
  assert.match(component, /function mediaIdentityLines\(revision\)/);
  assert.match(component, /binding\.role/);
  assert.match(component, /binding\.assetId/);
  assert.match(component, /binding\.assetVersionId/);
  assert.match(component, /selectedHistorical\.changeRequest/);
  assert.match(component, /selectedHistorical\.editProvenance\?\.restoredFromRevisionId/);
  assert.match(component, /No media bound/);
});

test("restore from hosted comparison remains an explicit new-current action pinned to the visible current revision", async () => {
  const component = await source("../components/HostedPlatformRevisionReviewPanel.js");
  assert.match(component, /onClick=\{\(\) => restore\(selectedHistorical\)\}/);
  assert.match(component, /Restore as new current/);
  assert.match(component, /client\.restoreRevision\(variant\.platformVariantId, sourceRevision\.platformVariantRevisionId/);
  assert.match(component, /expectedCurrentRevisionId: revisionId/);
  assert.match(component, /was restored as a new immutable current child/);
});

test("hosted revision comparison remains keyboard-visible, wrap-safe and single-column on narrow screens", async () => {
  const css = await source("../components/PlatformReviewPanel.module.css");
  assert.match(css, /\.hostedHistoryRail button\[data-selected="true"\]/);
  assert.match(css, /\.hostedCompare section > p[\s\S]*white-space: pre-wrap;[\s\S]*overflow-wrap: anywhere/);
  assert.match(css, /\.hostedMediaIdentity code[\s\S]*word-break: break-word/);
  assert.match(css, /\.reviewPanel summary:focus-visible/);
  assert.match(css, /@media \(max-width: 720px\)[\s\S]*\.hostedCompare \{ grid-template-columns: 1fr; \}/);
});
