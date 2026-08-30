import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createBrowserExactMediaPreviewAdapter } from "../lib/infrastructure/browserExactMediaPreviewAdapter.mjs";
import { normalizeAsset } from "../lib/domain/sourceArtifacts.mjs";
import { createBrowserAssetRepository, createBrowserBlobStorage } from "../lib/infrastructure/transferAdapters.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NOW = "2026-08-30T16:00:00.000Z";

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
}

async function seededPreview() {
  const storage = memoryStorage();
  const getStorage = () => storage;
  const assetRepository = createBrowserAssetRepository({ getStorage });
  const blobStorage = createBrowserBlobStorage({ getStorage });
  const asset = normalizeAsset({
    assetId: "asset-preview-1",
    assetVersionId: "asset-version-preview-1",
    workspaceId: "local-personal",
    assetType: "image",
    lifecycle: "derived",
    originalName: "exact-proof.png",
    mimeType: "image/png",
    byteSize: 8,
    dimensions: { width: 1600, height: 900 },
    storageRef: { provider: "browser", blobId: "blob-preview-1", objectKey: "browser/blob-preview-1", region: null },
    privacy: { classification: "workspace_private", processingAllowed: true, exportAllowed: true, remoteInferenceAllowed: false },
    provenance: [{ eventType: "derived", method: "api", actorType: "worker", occurredAt: NOW }],
    createdAt: NOW,
    updatedAt: NOW,
  }, { workspaceId: "local-personal", now: NOW });
  await assetRepository.upsert(asset);
  await blobStorage.put(asset.storageRef.blobId, new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]));
  return { storage, asset, adapter: createBrowserExactMediaPreviewAdapter({ getStorage, workspaceId: "local-personal" }) };
}

test("browser exact media preview resolves only the bound immutable AssetVersion bytes", async () => {
  const { adapter, asset } = await seededPreview();
  const preview = await adapter.readExact({ assetId: asset.assetId, assetVersionId: asset.assetVersionId });
  assert.equal(preview.asset.assetId, asset.assetId);
  assert.equal(preview.asset.assetVersionId, asset.assetVersionId);
  assert.deepEqual(Array.from(preview.bytes), [137, 80, 78, 71, 13, 10, 26, 10]);
  await assert.rejects(
    () => adapter.readExact({ assetId: asset.assetId, assetVersionId: "asset-version-stale" }),
    (error) => error.code === "stale_preview_asset",
  );
});

test("Plan exact review renders bound media and blocks approval when exact preview is unresolved", () => {
  const source = fs.readFileSync(path.join(ROOT, "components", "PlatformReviewPanel.js"), "utf8");
  assert.match(source, /ExactMediaRevisionPreview/);
  assert.match(source, /mediaApprovalBlocked/);
  assert.match(source, /Approve exact text \+ media/);
  assert.match(source, /Resolve exact media preview/);
  assert.match(source, /revision\.mediaBindings/);
});

test("text-only Plan review keeps the empty media input referentially stable", () => {
  const preview = fs.readFileSync(path.join(ROOT, "components", "ExactMediaRevisionPreview.js"), "utf8");
  const plan = fs.readFileSync(path.join(ROOT, "components", "PlatformReviewPanel.js"), "utf8");
  assert.match(preview, /const EMPTY_MEDIA_BINDINGS = Object\.freeze\(\[\]\)/);
  assert.match(preview, /mediaBindings = EMPTY_MEDIA_BINDINGS/);
  assert.match(plan, /<ExactMediaRevisionPreview mediaBindings=\{revision\.mediaBindings\}/);
  assert.doesNotMatch(plan, /mediaBindings=\{revision\.mediaBindings \|\| \[\]\}/);
});

test("Today carries exact media into the owner decision and cannot approve unseen media", () => {
  const today = fs.readFileSync(path.join(ROOT, "components", "TodayWorkspace.js"), "utf8");
  const projection = fs.readFileSync(path.join(ROOT, "lib", "application", "todayDecisionApplication.mjs"), "utf8");
  assert.match(projection, /mediaBindings: revision\.mediaBindings/);
  assert.match(today, /TodayExactMediaPreview/);
  assert.match(today, /mediaApprovalBlocked/);
  assert.match(today, /Approve text \+ media/);
  assert.match(today, /cannot approve this media-bound revision/);
});

test("exact media preview remains a restrained reusable surface with responsive containment", () => {
  const css = fs.readFileSync(path.join(ROOT, "components", "ExactMediaRevisionPreview.module.css"), "utf8");
  assert.match(css, /object-fit:\s*contain/);
  assert.match(css, /overflow-wrap:\s*anywhere/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.doesNotMatch(css, /position:\s*fixed|100vh|100vw/);
});
