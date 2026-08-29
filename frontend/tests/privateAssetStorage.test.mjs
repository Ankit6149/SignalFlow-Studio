import test from "node:test";
import assert from "node:assert/strict";

import { createPrivateAssetStorageApplication } from "../lib/application/privateAssetStorageApplication.mjs";
import { createMemoryAssetRepository } from "../lib/infrastructure/transferAdapters.mjs";

const NOW = "2026-08-30T00:00:00.000Z";

function clock() {
  let tick = 0;
  return {
    now() {
      const value = new Date(Date.parse(NOW) + tick * 1000).toISOString();
      tick += 1;
      return value;
    },
  };
}

function privateMemoryBlobStorage() {
  const records = new Map();
  const calls = { put: 0, get: 0, head: 0, remove: 0, preview: 0 };
  return {
    calls,
    async put(blobId, value, options = {}) {
      calls.put += 1;
      records.set(blobId, {
        value: new Uint8Array(value),
        objectKey: options.objectKey,
        contentType: options.contentType,
        contentHash: options.contentHash,
      });
      return {
        provider: "test-private",
        blobId,
        objectKey: options.objectKey,
        region: "test-region",
        byteSize: value.byteLength,
        contentHash: options.contentHash,
      };
    },
    async get(blobId) {
      calls.get += 1;
      const record = records.get(blobId);
      return record ? new Uint8Array(record.value) : null;
    },
    async remove(blobId) {
      calls.remove += 1;
      return records.delete(blobId);
    },
    async head(blobId) {
      calls.head += 1;
      const record = records.get(blobId);
      if (!record) return null;
      return {
        provider: "test-private",
        blobId,
        objectKey: record.objectKey,
        region: "test-region",
        byteSize: record.value.byteLength,
        contentType: record.contentType,
        contentHash: record.contentHash,
      };
    },
    async createReadUrl(blobId, options = {}) {
      calls.preview += 1;
      if (!records.has(blobId)) return null;
      const ttl = options.expiresInSeconds || 60;
      return {
        url: `https://private.example.test/object?X-Amz-Signature=test-signature&blob=${encodeURIComponent(blobId)}`,
        expiresAt: new Date(Date.parse(NOW) + ttl * 1000).toISOString(),
      };
    },
  };
}

function fixture() {
  const assetRepository = createMemoryAssetRepository();
  const blobStorage = privateMemoryBlobStorage();
  const application = createPrivateAssetStorageApplication({
    blobStorage,
    assetRepository,
    clock: clock(),
  });
  return { application, assetRepository, blobStorage };
}

async function storeScreenshot(application, overrides = {}) {
  return application.storeAsset({
    workspaceId: overrides.workspaceId || "workspace-1",
    projectId: "project-1",
    bytes: overrides.bytes || new TextEncoder().encode("deterministic screenshot bytes"),
    originalName: "product-proof.png",
    mimeType: "image/png",
    privacy: overrides.privacy || {
      classification: "workspace_private",
      exportAllowed: true,
      processingAllowed: true,
    },
    dimensions: { width: 1440, height: 900 },
  });
}

test("same workspace and bytes reuse one immutable object and canonical Asset identity", async () => {
  const { application, blobStorage } = fixture();
  const first = await storeScreenshot(application);
  const second = await storeScreenshot(application);

  assert.equal(first.stored, true);
  assert.equal(second.stored, false);
  assert.equal(second.reusedObject, true);
  assert.equal(blobStorage.calls.put, 1);
  assert.equal(first.asset.assetId, second.asset.assetId);
  assert.equal(first.asset.assetVersionId, second.asset.assetVersionId);
  assert.equal(first.asset.storageRef.blobId, second.asset.storageRef.blobId);
  assert.equal(first.asset.storageRef.objectKey, second.asset.storageRef.objectKey);
  assert.match(first.asset.storageRef.objectKey, /^workspaces\/[a-f0-9]{20}\/assets\/sha256\/[a-f0-9]{64}$/);
  assert.match(first.asset.contentHash, /^sha256:[a-f0-9]{64}$/);
});

test("the same bytes in another workspace receive a different storage namespace", async () => {
  const { application } = fixture();
  const left = await storeScreenshot(application, { workspaceId: "workspace-1" });
  const right = await storeScreenshot(application, { workspaceId: "workspace-2" });

  assert.notEqual(left.asset.storageRef.blobId, right.asset.storageRef.blobId);
  assert.notEqual(left.asset.storageRef.objectKey, right.asset.storageRef.objectKey);
  assert.notEqual(left.asset.assetId, right.asset.assetId);
  assert.equal(left.asset.contentHash, right.asset.contentHash);
});

test("device-private and restricted media fail closed before hosted storage is touched", async () => {
  for (const classification of ["device_private", "restricted"]) {
    const { application, blobStorage } = fixture();
    await assert.rejects(
      () => storeScreenshot(application, { privacy: { classification } }),
      (error) => error.code === "hosted_storage_privacy_blocked",
    );
    assert.equal(blobStorage.calls.put, 0);
    assert.equal(blobStorage.calls.head, 0);
  }
});

test("cross-workspace read preview and delete fail before blob storage access", async () => {
  const { application, blobStorage } = fixture();
  const stored = await storeScreenshot(application);
  const before = { ...blobStorage.calls };

  await assert.rejects(
    () => application.readAsset({ workspaceId: "workspace-2", assetId: stored.asset.assetId }),
    (error) => error.code === "cross_workspace_asset_access",
  );
  await assert.rejects(
    () => application.createPreview({ workspaceId: "workspace-2", assetId: stored.asset.assetId }),
    (error) => error.code === "cross_workspace_asset_access",
  );
  await assert.rejects(
    () => application.deleteAsset({ workspaceId: "workspace-2", assetId: stored.asset.assetId }),
    (error) => error.code === "cross_workspace_asset_access",
  );

  assert.deepEqual(blobStorage.calls, before);
});

test("signed preview authorization is ephemeral and never enters canonical Asset metadata", async () => {
  const { application, assetRepository } = fixture();
  const stored = await storeScreenshot(application);
  const preview = await application.createPreview({
    workspaceId: "workspace-1",
    assetId: stored.asset.assetId,
    expiresInSeconds: 9999,
  });

  assert.match(preview.url, /^https:\/\//);
  assert.match(preview.url, /X-Amz-Signature=/);
  assert.equal(preview.assetId, stored.asset.assetId);

  const persisted = await assetRepository.get(stored.asset.assetId);
  const serialized = JSON.stringify(persisted);
  assert.doesNotMatch(serialized, /X-Amz-Signature|https:\/\/private\.example\.test|accessKey|secret/i);
  assert.deepEqual(persisted.storageRef, stored.asset.storageRef);

  const expiryMs = Date.parse(preview.expiresAt) - Date.parse(NOW);
  assert.ok(expiryMs <= 300_000, "preview TTL must be bounded to five minutes");
});

test("authorized reads return bytes and deletion is truthful and idempotent", async () => {
  const { application, blobStorage } = fixture();
  const stored = await storeScreenshot(application);

  const read = await application.readAsset({ workspaceId: "workspace-1", assetId: stored.asset.assetId });
  assert.equal(new TextDecoder().decode(read.bytes), "deterministic screenshot bytes");

  const deleted = await application.deleteAsset({ workspaceId: "workspace-1", assetId: stored.asset.assetId });
  assert.equal(deleted.removed, true);
  assert.equal(deleted.asset.availability, "deleted");
  assert.equal(deleted.asset.deletion.state, "deleted");
  assert.ok(deleted.asset.deletion.deletedAt);

  const repeated = await application.deleteAsset({ workspaceId: "workspace-1", assetId: stored.asset.assetId });
  assert.equal(repeated.removed, false);
  assert.equal(repeated.alreadyDeleted, true);
  assert.equal(blobStorage.calls.remove, 1);

  await assert.rejects(
    () => application.readAsset({ workspaceId: "workspace-1", assetId: stored.asset.assetId }),
    (error) => error.code === "asset_deleted",
  );
});

test("zero-byte inputs are rejected before storage cost", async () => {
  const { application, blobStorage } = fixture();
  await assert.rejects(
    () => storeScreenshot(application, { bytes: new Uint8Array() }),
    (error) => error.code === "empty_blob",
  );
  assert.equal(blobStorage.calls.put, 0);
  assert.equal(blobStorage.calls.head, 0);
});
