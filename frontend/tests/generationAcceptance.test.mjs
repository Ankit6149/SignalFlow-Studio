import test from "node:test";
import assert from "node:assert/strict";

import {
  acceptGenerationResponse,
  GenerationResponseError,
} from "../lib/studio/generationAcceptance.mjs";
import {
  campaignReducer,
  createInitialCampaignState,
} from "../lib/studio/campaignState.mjs";

function validResponse(overrides = {}) {
  return {
    ok: true,
    providerUsed: "gemini",
    fallbackUsed: false,
    channels: ["linkedin", "x"],
    package: {
      project: { name: "SignalFlow" },
      generation: { mode: "staged_agent" },
    },
    generation_status: {
      linkedin: { status: "generated" },
      x: { status: "needs_review" },
    },
    posts: {
      linkedin: "A professional LinkedIn draft.",
      x: "A concise X draft.",
    },
    ...overrides,
  };
}

function editedCampaignState() {
  return {
    ...createInitialCampaignState(),
    stage: "review",
    result: validResponse({ providerUsed: "openai" }),
    generationRun: {
      generationRunId: "generation-existing",
      sourceFingerprint: "source-existing",
    },
    posts: {
      linkedin: "Manually edited LinkedIn draft that must survive.",
      x: "Manually edited X draft that must survive.",
    },
    activeChannel: "x",
  };
}

function assertRejectedWithoutMutation(response, requestedChannels = ["linkedin", "x"]) {
  const before = editedCampaignState();
  const snapshot = structuredClone(before);
  assert.throws(
    () => acceptGenerationResponse({ response, requestedChannels }),
    GenerationResponseError,
  );
  assert.deepEqual(before, snapshot);
}

test("valid generation response is normalized before one atomic reducer commit", () => {
  const accepted = acceptGenerationResponse({
    response: validResponse(),
    requestedChannels: ["linkedin", "x"],
  });
  const before = editedCampaignState();
  const next = campaignReducer(before, {
    type: "ACCEPT_GENERATION",
    payload: {
      result: accepted.result,
      posts: accepted.posts,
      activeChannel: accepted.activeChannel,
      generationRun: { generationRunId: "generation-next" },
    },
  });

  assert.equal(next.stage, "review");
  assert.equal(next.activeChannel, "linkedin");
  assert.equal(next.generationRun.generationRunId, "generation-next");
  assert.deepEqual(next.posts, validResponse().posts);
  assert.equal(before.posts.linkedin, "Manually edited LinkedIn draft that must survive.");
});

test("fallback responses are rejected before any campaign mutation", () => {
  assertRejectedWithoutMutation(validResponse({ fallbackUsed: true }));
  assertRejectedWithoutMutation(validResponse({
    package: {
      project: { name: "SignalFlow" },
      generation: { mode: "template_fallback" },
    },
  }));
});

test("malformed response shapes are rejected without losing previous work", () => {
  assertRejectedWithoutMutation(null);
  assertRejectedWithoutMutation(validResponse({ posts: null }));
  assertRejectedWithoutMutation(validResponse({ generation_status: null }));
  assertRejectedWithoutMutation(validResponse({ package: null }));
});

test("incompatible generation statuses are rejected", () => {
  assertRejectedWithoutMutation(validResponse({
    generation_status: {
      linkedin: { status: "template_fallback" },
      x: { status: "generated" },
    },
  }));
});

test("non-failed channels require non-empty string drafts", () => {
  assertRejectedWithoutMutation(validResponse({
    posts: { linkedin: "", x: "A valid X draft" },
  }));
  assertRejectedWithoutMutation(validResponse({
    posts: { linkedin: { body: "not flattened" }, x: "A valid X draft" },
  }));
});

test("partial destination failures are accepted without inserting substitute drafts", () => {
  const accepted = acceptGenerationResponse({
    response: validResponse({
      generation_status: {
        linkedin: { status: "generated" },
        x: { status: "failed" },
      },
      posts: {
        linkedin: "A real LinkedIn draft.",
        x: "",
      },
    }),
    requestedChannels: ["linkedin", "x"],
  });

  assert.deepEqual(accepted.acceptedChannels, ["linkedin"]);
  assert.deepEqual(accepted.failedChannels, ["x"]);
  assert.deepEqual(accepted.posts, { linkedin: "A real LinkedIn draft." });
});

test("responses missing requested destinations are rejected", () => {
  assertRejectedWithoutMutation(validResponse({ channels: ["linkedin"] }));
});

test("responses with no accepted destination draft are rejected", () => {
  assertRejectedWithoutMutation(validResponse({
    generation_status: {
      linkedin: { status: "failed" },
      x: { status: "failed" },
    },
    posts: {},
  }));
});
