import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  CHANNEL_IDS,
  canonicalChannelId,
  canonicalChannelList,
  canonicalChannelMap,
  normalizeLegacyChannelPayload,
  packageKeyForChannelId,
} from "../lib/domain/channelIdentifiers.mjs";
import { migrateCanonicalCampaign } from "../lib/domain/campaignCompatibility.mjs";
import { projectCampaignExport } from "../lib/export/campaignExport.mjs";

const legacyHackerNewsDraft = [
  "Show HN: SignalFlow Studio",
  "SignalFlow Studio turns supplied product evidence into editable destination drafts.",
].join("\n\n");

function legacyCampaign(overrides = {}) {
  return {
    id: "legacy-hn-campaign",
    title: "Legacy Hacker News campaign",
    channels: ["hn"],
    activeChannel: "hn",
    posts: { hn: legacyHackerNewsDraft },
    generatedPosts: { hn: legacyHackerNewsDraft },
    channelStates: {
      hn: {
        status: "generated",
        edited: false,
        approved: false,
        generationRunId: "legacy-run",
      },
    },
    result: {
      ok: true,
      providerUsed: "gemini",
      posts: { hn: legacyHackerNewsDraft },
      generation_status: { hn: { status: "generated" } },
      package: {
        project: { name: "SignalFlow Studio" },
        posts: {
          hn: {
            title: "Show HN: SignalFlow Studio",
            body: "A technical explanation of the current product and its limitations.",
          },
        },
      },
    },
    revision: 1,
    createdAt: "2026-08-06T00:00:00.000Z",
    updatedAt: "2026-08-06T00:00:00.000Z",
    ...overrides,
  };
}

test("the canonical registry documents every active destination ID", () => {
  assert.deepEqual(CHANNEL_IDS, [
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
  assert.equal(canonicalChannelId("hn"), "hackernews");
  assert.equal(canonicalChannelId("hacker-news"), "hackernews");
  assert.equal(canonicalChannelId("hacker_news"), "hackernews");
  assert.equal(canonicalChannelId("hackernews"), "hackernews");
  assert.equal(packageKeyForChannelId("hackernews"), "hackernews");
  assert.equal(packageKeyForChannelId("release_notes"), "releaseNotes");
});

test("canonical maps prefer an explicit Hacker News key over a legacy alias", () => {
  const normalized = canonicalChannelMap({
    hn: "legacy",
    hackernews: "canonical",
  });
  assert.deepEqual(normalized, { hackernews: "canonical" });
  assert.deepEqual(canonicalChannelList(["hn", "hackernews", "reddit"]), ["hackernews", "reddit"]);
});

test("legacy Hacker News payloads normalize every protocol and persistence surface", () => {
  const normalized = normalizeLegacyChannelPayload(legacyCampaign());

  assert.deepEqual(normalized.channels, ["hackernews"]);
  assert.equal(normalized.activeChannel, "hackernews");
  assert.equal(normalized.posts.hackernews, legacyHackerNewsDraft);
  assert.equal(normalized.generatedPosts.hackernews, legacyHackerNewsDraft);
  assert.equal(normalized.channelStates.hackernews.status, "generated");
  assert.equal(normalized.result.posts.hackernews, legacyHackerNewsDraft);
  assert.equal(normalized.result.generation_status.hackernews.status, "generated");
  assert.equal(normalized.result.package.posts.hackernews.title, "Show HN: SignalFlow Studio");
  assert.equal(Object.hasOwn(normalized.posts, "hn"), false);
  assert.equal(Object.hasOwn(normalized.result.generation_status, "hn"), false);
  assert.equal(Object.hasOwn(normalized.result.package.posts, "hn"), false);
});

test("legacy Hacker News campaigns reopen as canonical domain records", () => {
  const campaign = migrateCanonicalCampaign(legacyCampaign());

  assert.deepEqual(campaign.channels, ["hackernews"]);
  assert.deepEqual(Object.keys(campaign.drafts), ["hackernews"]);
  assert.equal(campaign.drafts.hackernews.channel, "hackernews");
  assert.equal(campaign.drafts.hackernews.current.content, legacyHackerNewsDraft);
  assert.equal(campaign.generationResult.generation_status.hackernews.status, "generated");
  assert.equal(Object.hasOwn(campaign.drafts, "hn"), false);
});

test("campaign export emits only the canonical Hacker News identifier", () => {
  const projection = projectCampaignExport(legacyCampaign());

  assert.deepEqual(projection.campaign.channels, ["hackernews"]);
  assert.deepEqual(Object.keys(projection.campaign.currentDrafts), ["hackernews"]);
  assert.equal(projection.campaign.currentDrafts.hackernews.channel, "hackernews");
  assert.equal(projection.campaign.currentDrafts.hackernews.content, legacyHackerNewsDraft);
  assert.equal(Object.hasOwn(projection.campaign.currentDrafts, "hn"), false);
  assert.doesNotMatch(JSON.stringify(projection), /"hn"\s*:/);
});

async function sourceFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const location = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(location));
    else if (/\.(?:js|mjs)$/.test(entry.name)) files.push(location);
  }
  return files;
}

test("active runtime surfaces never emit the legacy hn identifier", async () => {
  const frontendRoot = path.resolve(new URL("..", import.meta.url).pathname);
  const roots = ["app", "components", "lib"].map((name) => path.join(frontendRoot, name));
  const compatibilityFiles = new Set([
    path.join(frontendRoot, "lib", "ai", "channelGeneration.mjs"),
    path.join(frontendRoot, "lib", "domain", "campaign.mjs"),
    path.join(frontendRoot, "lib", "domain", "channelIdentifiers.mjs"),
    path.join(frontendRoot, "lib", "export", "campaignExport.mjs"),
    path.join(frontendRoot, "lib", "export", "campaignZip.mjs"),
  ]);
  const forbidden = [
    /\bid\s*:\s*["']hn["']/,
    /\bresult\.hn\s*=/,
    /\bactiveChannel\s*:\s*["']hn["']/,
    /\bchannel\s*:\s*["']hn["']/,
  ];

  for (const root of roots) {
    for (const file of await sourceFiles(root)) {
      if (compatibilityFiles.has(file)) continue;
      const source = await readFile(file, "utf8");
      for (const pattern of forbidden) {
        assert.doesNotMatch(source, pattern, `${path.relative(frontendRoot, file)} contains an active legacy Hacker News identifier`);
      }
    }
  }
});
