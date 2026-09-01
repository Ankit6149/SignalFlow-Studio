import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { gp2ReadinessStatus } from "../lib/server/gp2Readiness.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function configuredEnv() {
  return {
    SIGNALFLOW_PUBLIC_HOSTED: "true",
    SIGNALFLOW_ACCESS_KEY: "owner-lock",
    SIGNALFLOW_WORKSPACE_ID: "owner-local",
    DATABASE_URL: "postgres://example.invalid/signalflow",
    GITHUB_APP_ID: "12345",
    GITHUB_APP_SLUG: "signalflow-test",
    GITHUB_APP_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\nopaque-test-key\n-----END PRIVATE KEY-----",
    GITHUB_APP_CLIENT_ID: "client-id",
    GITHUB_APP_CLIENT_SECRET: "client-secret",
    GITHUB_INSTALL_STATE_SECRET: "github-install-state-secret-with-at-least-32-characters",
    NEXTAUTH_URL: "https://signal-flow-studio.vercel.app",
    GITHUB_WEBHOOK_SECRET: "github-webhook-secret",
    SIGNALFLOW_S3_ENDPOINT: "https://objects.example.invalid",
    SIGNALFLOW_S3_BUCKET: "signalflow-private",
    SIGNALFLOW_S3_REGION: "auto",
    SIGNALFLOW_S3_ACCESS_KEY_ID: "access-key",
    SIGNALFLOW_S3_SECRET_ACCESS_KEY: "secret-key",
    SIGNALFLOW_CDP_BROWSER_WS_ENDPOINT: "wss://browser.example.invalid/devtools/browser/opaque",
    SIGNALFLOW_CAPTURE_ENVIRONMENT: "preview",
    SIGNALFLOW_MEDIA_PREVIEW_RECEIPT_SECRET: "preview-receipt-secret-with-at-least-32-characters",
    OPENAI_API_KEY: "provider-key",
  };
}

test("GP2 readiness is true only when every production dependency class is configured", () => {
  const status = gp2ReadinessStatus(configuredEnv());
  assert.equal(status.ready, true);
  assert.deepEqual(status.missing, []);
  assert.ok(status.checks.every((item) => item.configured));
  assert.deepEqual(
    status.checks.map((item) => item.id),
    ["database", "owner_lock", "github_app", "github_webhook", "private_asset_storage", "capture_worker", "exact_media_preview", "inference"],
  );
});

test("GP2 readiness reports only missing configuration names and never values", () => {
  const env = configuredEnv();
  delete env.GITHUB_WEBHOOK_SECRET;
  delete env.SIGNALFLOW_CDP_BROWSER_WS_ENDPOINT;
  env.SIGNALFLOW_MEDIA_PREVIEW_RECEIPT_SECRET = "short";
  delete env.OPENAI_API_KEY;

  const status = gp2ReadinessStatus(env);
  assert.equal(status.ready, false);
  assert.ok(status.missing.includes("GITHUB_WEBHOOK_SECRET"));
  assert.ok(status.missing.includes("SIGNALFLOW_CDP_BROWSER_WS_ENDPOINT"));
  assert.ok(status.missing.includes("SIGNALFLOW_MEDIA_PREVIEW_RECEIPT_SECRET"));
  assert.ok(status.missing.some((item) => item.includes("OPENAI_API_KEY")));
  const serialized = JSON.stringify(status);
  assert.doesNotMatch(serialized, /owner-lock|client-secret|secret-key|provider-key|preview-receipt-secret/);
});

test("public hosted readiness requires the owner access lock", () => {
  const env = configuredEnv();
  delete env.SIGNALFLOW_ACCESS_KEY;
  const status = gp2ReadinessStatus(env);
  const owner = status.checks.find((item) => item.id === "owner_lock");
  assert.equal(owner.configured, false);
  assert.deepEqual(owner.missing, ["SIGNALFLOW_ACCESS_KEY"]);
});

test("GP2 readiness route is owner-only, no-store and returns the safe status contract", () => {
  const route = fs.readFileSync(path.join(ROOT, "app", "api", "gp2", "readiness", "route.js"), "utf8");
  assert.match(route, /requireOwnerAccess\(request\)/);
  assert.match(route, /gp2ReadinessStatus\(process\.env\)/);
  assert.match(route, /private, no-store, max-age=0/);
  assert.doesNotMatch(route, /process\.env\[[^\]]+\].*Response|secret.*value|credentialRef|storageRef/);
});
