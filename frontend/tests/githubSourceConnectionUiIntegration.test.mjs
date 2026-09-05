import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  githubSourceConnectionConfigurationStatus,
  resolveOwnerWorkspaceId,
} from "../lib/server/githubConnectionDependencies.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(here, "..");
const read = (relative) => fs.readFileSync(path.join(frontendRoot, relative), "utf8");

function configuredEnv(overrides = {}) {
  return {
    SIGNALFLOW_PUBLIC_HOSTED: "true",
    SIGNALFLOW_ACCESS_KEY: "owner-lock",
    SIGNALFLOW_WORKSPACE_ID: "owner-local",
    NEXTAUTH_URL: "https://signalflow.invalid",
    DATABASE_URL: "postgresql://example.invalid/db",
    GITHUB_APP_ID: "12345",
    GITHUB_APP_SLUG: "signalflow-test",
    GITHUB_APP_PRIVATE_KEY: "present-for-readiness-only",
    GITHUB_APP_CLIENT_ID: "client-id",
    GITHUB_APP_CLIENT_SECRET: "client-secret",
    GITHUB_INSTALL_STATE_SECRET: "state-secret-present-for-readiness-only",
    ...overrides,
  };
}

test("public hosted GitHub source readiness fails closed unless either legacy App credentials or secure manifest prerequisites are complete", () => {
  const unlocked = githubSourceConnectionConfigurationStatus(configuredEnv({ SIGNALFLOW_ACCESS_KEY: "" }));
  assert.equal(unlocked.configured, false);
  assert.ok(unlocked.missing.includes("SIGNALFLOW_ACCESS_KEY"));

  const incompleteLegacy = githubSourceConnectionConfigurationStatus(configuredEnv({ GITHUB_APP_CLIENT_SECRET: "" }));
  assert.equal(incompleteLegacy.configured, false);
  assert.equal(incompleteLegacy.mode, "unconfigured");
  assert.ok(incompleteLegacy.missing.includes("SIGNALFLOW_CREDENTIAL_VAULT_SECRET|SIGNALFLOW_ACCESS_KEY"));
  assert.equal(incompleteLegacy.missing.includes("GITHUB_APP_CLIENT_SECRET"), false);

  const manifestReady = githubSourceConnectionConfigurationStatus(configuredEnv({
    SIGNALFLOW_ACCESS_KEY: "o".repeat(48),
    GITHUB_APP_ID: "",
    GITHUB_APP_SLUG: "",
    GITHUB_APP_PRIVATE_KEY: "",
    GITHUB_APP_CLIENT_ID: "",
    GITHUB_APP_CLIENT_SECRET: "",
    GITHUB_INSTALL_STATE_SECRET: "",
  }));
  assert.equal(manifestReady.configured, true);
  assert.equal(manifestReady.mode, "manifest");
  assert.deepEqual(manifestReady.missing, []);

  const legacyReady = githubSourceConnectionConfigurationStatus(configuredEnv());
  assert.equal(legacyReady.configured, true);
  assert.equal(legacyReady.mode, "legacy_app");
  assert.deepEqual(legacyReady.missing, []);
});

test("Personal Alpha uses the same owner-local workspace identity unless explicitly overridden", () => {
  assert.equal(resolveOwnerWorkspaceId({}), "owner-local");
  assert.equal(resolveOwnerWorkspaceId({ SIGNALFLOW_WORKSPACE_ID: "workspace-custom" }), "workspace-custom");
});

test("Connections workspace renders GitHub sources in the existing canonical shell, not a competing route", () => {
  const shell = read("components/WorkspaceShell.js");
  const panel = read("components/GithubSourceConnectionPanel.js");
  assert.match(shell, /GithubSourceConnectionPanel/);
  assert.match(shell, /activeItem === "connections"/);
  assert.match(panel, /Source connections/);
  assert.match(panel, /\/api\/sources\/github\/connect/);
  assert.match(panel, /\/api\/sources\/github\/repositories/);
  assert.match(panel, /\/api\/sources\/github\/connections/);
  assert.match(panel, /there is no trigger setup/i);
  assert.doesNotMatch(panel, /GITHUB_APP_PRIVATE_KEY|GITHUB_APP_CLIENT_SECRET|GITHUB_INSTALL_STATE_SECRET|credentialRef/);
});

test("GitHub source panel keeps source and destination responsibilities distinct", () => {
  const panel = read("components/GithubSourceConnectionPanel.js");
  assert.match(panel, /work worth talking about/i);
  assert.match(panel, /repository events as signals/i);
  assert.doesNotMatch(panel, /LinkedIn|Instagram|TikTok|publish approved/i);
});

test("GitHub setup and OAuth callbacks are distinct Node-only routes", () => {
  const setup = read("app/api/sources/github/callback/route.js");
  const oauth = read("app/api/sources/github/oauth/callback/route.js");
  assert.match(setup, /runtime = "nodejs"/);
  assert.match(setup, /handlers\.callback/);
  assert.match(oauth, /runtime = "nodejs"/);
  assert.match(oauth, /handlers\.oauthCallback/);
  assert.match(oauth, /requireOwnerAccess/);
});
