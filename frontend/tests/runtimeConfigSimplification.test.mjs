import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import { createPostgresBlobStorage } from "../lib/infrastructure/postgresBlobStorage.mjs";
import { hostedAssetStorageConfigurationStatus } from "../lib/server/hostedAssetPreviewDependencies.mjs";
import { gp2ReadinessStatus } from "../lib/server/gp2Readiness.mjs";
import { resolveGithubRuntimeEnv } from "../lib/server/githubRuntimeConfig.mjs";
import {
  resolveGithubInstallStateSecret,
  resolveMediaPreviewReceiptSecret,
} from "../lib/server/runtimeSigningSecrets.mjs";

function hash(bytes) {
  return `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
}

function createBlobDatabase() {
  const rows = new Map();
  return {
    rows,
    async query(sql, params) {
      if (/^\s*SELECT\s+/i.test(sql)) {
        const [workspaceId, recordKind, recordId] = params;
        const row = rows.get(recordId);
        if (!row || row.workspace_id !== workspaceId || row.record_kind !== recordKind) return { rows: [] };
        return { rows: [structuredClone(row)] };
      }
      if (/^\s*INSERT\s+/i.test(sql)) {
        const [recordId, workspaceId, recordKind, recordJson] = params;
        if (!rows.has(recordId)) {
          rows.set(recordId, {
            record_id: recordId,
            workspace_id: workspaceId,
            record_kind: recordKind,
            record: JSON.parse(recordJson),
          });
        }
        return { rows: [] };
      }
      if (/^\s*DELETE\s+/i.test(sql)) {
        const [workspaceId, recordKind, recordId] = params;
        const row = rows.get(recordId);
        if (!row || row.workspace_id !== workspaceId || row.record_kind !== recordKind) return { rows: [] };
        rows.delete(recordId);
        return { rows: [{ record_id: recordId }] };
      }
      throw new Error(`Unexpected SQL in blob-storage test: ${sql}`);
    },
  };
}

test("runtime signing secrets use explicit overrides or domain-separated owner derivation", () => {
  const env = { SIGNALFLOW_ACCESS_KEY: "owner-access-key-that-is-long-enough-for-signing-123456" };
  const github = resolveGithubInstallStateSecret(env);
  const preview = resolveMediaPreviewReceiptSecret(env);

  assert.ok(github.length >= 32);
  assert.ok(preview.length >= 32);
  assert.notEqual(github, preview);
  assert.equal(github, resolveGithubInstallStateSecret(env));
  assert.equal(preview, resolveMediaPreviewReceiptSecret(env));
  assert.equal(resolveGithubInstallStateSecret({ ...env, GITHUB_INSTALL_STATE_SECRET: "explicit-install-secret" }), "explicit-install-secret");
  assert.equal(resolveMediaPreviewReceiptSecret({ ...env, SIGNALFLOW_MEDIA_PREVIEW_RECEIPT_SECRET: "explicit-preview-secret" }), "explicit-preview-secret");
});

test("GitHub runtime config derives canonical Vercel origin and install-state signer", () => {
  const env = resolveGithubRuntimeEnv({
    SIGNALFLOW_ACCESS_KEY: "owner-access-key-that-is-long-enough-for-signing-123456",
    VERCEL_PROJECT_PRODUCTION_URL: "signal-flow-studio.vercel.app",
  });
  assert.equal(env.NEXTAUTH_URL, "https://signal-flow-studio.vercel.app");
  assert.ok(env.GITHUB_INSTALL_STATE_SECRET.length >= 32);

  const explicit = resolveGithubRuntimeEnv({
    SIGNALFLOW_ACCESS_KEY: "owner-access-key-that-is-long-enough-for-signing-123456",
    NEXTAUTH_URL: "https://owner.example",
    GITHUB_INSTALL_STATE_SECRET: "explicit-install-secret",
    VERCEL_PROJECT_PRODUCTION_URL: "ignored.vercel.app",
  });
  assert.equal(explicit.NEXTAUTH_URL, "https://owner.example");
  assert.equal(explicit.GITHUB_INSTALL_STATE_SECRET, "explicit-install-secret");
});

test("private asset storage uses Postgres when S3 is absent and fails closed on partial S3 config", () => {
  assert.deepEqual(
    hostedAssetStorageConfigurationStatus({ DATABASE_URL: "postgres://example" }),
    { configured: true, missing: [], provider: "postgres" },
  );

  const partial = hostedAssetStorageConfigurationStatus({
    DATABASE_URL: "postgres://example",
    SIGNALFLOW_S3_ENDPOINT: "https://storage.example",
  });
  assert.equal(partial.configured, false);
  assert.equal(partial.provider, "s3-compatible");
  assert.ok(partial.missing.includes("SIGNALFLOW_S3_BUCKET"));
  assert.ok(partial.missing.includes("SIGNALFLOW_S3_ACCESS_KEY_ID"));
  assert.ok(partial.missing.includes("SIGNALFLOW_S3_SECRET_ACCESS_KEY"));
});

test("Postgres private blob storage is immutable, bounded, readable, and idempotent", async () => {
  const database = createBlobDatabase();
  const storage = createPostgresBlobStorage({
    database,
    workspaceId: "workspace-a",
    clock: { now: () => "2026-09-04T09:30:00.000Z" },
    maxBytes: 4096,
  });
  const bytes = new TextEncoder().encode("private screenshot bytes");
  const contentHash = hash(bytes);
  const options = {
    objectKey: "workspace-a/assets/asset-1/version-1.png",
    contentType: "image/png",
    contentHash,
    byteSize: bytes.byteLength,
  };

  const first = await storage.put("blob-1", bytes, options);
  const second = await storage.put("blob-1", bytes, options);
  assert.deepEqual(second, first);
  assert.equal(first.provider, "postgres");
  assert.equal(first.contentHash, contentHash);
  assert.deepEqual(await storage.get("blob-1", { objectKey: options.objectKey }), bytes);
  assert.deepEqual(await storage.head("blob-1", { objectKey: options.objectKey }), first);

  await assert.rejects(
    storage.put("blob-1", new TextEncoder().encode("different"), {
      ...options,
      contentHash: hash(new TextEncoder().encode("different")),
      byteSize: 9,
    }),
    (error) => error?.code === "immutable_blob_collision",
  );

  const tooLarge = new Uint8Array(4097);
  await assert.rejects(
    storage.put("blob-large", tooLarge, {
      ...options,
      objectKey: "workspace-a/assets/large.png",
      contentHash: hash(tooLarge),
      byteSize: tooLarge.byteLength,
    }),
    (error) => error?.code === "postgres_blob_too_large" && error?.status === 413,
  );

  assert.equal(await storage.remove("blob-1", { objectKey: options.objectKey }), true);
  assert.equal(await storage.get("blob-1", { objectKey: options.objectKey }), null);
});

test("GP2 readiness accepts Vercel-native inference, Postgres assets, and derived signing secrets", () => {
  const env = {
    VERCEL: "1",
    SIGNALFLOW_PUBLIC_HOSTED: "true",
    SIGNALFLOW_ACCESS_KEY: "owner-access-key-that-is-long-enough-for-signing-123456",
    DATABASE_URL: "postgres://example",
    VERCEL_PROJECT_PRODUCTION_URL: "signal-flow-studio.vercel.app",
    VERCEL_OIDC_TOKEN: "oidc-token-present-at-runtime",
    GITHUB_APP_ID: "12345",
    GITHUB_APP_SLUG: "signalflow-studio",
    GITHUB_APP_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\nplaceholder\n-----END PRIVATE KEY-----",
    GITHUB_APP_CLIENT_ID: "Iv1.example",
    GITHUB_APP_CLIENT_SECRET: "client-secret",
    GITHUB_WEBHOOK_SECRET: "webhook-secret",
    SIGNALFLOW_CDP_BROWSER_WS_ENDPOINT: "wss://browser.example/devtools/browser/test",
    SIGNALFLOW_CAPTURE_ENVIRONMENT: "preview",
  };

  const readiness = gp2ReadinessStatus(env);
  assert.equal(readiness.ready, true);
  assert.deepEqual(readiness.missing, []);
  assert.equal(readiness.checks.find((item) => item.id === "private_asset_storage")?.provider, "postgres");
  assert.equal(readiness.checks.find((item) => item.id === "inference")?.configured, true);
  assert.equal(readiness.checks.find((item) => item.id === "exact_media_preview")?.configured, true);
  assert.equal(readiness.checks.find((item) => item.id === "github_app")?.configured, true);
});
