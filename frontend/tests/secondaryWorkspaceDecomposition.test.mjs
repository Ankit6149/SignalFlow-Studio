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

  assert.match(page, /import LibraryWorkspace from/);
  assert.match(page, /import ConnectionsWorkspace from/);
  assert.match(page, /import SettingsWorkspace from/);
  assert.match(page, /<LibraryWorkspace/);
  assert.match(page, /<ConnectionsWorkspace/);
  assert.match(page, /<SettingsWorkspace/);

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

  assert.match(page, /function useChannelInStudio\(channelId\)/);
  assert.match(page, /function exportLocalLibrary\(\)/);
  assert.match(page, /function clearLocalLibrary\(\)/);
  assert.match(page, /async function refreshLibrary\(\)/);

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
