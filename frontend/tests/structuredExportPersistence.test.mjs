import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";

import { createCampaignApplication } from "../lib/application/campaignApplication.mjs";
import {
  campaignToEditorState,
  createCampaignAggregate,
  migrateLegacyCampaign,
} from "../lib/domain/campaign.mjs";
import { createMemoryCampaignRepository } from "../lib/infrastructure/adapters.mjs";
import { projectCampaignJson } from "../lib/export/campaignExport.mjs";

const createdAt = "2026-08-04T14:00:00.000Z";

function structuredInput(overrides = {}) {
  return {
    title: "Structured persistence",
    channels: ["x", "youtube", "tiktok"],
    posts: {
      x: "Edited first post.\n\nEdited second post.",
      youtube: "Walkthrough title\n\nCurrent description.",
    },
    generatedPosts: {
      x: "Generated first post.\n\nGenerated second post.",
      youtube: "Walkthrough title\n\nGenerated description.",
    },
    channelStates: {
      x: { status: "needs_review", edited: true, approved: false, generationRunId: "run-structured-1" },
      youtube: { status: "generated", edited: true, approved: true, generationRunId: "run-structured-1" },
    },
    result: {
      ok: true,
      providerUsed: "gemini",
      modelUsed: "gemini-test",
      generation_status: {
        x: { status: "needs_review", qualityScore: 78 },
        youtube: { status: "generated", qualityScore: 94 },
        tiktok: { status: "failed", issues: ["Provider returned no TikTok package."] },
      },
      package: {
        project: { name: "Structured persistence" },
        posts: {
          x: { mode: "thread", posts: ["Generated first post.", "Generated second post."] },
          youtube: {
            title: "Walkthrough title",
            description: "Generated description.",
            tags: ["signalflow"],
            segments: ["Problem", "Workflow", "Review"],
          },
        },
      },
    },
    generationRun: {
      generationRunId: "run-structured-1",
      sourceSnapshotId: "source-structured-1",
      sourceFingerprint: "sf1-structured",
      provider: "gemini",
      model: "gemini-test",
      createdAt,
      sourceSnapshot: {
        sourceSnapshotId: "source-structured-1",
        fingerprint: "sf1-structured",
        normalizedSource: {},
        createdAt,
      },
    },
    editorState: {
      revision: 3,
      savedRevision: 3,
      exportedRevision: null,
      lastSavedAt: createdAt,
      lastExportedAt: null,
      savedSourceFingerprint: "sf1-structured",
    },
    brief: { projectName: "Structured persistence", provider: "gemini" },
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

test("canonical campaigns preserve structured generation fields once", () => {
  const campaign = createCampaignAggregate(structuredInput());
  assert.equal(campaign.generationResult.package.posts, undefined);
  assert.deepEqual(campaign.generationResult.structuredPosts.x.posts, [
    "Generated first post.",
    "Generated second post.",
  ]);
  assert.deepEqual(campaign.generationResult.structuredPosts.youtube.tags, ["signalflow"]);
  assert.equal(campaign.generationResult.generation_status.tiktok.status, "failed");
});

test("canonical migration and editor reopen retain failed and structured destination state", () => {
  const migrated = migrateLegacyCampaign(createCampaignAggregate(structuredInput()));
  const editor = campaignToEditorState(migrated);

  assert.equal(editor.result.generation_status.tiktok.status, "failed");
  assert.deepEqual(editor.result.package.posts.x.posts, ["Generated first post.", "Generated second post."]);
  assert.deepEqual(editor.result.package.posts.youtube.segments, ["Problem", "Workflow", "Review"]);
  assert.equal(editor.posts.x, "Edited first post.\n\nEdited second post.");
});

test("versioned JSON includes current authoritative text and labelled structured snapshot", () => {
  const projection = JSON.parse(projectCampaignJson(createCampaignAggregate(structuredInput())).content);
  const x = projection.campaign.currentDrafts.x;

  assert.equal(x.content, "Edited first post.\n\nEdited second post.");
  assert.equal(x.structuredDraftOrigin, "generation_snapshot");
  assert.deepEqual(x.structuredDraft.posts, ["Generated first post.", "Generated second post."]);
});

test("save reopen and ZIP export retain destination structure and failed status", async () => {
  const application = createCampaignApplication({
    campaignRepository: createMemoryCampaignRepository(),
    clock: { now: () => createdAt },
    idService: { create: (kind) => `${kind}-structured-test` },
  });
  const saved = await application.saveCampaign(structuredInput());
  const reopened = application.openCampaign(saved);
  const zipProjection = await application.projectZip({
    ...structuredInput(),
    campaignId: saved.campaignId,
    channels: reopened.channels,
    posts: reopened.posts,
    generatedPosts: reopened.generatedPosts,
    channelStates: reopened.channelStates,
    result: reopened.result,
    generationRun: reopened.generationRun,
  });
  const zip = await JSZip.loadAsync(zipProjection.content);
  const x = JSON.parse(await zip.file("structured/x.json").async("string"));
  const tiktok = JSON.parse(await zip.file("structured/tiktok.json").async("string"));

  assert.equal(x.current.content, "Edited first post.\n\nEdited second post.");
  assert.deepEqual(x.structuredDraft.posts, ["Generated first post.", "Generated second post."]);
  assert.equal(tiktok.status, "failed");
  assert.match(tiktok.issues[0], /no TikTok package/i);
});
