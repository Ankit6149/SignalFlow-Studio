import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createCapabilitySnapshot,
  parseCapabilitySnapshot,
  SOURCE_CONTRACT_SCHEMA_VERSION,
} from "../lib/capabilities/capabilityContract.mjs";
import {
  createUploadSourceBundle,
  normalizeAsset,
  normalizeAssetProcessing,
  normalizeSourceArtifact,
  PROCESSING_RECORD_STATUSES,
  PROCESSING_STATES,
  SOURCE_KINDS,
  SOURCE_USABILITY_STATES,
  EVIDENCE_STATES,
  INGESTION_METHODS,
} from "../lib/domain/sourceArtifacts.mjs";
import {
  createMemoryBlobStorage,
  createMemoryCampaignRepository,
} from "../lib/infrastructure/adapters.mjs";
import {
  createBrowserAssetRepository,
  createBrowserSourceArtifactRepository,
  createMemoryApprovalRepository,
  createMemoryAssetProcessingRepository,
  createMemoryAssetRepository,
  createMemoryExportRepository,
  createMemorySourceArtifactRepository,
  createMemoryTransferReportRepository,
} from "../lib/infrastructure/transferAdapters.mjs";
import { createDeterministicIdService } from "../lib/domain/ports.mjs";
import { createTransferApplication } from "../lib/transfer/transferApplication.mjs";

const NOW = "2026-08-01T06:00:00.000Z";
const HASH_A = `sha256:${"a".repeat(64)}`;
const HASH_B = `sha256:${"b".repeat(64)}`;
const testDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(testDir, "..");
const repositoryRoot = path.resolve(frontendRoot, "..");
const readFrontend = (relative) => fs.readFileSync(path.join(frontendRoot, relative), "utf8");
const readRepository = (relative) => fs.readFileSync(path.join(repositoryRoot, relative), "utf8");

function fakeStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    dump(key) { return values.get(key); },
  };
}

test("same-length extracted text produces a different immutable source version", () => {
  const first = createUploadSourceBundle({
    file: { name: "evidence.txt", type: "text/plain", size: 4 },
    extractedText: "ABCD",
    workspaceId: "workspace-a",
    assetId: "asset-a",
    sourceArtifactId: "artifact-a",
    now: NOW,
  });
  const second = createUploadSourceBundle({
    file: { name: "evidence.txt", type: "text/plain", size: 4 },
    extractedText: "WXYZ",
    workspaceId: "workspace-a",
    assetId: "asset-a",
    sourceArtifactId: "artifact-a",
    now: NOW,
  });
  assert.equal(first.sourceArtifact.extraction.charCount, second.sourceArtifact.extraction.charCount);
  assert.notEqual(first.sourceArtifact.extraction.textFingerprint, second.sourceArtifact.extraction.textFingerprint);
  assert.notEqual(first.sourceArtifact.sourceArtifactVersionId, second.sourceArtifact.sourceArtifactVersionId);
});

test("browser repositories persist canonical legacy migration writeback", async () => {
  const assetKey = "assets";
  const artifactKey = "artifacts";
  const storage = fakeStorage({
    [assetKey]: JSON.stringify([{ assetId: "legacy-asset", name: "legacy.png", type: "image/png", size: 15 }]),
    [artifactKey]: JSON.stringify([{ sourceArtifactId: "legacy-artifact", artifactType: "document", name: "legacy.png", type: "image/png", size: 15, assetId: "legacy-asset" }]),
  });
  const assets = createBrowserAssetRepository({ getStorage: () => storage, key: assetKey });
  const artifacts = createBrowserSourceArtifactRepository({ getStorage: () => storage, key: artifactKey });
  const [asset] = await assets.list();
  const [artifact] = await artifacts.list();
  assert.equal(asset.kind, "Asset");
  assert.equal(asset.workspaceId, "legacy-local");
  assert.equal(artifact.kind, "SourceArtifact");
  assert.equal(artifact.workspaceId, "legacy-local");
  assert.match(storage.dump(assetKey), /"assetVersionId"/);
  assert.match(storage.dump(artifactKey), /"sourceArtifactVersionId"/);
  assert.doesNotMatch(storage.dump(artifactKey), /"artifactType":"document"/);
});

test("portable export excludes records whose privacy policy forbids export", async () => {
  const publicAsset = normalizeAsset({
    assetId: "asset-public",
    workspaceId: "workspace-a",
    originalName: "public.md",
    mimeType: "text/markdown",
    contentHash: HASH_A,
    privacy: { exportAllowed: true },
    createdAt: NOW,
  });
  const privateAsset = normalizeAsset({
    assetId: "asset-private",
    workspaceId: "workspace-a",
    originalName: "private.md",
    mimeType: "text/markdown",
    contentHash: HASH_B,
    privacy: { exportAllowed: false },
    createdAt: NOW,
  });
  const publicArtifact = normalizeSourceArtifact({
    sourceArtifactId: "artifact-public",
    workspaceId: "workspace-a",
    sourceKind: SOURCE_KINDS.UPLOAD,
    ingestionMethod: INGESTION_METHODS.BROWSER_UPLOAD,
    assetIds: ["asset-public"],
    extraction: { state: PROCESSING_STATES.COMPLETE, charCount: 10 },
    usability: { state: SOURCE_USABILITY_STATES.USABLE_EVIDENCE, evidenceState: EVIDENCE_STATES.VERIFIED },
    privacy: { exportAllowed: true },
    createdAt: NOW,
  });
  const privateArtifact = normalizeSourceArtifact({
    sourceArtifactId: "artifact-private",
    workspaceId: "workspace-a",
    sourceKind: SOURCE_KINDS.UPLOAD,
    ingestionMethod: INGESTION_METHODS.BROWSER_UPLOAD,
    assetIds: ["asset-private"],
    extraction: { state: PROCESSING_STATES.COMPLETE, charCount: 10 },
    usability: { state: SOURCE_USABILITY_STATES.USABLE_EVIDENCE, evidenceState: EVIDENCE_STATES.VERIFIED },
    privacy: { exportAllowed: false },
    createdAt: NOW,
  });
  const privateProcessing = normalizeAssetProcessing({
    processingId: "processing-private",
    workspaceId: "workspace-a",
    sourceArtifactId: "artifact-private",
    inputAssetIds: ["asset-private"],
    outputAssetIds: [],
    processor: { name: "extractor", version: "1" },
    status: PROCESSING_RECORD_STATUSES.COMPLETE,
    createdAt: NOW,
  });
  const app = createTransferApplication({
    campaignRepository: createMemoryCampaignRepository(),
    assetRepository: createMemoryAssetRepository([publicAsset, privateAsset]),
    sourceArtifactRepository: createMemorySourceArtifactRepository([publicArtifact, privateArtifact]),
    assetProcessingRepository: createMemoryAssetProcessingRepository([privateProcessing]),
    approvalRepository: createMemoryApprovalRepository(),
    exportRepository: createMemoryExportRepository(),
    blobStorage: createMemoryBlobStorage(),
    transferReportRepository: createMemoryTransferReportRepository(),
    clock: { now: () => NOW },
    idService: createDeterministicIdService("privacy"),
  });
  const archive = await app.exportSelection();
  assert.deepEqual(archive.payload.assets.map((item) => item.assetId), ["asset-public"]);
  assert.deepEqual(archive.payload.sourceArtifacts.map((item) => item.sourceArtifactId), ["artifact-public"]);
  assert.deepEqual(archive.payload.processingRecords, []);
  assert.ok(archive.manifest.exclusions.some((item) => /asset-private/.test(item.path)));
  assert.ok(archive.manifest.exclusions.some((item) => /artifact-private/.test(item.path)));
  assert.ok(archive.manifest.exclusions.some((item) => /processing-private/.test(item.path)));
  assert.doesNotMatch(JSON.stringify(archive.payload), /asset-private|artifact-private|processing-private/);
});

test("capability contract declares canonical records and fails closed on unfinished source capabilities", () => {
  const snapshot = createCapabilitySnapshot();
  assert.equal(snapshot.capabilities.sources.canonicalContract.available, true);
  assert.equal(snapshot.capabilities.sources.canonicalContract.schemaVersion, SOURCE_CONTRACT_SCHEMA_VERSION);
  assert.equal(snapshot.capabilities.sources.browserFiles.available, true);
  assert.equal(snapshot.capabilities.sources.processingRecords.available, true);
  assert.equal(snapshot.capabilities.sources.publicLinks.available, false);
  assert.equal(snapshot.capabilities.sources.repositoryUrl.available, false);
  assert.equal(snapshot.capabilities.sources.sourceHealthWorkspace.available, false);
  assert.equal(snapshot.capabilities.sources.remoteEvidenceVersions.available, false);
  assert.equal(snapshot.capabilities.sources.retentionEnforcement.available, false);

  const enabled = createCapabilitySnapshot({
    sourceCapabilities: { hardenedRemoteFetch: true, repositoryPlanning: true },
  });
  assert.equal(enabled.capabilities.sources.publicLinks.available, true);
  assert.equal(enabled.capabilities.sources.repositoryUrl.available, true);

  const parsed = parseCapabilitySnapshot(snapshot);
  assert.deepEqual(parsed.capabilities.sources, snapshot.capabilities.sources);
  delete snapshot.capabilities.sources.canonicalContract;
  assert.equal(parseCapabilitySnapshot(snapshot).capabilities.sources.canonicalContract.available, false);
});

test("Studio source list exposes canonical usability and evidence state without claiming full diagnostics", () => {
  const page = readFrontend("app/page.js");
  const css = readFrontend("app/source-contract.css");
  assert.match(page, /SOURCE_STATE_PRESENTATION/);
  assert.match(page, /Usable evidence/);
  assert.match(page, /Reference only/);
  assert.match(page, /sourceArtifactVersionId/);
  assert.match(page, /source-contract-summary/);
  assert.match(page, /aria-live="polite"/);
  assert.match(css, /source-state-badge\.is-usable_evidence/);
  assert.match(css, /source-state-badge\.is-reference_only/);
  assert.match(css, /@media \(max-width: 48rem\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(page, /Source health workspace|Filter all sources|Remote evidence refresh/);
});

test("source architecture documentation and public AI context are consistent", () => {
  const readme = readRepository("README.md");
  const agents = readRepository("AGENTS.md");
  const architecture = readRepository("docs/DOMAIN_ARCHITECTURE.md");
  const matrix = readRepository("docs/CAPABILITY_MATRIX.md");
  const sourceDoc = readRepository("docs/SOURCE_ASSET_CONTRACT.md");
  const transferDoc = readRepository("docs/PORTABLE_TRANSFER.md");
  const llms = readRepository("llms.txt");
  const publicLlms = readFrontend("public/llms.txt");
  const llmsFull = readRepository("llms-full.txt");
  const publicLlmsFull = readFrontend("public/llms-full.txt");

  assert.match(readme, /## Canonical source and asset records/);
  assert.match(agents, /Every upload, API, MCP, repository, extension, import, and future job boundary/);
  assert.match(architecture, /## Canonical source graph/);
  assert.match(matrix, /Hardened remote URL evidence fetch \| Not implemented/);
  assert.match(sourceDoc, /Remote links and extension pages remain `reference_only`/);
  assert.match(sourceDoc, /AssetProcessing/);
  assert.match(sourceDoc, /Rollback/);
  assert.match(transferDoc, /SOURCE_ASSET_CONTRACT\.md/);
  assert.equal(llms, publicLlms);
  assert.equal(llmsFull, publicLlmsFull);
  assert.match(llms, /Canonical Asset, SourceArtifact, and AssetProcessing/);
  assert.match(llmsFull, /## Canonical source and asset graph/);
  assert.match(llmsFull, /Remote URL records cannot become usable evidence/);
});
