import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  CHANNEL_GROUPS,
  CHANNELS,
  CORE_CHANNELS,
  DEFAULT_CHANNELS,
  OFFICIAL_CONNECTORS,
  PROVIDERS,
  channelMeta,
} from "../lib/studio/studioCatalog.mjs";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(testDir, "..");

test("Studio catalog preserves the canonical destination inventory", () => {
  const ids = CHANNELS.map((channel) => channel.id);
  assert.equal(ids.length, 12);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(ids, [
    "linkedin",
    "x",
    "instagram",
    "reddit",
    "facebook",
    "threads",
    "youtube",
    "tiktok",
    "hackernews",
    "newsletter",
    "blog",
    "release_notes",
  ]);

  assert.deepEqual([...OFFICIAL_CONNECTORS], ["linkedin", "x", "reddit"]);
  assert.deepEqual(CORE_CHANNELS, ["linkedin", "x", "instagram", "reddit"]);
  assert.deepEqual(DEFAULT_CHANNELS, ["linkedin", "x", "instagram", "reddit", "newsletter"]);
});

test("Studio channel groups cover every destination exactly once", () => {
  const grouped = CHANNEL_GROUPS.flatMap((group) => group.channels);
  assert.equal(new Set(grouped).size, grouped.length);
  assert.deepEqual(
    [...grouped].sort(),
    CHANNELS.map((channel) => channel.id).sort(),
  );
});

test("Studio provider catalog preserves supported UI routes", () => {
  assert.deepEqual(
    PROVIDERS.map((provider) => provider.id),
    ["gemini", "openai", "claude", "openrouter", "groq", "custom", "ollama", "lmstudio"],
  );
  for (const provider of PROVIDERS) {
    assert.ok(provider.label);
    assert.ok(provider.hint);
  }
});

test("channel metadata keeps the existing unknown-channel fallback", () => {
  assert.equal(channelMeta("linkedin").label, "LinkedIn");
  assert.deepEqual(channelMeta("future-network"), {
    id: "future-network",
    label: "future-network",
    tone: "Campaign draft",
    type: "Channel",
    limit: null,
    openUrl: "",
  });
});

test("page controller consumes the shared catalog instead of owning duplicate metadata", () => {
  const page = fs.readFileSync(path.join(frontendRoot, "app/page.js"), "utf8");
  assert.match(page, /from "\.\.\/lib\/studio\/studioCatalog\.mjs"/);
  assert.doesNotMatch(page, /const CHANNELS = \[/);
  assert.doesNotMatch(page, /const CHANNEL_GROUPS = \[/);
  assert.doesNotMatch(page, /const PROVIDERS = \[/);
  assert.doesNotMatch(page, /function channelMeta\(id\)/);
});
