import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createPostgresCredentialVault } from "../lib/infrastructure/postgresCredentialVaultAdapter.mjs";
import { buildSignalFlowGithubAppManifest } from "../lib/integrations/github/githubAppManifest.mjs";
import { githubManifestPrerequisiteStatus } from "../lib/server/githubCredentialAuthority.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function fakeVaultDatabase() {
  const rows = new Map();
  return {
    rows,
    async query(sql, params = []) {
      const text = String(sql || "");
      if (/INSERT INTO sf_secret_records/i.test(text)) {
        const [id, workspaceId, secretKind, envelopeJson, schemaVersion, now] = params;
        if (rows.has(id)) return { rows: [] };
        rows.set(id, {
          secret_record_id: id,
          workspace_id: workspaceId,
          secret_kind: secretKind,
          envelope: JSON.parse(envelopeJson),
          schema_version: schemaVersion,
          created_at: now,
          updated_at: now,
        });
        return { rows: [{ secret_record_id: id }] };
      }
      if (/SELECT secret_record_id, workspace_id, secret_kind, envelope/i.test(text)) {
        const [id, workspaceId] = params;
        const row = rows.get(id);
        return { rows: row && row.workspace_id === workspaceId ? [row] : [] };
      }
      if (/DELETE FROM sf_secret_records/i.test(text)) {
        const [id, workspaceId] = params;
        const row = rows.get(id);
        if (!row || row.workspace_id !== workspaceId) return { rows: [] };
        rows.delete(id);
        return { rows: [{ secret_record_id: id }] };
      }
      throw new Error(`Unexpected credential-vault SQL: ${text}`);
    },
  };
}

test("GitHub manifest requests only the exact read-only SignalFlow permissions and events", () => {
  const manifest = buildSignalFlowGithubAppManifest({
    origin: "https://signal-flow-studio.vercel.app",
    appName: "SignalFlow Studio Test",
  });

  assert.equal(manifest.url, "https://signal-flow-studio.vercel.app");
  assert.equal(manifest.hook_attributes.url, "https://signal-flow-studio.vercel.app/api/sources/github/webhook");
  assert.equal(manifest.redirect_url, "https://signal-flow-studio.vercel.app/api/sources/github/manifest/callback");
  assert.deepEqual(manifest.callback_urls, ["https://signal-flow-studio.vercel.app/api/sources/github/oauth/callback"]);
  assert.equal(manifest.setup_url, "https://signal-flow-studio.vercel.app/api/sources/github/callback");
  assert.equal(manifest.public, false);
  assert.deepEqual([...manifest.default_events].sort(), ["pull_request", "release"]);
  assert.deepEqual(manifest.default_permissions, {
    metadata: "read",
    contents: "read",
    pull_requests: "read",
  });
  assert.equal(manifest.request_oauth_on_install, false);
  assert.equal(manifest.setup_on_update, false);
});

test("credential vault stores only authenticated ciphertext and round-trips exact GitHub credentials", async () => {
  const database = fakeVaultDatabase();
  const vault = createPostgresCredentialVault({
    database,
    workspaceId: "owner-local",
    vaultSecret: "v".repeat(48),
    clock: { now: () => "2026-09-06T00:00:00.000Z" },
  });
  const secret = {
    appId: "12345",
    slug: "signalflow-studio-test",
    privateKey: "-----BEGIN PRIVATE KEY-----\nTOP-SECRET-PEM\n-----END PRIVATE KEY-----",
    clientId: "Iv1.client-secret-test",
    clientSecret: "github-client-secret-sensitive",
    webhookSecret: "github-webhook-secret-sensitive",
  };

  await vault.put({
    secretRecordId: "github-app-12345",
    secretKind: "github_app_credentials",
    value: secret,
  });

  const persisted = database.rows.get("github-app-12345");
  assert.ok(persisted?.envelope?.ciphertext);
  const serializedEnvelope = JSON.stringify(persisted.envelope);
  for (const value of Object.values(secret)) assert.equal(serializedEnvelope.includes(value), false);

  const restored = await vault.get("github-app-12345", "github_app_credentials");
  assert.deepEqual(restored, secret);
  assert.equal(await vault.remove("github-app-12345"), true);
  assert.equal(await vault.get("github-app-12345", "github_app_credentials"), null);
});

test("manifest provisioning needs only database plus the existing strong owner root on Vercel", () => {
  const env = {
    VERCEL: "1",
    VERCEL_PROJECT_PRODUCTION_URL: "signal-flow-studio.vercel.app",
    DATABASE_URL: "postgresql://example.invalid/neondb",
    SIGNALFLOW_PUBLIC_HOSTED: "true",
    SIGNALFLOW_ACCESS_KEY: "o".repeat(48),
  };
  const status = githubManifestPrerequisiteStatus(env);
  assert.equal(status.configured, true);
  assert.deepEqual(status.missing, []);

  delete env.DATABASE_URL;
  const missingDatabase = githubManifestPrerequisiteStatus(env);
  assert.equal(missingDatabase.configured, false);
  assert.deepEqual(missingDatabase.missing, ["DATABASE_URL"]);
});

test("manifest registration routes stay owner-only, no-store and never serialize returned credentials", () => {
  const register = fs.readFileSync(path.join(ROOT, "app/api/sources/github/manifest/register/route.js"), "utf8");
  const callback = fs.readFileSync(path.join(ROOT, "app/api/sources/github/manifest/callback/route.js"), "utf8");

  assert.match(register, /requireOwnerAccess\(request\)/);
  assert.match(register, /cache-control": "private, no-store, max-age=0"/);
  assert.match(register, /form-action https:\/\/github\.com/);
  assert.match(register, /prepareManifestRegistration/);
  assert.doesNotMatch(register, /privateKey|clientSecret|webhookSecret/);

  assert.match(callback, /requireOwnerAccess\(request\)/);
  assert.match(callback, /completeManifestRegistration/);
  assert.match(callback, /Response\.redirect\(result\.installUrl, 303\)/);
  assert.doesNotMatch(callback, /JSON\.stringify\(result\)|privateKey|clientSecret|webhookSecret/);
});
