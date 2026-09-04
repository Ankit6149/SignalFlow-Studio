import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { normalizeAsset } from "../lib/domain/sourceArtifacts.mjs";
import { createMemoryAssetRepository } from "../lib/infrastructure/transferAdapters.mjs";
import { createBrowserHostedExactMediaPreviewAdapter } from "../lib/infrastructure/browserHostedExactMediaPreviewAdapter.mjs";
import {
  createProductionHostedExactAssetPreviewApplication,
  hostedAssetStorageConfigurationStatus,
} from "../lib/server/hostedAssetPreviewDependencies.mjs";

const NOW = "2026-08-31T03:45:00.000Z";
const HASH = `sha256:${"c".repeat(64)}`;

function asset(overrides = {}) {
  return normalizeAsset({
    kind: "Asset",
    schemaVersion: 1,
    assetId: "asset-hosted-proof",
    assetVersionId: "asset-version-hosted-proof",
    workspaceId: "workspace-1",
    projectId: "project-1",
    originalName: "hosted-proof.png",
    mimeType: "image/png",
    byteSize: 4,
    contentHash: HASH,
    storageRef: {
      provider: "test-private",
      blobId: "blob-hosted-proof",
      objectKey: `workspaces/workspace-1/assets/sha256/${"c".repeat(64)}`,
      region: "test",
    },
    privacy: { classification: "workspace_private" },
    provenance: [{ eventType: "captured", method: "api", actorType: "worker", occurredAt: NOW }],
    uploadState: "complete",
    availability: "available",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }, {
    workspaceId: overrides.workspaceId || "workspace-1",
    projectId: overrides.projectId || "project-1",
    now: overrides.updatedAt || NOW,
  });
}

function blobStorage(bytes = new Uint8Array([1, 2, 3, 4])) {
  return {
    async get(blobId) {
      return blobId === "blob-hosted-proof" ? new Uint8Array(bytes) : null;
    },
    async put() {
      throw new Error("preview test must not write blobs");
    },
    async remove() {
      throw new Error("preview test must not remove blobs");
    },
  };
}

async function hostedFixture(record = asset(), options = {}) {
  const assetRepository = createMemoryAssetRepository([record]);
  const application = createProductionHostedExactAssetPreviewApplication({
    env: { SIGNALFLOW_WORKSPACE_ID: options.workspaceId || "workspace-1" },
    assetRepository,
    blobStorage: options.blobStorage || blobStorage(),
    clock: { now: () => NOW },
  });
  return { application, assetRepository };
}

test("hosted exact preview returns only the requested image AssetVersion bytes", async () => {
  const stored = asset();
  const { application } = await hostedFixture(stored);

  const result = await application.readExactImage({
    assetId: stored.assetId,
    assetVersionId: stored.assetVersionId,
  });

  assert.equal(result.workspaceId, "workspace-1");
  assert.equal(result.asset.assetId, stored.assetId);
  assert.equal(result.asset.assetVersionId, stored.assetVersionId);
  assert.equal(result.mimeType, "image/png");
  assert.deepEqual([...result.bytes], [1, 2, 3, 4]);
});

test("hosted exact preview rejects stale AssetVersion identity before approval can proceed", async () => {
  const stored = asset();
  const { application } = await hostedFixture(stored);

  await assert.rejects(
    () => application.readExactImage({ assetId: stored.assetId, assetVersionId: "asset-version-stale" }),
    (error) => error.code === "stale_preview_asset" && error.status === 409,
  );
});

test("hosted exact preview rejects deleted and non-image Assets", async () => {
  const deleted = asset({
    availability: "deleted",
    deletion: { state: "deleted", requestedAt: NOW, deletedAt: NOW, issueCodes: [] },
  });
  const { application: deletedApplication } = await hostedFixture(deleted);
  await assert.rejects(
    () => deletedApplication.readExactImage({ assetId: deleted.assetId, assetVersionId: deleted.assetVersionId }),
    (error) => error.code === "asset_deleted",
  );

  const document = asset({
    mimeType: "application/pdf",
    originalName: "proof.pdf",
  });
  const { application: documentApplication } = await hostedFixture(document);
  await assert.rejects(
    () => documentApplication.readExactImage({ assetId: document.assetId, assetVersionId: document.assetVersionId }),
    (error) => error.code === "unsupported_preview_media" && error.status === 415,
  );
});

test("hosted exact preview fails closed across workspaces before returning bytes", async () => {
  const stored = asset();
  const { application } = await hostedFixture(stored, { workspaceId: "workspace-2" });

  await assert.rejects(
    () => application.readExactImage({ assetId: stored.assetId, assetVersionId: stored.assetVersionId }),
    (error) => ["cross_workspace_asset_access", "asset_not_found"].includes(error.code),
  );
});

test("hosted storage configuration falls back to Postgres and reports only the missing database", () => {
  const status = hostedAssetStorageConfigurationStatus({});
  assert.equal(status.configured, false);
  assert.equal(status.provider, "postgres");
  assert.deepEqual(status.missing, ["DATABASE_URL"]);
});

test("hosted browser preview client preserves exact identity and never requests a public object URL", async () => {
  const calls = [];
  const adapter = createBrowserHostedExactMediaPreviewAdapter({
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response(new Uint8Array([9, 8, 7]), {
        status: 200,
        headers: {
          "content-type": "image/png",
          "x-signalflow-asset-id": "asset-1",
          "x-signalflow-asset-version": "version-1",
          "x-signalflow-preview-receipt": "signed-visible-version-receipt",
        },
      });
    },
  });

  const result = await adapter.readExact({ assetId: "asset-1", assetVersionId: "version-1" });

  assert.deepEqual([...result.bytes], [9, 8, 7]);
  assert.equal(result.mimeType, "image/png");
  assert.equal(result.previewReceipt, "signed-visible-version-receipt");
  assert.match(calls[0].url, /^\/api\/assets\/preview\?/);
  assert.match(calls[0].url, /assetId=asset-1/);
  assert.match(calls[0].url, /assetVersionId=version-1/);
  assert.equal(calls[0].options.credentials, "same-origin");
  assert.equal(calls[0].options.cache, "no-store");
  assert.doesNotMatch(calls[0].url, /s3|bucket|storage|signature|credential/i);
});

test("hosted browser preview client rejects response identity or media-type drift", async () => {
  const identityMismatch = createBrowserHostedExactMediaPreviewAdapter({
    fetchImpl: async () => new Response(new Uint8Array([1]), {
      status: 200,
      headers: {
        "content-type": "image/png",
        "x-signalflow-asset-id": "asset-other",
        "x-signalflow-asset-version": "version-1",
      },
    }),
  });
  await assert.rejects(
    () => identityMismatch.readExact({ assetId: "asset-1", assetVersionId: "version-1" }),
    (error) => error.code === "hosted_preview_identity_mismatch",
  );

  const mediaMismatch = createBrowserHostedExactMediaPreviewAdapter({
    fetchImpl: async () => new Response(new Uint8Array([1]), {
      status: 200,
      headers: {
        "content-type": "text/plain",
        "x-signalflow-asset-id": "asset-1",
        "x-signalflow-asset-version": "version-1",
      },
    }),
  });
  await assert.rejects(
    () => mediaMismatch.readExact({ assetId: "asset-1", assetVersionId: "version-1" }),
    (error) => error.code === "unsupported_preview_media",
  );
});

test("hosted exact preview route is owner-authenticated and explicitly non-cacheable", () => {
  const currentFile = fileURLToPath(import.meta.url);
  const route = fs.readFileSync(path.resolve(path.dirname(currentFile), "../app/api/assets/preview/route.js"), "utf8");

  assert.match(route, /requireOwnerAccess\(request\)/);
  assert.match(route, /createProductionHostedExactAssetPreviewApplication/);
  assert.match(route, /assetVersionId: url\.searchParams\.get\("assetVersionId"\)/);
  assert.match(route, /private, no-store, max-age=0/);
  assert.match(route, /x-content-type-options/);
  assert.match(route, /cross-origin-resource-policy/);
  assert.match(route, /x-signalflow-preview-receipt/);
  assert.doesNotMatch(route, /createReadUrl|presign|signedUrl|storageRef|objectKey/);
});
