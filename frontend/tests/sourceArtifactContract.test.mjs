import test from "node:test";
import assert from "node:assert/strict";

import {
  ASSET_TYPES,
  DELETION_STATES,
  EVIDENCE_STATES,
  INGESTION_METHODS,
  migrateLegacyAsset,
  migrateLegacySourceArtifact,
  normalizeAsset,
  normalizeAssetProcessing,
  normalizeSourceArtifact,
  PRIVACY_CLASSES,
  PROCESSING_RECORD_STATUSES,
  PROCESSING_STATES,
  projectGenerationMediaItem,
  RETENTION_STATES,
  SOURCE_KINDS,
  SOURCE_USABILITY_STATES,
  sourceArtifactSnapshotReference,
  SourceContractError,
  updateSourceArtifactMetadata,
  validateSourceGraph,
  createUploadSourceBundle,
} from "../lib/domain/sourceArtifacts.mjs";
import {
  parseDomainRecord,
  serializeDomainRecord,
} from "../lib/domain/contracts.mjs";

const NOW = "2026-08-01T00:00:00.000Z";
const HASH_A = `sha256:${"a".repeat(64)}`;
const HASH_B = `sha256:${"b".repeat(64)}`;

function assertContractError(callback, code) {
  assert.throws(callback, (error) => {
    assert.equal(error instanceof SourceContractError, true);
    assert.equal(error.code, code);
    return true;
  });
}

function canonicalAsset(overrides = {}) {
  return normalizeAsset({
    assetId: "asset-a",
    workspaceId: "workspace-a",
    campaignId: "campaign-a",
    originalName: "launch.png",
    mimeType: "image/png",
    byteSize: 2048,
    dimensions: { width: 1200, height: 630 },
    contentHash: HASH_A,
    storageRef: { provider: "browser", blobId: "blob-a" },
    userMetadata: {
      description: "Launch social card",
      tags: ["Launch", "launch", "Social"],
      altText: "SignalFlow launch card",
      intendedUse: ["linkedin"],
    },
    privacy: {
      classification: PRIVACY_CLASSES.WORKSPACE_PRIVATE,
      exportAllowed: true,
      processingAllowed: true,
    },
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  });
}

function canonicalArtifact(overrides = {}) {
  return normalizeSourceArtifact({
    sourceArtifactId: "artifact-a",
    workspaceId: "workspace-a",
    campaignId: "campaign-a",
    sourceKind: SOURCE_KINDS.UPLOAD,
    ingestionMethod: INGESTION_METHODS.BROWSER_UPLOAD,
    sourceReference: {
      clientReferenceId: "upload-a",
      displayName: "launch.png",
    },
    originalName: "launch.png",
    mimeType: "image/png",
    byteSize: 2048,
    contentHash: HASH_A,
    assetIds: ["asset-a"],
    extraction: {
      state: PROCESSING_STATES.UNSUPPORTED,
      issueCodes: ["image.analysis_unavailable"],
    },
    usability: {
      state: SOURCE_USABILITY_STATES.REFERENCE_ONLY,
      evidenceState: EVIDENCE_STATES.UNVERIFIED,
      issueCodes: ["image.reference_only"],
    },
    userMetadata: {
      description: "Use as visual direction",
      tags: ["Visual"],
      altText: "Launch image",
      intendedUse: ["campaign_reference"],
    },
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  });
}

test("canonical Asset round-trips with ownership metadata lifecycle and safe storage reference", () => {
  const asset = canonicalAsset();
  assert.equal(asset.kind, "Asset");
  assert.equal(asset.schemaVersion, 1);
  assert.equal(asset.assetType, ASSET_TYPES.IMAGE);
  assert.equal(asset.lifecycle, "original");
  assert.equal(asset.workspaceId, "workspace-a");
  assert.equal(asset.campaignId, "campaign-a");
  assert.deepEqual(asset.dimensions, { width: 1200, height: 630 });
  assert.deepEqual(asset.userMetadata.tags, ["launch", "social"]);
  assert.equal(asset.storageRef.blobId, "blob-a");
  assert.equal(asset.provenance.length, 1);
  assert.deepEqual(parseDomainRecord(serializeDomainRecord(asset), "Asset"), asset);
});

test("canonical SourceArtifact round-trips explicit usability evidence and version identity", () => {
  const artifact = canonicalArtifact();
  assert.equal(artifact.kind, "SourceArtifact");
  assert.equal(artifact.artifactType, SOURCE_KINDS.UPLOAD);
  assert.equal(artifact.sourceKind, SOURCE_KINDS.UPLOAD);
  assert.equal(artifact.usability.state, SOURCE_USABILITY_STATES.REFERENCE_ONLY);
  assert.equal(artifact.usability.evidenceState, EVIDENCE_STATES.UNVERIFIED);
  assert.equal(artifact.assetIds[0], "asset-a");
  assert.match(artifact.sourceArtifactVersionId, /^source-version-/);
  assert.deepEqual(parseDomainRecord(serializeDomainRecord(artifact), "SourceArtifact"), artifact);
});

test("upload bundle accepts plain metadata and creates one linked Asset and SourceArtifact", () => {
  const bundle = createUploadSourceBundle({
    file: {
      name: "launch.md",
      type: "text/markdown",
      size: 512,
      blobId: "blob-upload",
      description: "Launch notes",
    },
    extractedText: "Confirmed launch evidence",
    workspaceId: "workspace-a",
    campaignId: "campaign-a",
    assetId: "asset-upload",
    sourceArtifactId: "artifact-upload",
    now: NOW,
  });
  assert.equal(bundle.asset.assetId, "asset-upload");
  assert.equal(bundle.asset.assetType, ASSET_TYPES.DOCUMENT);
  assert.equal(bundle.sourceArtifact.assetIds[0], "asset-upload");
  assert.equal(bundle.sourceArtifact.extraction.state, PROCESSING_STATES.COMPLETE);
  assert.equal(bundle.sourceArtifact.usability.state, SOURCE_USABILITY_STATES.USABLE_EVIDENCE);
  assert.equal(bundle.sourceArtifact.usability.evidenceState, EVIDENCE_STATES.VERIFIED);
  assert.equal(bundle.extractedText, "Confirmed launch evidence");
});

test("browser File and other runtime objects are rejected at the upload boundary", () => {
  assertContractError(() => createUploadSourceBundle({
    file: new Date(),
    workspaceId: "workspace-a",
  }), "runtime_file_forbidden");
});

test("secret temporary and local-path fields are excluded without retaining their values", () => {
  const asset = normalizeAsset({
    workspaceId: "workspace-a",
    name: "private.png",
    type: "image/png",
    apiKey: "must-not-survive",
    signedUrl: "https://private.example/signed?token=secret",
    localPath: "C:\\Users\\Ankit\\private.png",
    storageRef: { provider: "browser", blobId: "blob-private" },
    createdAt: NOW,
  });
  const serialized = JSON.stringify(asset);
  assert.doesNotMatch(serialized, /must-not-survive|private\.example|Users\\Ankit/i);
  assert.deepEqual(asset.normalizationExclusions.map((item) => item.code).sort(), [
    "local_path_excluded",
    "secret_field_excluded",
    "temporary_reference_excluded",
  ]);
});

test("storage references reject URLs filesystem paths and traversal", () => {
  assertContractError(() => normalizeAsset({
    workspaceId: "workspace-a",
    name: "bad.png",
    storageRef: { provider: "cloud", objectKey: "https://bucket.example/file" },
    createdAt: NOW,
  }), "unsafe_storage_reference");
  assertContractError(() => normalizeAsset({
    workspaceId: "workspace-a",
    name: "bad.png",
    storageRef: { provider: "cloud", objectKey: "../private/file" },
    createdAt: NOW,
  }), "unsafe_storage_reference");
});

test("remote links remain reference-only until the hardened fetch boundary verifies them", () => {
  const reference = normalizeSourceArtifact({
    workspaceId: "workspace-a",
    campaignId: "campaign-a",
    sourceKind: SOURCE_KINDS.LINK,
    ingestionMethod: INGESTION_METHODS.REMOTE_FETCH,
    sourceReference: {
      url: "https://example.com/docs?lang=en#section",
      title: "Docs",
      safetyVerification: "unverified",
    },
    usability: {
      state: SOURCE_USABILITY_STATES.REFERENCE_ONLY,
      evidenceState: EVIDENCE_STATES.UNVERIFIED,
    },
    createdAt: NOW,
  });
  assert.equal(reference.sourceReference.canonicalUrl, "https://example.com/docs?lang=en");
  assert.equal(reference.usability.state, SOURCE_USABILITY_STATES.REFERENCE_ONLY);

  assertContractError(() => normalizeSourceArtifact({
    ...reference,
    usability: {
      state: SOURCE_USABILITY_STATES.USABLE_EVIDENCE,
      evidenceState: EVIDENCE_STATES.VERIFIED,
    },
  }), "unverified_remote_evidence");

  const verified = normalizeSourceArtifact({
    ...reference,
    sourceReference: { ...reference.sourceReference, safetyVerification: "verified" },
    usability: {
      state: SOURCE_USABILITY_STATES.USABLE_EVIDENCE,
      evidenceState: EVIDENCE_STATES.VERIFIED,
    },
  });
  assert.equal(verified.usability.state, SOURCE_USABILITY_STATES.USABLE_EVIDENCE);
});

test("credential-bearing and signed source URLs fail closed", () => {
  assertContractError(() => normalizeSourceArtifact({
    workspaceId: "workspace-a",
    sourceKind: SOURCE_KINDS.LINK,
    ingestionMethod: INGESTION_METHODS.REMOTE_FETCH,
    sourceReference: { url: "https://user:password@example.com/docs" },
    createdAt: NOW,
  }), "credentialed_url_forbidden");
  assertContractError(() => normalizeSourceArtifact({
    workspaceId: "workspace-a",
    sourceKind: SOURCE_KINDS.LINK,
    ingestionMethod: INGESTION_METHODS.REMOTE_FETCH,
    sourceReference: { url: "https://example.com/private?X-Amz-Signature=secret" },
    createdAt: NOW,
  }), "temporary_url_forbidden");
});

test("repository references preserve canonical owner repository revision and safe relative path", () => {
  const artifact = normalizeSourceArtifact({
    workspaceId: "workspace-a",
    campaignId: "campaign-a",
    sourceKind: SOURCE_KINDS.REPOSITORY_FILE,
    ingestionMethod: INGESTION_METHODS.REPOSITORY_SCAN,
    sourceReference: {
      provider: "github",
      owner: "Ankit6149",
      repository: "SignalFlow-Studio",
      revision: "main",
      relativePath: "frontend/app/page.js",
      canonicalUrl: "https://github.com/Ankit6149/SignalFlow-Studio/blob/main/frontend/app/page.js",
    },
    extraction: { state: PROCESSING_STATES.COMPLETE, charCount: 1200 },
    usability: {
      state: SOURCE_USABILITY_STATES.USABLE_EVIDENCE,
      evidenceState: EVIDENCE_STATES.VERIFIED,
    },
    createdAt: NOW,
  });
  assert.equal(artifact.sourceReference.owner, "Ankit6149");
  assert.equal(artifact.sourceReference.relativePath, "frontend/app/page.js");
  assertContractError(() => normalizeSourceArtifact({
    ...artifact,
    sourceArtifactId: "unsafe-repo",
    sourceReference: { ...artifact.sourceReference, relativePath: "../../private.env" },
  }), "unsafe_repository_path");
});

test("trusted local repository stores only an opaque reference and safe relative path", () => {
  const artifact = normalizeSourceArtifact({
    workspaceId: "workspace-a",
    sourceKind: SOURCE_KINDS.TRUSTED_LOCAL_REPOSITORY,
    ingestionMethod: INGESTION_METHODS.TRUSTED_LOCAL,
    sourceReference: {
      localReferenceId: "trusted-repo-1",
      displayName: "SignalFlow checkout",
      relativePath: "frontend/app/page.js",
    },
    privacy: { classification: PRIVACY_CLASSES.DEVICE_PRIVATE, exportAllowed: false },
    createdAt: NOW,
  });
  assert.equal(artifact.sourceReference.localReferenceId, "trusted-repo-1");
  assert.equal(artifact.sourceReference.relativePath, "frontend/app/page.js");
  assert.doesNotMatch(JSON.stringify(artifact), /Users|home\/|[A-Z]:\\/);
  assertContractError(() => normalizeSourceArtifact({
    ...artifact,
    sourceArtifactId: "unsafe-local",
    sourceReference: {
      localReferenceId: "C:\\private\\repo",
      displayName: "Private",
    },
  }), "private_path_forbidden");
});

test("extension pages screenshots recordings notes and imported archives normalize to explicit source kinds", () => {
  const fixtures = [
    {
      sourceKind: SOURCE_KINDS.EXTENSION_PAGE,
      ingestionMethod: INGESTION_METHODS.EXTENSION,
      sourceReference: { url: "https://example.com/product", title: "Product" },
    },
    {
      sourceKind: SOURCE_KINDS.SCREENSHOT,
      ingestionMethod: INGESTION_METHODS.EXTENSION,
      sourceReference: { captureId: "capture-image", pageUrl: "https://example.com", captureScope: "visible_tab" },
    },
    {
      sourceKind: SOURCE_KINDS.RECORDING,
      ingestionMethod: INGESTION_METHODS.EXTENSION,
      sourceReference: { captureId: "capture-video", pageUrl: "https://example.com", captureScope: "tab" },
    },
    {
      sourceKind: SOURCE_KINDS.NOTE,
      ingestionMethod: INGESTION_METHODS.USER_NOTE,
      sourceReference: { clientReferenceId: "note-1", displayName: "Founder note" },
      extraction: { state: PROCESSING_STATES.COMPLETE, charCount: 20 },
      usability: { state: SOURCE_USABILITY_STATES.USABLE_EVIDENCE, evidenceState: EVIDENCE_STATES.VERIFIED },
    },
    {
      sourceKind: SOURCE_KINDS.IMPORTED_ARCHIVE,
      ingestionMethod: INGESTION_METHODS.ARCHIVE_IMPORT,
      sourceReference: { archiveId: "archive-1", sourceArtifactId: "source-old" },
    },
  ];
  for (const [index, fixture] of fixtures.entries()) {
    const artifact = normalizeSourceArtifact({
      workspaceId: "workspace-a",
      campaignId: "campaign-a",
      sourceArtifactId: `artifact-kind-${index}`,
      createdAt: NOW,
      ...fixture,
    });
    assert.equal(artifact.sourceKind, fixture.sourceKind);
    assert.equal(artifact.ingestionMethod, fixture.ingestionMethod);
  }
});

test("derived assets and processing records retain explicit parent processor and output relationships", () => {
  const original = canonicalAsset();
  const derived = canonicalAsset({
    assetId: "asset-derived",
    assetVersionId: undefined,
    lifecycle: "derived",
    originalName: "launch-thumbnail.webp",
    mimeType: "image/webp",
    contentHash: HASH_B,
    storageRef: { provider: "browser", blobId: "blob-derived" },
    parentAssetIds: [original.assetId],
  });
  const artifact = canonicalArtifact({ assetIds: [original.assetId] });
  const processing = normalizeAssetProcessing({
    processingId: "processing-thumbnail",
    workspaceId: "workspace-a",
    campaignId: "campaign-a",
    sourceArtifactId: artifact.sourceArtifactId,
    inputAssetIds: [original.assetId],
    outputAssetIds: [derived.assetId],
    processor: { name: "thumbnailer", version: "2.1", model: "deterministic" },
    status: PROCESSING_RECORD_STATUSES.COMPLETE,
    startedAt: NOW,
    completedAt: "2026-08-01T00:00:01.000Z",
    createdAt: NOW,
  });
  const graph = validateSourceGraph({
    workspaceId: "workspace-a",
    campaignId: "campaign-a",
    assets: [original, derived],
    sourceArtifacts: [artifact],
    processingRecords: [processing],
  });
  assert.equal(graph.assets[1].lifecycle, "derived");
  assert.deepEqual(graph.assets[1].parentAssetIds, ["asset-a"]);
  assert.equal(graph.processingRecords[0].processor.name, "thumbnailer");
  assert.deepEqual(graph.processingRecords[0].outputAssetIds, ["asset-derived"]);
});

test("source graph rejects cross-workspace cross-campaign missing references and provenance cycles", () => {
  assertContractError(() => validateSourceGraph({
    workspaceId: "workspace-a",
    assets: [canonicalAsset({ workspaceId: "workspace-b" })],
  }), "cross_workspace_reference");

  assertContractError(() => validateSourceGraph({
    workspaceId: "workspace-a",
    campaignId: "campaign-a",
    assets: [canonicalAsset({ campaignId: "campaign-b" })],
  }), "cross_campaign_reference");

  assertContractError(() => validateSourceGraph({
    workspaceId: "workspace-a",
    campaignId: "campaign-a",
    sourceArtifacts: [canonicalArtifact({ assetIds: ["missing-asset"] })],
  }), "missing_asset_reference");

  const left = canonicalAsset({ assetId: "asset-left", parentAssetIds: ["asset-right"] });
  const right = canonicalAsset({ assetId: "asset-right", parentAssetIds: ["asset-left"] });
  assertContractError(() => validateSourceGraph({
    workspaceId: "workspace-a",
    assets: [left, right],
  }), "provenance_cycle");
});

test("metadata edits do not rewrite immutable provenance or creation identity", () => {
  const artifact = canonicalArtifact();
  const updated = updateSourceArtifactMetadata(artifact, {
    description: "Updated campaign usage",
    tags: ["reviewed"],
  }, { now: "2026-08-01T01:00:00.000Z" });
  assert.deepEqual(updated.provenance, artifact.provenance);
  assert.equal(updated.createdAt, artifact.createdAt);
  assert.equal(updated.sourceArtifactId, artifact.sourceArtifactId);
  assert.equal(updated.userMetadata.description, "Updated campaign usage");
  assert.deepEqual(updated.userMetadata.tags, ["reviewed"]);
  assert.notEqual(updated.updatedAt, artifact.updatedAt);
});

test("retention and deletion states remain explicit and portable", () => {
  const asset = canonicalAsset({
    retention: {
      state: RETENTION_STATES.EXPIRING,
      retainUntil: "2026-09-01T00:00:00.000Z",
      policy: "workspace_30_days",
    },
    deletion: {
      state: DELETION_STATES.REQUESTED,
      requestedAt: "2026-08-02T00:00:00.000Z",
      issueCodes: ["user.requested"],
    },
  });
  assert.equal(asset.retention.state, RETENTION_STATES.EXPIRING);
  assert.equal(asset.deletion.state, DELETION_STATES.REQUESTED);
  assert.equal(asset.deletion.issueCodes[0], "user.requested");
});

test("legacy media records migrate without claiming unsupported visual evidence", () => {
  const asset = migrateLegacyAsset({
    name: "legacy.png",
    type: "image/png",
    size: 500,
    description: "Legacy image",
  }, { workspaceId: "workspace-a", campaignId: "campaign-a", now: NOW });
  const artifact = migrateLegacySourceArtifact({
    name: "legacy.png",
    type: "image/png",
    size: 500,
    description: "Legacy image",
    assetId: asset.assetId,
    extracted: false,
  }, { workspaceId: "workspace-a", campaignId: "campaign-a", now: NOW });
  assert.equal(asset.assetType, ASSET_TYPES.IMAGE);
  assert.equal(artifact.usability.state, SOURCE_USABILITY_STATES.REFERENCE_ONLY);
  assert.equal(artifact.usability.evidenceState, EVIDENCE_STATES.UNVERIFIED);
  assert.deepEqual(artifact.assetIds, [asset.assetId]);
});

test("future source and asset schema versions fail with upgrade-safe codes", () => {
  assertContractError(() => normalizeAsset({
    schemaVersion: 99,
    workspaceId: "workspace-a",
    name: "future.png",
    createdAt: NOW,
  }), "future_source_schema");
  assertContractError(() => normalizeSourceArtifact({
    schemaVersion: 99,
    workspaceId: "workspace-a",
    sourceKind: SOURCE_KINDS.NOTE,
    createdAt: NOW,
  }), "future_source_schema");
  assertContractError(() => normalizeAssetProcessing({
    schemaVersion: 99,
    workspaceId: "workspace-a",
    sourceArtifactId: "artifact-a",
    processor: { name: "future", version: "99" },
    createdAt: NOW,
  }), "future_source_schema");
});

test("generation and source snapshots project stable version references instead of runtime data", () => {
  const artifact = canonicalArtifact();
  const reference = sourceArtifactSnapshotReference(artifact);
  const media = projectGenerationMediaItem(artifact);
  assert.deepEqual(Object.keys(reference).sort(), [
    "assetIds",
    "contentHash",
    "evidenceState",
    "sourceArtifactId",
    "sourceArtifactVersionId",
    "sourceKind",
    "usabilityState",
  ]);
  assert.equal(reference.sourceArtifactVersionId, artifact.sourceArtifactVersionId);
  assert.equal(media.sourceArtifactId, artifact.sourceArtifactId);
  assert.equal(media.usabilityState, SOURCE_USABILITY_STATES.REFERENCE_ONLY);
  assert.doesNotMatch(JSON.stringify({ reference, media }), /blob-a|storageRef|provenance/);
});
