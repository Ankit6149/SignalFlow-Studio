import test from "node:test";
import assert from "node:assert/strict";

import {
  campaignReducer,
  createInitialCampaignState,
} from "../lib/studio/campaignState.mjs";
import {
  selectCampaignStatus,
  selectChannelStatus,
  selectPublishAvailability,
} from "../lib/studio/campaignStatus.mjs";
import { acceptGenerationResponse } from "../lib/studio/generationAcceptance.mjs";

const channels = ["linkedin", "x", "instagram"];

function response(posts, status = "generated", run = "run-1") {
  return {
    ok: true,
    providerUsed: "gemini",
    generationRunId: run,
    package: { project: { name: "Campaign" } },
    channels: Object.keys(posts),
    posts,
    generation_status: Object.fromEntries(Object.keys(posts).map((channel) => [channel, { status }])),
  };
}

function generatedState() {
  const result = response({ linkedin: "LinkedIn v1", x: "X v1", instagram: "Instagram v1" });
  return campaignReducer(createInitialCampaignState(), {
    type: "ACCEPT_GENERATION",
    payload: {
      result,
      generationRun: { generationRunId: "run-1", sourceFingerprint: "source-1" },
      posts: result.posts,
      requestedChannels: channels,
      activeChannel: "linkedin",
    },
  });
}

function edit(state, channel, content) {
  return campaignReducer(state, { type: "EDIT_POST", channel, text: content });
}

test("regenerating one destination changes only that destination and archives the prior version", () => {
  let state = generatedState();
  state = edit(state, "linkedin", "LinkedIn manual");
  state = edit(state, "x", "X manual");
  state = edit(state, "instagram", "Instagram manual");
  const before = structuredClone(state);
  const next = response({ x: "X v2" }, "regenerated", "run-2");

  state = campaignReducer(state, {
    type: "APPLY_REGENERATION",
    payload: {
      result: next,
      generationRun: { generationRunId: "run-2", sourceFingerprint: "source-1" },
      posts: next.posts,
      targetChannels: ["x"],
      policy: "channel",
      archiveId: "archive-1",
      archivedAt: "2026-07-30T10:00:00.000Z",
      activeChannel: "x",
    },
  });

  assert.equal(state.posts.x, "X v2");
  assert.equal(state.posts.linkedin, before.posts.linkedin);
  assert.equal(state.posts.instagram, before.posts.instagram);
  assert.equal(state.archives.length, 1);
  assert.deepEqual(state.archives[0].posts, before.posts);
});

test("regenerate-unedited leaves every edited destination byte-for-byte unchanged", () => {
  let state = generatedState();
  state = edit(state, "linkedin", "LinkedIn manual\nwith exact spacing");
  const editedBefore = state.posts.linkedin;
  const next = response({ x: "X v2", instagram: "Instagram v2" }, "regenerated", "run-2");

  state = campaignReducer(state, {
    type: "APPLY_REGENERATION",
    payload: {
      result: next,
      generationRun: { generationRunId: "run-2", sourceFingerprint: "source-1" },
      posts: next.posts,
      targetChannels: ["x", "instagram"],
      policy: "unedited",
      archiveId: "archive-2",
      archivedAt: "2026-07-30T10:00:00.000Z",
    },
  });

  assert.equal(state.posts.linkedin, editedBefore);
  assert.equal(state.channelStates.linkedin.edited, true);
  assert.equal(state.posts.x, "X v2");
  assert.equal(state.posts.instagram, "Instagram v2");
});

test("archive-and-regenerate is recoverable and cancellation is a true no-op", () => {
  let state = edit(generatedState(), "linkedin", "Protected manual edit");
  const cancelled = structuredClone(state);
  assert.deepEqual(state, cancelled, "closing the policy dialog dispatches no reducer action");

  const next = response({ linkedin: "LinkedIn v2", x: "X v2", instagram: "Instagram v2" }, "regenerated", "run-2");
  state = campaignReducer(state, {
    type: "APPLY_REGENERATION",
    payload: {
      result: next,
      generationRun: { generationRunId: "run-2", sourceFingerprint: "source-1" },
      posts: next.posts,
      targetChannels: channels,
      policy: "archive_all",
      archiveId: "archive-before-regeneration",
      archivedAt: "2026-07-30T10:00:00.000Z",
    },
  });
  assert.equal(state.posts.linkedin, "LinkedIn v2");

  state = campaignReducer(state, {
    type: "RESTORE_ARCHIVE",
    payload: {
      archiveId: "archive-before-regeneration",
      currentArchiveId: "archive-before-restore",
      restoredAt: "2026-07-30T10:10:00.000Z",
    },
  });
  assert.equal(state.posts.linkedin, "Protected manual edit");
  assert.equal(state.channelStates.linkedin.edited, true);
});

test("restore generated copy clears edited state without touching other channels", () => {
  let state = generatedState();
  state = edit(state, "linkedin", "Manual edit");
  state = edit(state, "x", "Other manual edit");
  state = campaignReducer(state, { type: "RESTORE_GENERATED", channel: "linkedin" });
  assert.equal(state.posts.linkedin, "LinkedIn v1");
  assert.equal(state.channelStates.linkedin.edited, false);
  assert.equal(state.posts.x, "Other manual edit");
});

test("all-failed regeneration is rejected before reducer mutation", () => {
  const state = edit(generatedState(), "linkedin", "Protected edit");
  const before = structuredClone(state);
  const failed = {
    ok: true,
    providerUsed: "gemini",
    package: { project: { name: "Campaign" } },
    channels: ["linkedin"],
    posts: {},
    generation_status: { linkedin: { status: "failed" } },
  };
  assert.throws(
    () => acceptGenerationResponse({ response: failed, requestedChannels: ["linkedin"] }),
    /did not return any usable destination draft/i,
  );
  assert.deepEqual(state, before);
});

test("saved, exported, stale, edited, approved, failed, and needs-review states are derived consistently", () => {
  let state = generatedState();
  state = campaignReducer(state, {
    type: "MARK_SAVED",
    payload: { savedAt: "2026-07-30T10:00:00.000Z", sourceFingerprint: "source-1" },
  });
  let campaign = selectCampaignStatus({
    state,
    currentSourceFingerprint: "source-1",
    hasCampaignId: true,
  });
  assert.equal(campaign.campaignKey, "saved");

  state = edit(state, "linkedin", "Edited current draft");
  campaign = selectCampaignStatus({ state, currentSourceFingerprint: "source-1", hasCampaignId: true });
  assert.equal(campaign.campaignKey, "unsaved");
  assert.equal(selectChannelStatus({ channelState: state.channelStates.linkedin, content: state.posts.linkedin }).key, "edited");

  state = campaignReducer(state, { type: "MARK_CHANNEL_APPROVED", channel: "linkedin" });
  assert.equal(selectChannelStatus({ channelState: state.channelStates.linkedin, content: state.posts.linkedin }).key, "approved");

  state = campaignReducer(state, {
    type: "MARK_EXPORTED",
    payload: { exportedAt: "2026-07-30T10:05:00.000Z" },
  });
  campaign = selectCampaignStatus({ state, currentSourceFingerprint: "source-1", hasCampaignId: true });
  assert.equal(campaign.isExportedCurrent, true);
  assert.equal(selectChannelStatus({ channelState: { status: "failed" }, content: "" }).key, "failed");
  assert.equal(selectChannelStatus({ channelState: { status: "needs_review" }, content: "Draft" }).key, "needs_review");
  assert.equal(selectChannelStatus({ channelState: state.channelStates.linkedin, isStale: true, content: state.posts.linkedin }).key, "stale");
});

test("publishing requires a current approved draft", () => {
  assert.match(selectPublishAvailability({ hasContent: true, channelStatus: { key: "edited", isApproved: false }, manualRoute: true }).reason, /approved/i);
  assert.equal(selectPublishAvailability({ hasContent: true, channelStatus: { key: "approved", isApproved: true }, manualRoute: true }).ready, true);
  assert.match(selectPublishAvailability({ hasContent: true, channelStatus: { key: "approved", isApproved: true }, isStale: true, manualRoute: true }).reason, /regenerate/i);
});
