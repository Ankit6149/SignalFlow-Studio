import test from "node:test";
import assert from "node:assert/strict";

import { createDomainRecord } from "../lib/domain/contracts.mjs";
import { createMemoryAsyncStore } from "../lib/infrastructure/adapters.mjs";
import {
  createBrowserApprovalRepository,
  createBrowserAssetRepository,
  createBrowserBlobStorage,
  createBrowserExportRepository,
  createBrowserSourceArtifactRepository,
  createBrowserTransferReportRepository,
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

function fakeStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
  };
}

async function repositoryContract(repository, record, idField) {
  assert.deepEqual(await repository.list(), []);
  await repository.upsert(record);
  assert.equal((await repository.get(record[idField]))[idField], record[idField]);
  assert.equal((await repository.list()).length, 1);
  assert.equal(await repository.remove(record[idField]), true);
  assert.equal(await repository.get(record[idField]), null);
}

const fixtures = {
  asset: createDomainRecord("Asset", { assetId: "asset-1", assetType: "image", createdAt: "2026-07-30T00:00:00.000Z" }),
  sourceArtifact: createDomainRecord("SourceArtifact", { sourceArtifactId: "artifact-1", artifactType: "document", createdAt: "2026-07-30T00:00:00.000Z" }),
  approval: createDomainRecord("Approval", { approvalId: "approval-1", status: "approved", createdAt: "2026-07-30T00:00:00.000Z" }),
  export: createDomainRecord("Export", { exportId: "export-1", format: "json", createdAt: "2026-07-30T00:00:00.000Z" }),
  report: createDomainRecord("TransferReport", { transferReportId: "report-1", archiveId: "archive-1", status: "complete", createdAt: "2026-07-30T00:00:00.000Z" }),
};

test("memory portable metadata repositories share one contract", async () => {
  await repositoryContract(createMemoryAssetRepository(), fixtures.asset, "assetId");
  await repositoryContract(createMemorySourceArtifactRepository(), fixtures.sourceArtifact, "sourceArtifactId");
  await repositoryContract(createMemoryApprovalRepository(), fixtures.approval, "approvalId");
  await repositoryContract(createMemoryExportRepository(), fixtures.export, "exportId");
  await repositoryContract(createMemoryTransferReportRepository(), fixtures.report, "transferReportId");
});

test("store-backed portable metadata repositories share one contract", async () => {
  const store = createMemoryAsyncStore();
  await repositoryContract(createStoreBackedAssetRepository({ store }), fixtures.asset, "assetId");
  await repositoryContract(createStoreBackedSourceArtifactRepository({ store }), fixtures.sourceArtifact, "sourceArtifactId");
  await repositoryContract(createStoreBackedApprovalRepository({ store }), fixtures.approval, "approvalId");
  await repositoryContract(createStoreBackedExportRepository({ store }), fixtures.export, "exportId");
  await repositoryContract(createStoreBackedTransferReportRepository({ store }), fixtures.report, "transferReportId");
});

test("browser portable metadata repositories share one contract", async () => {
  const storage = fakeStorage();
  const getStorage = () => storage;
  await repositoryContract(createBrowserAssetRepository({ getStorage }), fixtures.asset, "assetId");
  await repositoryContract(createBrowserSourceArtifactRepository({ getStorage }), fixtures.sourceArtifact, "sourceArtifactId");
  await repositoryContract(createBrowserApprovalRepository({ getStorage }), fixtures.approval, "approvalId");
  await repositoryContract(createBrowserExportRepository({ getStorage }), fixtures.export, "exportId");
  await repositoryContract(createBrowserTransferReportRepository({ getStorage }), fixtures.report, "transferReportId");
});

test("browser blob storage preserves bytes text and JSON independently", async () => {
  const browserStorage = fakeStorage();
  const storage = createBrowserBlobStorage({ getStorage: () => browserStorage });
  await storage.put("bytes", new Uint8Array([0, 10, 255]));
  await storage.put("text", "portable text");
  await storage.put("json", { portable: true });
  assert.deepEqual(Array.from(await storage.get("bytes")), [0, 10, 255]);
  assert.equal(await storage.get("text"), "portable text");
  assert.deepEqual(await storage.get("json"), { portable: true });
  assert.equal(await storage.remove("text"), true);
  assert.equal(await storage.get("text"), null);
});