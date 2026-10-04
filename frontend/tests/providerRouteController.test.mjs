import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageUrl = new URL("../app/page.js", import.meta.url);
const controllerUrl = new URL("../lib/studio/useProviderRouteController.js", import.meta.url);

test("provider route state has one dedicated controller boundary", async () => {
  const [page, controller] = await Promise.all([
    readFile(pageUrl, "utf8"),
    readFile(controllerUrl, "utf8"),
  ]);

  assert.match(page, /useProviderRouteController\(\{ form, setForm \}\)/);
  assert.doesNotMatch(page, /const \[providerStatuses,/);
  assert.doesNotMatch(page, /const \[capabilitySnapshot,/);
  assert.doesNotMatch(page, /const \[providerStatusLoading,/);
  assert.doesNotMatch(page, /const \[providerTest,/);
  assert.doesNotMatch(page, /async function refreshProviderStatus/);
  assert.doesNotMatch(page, /async function testProviderConnection/);

  assert.match(controller, /getStudioCapabilities/);
  assert.match(controller, /testStudioProviderRoute/);
  assert.match(controller, /pickRecommendedProvider/);
  assert.match(controller, /evaluateProviderReadiness/);
  assert.match(controller, /getProviderCredentialPlacement/);
  assert.doesNotMatch(controller, /campaignReducer|dispatchCampaign/);
  assert.doesNotMatch(controller, /localStorage|createBrowserCampaignApplication/);
  assert.doesNotMatch(controller, /publishStudioPost|disconnectSocialAccount/);
});
