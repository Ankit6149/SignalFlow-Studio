import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";

import { createCampaignApplication } from "../lib/application/campaignApplication.mjs";
import {
  campaignFromPackagePayload,
  campaignToEditorState,
  createCampaignAggregate,
  migrateLegacyCampaign,
} from "../lib/domain/campaign.mjs";
import { createMemoryCampaignRepository } from "../lib/infrastructure/adapters.mjs";
import { projectCampaignJson, projectCampaignMarkdown } from "../lib/export/campaignExport.mjs";
import { buildCampaignZipExport } from "../lib/export/campaignZip.mjs";
import { campaignInput } from "./campaignFixtures.mjs";

const fixedClock = { now: () => "2026-07-30T00:00:00.000Z" };

test("canonical campaign keeps edited drafts authoritative and generated text only in history", () => {
  const campaign = createCampaignAggregate(campaignInput());
  assert.equal(campaign.drafts.linkedin.current.content, "Edited LinkedIn draft — authoritative.");
  assert.equal(campaign.drafts.linkedin.history[0].content, "Original generated LinkedIn text.");
  assert.equal(campaign.generationResult.posts, undefined);
  assert.equal(campaign.generationResult.package.posts, undefined);
  assert.equal(campaign.brief.apiKey, undefined);
  assert.doesNotMatch(JSON.stringify(campaign), /must-not-persist/);
});

test("Markdown exports each edited draft exactly once and omits original generated drafts", () => {
  const campaign = createCampaignAggregate(campaignInput());
  const first = projectCampaignMarkdown(campaign);
  const second = projectCampaignMarkdown(campaign);
  assert.equal(first.content, second.content);

  for (const content of Object.values(campaignInput().posts)) {
    assert.equal(first.content.split(content).length - 1, 1);
  }
  for (const original of Object.values(campaignInput().result.posts)) {
    assert.doesNotMatch(first.content, new RegExp(original.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("JSON export is versioned, deterministic, and separates current drafts from optional history", () => {
  const campaign = createCampaignAggregate(campaignInput());
  const first = projectCampaignJson(campaign);
  const second = projectCampaignJson(campaign);
  assert.equal(first.content, second.content);

  const parsed = JSON.parse(first.content);
  assert.equal(parsed.schemaVersion, 1);
  assert.equal(parsed.kind, "CampaignExport");
  assert.equal(parsed.campaign.currentDrafts.linkedin.content, campaignInput().posts.linkedin);
  assert.equal(parsed.campaign.history.linkedin[0].content, campaignInput().result.posts.linkedin);
  assert.equal(parsed.campaign.package.posts, undefined);
  assert.equal(parsed.metadata.generationRunId, "run-fixture-1");
  assert.equal(parsed.metadata.sourceSnapshotId, "source-fixture-1");
  assert.equal(parsed.metadata.provider, "gemini");
  assert.equal(parsed.metadata.snapshotAt, "2026-07-30T00:00:00.000Z");
  assert.equal(parsed.metadata.qualityStates.x, "needs_review");
});

test("ZIP contains the same authoritative Markdown, JSON, and per-channel drafts", async () => {
  const input = campaignInput();
  const campaign = createCampaignAggregate(input);
  const projection = await buildCampaignZipExport(campaign);
  const zip = await JSZip.loadAsync(projection.content);
  const markdown = await zip.file("campaign.md").async("string");
  const json = JSON.parse(await zip.file("campaign.json").async("string"));
  assert.equal(json.campaign.currentDrafts.linkedin.content, input.posts.linkedin);
  assert.equal(await zip.file("drafts/linkedin.txt").async("string"), input.posts.linkedin);
  assert.match(markdown, new RegExp(input.posts.linkedin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(markdown, /Original generated LinkedIn text/);
});

test("package compatibility canonicalizes releaseNotes into release_notes", () => {
  const campaign = campaignFromPackagePayload({
    package: {
      project: { name: "Release" },
      posts: {
        releaseNotes: {
          title: "Version 1",
          sections: [{ title: "Changes", items: ["Authoritative export"] }],
        },
      },
    },
    metadata: {
      providerUsed: "gemini",
      createdAt: "2026-07-30T00:00:00.000Z",
    },
  });
  assert.deepEqual(campaign.channels, ["release_notes"]);
  assert.match(campaign.drafts.release_notes.current.content, /Authoritative export/);
});

test("save, reopen, and re-export preserve the authoritative current drafts", async () => {
  const application = createCampaignApplication({
    campaignRepository: createMemoryCampaignRepository(),
    clock: fixedClock,
  });
  const saved = await application.saveCampaign(campaignInput());
  const [listed] = await application.listCampaigns();
  assert.deepEqual(listed, saved);

  const restored = application.openCampaign(listed);
  assert.deepEqual(restored.posts, campaignInput().posts);
  const reexported = application.projectJson({
    ...campaignInput(),
    campaignId: listed.campaignId,
    posts: restored.posts,
    result: restored.result,
    generationRun: restored.generationRun,
  });
  assert.equal(JSON.parse(reexported.content).campaign.currentDrafts.linkedin.content, campaignInput().posts.linkedin);
});

test("legacy saved campaigns migrate with edited posts as current and original posts as history", () => {
  const legacy = {
    id: "legacy-campaign",
    title: "Legacy",
    channels: ["linkedin"],
    posts: { linkedin: "Edited legacy content" },
    result: {
      providerUsed: "openai",
      posts: { linkedin: "Original legacy content" },
      generation_status: { linkedin: { status: "generated" } },
      package: { project: { name: "Legacy" }, posts: { linkedin: { body: "Original duplicate" } } },
    },
    generationRun: campaignInput().generationRun,
    brief: campaignInput().brief,
    createdAt: "2026-07-29T00:00:00.000Z",
    updatedAt: "2026-07-29T00:00:00.000Z",
  };
  const campaign = migrateLegacyCampaign(legacy);
  const restored = campaignToEditorState(campaign);
  assert.equal(restored.posts.linkedin, "Edited legacy content");
  assert.equal(campaign.drafts.linkedin.history[0].content, "Original legacy content");
});
