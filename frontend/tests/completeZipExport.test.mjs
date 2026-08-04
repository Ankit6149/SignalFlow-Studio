import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";

import { buildCampaignZipExport } from "../lib/export/campaignZip.mjs";

const CHANNELS = [
  "linkedin",
  "x",
  "instagram",
  "facebook",
  "threads",
  "reddit",
  "hackernews",
  "youtube",
  "tiktok",
  "newsletter",
  "blog",
  "release_notes",
];

function fullCampaignInput() {
  const createdAt = "2026-08-04T12:00:00.000Z";
  const posts = {
    linkedin: "Edited LinkedIn copy that is authoritative.",
    x: "First X post.\n\nSecond X post.",
    instagram: "Instagram caption current edit.",
    facebook: "Facebook current update.",
    threads: "Threads current note.",
    reddit: "Reddit title\n\nReddit current body.",
    hackernews: "Show HN: SignalFlow Studio\n\nCurrent technical explanation.",
    youtube: "SignalFlow Studio walkthrough\n\nCurrent YouTube description.",
    newsletter: "Current newsletter subject\n\nCurrent newsletter body.",
    blog: "Current edited long-form article.",
    release_notes: "SignalFlow release\n\nCurrent release notes.",
  };
  const generatedPosts = Object.fromEntries(
    Object.entries(posts).map(([channel, content]) => [channel, channel === "linkedin" ? "Original LinkedIn generation." : content]),
  );
  const structuredPosts = {
    linkedin: { title: "Launch", body: "Original LinkedIn generation.", hashtags: ["signalflow"], cta: "Review the workflow" },
    x: { mode: "thread", posts: ["First X post.", "Second X post."] },
    instagram: { caption: "Instagram caption current edit.", hashtags: ["signalflow"], visualDirection: "Review workspace carousel" },
    facebook: { body: "Facebook current update.", cta: "Open the workspace" },
    threads: { body: "Threads current note." },
    reddit: { title: "Reddit title", body: "Reddit current body.", subredditSuggestions: ["SideProject"] },
    hackernews: { title: "Show HN: SignalFlow Studio", body: "Current technical explanation." },
    youtube: {
      title: "SignalFlow Studio walkthrough",
      description: "Current YouTube description.",
      tags: ["signalflow", "campaign workflow"],
      chapters: [{ start: "00:00", title: "Product context" }],
    },
    newsletter: { subject: "Current newsletter subject", preview: "Evidence before copy", body: "Current newsletter body." },
    blog: { title: "SignalFlow Studio workflow", outline: ["Problem", "Evidence", "Review"], draft: "Current edited long-form article." },
    releaseNotes: {
      title: "SignalFlow release",
      sections: [
        { title: "Added", items: ["Complete ZIP export"] },
        { title: "Fixed", items: ["Canonical Hacker News ID"] },
      ],
    },
  };
  const generationStatus = Object.fromEntries(
    CHANNELS.map((channel) => [channel, channel === "tiktok"
      ? { status: "failed", issues: ["Provider did not return a TikTok draft."] }
      : { status: channel === "linkedin" ? "generated" : "needs_review", qualityScore: 84 }]),
  );

  return {
    title: "SignalFlow complete archive",
    channels: CHANNELS,
    posts,
    generatedPosts,
    channelStates: Object.fromEntries(CHANNELS.filter((channel) => posts[channel]).map((channel) => [channel, {
      status: generationStatus[channel].status,
      edited: channel === "linkedin",
      approved: channel === "linkedin",
      generationRunId: "run-zip-1",
    }])),
    result: {
      ok: true,
      providerUsed: "gemini",
      modelUsed: "gemini-test",
      warnings: ["TikTok generation failed."],
      generation_status: generationStatus,
      posts: generatedPosts,
      package: {
        project: { name: "SignalFlow complete archive" },
        context: { confirmedFacts: ["SignalFlow is review-first."] },
        strategy: { positioning: "Evidence-grounded campaign generation." },
        posts: structuredPosts,
      },
    },
    generationRun: {
      generationRunId: "run-zip-1",
      sourceSnapshotId: "source-zip-1",
      sourceFingerprint: "sf1-zip",
      provider: "gemini",
      model: "gemini-test",
      createdAt,
      sourceSnapshot: {
        sourceSnapshotId: "source-zip-1",
        fingerprint: "sf1-zip",
        normalizedSource: {},
        createdAt,
      },
    },
    editorState: {
      revision: 4,
      savedRevision: 4,
      exportedRevision: null,
      lastSavedAt: createdAt,
      lastExportedAt: null,
      savedSourceFingerprint: "sf1-zip",
    },
    brief: { projectName: "SignalFlow complete archive", provider: "gemini" },
    createdAt,
    updatedAt: createdAt,
  };
}

async function archiveFiles(projection) {
  const zip = await JSZip.loadAsync(projection.content);
  return { zip, paths: Object.values(zip.files).filter((entry) => !entry.dir).map((entry) => entry.name).sort() };
}

test("all twelve destinations receive current and structured files", async () => {
  const projection = await buildCampaignZipExport(fullCampaignInput());
  const { zip, paths } = await archiveFiles(projection);

  assert.equal(projection.summary.channelCount, 12);
  assert.deepEqual(projection.summary.failedChannels, ["tiktok"]);
  assert.ok(projection.summary.editedChannels.includes("linkedin"));

  for (const channel of CHANNELS) {
    assert.ok(paths.includes(`structured/${channel}.json`), channel);
    assert.ok(paths.includes(`structured/${channel}.md`), channel);
  }

  for (const path of [
    "drafts/linkedin.txt",
    "drafts/x.txt",
    "drafts/instagram.txt",
    "drafts/facebook.txt",
    "drafts/threads.txt",
    "drafts/reddit.txt",
    "drafts/hacker-news.txt",
    "drafts/youtube.txt",
    "drafts/tiktok.txt",
    "drafts/newsletter.md",
    "drafts/blog.md",
    "drafts/release-notes.md",
  ]) {
    assert.ok(paths.includes(path), path);
  }

  assert.equal(await zip.file("drafts/linkedin.txt").async("string"), "Edited LinkedIn copy that is authoritative.");
  assert.match(await zip.file("drafts/tiktok.txt").async("string"), /Status: failed/);
  assert.match(await zip.file("drafts/tiktok.txt").async("string"), /Provider did not return a TikTok draft/);
});

test("structured destination fields are preserved without flattening", async () => {
  const projection = await buildCampaignZipExport(fullCampaignInput());
  const { zip } = await archiveFiles(projection);
  const read = async (channel) => JSON.parse(await zip.file(`structured/${channel}.json`).async("string"));

  const x = await read("x");
  assert.deepEqual(x.structuredDraft.posts, ["First X post.", "Second X post."]);

  const youtube = await read("youtube");
  assert.equal(youtube.structuredDraft.title, "SignalFlow Studio walkthrough");
  assert.deepEqual(youtube.structuredDraft.tags, ["signalflow", "campaign workflow"]);
  assert.deepEqual(youtube.structuredDraft.chapters, [{ start: "00:00", title: "Product context" }]);

  const newsletter = await read("newsletter");
  assert.equal(newsletter.structuredDraft.subject, "Current newsletter subject");
  assert.equal(newsletter.structuredDraft.preview, "Evidence before copy");

  const blog = await read("blog");
  assert.deepEqual(blog.structuredDraft.outline, ["Problem", "Evidence", "Review"]);

  const releaseNotes = await read("release_notes");
  assert.equal(releaseNotes.structuredDraft.sections[1].title, "Fixed");

  const tiktok = await read("tiktok");
  assert.equal(tiktok.status, "failed");
  assert.equal(tiktok.available, false);
  assert.equal(tiktok.structuredDraft, null);
});

test("manifest and README match the actual deterministic archive", async () => {
  const first = await buildCampaignZipExport(fullCampaignInput());
  const second = await buildCampaignZipExport(fullCampaignInput());
  assert.deepEqual(first.manifest, second.manifest);

  const { zip, paths } = await archiveFiles(first);
  const manifest = JSON.parse(await zip.file("manifest.json").async("string"));
  const documentedPaths = manifest.files.map((entry) => entry.path).sort();
  assert.deepEqual(documentedPaths, paths.filter((path) => path !== "manifest.json"));
  assert.equal(manifest.channels.length, 12);
  assert.equal(manifest.channels.find((item) => item.channel === "tiktok").status, "failed");

  const readme = await zip.file("README.md").async("string");
  assert.match(readme, /current authoritative draft/i);
  assert.match(readme, /generation-snapshot origin/i);
  assert.match(readme, /TikTok \| failed/);
});
