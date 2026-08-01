import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
  updateSourceArtifactMetadata,
} from "../lib/domain/sourceArtifacts.mjs";
import {
  createGenerationSourceSnapshot,
  createSourceFingerprint,
  normalizeGenerationSource,
} from "../lib/studio/campaignFreshness.mjs";
import {
  createMemoryAsyncStore,
  createMemoryBlobStorage,
  createMemoryCampaignRepository,
} from "../lib/infrastructure/adapters.mjs";
import {
  createMemoryApprovalRepository,
  createMemoryAssetProcessingRepository,
  createMemoryAssetRepository,
  createMemoryExportRepository,
  createMemorySourceArtifactRepository,
  createMemoryTransferReportRepository,
  createStoreBackedAssetProcessingRepository,
  createStoreBackedAssetRepository,
  createStoreBackedSourceArtifactRepository,
} from "../lib/infrastructure/transferAdapters.mjs";
import { createDeterministicIdService } from "../lib/domain/ports.mjs";
import {
  createTransferApplication,
  TRANSFER_CONFLICT_POLICIES,
  TRANSFER_STATUSES,
} from "../lib/transfer/transferApplication.mjs";
import { validatePortableArchive } from "../lib/transfer/portableArchive.mjs";

const NOW = "2026-08-01T02:00:00.000Z";
const HASH_A = `sha256:${"a".repeat(64)}`;
const HASH_B = `sha256:${"b".repeat(64)}`;
const testDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(testDir, "..");
const repositoryRoot = path.resolve(frontendRoot, "..");
const readFrontend = (relative) => fs.readFileSync(path.join(frontendRoot, relative), "utf8");
const readRepository = (relative) => fs.readFileSync(path.join(repositoryRoot, relative), "utf8");

function clock(value = NOW) {
  return { now: () => value };
}

function repositories({ assets = [], artifacts = [], processing = [] } = {}) {
  return {
    campaignRepository: createMemoryCampaignRepository(),
    assetRepository: createMemoryAssetRepository(assets),
    sourceArtifactRepository: createMemorySourceArtifactRepository(artifacts),
    assetProcessingRepository: createMemoryAssetProcessingRepository(processing),
    approvalRepository: createMemoryApprovalRepository(),
    exportRepository: createMemoryExportRepository(),
    blobStorage: createMemoryBlobStorage(),
    transferReportRepository: createMemoryTransferReportRepository(),
  };
}

test("campaign source fingerprints use stable source artifact versions rather than editable metadata", () => {
  const bundle = createUploadSourceBundle({
    file: { name: "evidence.md", type: "text/markdown", size: 100 },
    extractedText: "Canonical product evidence",
    workspaceId: "workspace-a",
    campaignId: "campaign-a",
    assetId: "asset-evidence",
    sourceArtifactId: "artifact-evidence",
    now: NOW,
  });
  const firstInput = {
    form: {
      projectName: "SignalFlow",
      notes: "Launch",
      audience: "Builders",
      provider: "gemini",
    },
    channels: ["linkedin"],
    files: [{ asset: bundle.asset, sourceArtifact: bundle.sourceArtifact }],
    documentText: ["Canonical product evidence"],
  };
  const first = normalizeGenerationSource(firstInput);
  const updatedArtifact = updateSourceArtifactMetadata(bundle.sourceArtifact, {
    description: "Use this as primary launch evidence",
    tags: ["primary"],
  }, { now: "2026-08-01T03:00:00.000Z" });
  const second = normalizeGenerationSource({
    ...firstInput,
    files: [{ asset: bundle.asset, sourceArtifact: updatedArtifact }],
  });
  assert.equal(createSourceFingerprint(first), createSourceFingerprint(second));
  assert.equal(first.media[0].sourceArtifactVersionId, bundle.sourceArtifact.sourceArtifactVersionId);
  assert.doesNotMatch(JSON.stringify(first.media), /Use this as primary|storageRef|provenance/);

  const changedArtifact = normalizeSourceArtifact({
    ...bundle.sourceArtifact,
    sourceArtifactVersionId: undefined,
    contentHash: HASH_B,
    updatedAt: "2026-08-01T04:00:00.000Z",
  });
  const changed = normalizeGenerationSource({
    ...firstInput,
    files: [{ asset: bundle.asset, sourceArtifact: changedArtifact }],
  });
  assert.notEqual(createSourceFingerprint(first), createSourceFingerprint(changed));

  const snapshot = createGenerationSourceSnapshot(firstInput, { createdAt: NOW });
  assert.equal(snapshot.normalizedSource.media[0].sourceArtifactId, "artifact-evidence");
  assert.equal(snapshot.normalizedSource.media[0].sourceArtifactVersionId, bundle.sourceArtifact.sourceArtifactVersionId);
});

test("browser memory and store-backed repositories normalize legacy records into the canonical contract", async () => {
  const memoryAssets = createMemoryAssetRepository([{
    assetId: "legacy-asset",
    name: "legacy.png",
    type: "image/png",
    size: 55,
  }]);
  const memoryArtifacts = createMemorySourceArtifactRepository([{
    sourceArtifactId: "legacy-artifact",
    artifactType: "document",
    name: "legacy.png",
    type: "image/png",
    size: 55,
    assetId: "legacy-asset",
  }]);
  const asset = await memoryAssets.get("legacy-asset");
  const artifact = await memoryArtifacts.get("legacy-artifact");
  assert.equal(asset.workspaceId, "legacy-local");
  assert.equal(asset.assetType, "image");
  assert.equal(artifact.workspaceId, "legacy-local");
  assert.equal(artifact.sourceKind, SOURCE_KINDS.UPLOAD);
  assert.equal(artifact.usability.state, SOURCE_USABILITY_STATES.REFERENCE_ONLY);

  const store = createMemoryAsyncStore();
  const storeAssets = createStoreBackedAssetRepository({ store });
  const storeArtifacts = createStoreBackedSourceArtifactRepository({ store });
  const storeProcessing = createStoreBackedAssetProcessingRepository({ store });
  await storeAssets.upsert({
    assetId: "store-asset",
    workspaceId: "workspace-store",
    name: "source.md",
    type: "text/markdown",
    size: 20,
    createdAt: NOW,
  });
  await storeArtifacts.upsert({
    sourceArtifactId: "store-artifact",
    workspaceId: "workspace-store",
    artifactType: SOURCE_KINDS.UPLOAD,
    assetId: "store-asset",
    extracted: true,
    createdAt: NOW,
  });
  await storeProcessing.upsert({
    processingId: "store-processing",
    workspaceId: "workspace-store",
    sourceArtifactId: "store-artifact",
    processor: { name: "extractor", version: "1" },
    status: PROCESSING_RECORD_STATUSES.COMPLETE,
    createdAt: NOW,
  });
  assert.equal((await storeAssets.get("store-asset")).kind, "Asset");
  assert.equal((await storeArtifacts.get("store-artifact")).kind, "SourceArtifact");
  assert.equal((await storeProcessing.get("store-processing")).kind, "AssetProcessing");
});

test("portable archives include processing records and validate their manifest counts", async () => {
  const original = normalizeAsset({
    assetId: "asset-original",
    workspaceId: "workspace-source",
    originalName: "source.md",
    mimeType: "text/markdown",
    contentHash: HASH_A,
    storageRef: { provider: "memory", blobId: "blob-original" },
    createdAt: NOW,
  });
  const derived = normalizeAsset({
    assetId: "asset-derived",
    workspaceId: "workspace-source",
    lifecycle: "derived",
    parentAssetIds: ["asset-original"],
    originalName: "source-summary.txt",
    mimeType: "text/plain",
    contentHash: HASH_B,
    storageRef: { provider: "memory", blobId: "blob-derived" },
    createdAt: NOW,
  });
  const artifact = normalizeSourceArtifact({
    sourceArtifactId: "artifact-original",
    workspaceId: "workspace-source",
    sourceKind: SOURCE_KINDS.UPLOAD,
    ingestionMethod: INGESTION_METHODS.BROWSER_UPLOAD,
    originalName: "source.md",
    mimeType: "text/markdown",
    assetIds: ["asset-original"],
    extraction: { state: PROCESSING_STATES.COMPLETE, charCount: 50 },
    usability: { state: SOURCE_USABILITY_STATES.USABLE_EVIDENCE, evidenceState: EVIDENCE_STATES.VERIFIED },
    createdAt: NOW,
  });
  const processing = normalizeAssetProcessing({
    processingId: "processing-summary",
    workspaceId: "workspace-source",
    sourceArtifactId: "artifact-original",
    inputAssetIds: ["asset-original"],
    outputAssetIds: ["asset-derived"],
    outputSourceArtifactIds: [],
    processor: { name: "summary", version: "1" },
    status: PROCESSING_RECORD_STATUSES.COMPLETE,
    createdAt: NOW,
  });
  const app = createTransferApplication({
    ...repositories({ assets: [original, derived], artifacts: [artifact], processing: [processing] }),
    clock: clock(),
    idService: createDeterministicIdService("archive"),
  });
  const archive = await app.exportSelection({ sourceDeployment: { profile: "local" } });
  assert.equal(archive.manifest.processingRecordCount, 1);
  assert.equal(archive.payload.processingRecords[0].processingId, "processing-summary");
  const validation = await validatePortableArchive(archive);
  assert.equal(validation.valid, true);
  assert.equal(validation.counts.processingRecords, 1);
});

test("Copy import remaps AssetProcessing and SourceArtifact array references consistently", async () => {
  const sourceOriginal = normalizeAsset({
    assetId: "asset-original",
    workspaceId: "workspace-source",
    originalName: "source.md",
    mimeType: "text/markdown",
    contentHash: HASH_A,
    createdAt: NOW,
  });
  const sourceDerived = normalizeAsset({
    assetId: "asset-derived",
    workspaceId: "workspace-source",
    lifecycle: "derived",
    parentAssetIds: ["asset-original"],
    originalName: "derived.txt",
    mimeType: "text/plain",
    contentHash: HASH_B,
    createdAt: NOW,
  });
  const sourceArtifact = normalizeSourceArtifact({
    sourceArtifactId: "artifact-source",
    workspaceId: "workspace-source",
    sourceKind: SOURCE_KINDS.UPLOAD,
    ingestionMethod: INGESTION_METHODS.BROWSER_UPLOAD,
    assetIds: ["asset-original"],
    originalName: "source.md",
    extraction: { state: PROCESSING_STATES.COMPLETE, charCount: 10 },
    usability: { state: SOURCE_USABILITY_STATES.USABLE_EVIDENCE, evidenceState: EVIDENCE_STATES.VERIFIED },
    createdAt: NOW,
  });
  const sourceProcessing = normalizeAssetProcessing({
    processingId: "processing-source",
    workspaceId: "workspace-source",
    sourceArtifactId: "artifact-source",
    inputAssetIds: ["asset-original"],
    outputAssetIds: ["asset-derived"],
    outputSourceArtifactIds: ["artifact-source"],
    processor: { name: "derive", version: "1" },
    status: PROCESSING_RECORD_STATUSES.COMPLETE,
    createdAt: NOW,
  });
  const sourceApp = createTransferApplication({
    ...repositories({
      assets: [sourceOriginal, sourceDerived],
      artifacts: [sourceArtifact],
      processing: [sourceProcessing],
    }),
    clock: clock(),
    idService: createDeterministicIdService("source"),
  });
  const archive = await sourceApp.exportSelection();

  const targetOriginal = normalizeAsset({ ...sourceOriginal, workspaceId: "workspace-target" });
  const targetDerived = normalizeAsset({ ...sourceDerived, workspaceId: "workspace-target" });
  const targetArtifact = normalizeSourceArtifact({ ...sourceArtifact, workspaceId: "workspace-target" });
  const targetProcessing = normalizeAssetProcessing({ ...sourceProcessing, workspaceId: "workspace-target" });
  const targetRepositories = repositories({
    assets: [targetOriginal, targetDerived],
    artifacts: [targetArtifact],
    processing: [targetProcessing],
  });
  const targetApp = createTransferApplication({
    ...targetRepositories,
    clock: clock("2026-08-01T05:00:00.000Z"),
    idService: createDeterministicIdService("copy"),
  });
  const report = await targetApp.importArchive(archive, {
    destinationWorkspaceId: "workspace-target",
    conflictPolicy: TRANSFER_CONFLICT_POLICIES.COPY,
  });
  assert.equal(report.status, TRANSFER_STATUSES.COMPLETE);

  const importedArtifacts = (await targetRepositories.sourceArtifactRepository.list())
    .filter((item) => item.transferProvenance?.archiveId === archive.archiveId);
  const importedProcessing = (await targetRepositories.assetProcessingRepository.list())
    .filter((item) => item.transferProvenance?.archiveId === archive.archiveId);
  const importedAssets = (await targetRepositories.assetRepository.list())
    .filter((item) => item.transferProvenance?.archiveId === archive.archiveId);
  assert.equal(importedArtifacts.length, 1);
  assert.equal(importedProcessing.length, 1);
  assert.equal(importedAssets.length, 2);
  assert.notEqual(importedArtifacts[0].sourceArtifactId, "artifact-source");
  assert.notDeepEqual(importedArtifacts[0].assetIds, ["asset-original"]);
  assert.equal(importedProcessing[0].sourceArtifactId, importedArtifacts[0].sourceArtifactId);
  assert.deepEqual(new Set(importedProcessing[0].inputAssetIds), new Set([importedArtifacts[0].assetIds[0]]));
  assert.equal(importedProcessing[0].outputAssetIds.every((id) => importedAssets.some((asset) => asset.assetId === id)), true);
  assert.deepEqual(importedProcessing[0].outputSourceArtifactIds, [importedArtifacts[0].sourceArtifactId]);
});

test("main Studio upload and generation boundary use canonical records with compatibility projection only", () => {
  const page = readFrontend("app/page.js");
  assert.match(page, /createUploadSourceBundle/);
  assert.match(page, /assetId: createClientId\("asset"\)/);
  assert.match(page, /sourceArtifactId: createClientId\("source-artifact"\)/);
  assert.match(page, /assets: files\.map\(\(file\) => file\.asset\)/);
  assert.match(page, /source_artifacts: files\.map\(\(file\) => file\.sourceArtifact\)/);
  assert.match(page, /media_items: files\.map\(\(file\) => projectGenerationMediaItem/);
  assert.doesNotMatch(page, /nextFiles\.push\(\{\s*name: file\.name,\s*type: file\.type \|\| "file"/s);
});

test("generation API validates one canonical source graph and returns safe issue codes", () => {
  const route = readFrontend("app/api/launch_kit/route.js");
  assert.match(route, /validateSourceGraph/);
  assert.match(route, /body\.source_artifacts \|\| body\.sourceArtifacts/);
  assert.match(route, /body\.processing_records \|\| body\.processingRecords/);
  assert.match(route, /cross_workspace_reference/);
  assert.match(route, /sourceIssue/);
  assert.match(route, /status: 400/);
  assert.match(route, /projectGenerationMediaItem/);
});

test("MCP schema and execution use the same canonical validation and projections", () => {
  const tools = readRepository("mcp/lib/tools.mjs");
  assert.match(tools, /sourceArtifacts:/);
  assert.match(tools, /processingRecords:/);
  assert.match(tools, /validateSourceGraph/);
  assert.match(tools, /source_artifacts: canonicalSources\.sourceArtifacts/);
  assert.match(tools, /processing_records: canonicalSources\.processingRecords/);
  assert.match(tools, /projectGenerationMediaItem/);
});
