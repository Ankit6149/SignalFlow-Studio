import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(testDir, "..");

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

function sourceFiles(directory) {
  return walk(directory).filter((file) => /\.(?:js|mjs)$/.test(file));
}

test("UI and route modules do not import infrastructure adapters directly", () => {
  for (const file of sourceFiles(path.join(frontendRoot, "app"))) {
    const source = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(
      source,
      /(?:from\s+["'][^"']*lib\/infrastructure|import\(["'][^"']*lib\/infrastructure)/,
      `${path.relative(frontendRoot, file)} reaches infrastructure directly`,
    );
  }
});

test("domain modules stay pure and framework independent", () => {
  for (const file of sourceFiles(path.join(frontendRoot, "lib/domain"))) {
    const source = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(source, /(?:react|next\/|lib\/infrastructure|lib\/application|app\/)/i);
  }
});

test("application modules do not import React, Next routes, or UI components", () => {
  for (const file of sourceFiles(path.join(frontendRoot, "lib/application"))) {
    const source = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(source, /(?:from\s+["']react|from\s+["']next|app\/|components\/)/i);
  }
});

test("campaign UI delegates persistence and export projection to the persistence controller", () => {
  const page = fs.readFileSync(path.join(frontendRoot, "app/StudioRootController.js"), "utf8");
  const persistence = fs.readFileSync(path.join(frontendRoot, "lib/studio/useCampaignPersistenceController.js"), "utf8");

  assert.match(page, /useCampaignPersistenceController\(/);
  assert.doesNotMatch(page, /createBrowserCampaignApplication|campaignApplication\.|downloadBinary\(|downloadText\(/);
  assert.match(persistence, /createBrowserCampaignApplication/);
  assert.match(persistence, /campaignApplication\.saveCampaign/);
  assert.match(persistence, /campaignApplication\.projectMarkdown/);
  assert.match(persistence, /campaignApplication\.projectJson/);
  assert.match(persistence, /campaignApplication\.projectZip/);
  assert.doesNotMatch(persistence, /localStorage\.setItem\(LIBRARY_KEY/);
  assert.doesNotMatch(persistence, /generateStudioCampaign|publishStudioPost/);
});

test("campaign UI delegates generation execution to the generation controller", () => {
  const page = fs.readFileSync(path.join(frontendRoot, "app/StudioRootController.js"), "utf8");
  const generation = fs.readFileSync(path.join(frontendRoot, "lib/studio/useCampaignGenerationController.js"), "utf8");

  assert.match(page, /useCampaignGenerationController\(/);
  assert.doesNotMatch(page, /generateStudioCampaign|createGenerationRun|acceptGenerationResponse|new AbortController|regenerationTargets/);
  assert.match(generation, /generateStudioCampaign/);
  assert.match(generation, /createGenerationRun/);
  assert.match(generation, /acceptGenerationResponse/);
  assert.match(generation, /new AbortController\(\)/);
  assert.match(generation, /regenerationTargets/);
  assert.match(generation, /onProgress: setGenerationProgress/);
  assert.doesNotMatch(generation, /publishStudioPost|createBrowserCampaignApplication|useProviderRouteController|useOwnerConnectionsController/);
});

test("campaign UI delegates publishing and manual handoff to the publishing controller", () => {
  const page = fs.readFileSync(path.join(frontendRoot, "app/StudioRootController.js"), "utf8");
  const publishing = fs.readFileSync(path.join(frontendRoot, "lib/studio/useCampaignPublishingController.js"), "utf8");

  assert.match(page, /useCampaignPublishingController\(/);
  assert.doesNotMatch(page, /publishStudioPost|navigator\.clipboard|window\.open\(|selectPublishAvailability/);
  assert.match(publishing, /publishStudioPost/);
  assert.match(publishing, /navigator\.clipboard/);
  assert.match(publishing, /window\.open\(/);
  assert.match(publishing, /selectPublishAvailability/);
  assert.doesNotMatch(publishing, /generateStudioCampaign|createBrowserCampaignApplication|useProviderRouteController|useOwnerConnectionsController/);
});

test("campaign UI delegates source-file intake to the source controller", () => {
  const page = fs.readFileSync(path.join(frontendRoot, "app/StudioRootController.js"), "utf8");
  const source = fs.readFileSync(path.join(frontendRoot, "lib/studio/useCampaignSourceController.js"), "utf8");

  assert.match(page, /useCampaignSourceController\(/);
  assert.doesNotMatch(page, /createUploadSourceBundle|selectAcceptedFiles|sourceFilePresentation|async function handleFiles|function removeFile/);
  assert.match(source, /createUploadSourceBundle/);
  assert.match(source, /selectAcceptedFiles/);
  assert.match(source, /sourceFilePresentation/);
  assert.match(source, /async function handleFiles\(event\)/);
  assert.match(source, /function removeFile\(index\)/);
  assert.doesNotMatch(source, /generateStudioCampaign|publishStudioPost|createBrowserCampaignApplication|useProviderRouteController|useOwnerConnectionsController/);
});

test("campaign UI delegates review/editor coordination to the review controller", () => {
  const page = fs.readFileSync(path.join(frontendRoot, "app/StudioRootController.js"), "utf8");
  const review = fs.readFileSync(path.join(frontendRoot, "lib/studio/useCampaignReviewController.js"), "utf8");

  assert.match(page, /useCampaignReviewController\(/);
  assert.doesNotMatch(page, /MARK_CHANNEL_APPROVED|MARK_CHANNEL_NEEDS_REVIEW|RESTORE_ARCHIVE|DISCARD_ARCHIVE|RESTORE_GENERATED|window\.confirm/);
  assert.match(review, /MARK_CHANNEL_APPROVED/);
  assert.match(review, /MARK_CHANNEL_NEEDS_REVIEW/);
  assert.match(review, /RESTORE_ARCHIVE/);
  assert.match(review, /DISCARD_ARCHIVE/);
  assert.match(review, /RESTORE_GENERATED/);
  assert.match(review, /window\.confirm/);
  assert.doesNotMatch(review, /generateStudioCampaign|publishStudioPost|createBrowserCampaignApplication|createUploadSourceBundle|useProviderRouteController|useOwnerConnectionsController/);
});

test("new campaign action clears editor identity through the shared session boundary", () => {
  const controller = fs.readFileSync(path.join(frontendRoot, "app/StudioRootController.js"), "utf8");
  const libraryRoute = fs.readFileSync(path.join(frontendRoot, "app/library/page.js"), "utf8");
  const session = fs.readFileSync(path.join(frontendRoot, "lib/studio/CampaignEditorSessionContext.js"), "utf8");
  const library = fs.readFileSync(path.join(frontendRoot, "components/LibraryWorkspace.js"), "utf8");

  assert.doesNotMatch(controller, /function startNewCampaign\(\)|resetEditorSession\(\)/);
  assert.match(libraryRoute, /function startNewCampaign\(\)[\s\S]*resetEditorSession\(\)/);
  assert.match(session, /function resetEditorSession\(\)/);
  assert.match(session, /setCurrentCampaignId\(""\)/);
  assert.match(session, /type: "RESET_CAMPAIGN"/);
  assert.match(libraryRoute, /onNewCampaign=\{startNewCampaign\}/);
  assert.match(library, /onClick=\{onNewCampaign\}/);
});
