import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { gp2ReadinessStatus } from "../lib/server/gp2Readiness.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(here, "..");
const read = (relative) => fs.readFileSync(path.join(frontendRoot, relative), "utf8");

function readyEnv() {
  return {
    SIGNALFLOW_PUBLIC_HOSTED: "true",
    SIGNALFLOW_ACCESS_KEY: "owner-secret-value",
    SIGNALFLOW_WORKSPACE_ID: "owner-local",
    NEXTAUTH_URL: "https://signalflow.invalid",
    DATABASE_URL: "postgresql://private-database-value.invalid/db",
    GITHUB_APP_ID: "12345",
    GITHUB_APP_SLUG: "signalflow-test",
    GITHUB_APP_PRIVATE_KEY: "private-key-secret-value",
    GITHUB_APP_CLIENT_ID: "client-id-value",
    GITHUB_APP_CLIENT_SECRET: "client-secret-value",
    GITHUB_INSTALL_STATE_SECRET: "install-state-secret-value",
    GITHUB_WEBHOOK_SECRET: "webhook-secret-value",
    SIGNALFLOW_S3_ENDPOINT: "https://private-storage.invalid",
    SIGNALFLOW_S3_BUCKET: "private-bucket-value",
    SIGNALFLOW_S3_REGION: "auto",
    SIGNALFLOW_S3_ACCESS_KEY_ID: "storage-access-secret-value",
    SIGNALFLOW_S3_SECRET_ACCESS_KEY: "storage-secret-value",
    SIGNALFLOW_MEDIA_PREVIEW_RECEIPT_SECRET: "preview-receipt-secret-value-at-least-32-characters",
    SIGNALFLOW_CDP_BROWSER_WS_ENDPOINT: "wss://private-browser.invalid/devtools/browser/test",
    SIGNALFLOW_CAPTURE_ENVIRONMENT: "preview",
    SIGNALFLOW_CAPTURE_ALLOW_INSECURE_LOCALHOST: "false",
    OPENAI_API_KEY: "model-secret-value",
  };
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test("GP2 readiness data is safe to render because secret values never leave the server contract", () => {
  const env = readyEnv();
  const status = gp2ReadinessStatus(env);
  const serialized = JSON.stringify(status);

  assert.equal(status.ready, true);
  assert.equal(status.checks.length, 8);
  assert.deepEqual(status.missing, []);
  for (const secretValue of [
    env.SIGNALFLOW_ACCESS_KEY,
    env.DATABASE_URL,
    env.GITHUB_APP_PRIVATE_KEY,
    env.GITHUB_APP_CLIENT_SECRET,
    env.GITHUB_INSTALL_STATE_SECRET,
    env.GITHUB_WEBHOOK_SECRET,
    env.SIGNALFLOW_S3_ACCESS_KEY_ID,
    env.SIGNALFLOW_S3_SECRET_ACCESS_KEY,
    env.SIGNALFLOW_MEDIA_PREVIEW_RECEIPT_SECRET,
    env.SIGNALFLOW_CDP_BROWSER_WS_ENDPOINT,
    env.OPENAI_API_KEY,
  ]) {
    assert.doesNotMatch(serialized, new RegExp(escapeRegExp(secretValue)));
  }
});

test("Vercel GP2 readiness remains blocked when the owner lock is missing even without the explicit hosted flag", () => {
  const env = {
    ...readyEnv(),
    SIGNALFLOW_PUBLIC_HOSTED: "",
    SIGNALFLOW_ACCESS_KEY: "",
    VERCEL: "1",
  };
  const status = gp2ReadinessStatus(env);
  const ownerLock = status.checks.find((item) => item.id === "owner_lock");
  const githubApp = status.checks.find((item) => item.id === "github_app");

  assert.equal(status.ready, false);
  assert.equal(ownerLock?.configured, false);
  assert.deepEqual(ownerLock?.missing, ["SIGNALFLOW_ACCESS_KEY"]);
  assert.equal(githubApp?.configured, false);
  assert.ok(githubApp?.missing.includes("SIGNALFLOW_ACCESS_KEY"));
});

test("Connections workspace renders readiness before GitHub installation controls", () => {
  const shell = read("components/WorkspaceShell.js");
  assert.match(shell, /import Gp2ReadinessPanel from "\.\/Gp2ReadinessPanel"/);
  assert.match(shell, /activeItem === "connections" && <><Gp2ReadinessPanel \/><GithubSourceConnectionPanel \/><\/>/);
  assert.ok(shell.indexOf("<Gp2ReadinessPanel />") < shell.indexOf("<GithubSourceConnectionPanel />"));
});

test("browser readiness panel uses only the protected owner-safe API surface and fails closed on contract drift", () => {
  const panel = read("components/Gp2ReadinessPanel.js");
  assert.match(panel, /fetch\("\/api\/gp2\/readiness"/);
  assert.match(panel, /credentials: "same-origin"/);
  assert.match(panel, /state\.error\?\.status === 401/);
  assert.match(panel, /state\.error\?\.code === "owner_access_unconfigured"/);
  assert.match(panel, /Owner lock configuration required/);
  assert.match(panel, /credential values never leave the server/i);
  assert.match(panel, /const CHECK_LABELS = Object\.freeze/);
  assert.match(panel, /const CONFIGURATION_NAME = \/\^\[A-Z0-9_\+\|\.\-\]/);
  assert.match(panel, /filter\(\(value\) => CONFIGURATION_NAME\.test\(value\)\)/);
  assert.match(panel, /raw\.checks\.length !== CHECK_IDS\.length/);
  assert.match(panel, /gp2_readiness_contract_invalid/);
  assert.doesNotMatch(panel, /process\.env/);
  assert.doesNotMatch(panel, /GITHUB_APP_PRIVATE_KEY|GITHUB_APP_CLIENT_SECRET|GITHUB_WEBHOOK_SECRET|SIGNALFLOW_S3_SECRET_ACCESS_KEY|OPENAI_API_KEY/);
});

test("GP2 readiness route stays owner-authenticated and non-cacheable", () => {
  const route = read("app/api/gp2/readiness/route.js");
  assert.match(route, /requireOwnerAccess\(request\)/);
  assert.match(route, /cache-control": "private, no-store, max-age=0"/);
  assert.match(route, /gp2ReadinessStatus\(process\.env\)/);
  assert.doesNotMatch(route, /SIGNALFLOW_ACCESS_KEY\s*[:=]|GITHUB_APP_PRIVATE_KEY\s*[:=]|OPENAI_API_KEY\s*[:=]/);
});
