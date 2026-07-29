import {
  campaignFromPackagePayload,
  migrateLegacyCampaign,
} from "../domain/campaign.mjs";
import { buildCampaignZipExport } from "./campaignZip.mjs";

/**
 * Compatibility wrapper. Canonical Campaign records are preferred; legacy
 * package payloads are translated once and then use the same export projector.
 */
export async function buildZipExport(input, metadata = {}) {
  const campaign = input?.kind === "Campaign"
    ? migrateLegacyCampaign(input)
    : campaignFromPackagePayload({
        package: input,
        projectName: input?.project?.name,
        metadata,
      });
  return (await buildCampaignZipExport(campaign)).content;
}

export { buildCampaignZipExport };
