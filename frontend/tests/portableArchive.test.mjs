import test from "node:test";
import assert from "node:assert/strict";

import {
  createHmacArchiveSigner,
  createPortableArchive,
  decodeBlobPayload,
  encodeBlobPayload,
  PORTABLE_ARCHIVE_SCHEMA_VERSION,
  sha256Hex,
  validateArchivePath,
  validatePortableArchive,
} from "../lib/transfer/portableArchive.mjs";
import { stableStringify } from "../lib/domain/contracts.mjs";

function archiveInput(overrides = {}) {
  return {
    archiveId: "archive-test-1",
    createdAt: "2026-07-30T18:30:00.000Z",
    sourceDeployment: { profile: "local", productVersion: "0.2.0" },
    campaigns: [{
      schemaVersion: 1,
      kind: "Campaign",
      campaignId: "campaign-1",
      title: "Portable campaign",
      drafts: {
        linkedin: {
          schemaVersion: 1,
          kind: "ChannelDraft",
          draftId: "draft-1",
          channel: "linkedin",
          current: { content: "Edited authoritative copy" },
          generated: { content: "Generated baseline" },
          history: [],
          edited: true,
          approved: true,
          generationRunId: "run-1",
        },
      },
      brief: { notes: "Portable evidence" },
      sourceFiles: [],
      documentText: [],
      createdAt: "2026-07-29T10:00:00.000Z",
      updatedAt: "2026-07-29T11:00:00.000Z",
    }],
    assets: [],
    sourceArtifacts: [],
    approvals: [],
    exports: [],
    blobEntries: [],
    ...overrides,
  };
}

function withoutIntegrity(archive) {
  const { integrity, signature, ...unsigned } = archive;
  void integrity;
  void signature;
  return unsigned;
}

async function recalculateIntegrity(archive) {
  archive.integrity = {
    algorithm: "SHA-256",
    digest: await sha256Hex(stableStringify(withoutIntegrity(archive))),
  };
  return archive;
}

test("portable archive is deterministic, integrity protected, and optionally HMAC signed", async () => {
  const signer = createHmacArchiveSigner({ secret: "correct horse battery staple", keyId: "test-key" });
  const archive = await createPortableArchive({ ...archiveInput(), signer });
  const validated = await validatePortableArchive(archive, { signer, requireSignature: true });
  assert.equal(validated.valid, true);
  assert.equal(archive.signature.algorithm, "HMAC-SHA-256");
  assert.equal(archive.signature.keyId, "test-key");

  const same = await createPortableArchive({ ...archiveInput(), signer });
  assert.equal(stableStringify(archive), stableStringify(same));

  const wrongSigner = createHmacArchiveSigner({ secret: "wrong secret", keyId: "test-key" });
  const invalid = await validatePortableArchive(archive, { signer: wrongSigner, requireSignature: true });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.some((error) => error.code === "invalid_signature"));
});

test("secret fields, private endpoints, local paths, and signed references never enter the archive", async () => {
  const input = archiveInput({
    sourceDeployment: {
      profile: "local",
      baseUrl: "http://127.0.0.1:3000",
      accessToken: "do-not-export",
    },
    campaigns: [{
      ...archiveInput().campaigns[0],
      brief: {
        notes: "Portable evidence",
        apiKey: "do-not-export",
        providerBaseUrl: "http://localhost:11434",
      },
      sourceFiles: [
        { name: "notes.md", path: "C:\\Users\\Ankit\\private\\notes.md" },
        { name: "home.md", filesystemPath: "/home/ankit/private/home.md" },
      ],
    }],
    assets: [{
      schemaVersion: 1,
      kind: "Asset",
      assetId: "asset-1",
      assetType: "image",
      signedUrl: "https://private.example/signed",
      localPath: "/Users/ankit/Desktop/private.png",
    }],
  });
  const archive = await createPortableArchive(input);
  const serialized = stableStringify(archive);
  assert.doesNotMatch(serialized, /do-not-export|localhost|127\.0\.0\.1|Users\\Ankit|\/home\/ankit|\/Users\/ankit|signedUrl/i);
  assert.ok(archive.manifest.exclusions.length >= 6);
  assert.ok(archive.manifest.exclusions.some((item) => item.reason === "secret field"));
  assert.ok(archive.manifest.exclusions.some((item) => /path|reference|endpoint/i.test(item.reason)));
});

test("corrupted content and future schema versions fail safely with actionable codes", async () => {
  const archive = await createPortableArchive(archiveInput());
  const corrupted = structuredClone(archive);
  corrupted.payload.campaigns[0].title = "Tampered campaign";
  const invalid = await validatePortableArchive(corrupted);
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.some((error) => error.code === "integrity_mismatch"));

  const future = structuredClone(archive);
  future.schemaVersion = PORTABLE_ARCHIVE_SCHEMA_VERSION + 1;
  await recalculateIntegrity(future);
  const futureResult = await validatePortableArchive(future);
  assert.equal(futureResult.valid, false);
  assert.match(futureResult.errors.find((error) => error.code === "future_schema").message, /upgrade SignalFlow/i);
});

test("archive traversal, oversized payloads, and partial assets are reported", async () => {
  const encoded = encodeBlobPayload("asset payload");
  const archive = await createPortableArchive(archiveInput({
    assets: [{
      schemaVersion: 1,
      kind: "Asset",
      assetId: "asset-1",
      assetType: "image",
      blobId: "blob-1",
    }],
    blobEntries: [{
      blobId: "blob-1",
      assetId: "asset-1",
      archivePath: "blobs/blob-1.bin",
      contentType: "text/plain",
      ...encoded,
    }],
  }));
  assert.equal(validateArchivePath("blobs/blob-1.bin"), true);
  assert.equal(validateArchivePath("../private.txt"), false);
  assert.equal(validateArchivePath("blobs/../../private.txt"), false);
  assert.equal(validateArchivePath("/blobs/private.txt"), false);
  assert.equal(validateArchivePath("blobs\\private.txt"), false);

  const traversal = structuredClone(archive);
  traversal.payload.blobEntries[0].archivePath = "blobs/../../private.txt";
  await recalculateIntegrity(traversal);
  const traversalResult = await validatePortableArchive(traversal);
  assert.ok(traversalResult.errors.some((error) => error.code === "archive_traversal"));

  const oversized = await validatePortableArchive(archive, { maxBytes: 100 });
  assert.ok(oversized.errors.some((error) => error.code === "archive_too_large"));

  const partial = await createPortableArchive(archiveInput({
    assets: [{
      schemaVersion: 1,
      kind: "Asset",
      assetId: "asset-missing",
      assetType: "video",
      blobId: "blob-missing",
    }],
  }));
  const partialResult = await validatePortableArchive(partial);
  assert.equal(partialResult.valid, true);
  assert.ok(partialResult.warnings.some((warning) => warning.code === "partial_assets"));
});

test("blob payloads round-trip bytes, text, and JSON", () => {
  const bytes = new Uint8Array([0, 1, 2, 254, 255]);
  assert.deepEqual(Array.from(decodeBlobPayload(encodeBlobPayload(bytes))), Array.from(bytes));
  assert.equal(decodeBlobPayload(encodeBlobPayload("hello")), "hello");
  assert.deepEqual(decodeBlobPayload(encodeBlobPayload({ hello: "world" })), { hello: "world" });
});
