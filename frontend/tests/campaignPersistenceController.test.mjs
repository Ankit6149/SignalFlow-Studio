import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const controllerUrl = new URL("../app/StudioRootController.js", import.meta.url);
const persistenceUrl = new URL("../lib/studio/useCampaignPersistenceController.js", import.meta.url);

test("campaign persistence and export side effects have one dedicated controller boundary", async () => {
  const [controller, persistence] = await Promise.all([
    readFile(controllerUrl, "utf8"),
    readFile(persistenceUrl, "utf8"),
  ]);

  assert.match(controller, /useCampaignPersistenceController\(/);
  assert.match(controller, /onSaveCampaign=\{saveCampaign\}/);
  assert.match(controller, /onSaveCampaignAsCopy=\{saveCampaignAsCopy\}/);
  assert.match(controller, /onExportMarkdown=\{exportMarkdown\}/);
  assert.match(controller, /onExportJson=\{exportJson\}/);
  assert.match(controller, /onExportZip=\{\(\) => void exportZip\(\)\}/);

  assert.doesNotMatch(controller, /createBrowserCampaignApplication|campaignApplication\./);
  assert.doesNotMatch(controller, /function currentCampaignInput|function persistCampaign/);
  assert.doesNotMatch(controller, /function exportMarkdown|function exportJson|function exportZip/);
  assert.doesNotMatch(controller, /downloadBinary\(|downloadText\(/);

  assert.match(persistence, /createBrowserCampaignApplication/);
  assert.match(persistence, /function currentCampaignInput/);
  assert.match(persistence, /async function persistCampaign/);
  assert.match(persistence, /campaignApplication\.saveCampaign/);
  assert.match(persistence, /campaignApplication\.saveAsCopy/);
  assert.match(persistence, /campaignApplication\.projectMarkdown/);
  assert.match(persistence, /campaignApplication\.projectJson/);
  assert.match(persistence, /campaignApplication\.projectZip/);
  assert.match(persistence, /downloadBinary\(/);
  assert.match(persistence, /downloadText\(/);

  assert.doesNotMatch(persistence, /generateStudioCampaign|publishStudioPost|useProviderRouteController|useOwnerConnectionsController/);
  assert.doesNotMatch(persistence, /navigator\.clipboard|window\.open/);
});
