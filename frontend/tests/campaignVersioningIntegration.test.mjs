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
  const review = read("components/ReviewStage.js");
  assert.match(page, /campaignStatus=\{campaignStatus\}/);
  assert.match(page, /lastSavedAt=\{lastSavedAt\}/);
  assert.match(page, /lastExportedAt=\{lastExportedAt\}/);
  assert.match(review, /campaign-status-strip/);
  assert.match(review, /campaignStatus\.campaignLabel/);
  assert.match(review, /selectChannelStatus/);
  assert.match(review, /review-tab__status/);
  assert.match(review, /role="status"/);
  assert.match(review, /aria-live="polite"/);
  assert.match(review, /Mark approved/);
  assert.match(review, /Return to review/);
  assert.match(review, /review-action-reason/);
});

test("Studio exposes explicit identity-safe persistence operations", () => {
  const page = read("app/page.js");
  const review = read("components/ReviewStage.js");
  const application = read("lib/application/campaignApplication.mjs");
  assert.match(page, /saveCampaignAsCopy/);
  assert.match(page, /onSaveCampaignAsCopy=\{saveCampaignAsCopy\}/);
  assert.match(review, /Save as copy/);
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
  const review = read("components/ReviewStage.js");
  assert.match(review, /Version history/);
  assert.match(page, /RESTORE_ARCHIVE/);
  assert.match(page, /DISCARD_ARCHIVE/);
  assert.match(page, /RESTORE_GENERATED/);
  assert.match(review, /Restore generated copy/);
  assert.match(review, /Regenerate this channel/);
});

test("versioning styles are split between Review state and the regeneration dialog", () => {
  const reviewStyles = read("components/ReviewStage.module.css");
  const dialogStyles = read("app/campaign-versioning.css");

  assert.match(reviewStyles, /campaign-status-strip/);
  assert.match(reviewStyles, /version-history/);
  assert.match(reviewStyles, /review-action-reason/);
  assert.match(reviewStyles, /@media \(max-width: 48rem\)/);

  assert.match(dialogStyles, /regeneration-dialog-backdrop/);
  assert.match(dialogStyles, /regeneration-dialog button/);
  assert.match(dialogStyles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(dialogStyles, /campaign-status-strip|draft-state-badge|version-history|review-action-reason|save-action-group/);
});
