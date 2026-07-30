import { createCampaignApplication } from "./campaignApplication.mjs";
import { createBrowserCampaignRepository } from "../infrastructure/adapters.mjs";
import { createSystemIdService } from "../domain/ports.mjs";

export function createBrowserCampaignApplication({ getStorage, key, limit = 30, clock, idService } = {}) {
  return createCampaignApplication({
    campaignRepository: createBrowserCampaignRepository({ getStorage, key, limit }),
    clock,
    idService: idService || createSystemIdService("signalflow"),
  });
}
