import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(here, "..");
const read = (relative) => fs.readFileSync(path.join(frontendRoot, relative), "utf8");

test("Connections consumes only SignalFlow callback status/error fields and removes them after use", () => {
  const panel = read("components/GithubSourceConnectionPanel.js");
  assert.match(panel, /params\.get\("github_source_status"\)/);
  assert.match(panel, /params\.get\("github_source_error"\)/);
  assert.match(panel, /params\.get\("source_connection"\)/);
  assert.match(panel, /next\.searchParams\.delete\("github_source_status"\)/);
  assert.match(panel, /next\.searchParams\.delete\("github_source_error"\)/);
  assert.match(panel, /next\.searchParams\.delete\("source_connection"\)/);
  assert.doesNotMatch(panel, /params\.get\("state"\)|params\.get\("code"\)|params\.get\("error_description"\)/);
});

test("callback recovery copy is applied after initial refresh so refresh cannot erase it", () => {
  const panel = read("components/GithubSourceConnectionPanel.js");
  const start = panel.indexOf("async function initialize()");
  const end = panel.indexOf("void initialize();", start);
  assert.ok(start >= 0 && end > start);
  const initialize = panel.slice(start, end);
  const cleanupIndex = initialize.indexOf("clearCallbackParams();");
  const refreshIndex = initialize.indexOf("await refresh();");
  const installedIndex = initialize.indexOf('callbackStatus === "installed"');
  const errorIndex = initialize.indexOf('callbackStatus === "error"');
  assert.ok(cleanupIndex >= 0 && cleanupIndex < refreshIndex);
  assert.ok(refreshIndex < installedIndex);
  assert.ok(refreshIndex < errorIndex);
  assert.match(initialize, /const loaded = await loadRepositories\(callbackConnection\)/);
  assert.match(initialize, /if \(loaded\) \{[\s\S]*GitHub installation and owner authorization verified/);
  assert.match(initialize, /friendlyError\(\{ code: callbackError \|\| "github_connection_failed" \}\)/);
});

test("repository discovery reports success only when an observable repository was actually loaded", () => {
  const panel = read("components/GithubSourceConnectionPanel.js");
  const start = panel.indexOf("async function loadRepositories");
  const end = panel.indexOf("async function bootstrapRepository", start);
  assert.ok(start >= 0 && end > start);
  const loader = panel.slice(start, end);
  assert.match(loader, /const items = Array\.isArray\(body\.repositories\) \? body\.repositories : \[\]/);
  assert.match(loader, /if \(!items\.length\) \{[\s\S]*return false;/);
  assert.match(loader, /return true;/);
  assert.match(loader, /catch \(error\) \{[\s\S]*return false;/);
});

test("callback-safe server codes map to actionable owner copy without displaying raw callback data", () => {
  const panel = read("components/GithubSourceConnectionPanel.js");
  for (const code of [
    "owner_session_required",
    "owner_access_unconfigured",
    "github_install_state_expired",
    "github_install_state_invalid",
    "github_install_state_workspace_mismatch",
    "github_install_callback_incomplete",
    "github_oauth_callback_incomplete",
    "github_provider_unavailable",
    "github_connection_unavailable",
    "github_user_authorization_denied",
    "github_installation_permissions_insufficient",
  ]) {
    assert.match(panel, new RegExp(code));
  }
  assert.doesNotMatch(panel, /error_description|oauth-code|authorization code|signed state/i);
});
