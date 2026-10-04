import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(testDir, "..");
const read = (relative) => fs.readFileSync(path.join(frontendRoot, relative), "utf8");

test("secondary workspaces are explicit presentation components", () => {
  const page = read("app/page.js");
  const library = read("components/LibraryWorkspace.js");
  const connections = read("components/ConnectionsWorkspace.js");
  const settings = read("components/SettingsWorkspace.js");
  const settingsRoute = read("app/settings/page.js");
  const connectionsRoute = read("app/connections/page.js");

  assert.match(page, /import LibraryWorkspace from/);
  assert.doesNotMatch(page, /import ConnectionsWorkspace from/);
  assert.doesNotMatch(page, /import SettingsWorkspace from/);
  assert.match(page, /<LibraryWorkspace/);
  assert.doesNotMatch(page, /<ConnectionsWorkspace/);
  assert.match(connectionsRoute, /import ConnectionsWorkspace from/);
  assert.match(connectionsRoute, /<ConnectionsWorkspace/);
  assert.doesNotMatch(page, /<SettingsWorkspace/);
  assert.match(settingsRoute, /import SettingsWorkspace from/);
  assert.match(settingsRoute, /<SettingsWorkspace/);

  for (const [name, source] of [
    ["LibraryWorkspace", library],
    ["ConnectionsWorkspace", connections],
    ["SettingsWorkspace", settings],
  ]) {
    assert.doesNotMatch(source, /\bfetch\s*\(/, `${name} must not own network transport`);
    assert.doesNotMatch(source, /\/api\//, `${name} must not own API routes`);
    assert.doesNotMatch(source, /localStorage/, `${name} must not own browser persistence`);
  }
});

test("secondary workspace mutations stay explicit in the page controller", () => {
  const page = read("app/page.js");
  const connections = read("components/ConnectionsWorkspace.js");
  const settings = read("components/SettingsWorkspace.js");
  const settingsRoute = read("app/settings/page.js");
  const connectionsRoute = read("app/connections/page.js");

  assert.doesNotMatch(page, /function useChannelInStudio\(channelId\)/);
  assert.match(connectionsRoute, /function useChannelInStudio\(channelId\)/);
  assert.doesNotMatch(page, /function exportLocalLibrary\(\)/);
  assert.doesNotMatch(page, /function clearLocalLibrary\(\)/);
  assert.match(page, /async function refreshLibrary\(\)/);
  assert.match(settingsRoute, /async function exportLocalLibrary\(\)/);
  assert.match(settingsRoute, /function clearLocalLibrary\(\)/);
  assert.match(settingsRoute, /useOwnerConnectionsController\(/);

  assert.match(connections, /onConnect\(channel\.id\)/);
  assert.match(connections, /onDisconnect\(channel\.id\)/);
  assert.match(connections, /onUseInStudio\(channel\.id\)/);

  assert.match(settings, /onUnlockOwner/);
  assert.match(settings, /onLockOwner/);
  assert.match(settings, /onExportLibrary/);
  assert.match(settings, /onClearLibrary/);
});

test("Library keeps portable transfer and campaign actions explicit", () => {
  const library = read("components/LibraryWorkspace.js");

  assert.match(library, /<PortableTransferPanel/);
  assert.match(library, /campaigns=\{campaigns\}/);
  assert.match(library, /onLibraryChanged=\{onLibraryChanged\}/);
  assert.match(library, /onOpenCampaign\(item\)/);
  assert.match(library, /onDeleteCampaign\(item\.campaignId\)/);
});

test("Connections preserves truthful connector gates without transport ownership", () => {
  const connections = read("components/ConnectionsWorkspace.js");

  assert.match(connections, /Implementation, deployment credentials, account authorization, and live post verification are separate gates/);
  assert.match(connections, /status\.scopeStatus === "verified"/);
  assert.match(connections, /status\.canPublishText/);
  assert.match(connections, /Live post verification/);
  assert.match(connections, /manual channels remain explicit instead of pretending to/);
});
