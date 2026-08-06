import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  buildPublishConfirmation,
  connectionIdentity,
  isConfirmedPublishResponse,
  selectDirectPublishAvailability,
} from "../lib/studio/publishingPolicy.mjs";

const approved = {
  key: "approved",
  label: "Approved",
  isApproved: true,
};
const readyConnection = {
  connected: true,
  expired: false,
  manualOnly: false,
  profile: { name: "Ankit", username: "ankit" },
  readiness: { authorization: "ready" },
};

function availability(overrides = {}) {
  return selectDirectPublishAvailability({
    channelStatus: approved,
    hasContent: true,
    permissionValid: true,
    connection: readyConnection,
    ...overrides,
  });
}

test("direct publishing guard rejects every unsafe draft and connector state", () => {
  assert.equal(availability({ isStale: true }).code, "stale");
  assert.equal(availability({ hasContent: false }).code, "empty");
  assert.equal(availability({ channelStatus: { key: "failed", isApproved: false } }).code, "failed");
  assert.equal(availability({ channelStatus: { key: "needs_review", isApproved: false } }).code, "needs_review");
  assert.equal(availability({ channelStatus: { key: "edited", isApproved: false } }).code, "unapproved");
  assert.equal(availability({ isOverLimit: true }).code, "over_limit");
  assert.equal(availability({ permissionValid: false }).code, "permission_required");
  assert.equal(availability({ connection: { connected: false } }).code, "not_connected");
  assert.equal(availability({ connection: { ...readyConnection, expired: true } }).code, "expired");
  assert.equal(availability({ connection: { ...readyConnection, manualOnly: true } }).code, "manual_only");
  assert.equal(
    availability({
      connection: { ...readyConnection, readiness: { authorization: "pending" } },
    }).code,
    "connector_unverified",
  );
  assert.deepEqual(availability(), { ready: true, code: "ready", reason: "" });
});

test("connection identity and confirmation identify platform account and exact revision", () => {
  assert.equal(connectionIdentity(readyConnection, "LinkedIn"), "Ankit (@ankit)");
  assert.equal(connectionIdentity({ profile: { username: "builder" } }, "X"), "@builder");
  assert.equal(connectionIdentity({ profile: { id: "abc-123" } }, "Reddit"), "Reddit account abc-123");

  assert.deepEqual(buildPublishConfirmation({
    platformId: "linkedin",
    platformLabel: "LinkedIn",
    connection: readyConnection,
    revision: 7,
    channelStatus: approved,
  }), {
    platformId: "linkedin",
    platformLabel: "LinkedIn",
    accountLabel: "Ankit (@ankit)",
    draftRevision: 7,
    draftState: "Approved",
    title: "Publish to LinkedIn?",
    description: "This live action will publish approved draft revision 7 to Ankit (@ankit).",
  });
});

test("publishing success requires HTTP success, API confirmation, matching platform, and stable reference", () => {
  assert.equal(isConfirmedPublishResponse({
    responseOk: true,
    expectedPlatform: "linkedin",
    data: { ok: true, platform: "linkedin", postId: "urn:li:share:123" },
  }), true);
  assert.equal(isConfirmedPublishResponse({
    responseOk: true,
    expectedPlatform: "x",
    data: { ok: true, platform: "x", postUrl: "https://x.com/i/status/123" },
  }), true);

  const rejectedFixtures = [
    { responseOk: false, data: { ok: true, platform: "x", postId: "123" } },
    { responseOk: true, data: { ok: false, platform: "x", error: "Rejected" } },
    { responseOk: true, data: { ok: true, platform: "reddit", postId: "123" } },
    { responseOk: true, data: { ok: true, platform: "x" } },
  ];
  for (const fixture of rejectedFixtures) {
    assert.equal(isConfirmedPublishResponse({ ...fixture, expectedPlatform: "x" }), false);
  }
});

test("Review source keeps handoff primary and direct publication in a secondary accessible dialog", async () => {
  const root = path.resolve(new URL("..", import.meta.url).pathname);
  const page = await readFile(path.join(root, "app", "page.js"), "utf8");
  const css = await readFile(path.join(root, "app", "globals.css"), "utf8");

  assert.match(page, /Copy & open \{activeMeta\.label\}/);
  assert.match(page, /direct-publishing-panel/);
  assert.match(page, /Review live publication/);
  assert.match(page, /role="dialog"/);
  assert.match(page, /aria-modal="true"/);
  assert.match(page, /Draft revision/);
  assert.match(page, /Connected account/);
  assert.doesNotMatch(page, /Publish this approved draft to/);
  assert.match(css, /\.direct-publishing-panel/);
  assert.match(css, /\.publish-confirmation-backdrop/);
});
