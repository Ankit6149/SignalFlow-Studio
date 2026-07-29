import { assertPort, createSystemClock } from "../domain/ports.mjs";
import {
  campaignToEditorState,
  createCampaignAggregate,
  migrateLegacyCampaign,
} from "../domain/campaign.mjs";
import {
  projectCampaignJson,
  projectCampaignMarkdown,
} from "../export/campaignExport.mjs";

export function createCampaignApplication({ campaignRepository, clock = createSystemClock() } = {}) {
  const repository = assertPort("campaignRepository", campaignRepository);
  const applicationClock = assertPort("clock", clock);

  function aggregateInput(input, existing = null) {
    const snapshotAt = input.updatedAt || applicationClock.now();
    return createCampaignAggregate({
      ...input,
      campaignId: input.campaignId || existing?.campaignId,
      createdAt: existing?.createdAt || input.createdAt || snapshotAt,
      updatedAt: snapshotAt,
    });
  }

  return {
    async listCampaigns() {
      const stored = await repository.list();
      const normalized = [];
      for (const item of stored) {
        const campaign = migrateLegacyCampaign(item);
        normalized.push(campaign);
        if (item?.kind !== "Campaign" || item?.schemaVersion !== campaign.schemaVersion) {
          await repository.upsert(campaign);
        }
      }
      return normalized;
    },

    async saveCampaign(input) {
      const candidateId = input.campaignId || input.id || "";
      const existing = candidateId ? await repository.get(candidateId) : null;
      const campaign = aggregateInput(input, existing);
      return repository.upsert(campaign);
    },

    openCampaign(input) {
      return campaignToEditorState(input);
    },

    async deleteCampaign(campaignId) {
      return repository.remove(campaignId);
    },

    createSnapshot(input) {
      return aggregateInput(input);
    },

    projectMarkdown(input) {
      return projectCampaignMarkdown(aggregateInput(input));
    },

    projectJson(input) {
      return projectCampaignJson(aggregateInput(input));
    },
  };
}
