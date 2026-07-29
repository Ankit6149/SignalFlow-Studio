import test from "node:test";
import assert from "node:assert/strict";

import {
  campaignReducer,
  createInitialCampaignState,
} from "../lib/studio/campaignState.mjs";

test("campaign reducer accepts a generation as one complete state transition", () => {
  const before = {
    ...createInitialCampaignState(),
    stage: "review",
    posts: { linkedin: "Existing manual edit" },
    activeChannel: "linkedin",
  };
  const payload = {
    result: { ok: true, providerUsed: "gemini" },
    generationRun: { generationRunId: "run-2" },
    posts: { x: "New X draft" },
    activeChannel: "x",
  };
  const after = campaignReducer(before, { type: "ACCEPT_GENERATION", payload });

  assert.deepEqual(after, {
    ...before,
    stage: "review",
    result: payload.result,
    generationRun: payload.generationRun,
    posts: payload.posts,
    activeChannel: "x",
  });
  assert.deepEqual(before.posts, { linkedin: "Existing manual edit" });
});

test("campaign reducer restores persisted output atomically", () => {
  const restored = campaignReducer(createInitialCampaignState(), {
    type: "RESTORE_CAMPAIGN",
    payload: {
      result: { markdown: "# Campaign" },
      generationRun: { generationRunId: "saved-run" },
      posts: { blog: "Saved blog" },
      activeChannel: "blog",
    },
  });

  assert.equal(restored.stage, "review");
  assert.equal(restored.activeChannel, "blog");
  assert.equal(restored.posts.blog, "Saved blog");
  assert.equal(restored.generationRun.generationRunId, "saved-run");
});

test("editing one channel preserves every other authoritative draft", () => {
  const state = {
    ...createInitialCampaignState(),
    posts: { linkedin: "LinkedIn", x: "X" },
  };
  const next = campaignReducer(state, {
    type: "EDIT_POST",
    channel: "x",
    text: "Edited X",
  });

  assert.deepEqual(next.posts, { linkedin: "LinkedIn", x: "Edited X" });
  assert.deepEqual(state.posts, { linkedin: "LinkedIn", x: "X" });
});

test("unknown actions preserve object identity", () => {
  const state = createInitialCampaignState();
  assert.equal(campaignReducer(state, { type: "UNKNOWN" }), state);
});
