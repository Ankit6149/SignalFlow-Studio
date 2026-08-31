import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createHostedMediaPreviewReceiptService } from "../lib/server/hostedMediaPreviewReceipt.mjs";
import { createBrowserHostedExactMediaPreviewAdapter } from "../lib/infrastructure/browserHostedExactMediaPreviewAdapter.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SECRET = "signalflow-test-preview-receipt-secret-2026";
const START = "2026-08-31T05:00:00.000Z";

function source(...parts) {
  return fs.readFileSync(path.join(ROOT, ...parts), "utf8");
}

test("hosted exact-media receipt is short-lived and pinned to workspace + exact AssetVersion", () => {
  let now = START;
  const receipts = createHostedMediaPreviewReceiptService({
    signingSecret: SECRET,
    ttlMs: 60_000,
    clock: { now: () => now },
  });
  const receipt = receipts.issue({ workspaceId: "workspace-1", assetId: "asset-1", assetVersionId: "version-1" });
  const claims = receipts.verify(receipt, { workspaceId: "workspace-1", assetId: "asset-1", assetVersionId: "version-1" });
  assert.equal(claims.workspaceId, "workspace-1");
  assert.equal(claims.assetId, "asset-1");
  assert.equal(claims.assetVersionId, "version-1");

  assert.throws(
    () => receipts.verify(receipt, { workspaceId: "workspace-2", assetId: "asset-1", assetVersionId: "version-1" }),
    (error) => error.code === "preview_receipt_identity_mismatch",
  );
  assert.throws(
    () => receipts.verify(receipt, { workspaceId: "workspace-1", assetId: "asset-1", assetVersionId: "version-2" }),
    (error) => error.code === "preview_receipt_identity_mismatch",
  );

  now = "2026-08-31T05:02:00.000Z";
  assert.throws(() => receipts.verify(receipt), (error) => error.code === "preview_receipt_expired");
});

test("hosted exact-media receipt rejects weak secrets and tampering", () => {
  assert.throws(
    () => createHostedMediaPreviewReceiptService({ signingSecret: "too-short" }),
    (error) => error.code === "preview_receipt_secret_unconfigured" && error.status === 503,
  );
  const receipts = createHostedMediaPreviewReceiptService({ signingSecret: SECRET, clock: { now: () => START } });
  const receipt = receipts.issue({ workspaceId: "workspace-1", assetId: "asset-1", assetVersionId: "version-1" });
  const [payload, signature] = receipt.split(".");
  const tampered = `${payload}.${signature.slice(0, -1)}${signature.endsWith("a") ? "b" : "a"}`;
  assert.throws(() => receipts.verify(tampered), (error) => error.code === "preview_receipt_invalid");
});

test("hosted browser preview requires exact response identity, image bytes and signed visibility receipt", async () => {
  const calls = [];
  const adapter = createBrowserHostedExactMediaPreviewAdapter({
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response(new Uint8Array([137, 80, 78, 71]), {
        status: 200,
        headers: {
          "content-type": "image/png",
          "x-signalflow-asset-id": "asset-1",
          "x-signalflow-asset-version": "version-1",
          "x-signalflow-preview-receipt": "signed-receipt-1",
        },
      });
    },
  });
  const result = await adapter.readExact({ assetId: "asset-1", assetVersionId: "version-1" });
  assert.equal(result.previewReceipt, "signed-receipt-1");
  assert.deepEqual(Array.from(result.bytes), [137, 80, 78, 71]);
  assert.equal(calls[0].options.credentials, "same-origin");
  assert.equal(calls[0].options.cache, "no-store");
  assert.match(calls[0].url, /^\/api\/assets\/preview\?/);

  const missingReceipt = createBrowserHostedExactMediaPreviewAdapter({
    fetchImpl: async () => new Response(new Uint8Array([1]), {
      status: 200,
      headers: {
        "content-type": "image/png",
        "x-signalflow-asset-id": "asset-1",
        "x-signalflow-asset-version": "version-1",
      },
    }),
  });
  await assert.rejects(
    () => missingReceipt.readExact({ assetId: "asset-1", assetVersionId: "version-1" }),
    (error) => error.code === "hosted_preview_receipt_missing",
  );
});

test("exact preview component carries role + exact AssetVersion + receipt without inventing a hosted proof", () => {
  const preview = source("components", "ExactMediaRevisionPreview.js");
  assert.match(preview, /function visibleMedia\(items = \[\]\)/);
  assert.match(preview, /role: binding\.role/);
  assert.match(preview, /assetId: binding\.assetId/);
  assert.match(preview, /assetVersionId: binding\.assetVersionId/);
  assert.match(preview, /previewReceipt: previewReceipt \|\| null/);
  assert.match(preview, /visibleMedia: visibleMedia\(items\)/);
});

test("hosted review API verifies every visible media binding and guards stale edit/regenerate mutations", () => {
  const route = source("app", "api", "platform-review", "route.js");
  assert.match(route, /createHostedMediaPreviewReceiptService/);
  assert.match(route, /SIGNALFLOW_MEDIA_PREVIEW_RECEIPT_SECRET/);
  assert.match(route, /receipts\.verify\(confirmation\.previewReceipt/);
  assert.match(route, /target\.role !== confirmation\.role/);
  assert.match(route, /target\.assetId !== confirmation\.assetId/);
  assert.match(route, /target\.assetVersionId !== confirmation\.assetVersionId/);
  assert.match(route, /visible\.length !== expected\.length/);
  assert.match(route, /assertExpectedCurrent\(apps, platformVariantId, body\.expectedCurrentRevisionId\)/);
  assert.match(route, /action === "edit_revision"/);
  assert.match(route, /editCurrentVariant/);
  assert.match(route, /action === "regenerate_variant"/);
  assert.doesNotMatch(route, /presign|signedUrl|objectKey|storageRef/);
});

test("connected-source Plan uses durable hosted review clients and protected exact-media preview only", () => {
  const plan = source("components", "HostedCampaignPlanPanel.js");
  const drafts = source("components", "HostedPlatformDraftsPanel.js");
  const revision = source("components", "HostedPlatformRevisionReviewPanel.js");
  const client = source("lib", "infrastructure", "browserHostedPlatformReviewClient.mjs");

  assert.match(plan, /HostedPlatformDraftsPanel/);
  assert.match(drafts, /createBrowserHostedPlatformReviewClient/);
  assert.match(drafts, /client\.getBundle\(contentPieceId\)/);
  assert.match(drafts, /HostedPlatformRevisionReviewPanel/);
  assert.doesNotMatch(drafts, /localStorage|createBrowserPlatformReviewApplication|createBrowserPlatformGenerationApplication/);

  assert.match(revision, /createBrowserHostedExactMediaPreviewAdapter/);
  assert.match(revision, /previewAdapter=\{previewAdapter\}/);
  assert.match(revision, /mediaPreviewState\.visibleMedia/);
  assert.match(revision, /expectedCurrentRevisionId: revisionId/);
  assert.match(revision, /editCurrentVariant/);
  assert.match(revision, /regenerateVariant/);
  assert.match(revision, /approveRevision/);
  assert.match(revision, /restoreRevision/);
  assert.doesNotMatch(revision, /localStorage|createBrowserPlatformReviewApplication/);

  assert.match(client, /credentials: "same-origin"/);
  assert.match(client, /cache: "no-store"/);
  assert.match(client, /visibleMedia: normalizeVisibleMedia\(visibleMedia\)/);
  assert.match(client, /action: "edit_revision"/);
  assert.match(client, /action: "regenerate_variant"/);
});

test("hosted preview receipt secret is documented as server-only configuration", () => {
  const env = source(".env.example");
  assert.match(env, /SIGNALFLOW_MEDIA_PREVIEW_RECEIPT_SECRET=/);
  assert.doesNotMatch(env, /NEXT_PUBLIC_SIGNALFLOW_MEDIA_PREVIEW_RECEIPT_SECRET/);
});
