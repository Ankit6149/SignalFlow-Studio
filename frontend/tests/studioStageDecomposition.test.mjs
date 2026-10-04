import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(testDir, "..");
const read = (relative) => fs.readFileSync(path.join(frontendRoot, relative), "utf8");

test("Source stage is an explicit presentation boundary", () => {
  const page = read("app/StudioRootController.js");
  const source = read("components/SourceStage.js");

  assert.match(page, /import SourceStage from/);
  assert.match(page, /<SourceStage/);
  assert.match(page, /onUpdateForm=\{updateForm\}/);
  assert.match(page, /onFiles=\{handleFiles\}/);
  assert.match(page, /onRemoveFile=\{removeFile\}/);

  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.doesNotMatch(source, /\/api\//);
  assert.doesNotMatch(source, /localStorage/);
  assert.match(source, /onUpdateForm\("projectName"/);
  assert.match(source, /onUpdateForm\("notes"/);
  assert.match(source, /onUpdateForm\("links"/);
  assert.match(source, /onUpdateForm\("repo"/);
  assert.match(source, /onFiles/);
  assert.match(source, /onRemoveFile\(index\)/);
});

test("canonical source presentation policy is separate from the page controller", () => {
  const page = read("app/StudioRootController.js");
  const presentation = read("lib/studio/sourcePresentation.mjs");

  assert.match(page, /sourceFilePresentation/);
  assert.doesNotMatch(page, /const SOURCE_STATE_PRESENTATION/);
  assert.match(presentation, /SOURCE_STATE_PRESENTATION/);
  assert.match(presentation, /sourceArtifactVersionId/);
  assert.match(presentation, /Legacy source/);
});


test("Destinations stage is an explicit presentation boundary", () => {
  const page = read("app/StudioRootController.js");
  const destinations = read("components/DestinationsStage.js");

  assert.match(page, /import DestinationsStage from/);
  assert.match(page, /<DestinationsStage/);
  assert.match(page, /onToggleChannel=\{toggleChannel\}/);
  assert.match(page, /onSelectProvider=\{selectProviderRoute\}/);
  assert.match(page, /onTestProviderConnection=\{testProviderConnection\}/);
  assert.match(page, /onRebuildStrategy=\{handleGenerationAction\}/);

  assert.doesNotMatch(destinations, /\bfetch\s*\(/);
  assert.doesNotMatch(destinations, /\/api\//);
  assert.doesNotMatch(destinations, /localStorage/);
  assert.match(destinations, /CHANNEL_GROUPS\.map/);
  assert.match(destinations, /onToggleChannel\(channel\.id\)/);
  assert.match(destinations, /onSelectProvider\(item\.id\)/);
  assert.match(destinations, /strategy-review-panel/);
  assert.match(destinations, /compose-readiness/);
});


test("Review stage is an explicit presentation boundary", () => {
  const page = read("app/StudioRootController.js");
  const review = read("components/ReviewStage.js");

  assert.match(page, /import ReviewStage from/);
  assert.match(page, /<ReviewStage/);
  assert.match(page, /onEditPost=\{editActivePost\}/);
  assert.match(page, /onDraftApproval=\{handleDraftApproval\}/);
  assert.match(page, /onRegenerateActiveChannel=\{regenerateActiveChannel\}/);
  assert.match(page, /onPublishCurrentPost=\{publishCurrentPost\}/);
  assert.match(page, /onExportMarkdown=\{exportMarkdown\}/);
  assert.match(page, /onExportJson=\{exportJson\}/);

  assert.doesNotMatch(review, /\bfetch\s*\(/);
  assert.doesNotMatch(review, /\/api\//);
  assert.doesNotMatch(review, /localStorage/);
  assert.doesNotMatch(review, /dispatchCampaign|performRegeneration/);
  assert.match(review, /campaign-stale-banner/);
  assert.match(review, /review-tabs/);
  assert.match(review, /direct-publish-panel/);
  assert.match(review, /export-row/);
});
