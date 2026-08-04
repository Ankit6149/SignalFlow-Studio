import JSZip from "jszip";

import { currentPostsFromCampaign, migrateLegacyCampaign } from "../domain/campaign.mjs";
import { stableStringify } from "../domain/contracts.mjs";
import { projectCampaignJson, projectCampaignMarkdown } from "./campaignExport.mjs";

export const CAMPAIGN_ZIP_SCHEMA_VERSION = 1;

const CHANNEL_ORDER = [
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

const CHANNEL_META = {
  linkedin: { label: "LinkedIn", filename: "linkedin.txt", fields: ["title", "body", "hashtags", "cta"] },
  x: { label: "X", filename: "x.txt", fields: ["mode", "posts"] },
  instagram: { label: "Instagram", filename: "instagram.txt", fields: ["caption", "hashtags", "visualDirection"] },
  facebook: { label: "Facebook", filename: "facebook.txt", fields: ["body", "cta"] },
  threads: { label: "Threads", filename: "threads.txt", fields: ["body"] },
  reddit: { label: "Reddit", filename: "reddit.txt", fields: ["title", "body", "subredditSuggestions"] },
  hackernews: { label: "Hacker News", filename: "hacker-news.txt", fields: ["title", "body"] },
  youtube: { label: "YouTube", filename: "youtube.txt", fields: ["title", "description", "tags", "chapters", "segments"] },
  tiktok: { label: "TikTok", filename: "tiktok.txt", fields: ["hook", "caption", "shotList"] },
  newsletter: { label: "Newsletter", filename: "newsletter.md", fields: ["subject", "preview", "body"] },
  blog: { label: "Blog", filename: "blog.md", fields: ["title", "outline", "draft"] },
  release_notes: { label: "Release notes", filename: "release-notes.md", fields: ["title", "sections"] },
};

function canonicalChannel(value) {
  const channel = String(value || "").trim().toLowerCase();
  if (["hn", "hacker-news", "hacker_news"].includes(channel)) return "hackernews";
  if (["releasenotes", "release-notes", "release_notes"].includes(channel)) return "release_notes";
  return channel;
}

function packageKey(channel) {
  return channel === "release_notes" ? "releaseNotes" : channel;
}

function channelLabel(channel) {
  return CHANNEL_META[channel]?.label || channel;
}

function channelFilename(channel) {
  return CHANNEL_META[channel]?.filename || `${channel}.txt`;
}

function orderedChannels(values) {
  const unique = new Set((values || []).map(canonicalChannel).filter(Boolean));
  return [
    ...CHANNEL_ORDER.filter((channel) => unique.has(channel)),
    ...Array.from(unique).filter((channel) => !CHANNEL_ORDER.includes(channel)).sort(),
  ];
}

function portableStructuredDraft(channel, value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const fields = CHANNEL_META[channel]?.fields || Object.keys(value).sort();
  return Object.fromEntries(
    fields
      .filter((field) => value[field] !== undefined)
      .map((field) => [field, value[field]]),
  );
}

function structuredPostsFrom(input, campaign) {
  const candidates = [
    input?.result?.package?.posts,
    input?.generationResult?.structuredPosts,
    campaign?.generationResult?.structuredPosts,
  ];
  return candidates.find((value) => value && typeof value === "object" && !Array.isArray(value)) || {};
}

function generationStatusFrom(input, campaign) {
  const candidates = [
    input?.result?.generation_status,
    input?.generationStatus,
    campaign?.generationResult?.generation_status,
  ];
  return candidates.find((value) => value && typeof value === "object" && !Array.isArray(value)) || {};
}

function structuredValue(posts, channel) {
  if (channel === "hackernews") return posts.hackernews || posts.hn || null;
  if (channel === "release_notes") return posts.releaseNotes || posts.release_notes || null;
  return posts[channel] || null;
}

function statusValue(statuses, channel) {
  if (channel === "hackernews") return statuses.hackernews || statuses.hn || null;
  if (channel === "release_notes") return statuses.release_notes || statuses.releaseNotes || null;
  return statuses[channel] || null;
}

function channelSnapshot({ campaign, posts, structuredPosts, statuses, channel }) {
  const draft = campaign.drafts?.[channel] || null;
  const generationStatus = statusValue(statuses, channel) || {};
  const currentContent = posts[channel] || "";
  const structuredDraft = portableStructuredDraft(channel, structuredValue(structuredPosts, channel));
  const status = String(
    generationStatus.status
    || draft?.qualityState
    || (currentContent || structuredDraft ? "generated" : "failed"),
  );
  const issues = Array.isArray(generationStatus.issues)
    ? generationStatus.issues.map(String)
    : [];

  return {
    schemaVersion: CAMPAIGN_ZIP_SCHEMA_VERSION,
    kind: "ChannelExport",
    channel,
    label: channelLabel(channel),
    status,
    available: Boolean(currentContent || structuredDraft),
    current: {
      content: currentContent,
      origin: draft?.current?.origin || (draft?.edited ? "edited" : "generated"),
      edited: Boolean(draft?.edited),
      approved: Boolean(draft?.approved),
      qualityState: draft?.qualityState || status,
      updatedAt: draft?.updatedAt || campaign.updatedAt,
    },
    generatedContent: draft?.generated?.content || currentContent,
    structuredDraft,
    structuredDraftOrigin: structuredDraft ? "generation_snapshot" : null,
    issues,
    metrics: generationStatus.metrics || null,
    generationRunId: draft?.generationRunId || campaign.generationRun?.generationRunId || null,
  };
}

function failedDraftNotice(snapshot) {
  const issueText = snapshot.issues.length
    ? `\nIssues:\n${snapshot.issues.map((issue) => `- ${issue}`).join("\n")}`
    : "";
  return `[No current ${snapshot.label} draft]\nStatus: ${snapshot.status}${issueText}\n`;
}

function channelReadme(snapshot) {
  const state = [
    `Status: ${snapshot.status}`,
    `Edited: ${snapshot.current.edited ? "yes" : "no"}`,
    `Approved: ${snapshot.current.approved ? "yes" : "no"}`,
    `Structured snapshot: ${snapshot.structuredDraft ? "included" : "not available"}`,
  ].join(" · ");
  const content = snapshot.current.content || failedDraftNotice(snapshot);
  return `# ${snapshot.label}\n\n${state}\n\n## Current authoritative draft\n\n${content}\n`;
}

function rootReadme(campaign, snapshots) {
  const rows = snapshots.map((snapshot) =>
    `| ${snapshot.label} | ${snapshot.status} | ${snapshot.current.edited ? "Yes" : "No"} | ${snapshot.current.approved ? "Yes" : "No"} | ${snapshot.structuredDraft ? "Yes" : "No"} |`,
  ).join("\n");
  return `# ${campaign.title} — SignalFlow export\n\nThis archive is a deterministic snapshot of the current campaign revision. The files in \`drafts/\` contain the authoritative text currently visible in the editor. The files in \`structured/\` preserve destination-specific generation fields and explicitly identify their generation-snapshot origin. When a draft was edited, the current text remains authoritative.\n\n## Campaign\n\n- Campaign ID: ${campaign.campaignId}\n- Snapshot: ${campaign.updatedAt}\n- Provider: ${campaign.providerUsed || "unknown"}${campaign.modelUsed ? ` · ${campaign.modelUsed}` : ""}\n- Revision: ${campaign.editorState?.revision ?? "unknown"}\n\n## Destination summary\n\n| Destination | Status | Edited | Approved | Structured fields |\n| --- | --- | --- | --- | --- |\n${rows}\n\n## Archive layout\n\n- \`campaign.md\` — complete human-readable campaign snapshot.\n- \`campaign.json\` — versioned canonical campaign export.\n- \`drafts/\` — one current authoritative draft per selected destination.\n- \`structured/\` — one structured JSON record per selected destination, including status and generation fields.\n- \`manifest.json\` — deterministic file and channel manifest.\n`;
}

function byteLength(value) {
  return Buffer.byteLength(value, "utf8");
}

export async function buildCampaignZipExport(input) {
  const campaign = migrateLegacyCampaign(input);
  const markdown = projectCampaignMarkdown(campaign);
  const json = projectCampaignJson(campaign);
  const posts = currentPostsFromCampaign(campaign);
  const structuredPosts = structuredPostsFrom(input, campaign);
  const statuses = generationStatusFrom(input, campaign);
  const channels = orderedChannels([
    ...(Array.isArray(input?.channels) ? input.channels : []),
    ...(campaign.channels || []),
    ...Object.keys(structuredPosts),
    ...Object.keys(statuses),
  ]);
  const snapshots = channels.map((channel) => channelSnapshot({
    campaign,
    posts,
    structuredPosts,
    statuses,
    channel,
  }));
  const zip = new JSZip();
  const date = new Date(campaign.updatedAt || new Date(0).toISOString());
  const manifestEntries = [];

  function addText(path, content, mimeType) {
    zip.file(path, content, { date });
    manifestEntries.push({ path, mimeType, bytes: byteLength(content) });
  }

  addText("campaign.md", markdown.content, markdown.mimeType);
  addText("campaign.json", json.content, json.mimeType);
  addText("README.md", rootReadme(campaign, snapshots), "text/markdown");

  for (const snapshot of snapshots) {
    const draftContent = snapshot.current.content || failedDraftNotice(snapshot);
    addText(`drafts/${channelFilename(snapshot.channel)}`, draftContent, snapshot.channel === "blog" || snapshot.channel === "newsletter" || snapshot.channel === "release_notes" ? "text/markdown" : "text/plain");
    addText(`structured/${snapshot.channel}.json`, stableStringify(snapshot, 2), "application/json");
    addText(`structured/${snapshot.channel}.md`, channelReadme(snapshot), "text/markdown");
  }

  const manifest = {
    schemaVersion: CAMPAIGN_ZIP_SCHEMA_VERSION,
    kind: "CampaignArchiveManifest",
    campaignId: campaign.campaignId,
    title: campaign.title,
    snapshotAt: campaign.updatedAt,
    channels: snapshots.map((snapshot) => ({
      channel: snapshot.channel,
      status: snapshot.status,
      available: snapshot.available,
      edited: snapshot.current.edited,
      approved: snapshot.current.approved,
      structured: Boolean(snapshot.structuredDraft),
    })),
    files: manifestEntries,
  };
  zip.file("manifest.json", stableStringify(manifest, 2), { date });

  return {
    filename: `${json.filename.replace(/\.json$/, "")}.zip`,
    content: await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
      platform: "UNIX",
    }),
    mimeType: "application/zip",
    campaign,
    manifest,
    summary: {
      channelCount: snapshots.length,
      fileCount: manifestEntries.length + 1,
      failedChannels: snapshots.filter((snapshot) => snapshot.status === "failed").map((snapshot) => snapshot.channel),
      editedChannels: snapshots.filter((snapshot) => snapshot.current.edited).map((snapshot) => snapshot.channel),
    },
  };
}
