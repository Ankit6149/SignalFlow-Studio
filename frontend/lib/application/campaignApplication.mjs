import {
  assertPort,
  createSystemClock,
  createSystemIdService,
} from "../domain/ports.mjs";
import {
  campaignToEditorState,
  createCampaignAggregate,
} from "../domain/campaign.mjs";
import { migrateCanonicalCampaign } from "../domain/campaignCompatibility.mjs";
import { normalizeLegacyChannelPayload } from "../domain/channelIdentifiers.mjs";
import {
  projectCampaignJson,
  projectCampaignMarkdown,
} from "../export/campaignExport.mjs";
import { buildCampaignZipExport } from "../export/campaignZip.mjs";

export function createCampaignApplication({
  campaignRepository,
  clock = createSystemClock(),
  idService = createSystemIdService("signalflow"),
} = {}) {
  const repository = assertPort("campaignRepository", campaignRepository);
  const applicationClock = assertPort("clock", clock);
  const applicationIds = assertPort("idService", idService);

  function aggregateInput(input, existing = null) {
    const normalizedInput = normalizeLegacyChannelPayload(input) || {};
    const normalizedExisting = existing ? migrateCanonicalCampaign(existing) : null;
    const snapshotAt = normalizedInput.updatedAt
      || normalizedInput.generationRun?.createdAt
      || normalizedExisting?.updatedAt
      || applicationClock.now();
    return createCampaignAggregate({
      ...normalizedInput,
      campaignId: normalizedInput.campaignId || normalizedExisting?.campaignId,
      existingDrafts: normalizedExisting?.drafts || normalizedInput.existingDrafts,
      existingArchives: normalizedExisting?.archives || normalizedInput.existingArchives,
      createdAt: normalizedExisting?.createdAt || normalizedInput.createdAt || snapshotAt,
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

  async function listCampaigns() {
    const stored = await repository.list();
    const normalized = [];
    for (const item of stored) {
      const campaign = migrateCanonicalCampaign(item);
      normalized.push(campaign);
      if (item?.kind !== "Campaign" || item?.schemaVersion !== campaign.schemaVersion) {
        await repository.upsert(campaign);
      }
    }
    return normalized;
  }

  async function getCampaign(campaignId) {
    const stored = await repository.get(campaignId);
    return stored ? migrateCanonicalCampaign(stored) : null;
  }

  async function createCampaign(input) {
    const now = input.updatedAt || applicationClock.now();
    const campaign = aggregateInput({
      ...input,
      campaignId: applicationIds.create("campaign"),
      createdAt: now,
      updatedAt: now,
    });
    return repository.upsert(campaign);
  }

  async function updateCampaign(input) {
    const existing = await requireExisting(input.campaignId);
    const campaign = aggregateInput({
      ...input,
      campaignId: existing.campaignId,
      updatedAt: input.updatedAt || applicationClock.now(),
    }, existing);
    return repository.upsert(campaign);
  }

  async function saveCampaign(input) {
    return input.campaignId
      ? updateCampaign(input)
      : createCampaign(input);
  }

  async function saveAsCopy(input) {
    const now = input.updatedAt || applicationClock.now();
    const campaign = aggregateInput({
      ...input,
      campaignId: applicationIds.create("campaign"),
      createdAt: now,
      updatedAt: now,
    });
    return repository.upsert(campaign);
  }

  function openCampaign(input) {
    return campaignToEditorState(normalizeLegacyChannelPayload(input));
  }

  async function deleteCampaign(campaignId) {
    return repository.remove(campaignId);
  }

  function createSnapshot(input) {
    return aggregateInput(input);
  }

  function projectMarkdown(input) {
    return projectCampaignMarkdown(aggregateInput(input));
  }

  function projectJson(input) {
    return projectCampaignJson(aggregateInput(input));
  }

  async function projectZip(input) {
    return buildCampaignZipExport(aggregateInput(input));
  }

  return {
    listCampaigns,
    getCampaign,
    createCampaign,
    updateCampaign,
    saveCampaign,
    saveAsCopy,
    openCampaign,
    deleteCampaign,
    createSnapshot,
    projectMarkdown,
    projectJson,
    projectZip,
  };
}
