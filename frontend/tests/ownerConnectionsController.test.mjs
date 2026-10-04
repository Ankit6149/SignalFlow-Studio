import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageUrl = new URL("../app/StudioRootController.js", import.meta.url);
const controllerUrl = new URL("../lib/studio/useOwnerConnectionsController.js", import.meta.url);

test("owner session and official connector state have one dedicated controller boundary", async () => {
  const [page, controller] = await Promise.all([
    readFile(pageUrl, "utf8"),
    readFile(controllerUrl, "utf8"),
  ]);

  assert.match(page, /useOwnerConnectionsController\(/);
  assert.doesNotMatch(page, /const \[connections,/);
  assert.doesNotMatch(page, /const \[connectionsLoading,/);
  assert.doesNotMatch(page, /const \[accessToken,/);
  assert.doesNotMatch(page, /const \[ownerKey,/);
  assert.doesNotMatch(page, /async function syncOwnerSession/);
  assert.doesNotMatch(page, /async function refreshConnections/);
  assert.doesNotMatch(page, /async function disconnectPlatform/);
  assert.doesNotMatch(page, /async function unlockOwnerSession/);
  assert.doesNotMatch(page, /async function lockOwnerSession/);

  assert.match(controller, /getOwnerApiSession/);
  assert.match(controller, /getSocialConnectionStatus/);
  assert.match(controller, /disconnectSocialAccount/);
  assert.match(controller, /unlockOwnerApiSession/);
  assert.match(controller, /lockOwnerApiSession/);
  assert.doesNotMatch(controller, /campaignReducer|dispatchCampaign/);
  assert.doesNotMatch(controller, /createBrowserCampaignApplication|localStorage/);
  assert.doesNotMatch(controller, /generateStudioCampaign|publishStudioPost/);
});
