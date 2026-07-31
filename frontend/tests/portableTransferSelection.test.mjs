import test from "node:test";
import assert from "node:assert/strict";

import { createCampaignAggregate } from "../lib/domain/campaign.mjs";
import { createDomainRecord } from "../lib/domain/contracts.mjs";
import { createDeterministicIdService } from "../lib/domain/ports.mjs";
import {
  createMemoryBlobStorage,
  createMemoryCampaignRepository,
} from "../lib/infrastructure/adapters.mjs";
import {
  createMemoryApprovalRepository,
  createMemoryAssetRepository,
  createMemoryExportRepository,
  createMemorySourceArtifactRepository,
  createMemoryTransferReportRepository,
} from "../lib/infrastructure/transferAdapters.mjs";
import { createTransferApplication } from "../lib/transfer/transferApplication.mjs";

function campaign(campaignId, title) {
  return createCampaignAggregate({
    campaignId,
    title,
    channels: ["linkedin"],
    posts: { linkedin: `${title} edited draft` },
    generatedPosts: { linkedin: `${title} generated draft` },
    channelStates: {
      linkedin: {
        status: "generated",
        edited: true,
        approved: false,
        generationRunId: `run-${campaignId}`,
      },
    },
    result: {
      providerUsed: "gemini",
      generation_status: { linkedin: { status: "generated" } },
    },
    generationRun: {
      generationRunId: `run-${campaignId}`,
      sourceSnapshotId: `source-${campaignId}`,
      sourceFingerprint: `fingerprint-${campaignId}`,
      provider: "gemini",
      createdAt: "2026-07-31T00:00:00.000Z",
    },
    createdAt: "2026-07-31T00:00:00.000Z",
    updatedAt: "2026-07-31T00:00:00.000Z",
  });
}

function recordFixtures() {
  return {
    assets: [
      createDomainRecord("Asset", {
        assetId: "asset-a",
        assetType: "image",
        blobId: "blob-a",
      }),
      createDomainRecord("Asset", {
        assetId: "asset-b",
        assetType: "image",
        blobId: "blob-b",
      }),
      createDomainRecord("Asset", {
        assetId: "asset-unrelated",
        assetType: "image",
        blobId: "blob-unrelated",
      }),
    ],
    artifacts: [
      createDomainRecord("SourceArtifact", {
        sourceArtifactId: "artifact-a",
        campaignId: "campaign-a",
        assetId: "asset-a",
        artifactType: "uploaded_file",
      }),
      createDomainRecord("SourceArtifact", {
        sourceArtifactId: "artifact-b",
        campaignId: "campaign-b",
        assetId: "asset-b",
        artifactType: "uploaded_file",
      }),
    ],
    approvals: [
      createDomainRecord("Approval", {
        approvalId: "approval-a",
        campaignId: "campaign-a",
        status: "approved",
      }),
      createDomainRecord("Approval", {
        approvalId: "approval-b",
        campaignId: "campaign-b",
        status: "approved",
      }),
    ],
    exports: [
      createDomainRecord("Export", {
        exportId: "export-a",
        campaignId: "campaign-a",
        format: "json",
      }),
      createDomainRecord("Export", {
        exportId: "export-b",
        campaignId: "campaign-b",
        format: "json",
      }),
    ],
  };
}

function application() {
  const records = recordFixtures();
  return createTransferApplication({
    campaignRepository: createMemoryCampaignRepository([
      campaign("campaign-a", "Campaign A"),
      campaign("campaign-b", "Campaign B"),
    ]),
    assetRepository: createMemoryAssetRepository(records.assets),
    sourceArtifactRepository: createMemorySourceArtifactRepository(records.artifacts),
    approvalRepository: createMemoryApprovalRepository(records.approvals),
    exportRepository: createMemoryExportRepository(records.exports),
    blobStorage: createMemoryBlobStorage({
      "blob-a": "A payload",
      "blob-b": "B payload",
      "blob-unrelated": "Unrelated payload",
    }),
    transferReportRepository: createMemoryTransferReportRepository(),
    clock: { now: () => "2026-07-31T12:00:00.000Z" },
    idService: createDeterministicIdService("selection"),
  });
}

test("campaign selection includes only related metadata and blobs by default", async () => {
  const archive = await application().exportSelection({
    campaignIds: ["campaign-a"],
    sourceDeployment: { profile: "browser-local" },
  });

  assert.deepEqual(archive.payload.campaigns.map((item) => item.campaignId), ["campaign-a"]);
  assert.deepEqual(archive.payload.sourceArtifacts.map((item) => item.sourceArtifactId), ["artifact-a"]);
  assert.deepEqual(archive.payload.assets.map((item) => item.assetId), ["asset-a"]);
  assert.deepEqual(archive.payload.approvals.map((item) => item.approvalId), ["approval-a"]);
  assert.deepEqual(archive.payload.exports.map((item) => item.exportId), ["export-a"]);
  assert.deepEqual(archive.payload.blobEntries.map((item) => item.blobId), ["blob-a"]);

  const serialized = JSON.stringify(archive);
  assert.doesNotMatch(serialized, /campaign-b|artifact-b|asset-b|approval-b|export-b|blob-b|unrelated/i);
});

test("explicit metadata IDs may add records outside the selected campaign deliberately", async () => {
  const archive = await application().exportSelection({
    campaignIds: ["campaign-a"],
    assetIds: ["asset-unrelated"],
    sourceArtifactIds: ["artifact-b"],
    approvalIds: ["approval-b"],
    exportIds: ["export-b"],
  });

  assert.deepEqual(archive.payload.campaigns.map((item) => item.campaignId), ["campaign-a"]);
  assert.deepEqual(archive.payload.sourceArtifacts.map((item) => item.sourceArtifactId), ["artifact-b"]);
  assert.deepEqual(archive.payload.assets.map((item) => item.assetId), ["asset-unrelated"]);
  assert.deepEqual(archive.payload.approvals.map((item) => item.approvalId), ["approval-b"]);
  assert.deepEqual(archive.payload.exports.map((item) => item.exportId), ["export-b"]);
  assert.deepEqual(archive.payload.blobEntries.map((item) => item.blobId), ["blob-unrelated"]);
});

test("empty campaign selection still exports the complete library for explicit whole-library transfer", async () => {
  const archive = await application().exportSelection();
  assert.equal(archive.payload.campaigns.length, 2);
  assert.equal(archive.payload.sourceArtifacts.length, 2);
  assert.equal(archive.payload.assets.length, 3);
  assert.equal(archive.payload.approvals.length >= 2, true);
  assert.equal(archive.payload.exports.length, 2);
  assert.equal(archive.payload.blobEntries.length, 3);
});
