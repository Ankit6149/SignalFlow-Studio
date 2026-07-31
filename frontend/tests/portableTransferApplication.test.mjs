import test from "node:test";
import assert from "node:assert/strict";

import { createCampaignAggregate } from "../lib/domain/campaign.mjs";
import { createDomainRecord } from "../lib/domain/contracts.mjs";
import { createDeterministicIdService } from "../lib/domain/ports.mjs";
import {
  createMemoryAsyncStore,
  createMemoryBlobStorage,
  createMemoryCampaignRepository,
  createStoreBackedBlobStorage,
  createStoreBackedCampaignRepository,
} from "../lib/infrastructure/adapters.mjs";
import {
  createMemoryApprovalRepository,
  createMemoryAssetRepository,
  createMemoryExportRepository,
  createMemorySourceArtifactRepository,
  createMemoryTransferReportRepository,
  createStoreBackedApprovalRepository,
  createStoreBackedAssetRepository,
  createStoreBackedExportRepository,
  createStoreBackedSourceArtifactRepository,
  createStoreBackedTransferReportRepository,
} from "../lib/infrastructure/transferAdapters.mjs";
import {
  createTransferApplication,
  TRANSFER_CONFLICT_POLICIES,
  TRANSFER_STATUSES,
} from "../lib/transfer/transferApplication.mjs";
import { campaignInput } from "./campaignFixtures.mjs";

function sequenceClock(values) {
  let index = 0;
  return {
    now() {
      const value = values[Math.min(index, values.length - 1)];
      index += 1;
      return value;
    },
  };
}

function clock() {
  return sequenceClock([
    "2026-07-30T18:00:00.000Z",
    "2026-07-30T18:01:00.000Z",
    "2026-07-30T18:02:00.000Z",
    "2026-07-30T18:03:00.000Z",
    "2026-07-30T18:04:00.000Z",
    "2026-07-30T18:05:00.000Z",
    "2026-07-30T18:06:00.000Z",
    "2026-07-30T18:07:00.000Z",
    "2026-07-30T18:08:00.000Z",
    "2026-07-30T18:09:00.000Z",
    "2026-07-30T18:10:00.000Z",
  ]);
}

function campaignFixture(overrides = {}) {
  return createCampaignAggregate(campaignInput({
    campaignId: "campaign-transfer-1",
    generatedPosts: {
      linkedin: "Generated LinkedIn baseline",
      x: "Generated X baseline",
      blog: "Generated blog baseline",
    },
    channelStates: {
      linkedin: { status: "generated", edited: true, approved: true, generationRunId: "run-fixture-1" },
      x: { status: "needs_review", edited: true, approved: false, generationRunId: "run-fixture-1" },
      blog: { status: "regenerated", edited: true, approved: false, generationRunId: "run-fixture-1" },
    },
    archives: [{
      archiveId: "generation-archive-1",
      createdAt: "2026-07-29T12:00:00.000Z",
      reason: "archive_all",
      posts: { linkedin: "Previous edited LinkedIn" },
      generatedPosts: { linkedin: "Previous generated LinkedIn" },
      channelStates: { linkedin: { status: "generated", edited: true, approved: false, generationRunId: "run-old" } },
      result: { providerUsed: "gemini", generation_status: { linkedin: { status: "generated" } } },
      generationRun: { generationRunId: "run-old", provider: "gemini" },
      activeChannel: "linkedin",
      revision: 4,
    }],
    editorState: {
      revision: 9,
      savedRevision: 9,
      exportedRevision: 8,
      lastSavedAt: "2026-07-30T10:00:00.000Z",
      lastExportedAt: "2026-07-30T09:00:00.000Z",
      savedSourceFingerprint: "sf1-fixture",
    },
    ...overrides,
  }));
}

function metadataFixture() {
  const asset = createDomainRecord("Asset", {
    assetId: "asset-transfer-1",
    workspaceId: "workspace-local",
    assetType: "image",
    blobId: "blob-transfer-1",
    contentType: "text/plain",
    fileName: "preview.txt",
    createdAt: "2026-07-29T10:00:00.000Z",
    updatedAt: "2026-07-29T10:00:00.000Z",
  });
  const sourceArtifact = createDomainRecord("SourceArtifact", {
    sourceArtifactId: "source-artifact-1",
    campaignId: "campaign-transfer-1",
    assetId: "asset-transfer-1",
    artifactType: "uploaded_file",
    title: "Preview source",
    createdAt: "2026-07-29T10:00:00.000Z",
  });
  const exportRecord = createDomainRecord("Export", {
    exportId: "export-transfer-1",
    campaignId: "campaign-transfer-1",
    format: "markdown",
    createdAt: "2026-07-29T11:00:00.000Z",
  });
  return { asset, sourceArtifact, exportRecord };
}

function memoryApplication({ campaigns = [], assets = [], sourceArtifacts = [], approvals = [], exports = [], blobValues = {}, assetRepository = null } = {}) {
  return createTransferApplication({
    campaignRepository: createMemoryCampaignRepository(campaigns),
    assetRepository: assetRepository || createMemoryAssetRepository(assets),
    sourceArtifactRepository: createMemorySourceArtifactRepository(sourceArtifacts),
    approvalRepository: createMemoryApprovalRepository(approvals),
    exportRepository: createMemoryExportRepository(exports),
    blobStorage: createMemoryBlobStorage(blobValues),
    transferReportRepository: createMemoryTransferReportRepository(),
    clock: clock(),
    idService: createDeterministicIdService("memory-transfer"),
  });
}

function storeApplication(store = createMemoryAsyncStore()) {
  return {
    store,
    app: createTransferApplication({
      campaignRepository: createStoreBackedCampaignRepository({ store }),
      assetRepository: createStoreBackedAssetRepository({ store }),
      sourceArtifactRepository: createStoreBackedSourceArtifactRepository({ store }),
      approvalRepository: createStoreBackedApprovalRepository({ store }),
      exportRepository: createStoreBackedExportRepository({ store }),
      blobStorage: createStoreBackedBlobStorage({ store }),
      transferReportRepository: createStoreBackedTransferReportRepository({ store }),
      clock: clock(),
      idService: createDeterministicIdService("store-transfer"),
    }),
  };
}

async function sourceArchive() {
  const campaign = campaignFixture();
  const { asset, sourceArtifact, exportRecord } = metadataFixture();
  const source = memoryApplication({
    campaigns: [campaign],
    assets: [asset],
    sourceArtifacts: [sourceArtifact],
    exports: [exportRecord],
    blobValues: { "blob-transfer-1": "portable asset payload" },
  });
  const archive = await source.exportSelection({
    sourceDeployment: { profile: "local", productVersion: "0.2.0", deploymentId: "local-fixture" },
  });
  return { archive, campaign, asset, sourceArtifact, exportRecord };
}

test("local to store-backed hosted to fresh local round-trip preserves content history provenance and blobs", async () => {
  const { archive, campaign } = await sourceArchive();
  const hosted = storeApplication();
  const preview = await hosted.app.previewImport(archive, { destinationWorkspaceId: "workspace-cloud" });
  assert.ok(["ready", TRANSFER_STATUSES.WARNINGS_FOUND].includes(preview.status));
  assert.equal(preview.counts.campaigns, 1);
  assert.equal(preview.counts.assets, 1);

  const imported = await hosted.app.importArchive(archive, { destinationWorkspaceId: "workspace-cloud" });
  assert.equal(imported.status, TRANSFER_STATUSES.COMPLETE);
  const hostedCampaigns = await createStoreBackedCampaignRepository({ store: hosted.store }).list();
  const hostedCampaign = hostedCampaigns[0];
  assert.equal(hostedCampaign.drafts.linkedin.current.content, campaign.drafts.linkedin.current.content);
  assert.equal(hostedCampaign.drafts.linkedin.generated.content, campaign.drafts.linkedin.generated.content);
  assert.equal(hostedCampaign.drafts.linkedin.approved, true);
  assert.equal(hostedCampaign.archives[0].archiveId, "generation-archive-1");
  assert.equal(hostedCampaign.generationRun.createdAt, campaign.generationRun.createdAt);
  assert.equal(hostedCampaign.transferProvenance.archiveId, archive.archiveId);
  assert.equal(hostedCampaign.transferProvenance.historical, true);
  assert.equal(hostedCampaign.transferProvenance.destinationWorkspaceId, "workspace-cloud");

  const hostedAssets = await createStoreBackedAssetRepository({ store: hosted.store }).list();
  assert.equal(hostedAssets[0].transferProvenance.sourceAssetId, "asset-transfer-1");
  assert.equal(await createStoreBackedBlobStorage({ store: hosted.store }).get("blob-transfer-1"), "portable asset payload");
  const hostedArtifacts = await createStoreBackedSourceArtifactRepository({ store: hosted.store }).list();
  assert.equal(hostedArtifacts[0].campaignId, hostedCampaign.campaignId);
  assert.equal(hostedArtifacts[0].assetId, hostedAssets[0].assetId);
  assert.equal((await createStoreBackedApprovalRepository({ store: hosted.store }).list())[0].status, "approved");
  assert.equal((await createStoreBackedExportRepository({ store: hosted.store }).list())[0].campaignId, hostedCampaign.campaignId);

  const hostedArchive = await hosted.app.exportSelection({
    sourceDeployment: { profile: "hosted", productVersion: "0.2.0", deploymentId: "cloud-fixture" },
  });
  const freshLocal = memoryApplication();
  const localImport = await freshLocal.importArchive(hostedArchive, { destinationWorkspaceId: "workspace-local-restored" });
  assert.equal(localImport.status, TRANSFER_STATUSES.COMPLETE);
  const localArchive = await freshLocal.exportSelection({ sourceDeployment: { profile: "local", deploymentId: "restored" } });
  const restoredCampaign = localArchive.payload.campaigns[0];
  assert.equal(restoredCampaign.drafts.linkedin.current.content, campaign.drafts.linkedin.current.content);
  assert.equal(restoredCampaign.drafts.linkedin.generated.content, campaign.drafts.linkedin.generated.content);
  assert.equal(restoredCampaign.drafts.linkedin.approved, true);
  assert.equal(restoredCampaign.archives[0].archiveId, "generation-archive-1");
  assert.equal(restoredCampaign.transferProvenance.sourceCampaignId, hostedCampaign.campaignId);
});

test("re-import is idempotent with skip and creates independent IDs with copy", async () => {
  const { archive } = await sourceArchive();
  const target = storeApplication();
  const first = await target.app.importArchive(archive, { destinationWorkspaceId: "workspace-cloud" });
  assert.equal(first.status, TRANSFER_STATUSES.COMPLETE);

  const secondPreview = await target.app.previewImport(archive, { destinationWorkspaceId: "workspace-cloud" });
  assert.ok(secondPreview.conflicts.some((conflict) => conflict.type === "already_imported"));
  const second = await target.app.importArchive(archive, {
    destinationWorkspaceId: "workspace-cloud",
    conflictPolicy: TRANSFER_CONFLICT_POLICIES.SKIP,
  });
  assert.equal(second.status, TRANSFER_STATUSES.COMPLETE);
  assert.ok(second.items.every((item) => item.status === "skipped"));
  assert.equal((await createStoreBackedCampaignRepository({ store: target.store }).list()).length, 1);

  const copied = await target.app.importArchive(archive, {
    destinationWorkspaceId: "workspace-cloud",
    conflictPolicy: TRANSFER_CONFLICT_POLICIES.COPY,
  });
  assert.equal(copied.status, TRANSFER_STATUSES.COMPLETE);
  const campaigns = await createStoreBackedCampaignRepository({ store: target.store }).list();
  assert.equal(campaigns.length, 2);
  assert.notEqual(campaigns[0].campaignId, campaigns[1].campaignId);
  assert.equal(campaigns[0].title, campaigns[1].title);
  assert.equal((await createStoreBackedAssetRepository({ store: target.store }).list()).length, 2);
});

test("replace conflict restores the archive version without relabeling historical timestamps", async () => {
  const { archive, campaign } = await sourceArchive();
  const altered = createCampaignAggregate({
    ...campaignInput({
      campaignId: "campaign-transfer-1",
      posts: { linkedin: "Locally changed collision" },
      generatedPosts: { linkedin: "Locally changed generated" },
      channels: ["linkedin"],
      createdAt: "2026-07-30T12:00:00.000Z",
      updatedAt: "2026-07-30T12:00:00.000Z",
    }),
  });
  const target = storeApplication();
  await createStoreBackedCampaignRepository({ store: target.store }).upsert(altered);
  const report = await target.app.importArchive(archive, {
    destinationWorkspaceId: "workspace-cloud",
    conflictPolicy: TRANSFER_CONFLICT_POLICIES.REPLACE,
  });
  assert.equal(report.status, TRANSFER_STATUSES.COMPLETE);
  const restored = await createStoreBackedCampaignRepository({ store: target.store }).get("campaign-transfer-1");
  assert.equal(restored.drafts.linkedin.current.content, campaign.drafts.linkedin.current.content);
  assert.equal(restored.createdAt, campaign.createdAt);
  assert.equal(restored.updatedAt, campaign.updatedAt);
  assert.equal(restored.transferProvenance.historical, true);
});

test("non-atomic partial imports can resume without duplicating completed records", async () => {
  const { archive } = await sourceArchive();
  const backingAssets = createMemoryAssetRepository();
  let failOnce = true;
  const failingAssets = {
    list: () => backingAssets.list(),
    get: (id) => backingAssets.get(id),
    remove: (id) => backingAssets.remove(id),
    async upsert(value) {
      if (failOnce) {
        failOnce = false;
        throw new Error("simulated asset write failure");
      }
      return backingAssets.upsert(value);
    },
  };
  const app = createTransferApplication({
    campaignRepository: createMemoryCampaignRepository(),
    assetRepository: failingAssets,
    sourceArtifactRepository: createMemorySourceArtifactRepository(),
    approvalRepository: createMemoryApprovalRepository(),
    exportRepository: createMemoryExportRepository(),
    blobStorage: createMemoryBlobStorage(),
    transferReportRepository: createMemoryTransferReportRepository(),
    clock: clock(),
    idService: createDeterministicIdService("resume-transfer"),
  });

  const partial = await app.importArchive(archive, { destinationWorkspaceId: "workspace-cloud", atomic: false });
  assert.equal(partial.status, TRANSFER_STATUSES.PARTIALLY_IMPORTED);
  assert.ok(partial.items.some((item) => item.kind === "campaign" && item.status === "imported"));

  const resumed = await app.resumeImport(archive, partial.transferReportId, { atomic: false });
  assert.equal(resumed.status, TRANSFER_STATUSES.COMPLETE);
  assert.equal(resumed.items.filter((item) => item.kind === "campaign").length, 1);
  assert.equal((await backingAssets.list()).length, 1);
});

test("atomic import failure rolls back every prior record and manual rollback reverses a completed import", async () => {
  const { archive } = await sourceArchive();
  const campaigns = createMemoryCampaignRepository();
  const assets = createMemoryAssetRepository();
  const artifacts = createMemorySourceArtifactRepository();
  const failingArtifacts = {
    list: () => artifacts.list(),
    get: (id) => artifacts.get(id),
    remove: (id) => artifacts.remove(id),
    async upsert() { throw new Error("simulated source artifact failure"); },
  };
  const reports = createMemoryTransferReportRepository();
  const atomicApp = createTransferApplication({
    campaignRepository: campaigns,
    assetRepository: assets,
    sourceArtifactRepository: failingArtifacts,
    approvalRepository: createMemoryApprovalRepository(),
    exportRepository: createMemoryExportRepository(),
    blobStorage: createMemoryBlobStorage(),
    transferReportRepository: reports,
    clock: clock(),
    idService: createDeterministicIdService("atomic-transfer"),
  });
  const failed = await atomicApp.importArchive(archive, { destinationWorkspaceId: "workspace-cloud", atomic: true });
  assert.equal(failed.status, TRANSFER_STATUSES.FAILED);
  assert.equal(failed.rollback.complete, true);
  assert.equal((await campaigns.list()).length, 0);
  assert.equal((await assets.list()).length, 0);

  const target = storeApplication();
  const complete = await target.app.importArchive(archive, { destinationWorkspaceId: "workspace-cloud" });
  assert.equal(complete.status, TRANSFER_STATUSES.COMPLETE);
  const rolledBack = await target.app.rollbackImport(complete.transferReportId);
  assert.equal(rolledBack.status, TRANSFER_STATUSES.ROLLED_BACK);
  assert.equal((await createStoreBackedCampaignRepository({ store: target.store }).list()).length, 0);
  assert.equal((await createStoreBackedAssetRepository({ store: target.store }).list()).length, 0);
});

test("legacy campaign records export through the canonical contract", async () => {
  const legacy = {
    id: "legacy-transfer-1",
    title: "Legacy portable campaign",
    channels: ["linkedin"],
    posts: { linkedin: "Legacy edited authoritative draft" },
    result: {
      providerUsed: "gemini",
      posts: { linkedin: "Legacy generated baseline" },
      generation_status: { linkedin: { status: "generated" } },
      package: { project: { name: "Legacy portable campaign" } },
    },
    generationRun: campaignInput().generationRun,
    brief: campaignInput().brief,
    createdAt: "2026-07-28T10:00:00.000Z",
    updatedAt: "2026-07-28T11:00:00.000Z",
  };
  const source = memoryApplication({ campaigns: [legacy] });
  const archive = await source.exportSelection({ sourceDeployment: { profile: "local" } });
  const target = memoryApplication();
  const imported = await target.importArchive(archive, { destinationWorkspaceId: "workspace-import" });
  assert.equal(imported.status, TRANSFER_STATUSES.COMPLETE);
  const exportedAgain = await target.exportSelection({ sourceDeployment: { profile: "local" } });
  const campaign = exportedAgain.payload.campaigns[0];
  assert.equal(campaign.campaignId, "legacy-transfer-1");
  assert.equal(campaign.drafts.linkedin.current.content, "Legacy edited authoritative draft");
  assert.equal(campaign.drafts.linkedin.generated.content, "Legacy generated baseline");
});
