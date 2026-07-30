import test from "node:test";
import assert from "node:assert/strict";

import { createCampaignApplication } from "../lib/application/campaignApplication.mjs";
import { createBrowserCampaignApplication } from "../lib/application/browserCampaignApplication.mjs";
import { createMemoryCampaignRepository } from "../lib/infrastructure/adapters.mjs";
import { createDeterministicIdService } from "../lib/domain/ports.mjs";
import { campaignInput } from "./campaignFixtures.mjs";

function clock(values = ["2026-07-30T10:00:00.000Z"]) {
  let index = 0;
  return {
    now() {
      const value = values[Math.min(index, values.length - 1)];
      index += 1;
      return value;
    },
  };
}

function application(repository = createMemoryCampaignRepository()) {
  return createCampaignApplication({
    campaignRepository: repository,
    clock: clock([
      "2026-07-30T10:00:00.000Z",
      "2026-07-30T10:01:00.000Z",
      "2026-07-30T10:02:00.000Z",
      "2026-07-30T10:03:00.000Z",
    ]),
    idService: createDeterministicIdService("test"),
  });
}

test("duplicate-title campaigns remain independent across create, update, copy, read, list, and delete", async () => {
  const app = application();
  const first = await app.createCampaign(campaignInput({ title: "Public beta", campaignId: undefined }));
  const second = await app.createCampaign(campaignInput({ title: "Public beta", campaignId: undefined, posts: { linkedin: "Second campaign" }, channels: ["linkedin"] }));

  assert.notEqual(first.campaignId, second.campaignId);
  assert.equal((await app.listCampaigns()).length, 2);

  const updated = await app.updateCampaign(campaignInput({
    campaignId: first.campaignId,
    title: "Public beta",
    posts: { linkedin: "Updated first campaign" },
    channels: ["linkedin"],
  }));
  assert.equal(updated.campaignId, first.campaignId);
  assert.equal((await app.getCampaign(second.campaignId)).drafts.linkedin.current.content, "Second campaign");

  const copy = await app.saveAsCopy({
    ...app.openCampaign(updated),
    title: "Public beta",
  });
  assert.notEqual(copy.campaignId, first.campaignId);
  assert.equal((await app.listCampaigns()).length, 3);
  assert.equal((await app.getCampaign(first.campaignId)).drafts.linkedin.current.content, "Updated first campaign");

  assert.equal(await app.deleteCampaign(second.campaignId), true);
  assert.equal(await app.getCampaign(second.campaignId), null);
  assert.equal((await app.listCampaigns()).length, 2);
});

test("save and reopen preserve drafts, statuses, archives, source state, and publishing options", async () => {
  const app = application();
  const input = campaignInput({
    generatedPosts: {
      linkedin: "Generated LinkedIn",
      x: "Generated X",
      blog: "Generated blog",
    },
    channelStates: {
      linkedin: { status: "generated", edited: true, approved: true, generationRunId: "run-fixture-1" },
      x: { status: "needs_review", edited: true, approved: false, generationRunId: "run-fixture-1" },
      blog: { status: "regenerated", edited: true, approved: false, generationRunId: "run-fixture-1" },
    },
    archives: [{
      archiveId: "archive-1",
      createdAt: "2026-07-30T09:00:00.000Z",
      reason: "archive_all",
      posts: { linkedin: "Archived LinkedIn" },
      generatedPosts: { linkedin: "Archived generated LinkedIn" },
      channelStates: { linkedin: { status: "generated", edited: true, approved: false } },
      result: { providerUsed: "gemini", generation_status: { linkedin: { status: "generated" } } },
      generationRun: { generationRunId: "run-archive" },
      activeChannel: "linkedin",
      revision: 3,
    }],
    editorState: {
      revision: 8,
      savedRevision: 8,
      exportedRevision: 7,
      lastSavedAt: "2026-07-30T09:30:00.000Z",
      lastExportedAt: "2026-07-30T09:20:00.000Z",
      savedSourceFingerprint: "sf1-fixture",
    },
  });

  const saved = await app.createCampaign(input);
  const reopened = app.openCampaign(await app.getCampaign(saved.campaignId));

  assert.equal(reopened.posts.linkedin, input.posts.linkedin);
  assert.equal(reopened.generatedPosts.linkedin, "Generated LinkedIn");
  assert.equal(reopened.channelStates.linkedin.approved, true);
  assert.equal(reopened.channelStates.x.status, "needs_review");
  assert.equal(reopened.archives[0].archiveId, "archive-1");
  assert.equal(reopened.revision, 8);
  assert.equal(reopened.savedRevision, 8);
  assert.equal(reopened.lastExportedAt, "2026-07-30T09:20:00.000Z");
  assert.deepEqual(reopened.publishOptions, input.publishOptions);
  assert.deepEqual(reopened.sourceFiles, input.sourceFiles);
  assert.deepEqual(reopened.documentText, input.documentText);
  assert.doesNotMatch(JSON.stringify(await app.getCampaign(saved.campaignId)), /must-not-persist/);
});

test("legacy records retain their stable ID and migrate without losing current drafts", async () => {
  const repository = createMemoryCampaignRepository([{
    id: "legacy-campaign-1",
    title: "Same title",
    channels: ["linkedin"],
    posts: { linkedin: "Legacy edited draft" },
    result: {
      providerUsed: "gemini",
      posts: { linkedin: "Legacy generated draft" },
      generation_status: { linkedin: { status: "generated" } },
      package: { project: { name: "Same title" } },
    },
    generationRun: campaignInput().generationRun,
    brief: campaignInput().brief,
    publishOptions: campaignInput().publishOptions,
    createdAt: "2026-07-29T00:00:00.000Z",
    updatedAt: "2026-07-29T00:00:00.000Z",
  }]);
  const app = application(repository);
  const [migrated] = await app.listCampaigns();
  assert.equal(migrated.campaignId, "legacy-campaign-1");
  assert.equal(migrated.drafts.linkedin.current.content, "Legacy edited draft");
  assert.equal(app.openCampaign(migrated).generatedPosts.linkedin, "Legacy generated draft");
});

test("browser quota errors propagate so the UI can offer export recovery", async () => {
  const storage = {
    getItem() { return null; },
    setItem() {
      const error = new Error("Quota exceeded");
      error.name = "QuotaExceededError";
      throw error;
    },
  };
  const app = createBrowserCampaignApplication({
    getStorage: () => storage,
    key: "campaigns",
    clock: clock(),
    idService: createDeterministicIdService("quota"),
  });
  await assert.rejects(() => app.createCampaign(campaignInput()), /Quota exceeded/);
});
