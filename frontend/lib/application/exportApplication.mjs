import {
  campaignFromPackagePayload,
  migrateLegacyCampaign,
} from "../domain/campaign.mjs";
import {
  projectCampaignJson,
  projectCampaignMarkdown,
} from "../export/campaignExport.mjs";
import { buildCampaignZipExport } from "../export/campaignZip.mjs";

export function resolveExportCampaign(body = {}) {
  if (body.campaign) return migrateLegacyCampaign(body.campaign);
  if (body.package) {
    return campaignFromPackagePayload({
      package: body.package,
      projectName: body.projectName,
      metadata: body.metadata || {
        providerUsed: body.providerUsed,
        modelUsed: body.modelUsed,
        selectedChannels: body.selectedChannels,
        warnings: body.warnings,
        createdAt: body.createdAt,
      },
    });
  }
  throw new TypeError("Missing canonical campaign or compatible package payload.");
}

export function createMarkdownExport(body) {
  return projectCampaignMarkdown(resolveExportCampaign(body));
}

export function createJsonExport(body) {
  return projectCampaignJson(resolveExportCampaign(body));
}

export async function createZipExport(body) {
  return buildCampaignZipExport(resolveExportCampaign(body));
}
