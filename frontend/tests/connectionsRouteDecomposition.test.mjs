import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const rootUrl = new URL("../app/StudioRootController.js", import.meta.url);
const routeUrl = new URL("../app/connections/page.js", import.meta.url);
const shellUrl = new URL("../components/WorkspaceShell.js", import.meta.url);
const callbackUrl = new URL("../app/api/social/callback/[platform]/route.js", import.meta.url);

test("Connections is an independent route with callback-safe compatibility", async () => {
  const [root, route, shell, callback] = await Promise.all([
    readFile(rootUrl, "utf8"),
    readFile(routeUrl, "utf8"),
    readFile(shellUrl, "utf8"),
    readFile(callbackUrl, "utf8"),
  ]);

  assert.match(shell, /id: "connections", label: "Connections", href: "\/connections"/);
  assert.match(route, /<WorkspaceShell[\s\S]*activeItem="connections"/);
  assert.match(route, /<ConnectionsWorkspace/);
  assert.match(route, /useOwnerConnectionsController\(/);
  assert.doesNotMatch(route, /campaignReducer|dispatchCampaign|generateStudioCampaign|publishStudioPost/);
  assert.doesNotMatch(root, /<ConnectionsWorkspace/);
  assert.match(callback, /\$\{baseUrl\}\/connections\?\$\{params\.toString\(\)\}/);
  assert.match(root, /workspace === "connections" \|\| socialStatus/);
  assert.match(root, /if \(key !== "workspace"\) next\.searchParams\.append\(key, value\)/);
});

test("Connections can hand a manual destination back to Studio without re-owning campaign state", async () => {
  const [root, route] = await Promise.all([
    readFile(rootUrl, "utf8"),
    readFile(routeUrl, "utf8"),
  ]);

  assert.match(route, /\?workspace=studio&channel=\$\{encodeURIComponent\(channelId\)\}/);
  assert.match(root, /const requestedChannel = params\.get\("channel"\)/);
  assert.match(root, /CHANNELS\.some\(\(item\) => item\.id === requestedChannel\)/);
  assert.match(root, /setActiveChannel\(requestedChannel\)/);
});
