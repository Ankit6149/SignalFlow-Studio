import { createBrowserCampaignRepository } from "../infrastructure/adapters.mjs";
import {
  createBrowserApprovalRepository,
  createBrowserAssetRepository,
  createBrowserBlobStorage,
  createBrowserExportRepository,
  createBrowserSourceArtifactRepository,
  createBrowserTransferReportRepository,
} from "../infrastructure/transferAdapters.mjs";
import { createTransferApplication } from "../transfer/transferApplication.mjs";

export function createBrowserTransferApplication({
  getStorage,
  campaignKey = "signalflow_recovery_library",
  clock,
  idService,
  signer = null,
} = {}) {
  return createTransferApplication({
    campaignRepository: createBrowserCampaignRepository({ getStorage, key: campaignKey }),
    assetRepository: createBrowserAssetRepository({ getStorage }),
    sourceArtifactRepository: createBrowserSourceArtifactRepository({ getStorage }),
    approvalRepository: createBrowserApprovalRepository({ getStorage }),
    exportRepository: createBrowserExportRepository({ getStorage }),
    blobStorage: createBrowserBlobStorage({ getStorage }),
    transferReportRepository: createBrowserTransferReportRepository({ getStorage }),
    clock,
    idService,
    signer,
  });
}
