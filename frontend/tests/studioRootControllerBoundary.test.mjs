import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageUrl = new URL("../app/page.js", import.meta.url);
const controllerUrl = new URL("../app/StudioRootController.js", import.meta.url);

test("root page is a thin compatibility wrapper around the named Studio controller", async () => {
  const [page, controller] = await Promise.all([
    readFile(pageUrl, "utf8"),
    readFile(controllerUrl, "utf8"),
  ]);

  assert.match(page, /import StudioRootController from "\.\/StudioRootController\.js"/);
  assert.match(page, /return <StudioRootController \/>/);
  assert.doesNotMatch(page, /generateStudioCampaign|publishStudioPost|createBrowserCampaignApplication/);
  assert.doesNotMatch(page, /useCampaignEditorSession|useProviderRouteController|useOwnerConnectionsController/);

  assert.match(controller, /export default function StudioRootController\(\)/);
  assert.match(controller, /<LandingPage/);
  assert.match(controller, /<WorkspaceShell/);
  assert.match(controller, /useCampaignEditorSession\(\)/);
  assert.match(controller, /generateStudioCampaign/);
});

test("Studio regression tests target the controller owner instead of the route wrapper", async () => {
  const routeSensitiveTests = [
    "../tests/studioStepIsolation.test.mjs",
    "../tests/campaignFreshness.test.mjs",
    "../tests/generationQualityContracts.test.mjs",
    "../tests/reviewPublishingPriority.test.mjs",
  ];

  for (const relative of routeSensitiveTests) {
    const source = await readFile(new URL(relative, import.meta.url), "utf8");
    assert.match(source, /StudioRootController\.js/);
    assert.doesNotMatch(source, /app\/page\.js/);
  }
});
