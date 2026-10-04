import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const rootUrl = new URL("../app/page.js", import.meta.url);
const studioUrl = new URL("../app/studio/page.js", import.meta.url);
const controllerUrl = new URL("../app/StudioRootController.js", import.meta.url);

test("Landing and Create have explicit route owners", async () => {
  const [root, studio, controller] = await Promise.all([
    readFile(rootUrl, "utf8"),
    readFile(studioUrl, "utf8"),
    readFile(controllerUrl, "utf8"),
  ]);

  assert.match(root, /import LandingPage from "\.\.\/components\/LandingPage"/);
  assert.match(root, /return <LandingPage \/>/);
  assert.match(root, /redirect\(\`\/studio\$\{forwarded\}\`\)/);
  assert.doesNotMatch(root, /StudioRootController|generateStudioCampaign|publishStudioPost|useCampaignEditorSession/);

  assert.match(studio, /import StudioRootController from "\.\.\/StudioRootController\.js"/);
  assert.match(studio, /return <StudioRootController \/>/);

  assert.match(controller, /export default function StudioRootController\(\)/);
  assert.match(controller, /<WorkspaceShell[\s\S]*activeItem="create"/);
  assert.match(controller, /useCampaignEditorSession\(\)/);
  assert.match(controller, /useCampaignGenerationController\(/);
  assert.doesNotMatch(controller, /generateStudioCampaign|new AbortController|acceptGenerationResponse/);
  assert.doesNotMatch(controller, /LandingPage|workspace === "settings"|workspace === "library"|socialStatus/);
});

test("Studio regression tests target the controller owner instead of route wrappers", async () => {
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
