import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(testDir, "..");
const read = (relative) => fs.readFileSync(path.join(frontendRoot, relative), "utf8");

test("Studio exposes deliberate edit-safe regeneration choices", () => {
  const page = read("app/page.js");
  assert.match(page, /REGENERATION_POLICIES\.UNEDITED/);
  assert.match(page, /REGENERATION_POLICIES\.ARCHIVE_ALL/);
  assert.match(page, /REGENERATION_POLICIES\.CHANNEL/);
  assert.match(page, /role="dialog"/);
  assert.match(page, /aria-modal="true"/);
  assert.match(page, /Regenerate only unedited destinations/);
  assert.match(page, /Archive edits and regenerate everything/);
  assert.match(page, /Cancel/);
  assert.doesNotMatch(page, /onClick=\{generateCampaign\}/);
});

test("Studio shows persistent campaign and channel state instead of toast-only state", () => {
  const page = read("app/page.js");
  assert.match(page, /campaign-status-strip/);
  assert.match(page, /campaignStatus\.campaignLabel/);
  assert.match(page, /lastSavedAt/);
  assert.match(page, /lastExportedAt/);
  assert.match(page, /selectChannelStatus/);
  assert.match(page, /review-tab__status/);
  assert.match(page, /role="status"/);
  assert.match(page, /aria-live="polite"/);
  assert.match(page, /Mark approved/);
  assert.match(page, /Return to review/);
  assert.match(page, /review-action-reason/);
});

test("Studio exposes explicit identity-safe persistence operations", () => {
  const page = read("app/page.js");
  const application = read("lib/application/campaignApplication.mjs");
  assert.match(page, /saveCampaignAsCopy/);
  assert.match(page, /Save as copy/);
  assert.match(page, /campaignApplication\.saveAsCopy/);
  assert.match(application, /async function createCampaign/);
  assert.match(application, /async function updateCampaign/);
  assert.match(application, /async function saveAsCopy/);
  assert.match(application, /async function getCampaign/);
  assert.match(application, /async function deleteCampaign/);
  assert.doesNotMatch(application, /this\.(?:createCampaign|updateCampaign|list|get|upsert|remove)/);
  assert.doesNotMatch(page, /filter\(\(entry\) => entry\.title/);
});

test("version history and generated-copy restoration are available", () => {
  const page = read("app/page.js");
  assert.match(page, /Version history/);
  assert.match(page, /RESTORE_ARCHIVE/);
  assert.match(page, /DISCARD_ARCHIVE/);
  assert.match(page, /RESTORE_GENERATED/);
  assert.match(page, /Restore generated copy/);
  assert.match(page, /Regenerate this channel/);
});

test("versioning styles include mobile and reduced-motion behavior", () => {
  const css = read("app/campaign-versioning.css");
  assert.match(css, /campaign-status-strip/);
  assert.match(css, /regeneration-dialog-backdrop/);
  assert.match(css, /@media \(max-width: 48rem\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /review-action-reason/);
});
