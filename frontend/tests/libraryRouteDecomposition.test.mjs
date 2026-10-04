import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const rootUrl = new URL("../app/page.js", import.meta.url);
const libraryUrl = new URL("../app/library/page.js", import.meta.url);
const shellUrl = new URL("../components/WorkspaceShell.js", import.meta.url);
const sessionUrl = new URL("../lib/studio/CampaignEditorSessionContext.js", import.meta.url);

test("Library is an independent route that preserves the shared editor session", async () => {
  const [root, library, shell, session] = await Promise.all([
    readFile(rootUrl, "utf8"),
    readFile(libraryUrl, "utf8"),
    readFile(shellUrl, "utf8"),
    readFile(sessionUrl, "utf8"),
  ]);

  assert.match(shell, /id: "library", label: "Library", href: "\/library"/);
  assert.match(library, /<WorkspaceShell activeItem="library"/);
  assert.match(library, /<LibraryWorkspace/);
  assert.match(library, /useCampaignEditorSession\(\)/);
  assert.match(library, /router\.push\("\/studio"\)/);
  assert.doesNotMatch(root, /<LibraryWorkspace/);
  assert.match(root, /workspace === "library"[\s\S]*redirect\(\`\/library\$\{forwarded\}\`\)/);
  assert.match(session, /function resetEditorSession\(\)/);
  assert.match(session, /function restoreEditorSession\(restored\)/);
});

test("Library owns browser-library I/O without absorbing generation or publishing", async () => {
  const library = await readFile(libraryUrl, "utf8");

  assert.match(library, /createBrowserCampaignApplication/);
  assert.match(library, /campaignApplication\.listCampaigns/);
  assert.match(library, /campaignApplication\.openCampaign/);
  assert.match(library, /campaignApplication\.deleteCampaign/);
  assert.doesNotMatch(library, /generateStudioCampaign|publishStudioPost|dispatchCampaign/);
  assert.doesNotMatch(library, /providerReadiness|useProviderRouteController|useOwnerConnectionsController/);
});
