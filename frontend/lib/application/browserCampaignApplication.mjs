import { createCampaignApplication } from "./campaignApplication.mjs";
import { createBrowserCampaignRepository } from "../infrastructure/adapters.mjs";

export function createBrowserCampaignApplication({ getStorage, key, limit = 30, clock } = {}) {
  return createCampaignApplication({
    campaignRepository: createBrowserCampaignRepository({ getStorage, key, limit }),
    clock,
  });
}
