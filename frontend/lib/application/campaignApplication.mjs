import {
  assertPort,
  createSystemClock,
  createSystemIdService,
} from "../domain/ports.mjs";
import {
  campaignToEditorState,
  createCampaignAggregate,
  migrateLegacyCampaign,
} from "../domain/campaign.mjs";
import {
  projectCampaignJson,
  projectCampaignMarkdown,
} from "../export/campaignExport.mjs";

export function createCampaignApplication({
  campaignRepository,
  clock = createSystemClock(),
  idService = createSystemIdService("signalflow"),
} = {}) {
  const repository = assertPort("campaignRepository", campaignRepository);
  const applicationClock = assertPort("clock", clock);
  const applicationIds = assertPort("idService", idService);

  function aggregateInput(input, existing = null) {
    const snapshotAt = input.updatedAt || input.generationRun?.createdAt || existing?.updatedAt || applicationClock.now();
    return createCampaignAggregate({
      ...input,
      campaignId: input.campaignId || existing?.campaignId,
      existingDrafts: existing?.drafts || input.existingDrafts,
      existingArchives: existing?.archives || input.existingArchives,
      createdAt: existing?.createdAt || input.createdAt || snapshotAt,
      updatedAt: snapshotAt,
    });
  }

  async function requireExisting(campaignId) {
    const normalizedId = String(campaignId || "").trim();
    if (!normalizedId) throw new TypeError("A campaignId is required to update a campaign.");
    const existing = await repository.get(normalizedId);
    if (!existing) throw new Error(`Campaign ${normalizedId} does not exist.`);
    return existing;
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

    async getCampaign(campaignId) {
      const stored = await repository.get(campaignId);
      return stored ? migrateLegacyCampaign(stored) : null;
    },

    async createCampaign(input) {
      const now = input.updatedAt || applicationClock.now();
      const campaign = aggregateInput({
        ...input,
        campaignId: applicationIds.create("campaign"),
        createdAt: now,
        updatedAt: now,
      });
      return repository.upsert(campaign);
    },

    async updateCampaign(input) {
      const existing = await requireExisting(input.campaignId);
      const campaign = aggregateInput({
        ...input,
        campaignId: existing.campaignId,
        updatedAt: input.updatedAt || applicationClock.now(),
      }, existing);
      return repository.upsert(campaign);
    },

    async saveCampaign(input) {
      return input.campaignId
        ? this.updateCampaign(input)
        : this.createCampaign(input);
    },

    async saveAsCopy(input) {
      const now = input.updatedAt || applicationClock.now();
      const campaign = aggregateInput({
        ...input,
        campaignId: applicationIds.create("campaign"),
        createdAt: now,
        updatedAt: now,
      });
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
