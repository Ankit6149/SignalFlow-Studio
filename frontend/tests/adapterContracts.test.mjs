import test from "node:test";
import assert from "node:assert/strict";

import { createDomainRecord } from "../lib/domain/contracts.mjs";
import { createCampaignAggregate } from "../lib/domain/campaign.mjs";
import {
  createBrowserCampaignRepository,
  createMemoryAsyncStore,
  createMemoryBlobStorage,
  createMemoryCampaignRepository,
  createMemoryJobQueue,
  createStoreBackedBlobStorage,
  createStoreBackedCampaignRepository,
  createStoreBackedJobQueue,
} from "../lib/infrastructure/adapters.mjs";
import { campaignInput } from "./campaignFixtures.mjs";

function fakeStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
}

async function campaignRepositoryContract(repository) {
  const campaign = createCampaignAggregate(campaignInput());
  assert.deepEqual(await repository.list(), []);
  const saved = await repository.upsert(campaign);
  assert.equal(saved.campaignId, campaign.campaignId);
  assert.equal((await repository.get(campaign.campaignId)).title, campaign.title);
  assert.equal((await repository.list()).length, 1);
  const changed = { ...campaign, title: "Updated campaign", updatedAt: "2026-07-30T01:00:00.000Z" };
  await repository.upsert(changed);
  assert.equal((await repository.list())[0].title, "Updated campaign");
  assert.equal(await repository.remove(campaign.campaignId), true);
  assert.equal(await repository.get(campaign.campaignId), null);
}

test("memory, browser-local, and store-backed campaign repositories share one contract", async () => {
  await campaignRepositoryContract(createMemoryCampaignRepository());
  await campaignRepositoryContract(createBrowserCampaignRepository({ getStorage: () => fakeStorage(), key: "campaigns" }));
  await campaignRepositoryContract(createStoreBackedCampaignRepository({ store: createMemoryAsyncStore() }));
});

test("browser repository migrates legacy library entries to canonical campaign records", async () => {
  const legacy = {
    id: "legacy-1",
    title: "Legacy campaign",
    channels: ["linkedin"],
    posts: { linkedin: "Edited legacy draft" },
    result: {
      providerUsed: "gemini",
      posts: { linkedin: "Original legacy draft" },
      generation_status: { linkedin: { status: "generated" } },
      package: { project: { name: "Legacy campaign" }, posts: { linkedin: { body: "Original legacy duplicate" } } },
    },
    generationRun: campaignInput().generationRun,
    brief: campaignInput().brief,
    createdAt: "2026-07-29T00:00:00.000Z",
    updatedAt: "2026-07-29T00:00:00.000Z",
  };
  const storage = fakeStorage({ campaigns: JSON.stringify([legacy]) });
  const repository = createBrowserCampaignRepository({ getStorage: () => storage, key: "campaigns" });
  const [campaign] = await repository.list();
  assert.equal(campaign.kind, "Campaign");
  assert.equal(campaign.drafts.linkedin.current.content, "Edited legacy draft");
  assert.equal(campaign.drafts.linkedin.history[0].content, "Original legacy draft");
  assert.match(storage.getItem("campaigns"), /"kind":"Campaign"/);
});

async function blobStorageContract(storage) {
  await storage.put("blob-1", { contentType: "text/plain", text: "hello" });
  assert.deepEqual(await storage.get("blob-1"), { contentType: "text/plain", text: "hello" });
  assert.equal(await storage.remove("blob-1"), true);
  assert.equal(await storage.get("blob-1"), null);
}

test("memory and store-backed blob storage share one contract", async () => {
  await blobStorageContract(createMemoryBlobStorage());
  await blobStorageContract(createStoreBackedBlobStorage({ store: createMemoryAsyncStore() }));
});

async function jobQueueContract(queue) {
  const job = createDomainRecord("GenerationJob", {
    generationJobId: "job-1",
    status: "queued",
    campaignId: "campaign-1",
  });
  await queue.enqueue(job);
  assert.equal((await queue.get("job-1")).status, "queued");
  assert.equal((await queue.cancel("job-1")).status, "cancelled");
  assert.equal((await queue.get("job-1")).status, "cancelled");
}

test("memory and store-backed job queues share one contract", async () => {
  await jobQueueContract(createMemoryJobQueue());
  await jobQueueContract(createStoreBackedJobQueue({ store: createMemoryAsyncStore() }));
});
