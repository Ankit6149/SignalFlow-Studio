import { assertPort } from "../domain/ports.mjs";
import { migrateLegacyCampaign } from "../domain/campaign.mjs";
import { portableClone, serializeDomainRecord } from "../domain/contracts.mjs";

function clone(value) {
  return portableClone(value);
}

function sortCampaigns(items) {
  return [...items].sort((left, right) => String(right.updatedAt || "").localeCompare(String(left.updatedAt || "")));
}

export function createMemoryCampaignRepository(initial = []) {
  const records = new Map();
  for (const item of initial) {
    const campaign = migrateLegacyCampaign(item);
    records.set(campaign.campaignId, campaign);
  }
  return assertPort("campaignRepository", {
    async list() {
      return sortCampaigns(Array.from(records.values())).map(clone);
    },
    async get(campaignId) {
      return records.has(campaignId) ? clone(records.get(campaignId)) : null;
    },
    async upsert(campaign) {
      const normalized = migrateLegacyCampaign(campaign);
      records.set(normalized.campaignId, normalized);
      return clone(normalized);
    },
    async remove(campaignId) {
      return records.delete(campaignId);
    },
  });
}

export function createBrowserCampaignRepository({ getStorage, key = "signalflow_campaigns_v1", limit = 30 } = {}) {
  if (typeof getStorage !== "function") throw new TypeError("Browser repository requires getStorage().");

  function storage() {
    const target = getStorage();
    if (!target || typeof target.getItem !== "function" || typeof target.setItem !== "function") {
      throw new TypeError("Browser storage is unavailable.");
    }
    return target;
  }

  function readRaw() {
    const raw = storage().getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  }

  function write(items) {
    const normalized = sortCampaigns(items).slice(0, limit);
    storage().setItem(key, `[${normalized.map((item) => serializeDomainRecord(item)).join(",")}]`);
    return normalized;
  }

  return assertPort("campaignRepository", {
    async list() {
      const raw = readRaw();
      const campaigns = raw.map(migrateLegacyCampaign);
      const needsMigration = raw.some((item) => item?.kind !== "Campaign" || item?.schemaVersion !== 1);
      const sorted = sortCampaigns(campaigns).slice(0, limit);
      if (needsMigration) write(sorted);
      return sorted.map(clone);
    },
    async get(campaignId) {
      const items = await this.list();
      return items.find((item) => item.campaignId === campaignId) || null;
    },
    async upsert(campaign) {
      const normalized = migrateLegacyCampaign(campaign);
      const items = await this.list();
      write([normalized, ...items.filter((item) => item.campaignId !== normalized.campaignId)]);
      return clone(normalized);
    },
    async remove(campaignId) {
      const items = await this.list();
      const next = items.filter((item) => item.campaignId !== campaignId);
      write(next);
      return next.length !== items.length;
    },
  });
}

export function createMemoryAsyncStore(initial = {}) {
  const values = new Map(Object.entries(initial).map(([key, value]) => [key, clone(value)]));
  return {
    async list(prefix = "") {
      return Array.from(values.keys()).filter((key) => key.startsWith(prefix)).sort();
    },
    async get(key) {
      return values.has(key) ? clone(values.get(key)) : null;
    },
    async set(key, value) {
      values.set(key, clone(value));
      return clone(value);
    },
    async remove(key) {
      return values.delete(key);
    },
  };
}

export function createStoreBackedCampaignRepository({ store, prefix = "campaign/" } = {}) {
  if (!store || ["list", "get", "set", "remove"].some((method) => typeof store[method] !== "function")) {
    throw new TypeError("Store-backed campaign repository requires list/get/set/remove methods.");
  }
  const keyFor = (campaignId) => `${prefix}${campaignId}`;
  return assertPort("campaignRepository", {
    async list() {
      const keys = await store.list(prefix);
      const values = await Promise.all(keys.map((key) => store.get(key)));
      return sortCampaigns(values.filter(Boolean).map(migrateLegacyCampaign));
    },
    async get(campaignId) {
      const value = await store.get(keyFor(campaignId));
      return value ? migrateLegacyCampaign(value) : null;
    },
    async upsert(campaign) {
      const normalized = migrateLegacyCampaign(campaign);
      await store.set(keyFor(normalized.campaignId), normalized);
      return clone(normalized);
    },
    async remove(campaignId) {
      return Boolean(await store.remove(keyFor(campaignId)));
    },
  });
}

export function createMemoryBlobStorage(initial = {}) {
  const blobs = new Map(Object.entries(initial).map(([key, value]) => [key, clone(value)]));
  return assertPort("blobStorage", {
    async put(blobId, value) {
      blobs.set(blobId, clone(value));
      return { blobId };
    },
    async get(blobId) {
      return blobs.has(blobId) ? clone(blobs.get(blobId)) : null;
    },
    async remove(blobId) {
      return blobs.delete(blobId);
    },
  });
}

export function createStoreBackedBlobStorage({ store, prefix = "blob/" } = {}) {
  if (!store || ["get", "set", "remove"].some((method) => typeof store[method] !== "function")) {
    throw new TypeError("Store-backed blob storage requires get/set/remove methods.");
  }
  const keyFor = (blobId) => `${prefix}${blobId}`;
  return assertPort("blobStorage", {
    async put(blobId, value) {
      await store.set(keyFor(blobId), value);
      return { blobId };
    },
    async get(blobId) {
      return store.get(keyFor(blobId));
    },
    async remove(blobId) {
      return Boolean(await store.remove(keyFor(blobId)));
    },
  });
}

export function createMemoryJobQueue(initial = []) {
  const jobs = new Map(initial.map((job) => [job.generationJobId, clone(job)]));
  return assertPort("jobQueue", {
    async enqueue(job) {
      const normalized = clone(job);
      jobs.set(normalized.generationJobId, normalized);
      return clone(normalized);
    },
    async get(generationJobId) {
      return jobs.has(generationJobId) ? clone(jobs.get(generationJobId)) : null;
    },
    async cancel(generationJobId) {
      const current = jobs.get(generationJobId);
      if (!current) return null;
      const cancelled = { ...current, status: "cancelled" };
      jobs.set(generationJobId, cancelled);
      return clone(cancelled);
    },
  });
}

export function createStoreBackedJobQueue({ store, prefix = "job/" } = {}) {
  if (!store || ["get", "set"].some((method) => typeof store[method] !== "function")) {
    throw new TypeError("Store-backed job queue requires get/set methods.");
  }
  const keyFor = (generationJobId) => `${prefix}${generationJobId}`;
  return assertPort("jobQueue", {
    async enqueue(job) {
      await store.set(keyFor(job.generationJobId), job);
      return clone(job);
    },
    async get(generationJobId) {
      return store.get(keyFor(generationJobId));
    },
    async cancel(generationJobId) {
      const current = await store.get(keyFor(generationJobId));
      if (!current) return null;
      const cancelled = { ...current, status: "cancelled" };
      await store.set(keyFor(generationJobId), cancelled);
      return clone(cancelled);
    },
  });
}
