import { migrateLegacyCampaign } from "./campaign.mjs";
import { normalizeLegacyChannelPayload } from "./channelIdentifiers.mjs";

export function migrateCanonicalCampaign(input) {
  return migrateLegacyCampaign(normalizeLegacyChannelPayload(input));
}
