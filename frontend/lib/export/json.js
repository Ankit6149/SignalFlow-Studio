import {
  campaignFromPackagePayload,
  migrateLegacyCampaign,
} from "../domain/campaign.mjs";
import { projectCampaignJson } from "./campaignExport.mjs";

/**
 * Compatibility wrapper. New callers should pass a canonical Campaign record.
 * Legacy package payloads are translated once, then projected through the same
 * authoritative CampaignExport schema.
 */
export function buildJSONExport(input, metadata = {}) {
  const campaign = input?.kind === "Campaign"
    ? migrateLegacyCampaign(input)
    : campaignFromPackagePayload({
        package: input,
        projectName: input?.project?.name,
        metadata,
      });
  return projectCampaignJson(campaign).content;
}
