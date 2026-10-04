import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const rootUrl = new URL("../app/page.js", import.meta.url);
const settingsUrl = new URL("../app/settings/page.js", import.meta.url);
const shellUrl = new URL("../components/WorkspaceShell.js", import.meta.url);

test("Settings is an independent route rather than campaign-controller state", async () => {
  const [root, settings, shell] = await Promise.all([
    readFile(rootUrl, "utf8"),
    readFile(settingsUrl, "utf8"),
    readFile(shellUrl, "utf8"),
  ]);

  assert.match(shell, /id: "settings", label: "Settings", href: "\/settings"/);
  assert.match(settings, /<WorkspaceShell[\s\S]*activeItem="settings"/);
  assert.match(settings, /<SettingsWorkspace/);
  assert.match(settings, /useOwnerConnectionsController\(/);
  assert.doesNotMatch(settings, /campaignReducer|dispatchCampaign|generateStudioCampaign|publishStudioPost/);
  assert.doesNotMatch(root, /<SettingsWorkspace/);
  assert.match(root, /workspace === "settings"[\s\S]*window\.location\.replace\("\/settings"\)/);
});

test("legacy and shared-shell Create navigation both enter the Studio workspace", async () => {
  const root = await readFile(rootUrl, "utf8");
  assert.match(root, /\["create", "studio", "library", "connections"\]\.includes\(workspace\)/);
  assert.match(root, /workspace === "create" \|\| workspace === "studio" \? "studio" : workspace/);
});
