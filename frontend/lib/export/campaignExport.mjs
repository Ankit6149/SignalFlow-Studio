import { createDomainRecord, stableStringify } from "../domain/contracts.mjs";
import { currentPostsFromCampaign, migrateLegacyCampaign } from "../domain/campaign.mjs";

export const CAMPAIGN_EXPORT_SCHEMA_VERSION = 1;

function slug(value) {
  return String(value || "signalflow-campaign")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "signalflow-campaign";
}

function label(channel) {
  const labels = {
    linkedin: "LinkedIn",
    x: "X",
    instagram: "Instagram",
    facebook: "Facebook",
    threads: "Threads",
    reddit: "Reddit",
    hackernews: "Hacker News",
    youtube: "YouTube",
    tiktok: "TikTok",
    newsletter: "Newsletter",
    blog: "Blog",
    release_notes: "Release notes",
  };
  return labels[channel] || channel;
}

function listSection(title, values) {
  if (!Array.isArray(values) || !values.length) return "";
  return `### ${title}\n\n${values.map((value) => `- ${value}`).join("\n")}\n\n`;
}

function packageContextMarkdown(pkg = {}) {
  const strategy = pkg.strategy || {};
  const context = pkg.context || {};
  const media = pkg.media || {};
  const publishing = pkg.publishing || {};
  let markdown = "## Campaign context\n\n";

  if (strategy.coreAngle) markdown += `**Core angle:** ${strategy.coreAngle}\n\n`;
  if (strategy.positioning) markdown += `**Positioning:** ${strategy.positioning}\n\n`;
  markdown += listSection("Hooks", strategy.hooks);
  markdown += listSection("Proof points", strategy.proofPoints);
  markdown += listSection("Safe claims", strategy.safeClaims);
  markdown += listSection("Claims to avoid", strategy.avoidClaims);
  markdown += listSection("Confirmed facts", context.confirmedFacts);
  markdown += listSection("Inferences", context.inferredFacts);
  markdown += listSection("Missing context", context.missingContext);
  markdown += listSection("Screenshot plan", media.screenshotPlan);
  markdown += listSection("Asset checklist", media.assetChecklist);
  markdown += listSection("Publishing checklist", publishing.platformChecklist);
  return markdown;
}

function exportMetadata(campaign) {
  const qualityStates = Object.fromEntries(
    campaign.channels.map((channel) => [channel, campaign.drafts[channel]?.qualityState || "unknown"]),
  );
  const approvalStates = Object.fromEntries(
    campaign.channels.map((channel) => [channel, Boolean(campaign.drafts[channel]?.approved)]),
  );
  const editedStates = Object.fromEntries(
    campaign.channels.map((channel) => [channel, Boolean(campaign.drafts[channel]?.edited)]),
  );
  return {
    campaignId: campaign.campaignId,
    generationRunId: campaign.generationRun?.generationRunId || null,
    sourceSnapshotId: campaign.sourceSnapshot?.sourceSnapshotId || null,
    sourceFingerprint: campaign.sourceSnapshot?.fingerprint || null,
    provider: campaign.providerUsed || campaign.generationRun?.provider || "unknown",
    model: campaign.modelUsed || campaign.generationRun?.model || "",
    snapshotAt: campaign.updatedAt,
    warnings: campaign.warnings || [],
    qualityStates,
    approvalStates,
    editedStates,
    revision: campaign.editorState?.revision ?? null,
    savedRevision: campaign.editorState?.savedRevision ?? null,
    exportedRevision: campaign.editorState?.exportedRevision ?? null,
    lastSavedAt: campaign.editorState?.lastSavedAt || null,
    lastExportedAt: campaign.editorState?.lastExportedAt || null,
  };
}

export function projectCampaignExport(input) {
  const campaign = migrateLegacyCampaign(input);
  const currentDrafts = Object.fromEntries(
    campaign.channels.map((channel) => {
      const draft = campaign.drafts[channel];
      return [channel, {
        draftId: draft.draftId,
        channel,
        content: draft.current.content,
        origin: draft.current.origin,
        generatedContent: draft.generated?.content || draft.current.content,
        edited: Boolean(draft.edited),
        approved: Boolean(draft.approved),
        qualityState: draft.qualityState,
        generationRunId: draft.generationRunId || null,
        updatedAt: draft.updatedAt,
      }];
    }),
  );
  const history = Object.fromEntries(
    campaign.channels
      .map((channel) => [channel, campaign.drafts[channel]?.history || []])
      .filter(([, revisions]) => revisions.length),
  );
  const metadata = exportMetadata(campaign);
  const exportId = `export-${campaign.campaignId}-${campaign.updatedAt}`;

  const exportRecord = createDomainRecord("Export", {
    exportId,
    campaignId: campaign.campaignId,
    format: "campaign_snapshot",
    createdAt: campaign.updatedAt,
  });

  return {
    schemaVersion: CAMPAIGN_EXPORT_SCHEMA_VERSION,
    kind: "CampaignExport",
    export: exportRecord,
    metadata,
    campaign: {
      campaignId: campaign.campaignId,
      title: campaign.title,
      status: campaign.status,
      channels: campaign.channels,
      sourceSnapshot: campaign.sourceSnapshot,
      generationRun: campaign.generationRun,
      editorState: campaign.editorState,
      brief: campaign.brief,
      warnings: campaign.warnings,
      package: campaign.generationResult?.package || null,
      currentDrafts,
      ...(Object.keys(history).length ? { history } : {}),
    },
  };
}

export function projectCampaignMarkdown(input) {
  const campaign = migrateLegacyCampaign(input);
  const metadata = exportMetadata(campaign);
  const posts = currentPostsFromCampaign(campaign);
  let content = `# ${campaign.title}\n\n`;
  content += `> Campaign ID: ${campaign.campaignId}\n`;
  content += `> Snapshot: ${metadata.snapshotAt}\n`;
  content += `> Provider: ${metadata.provider}${metadata.model ? ` · ${metadata.model}` : ""}\n`;
  if (metadata.generationRunId) content += `> Generation run: ${metadata.generationRunId}\n`;
  if (metadata.sourceSnapshotId) content += `> Source snapshot: ${metadata.sourceSnapshotId}\n`;
  if (metadata.revision !== null) content += `> Editor revision: ${metadata.revision}\n`;
  content += "\n";

  content += packageContextMarkdown(campaign.generationResult?.package || {});
  content += "## Current channel drafts\n\n";
  for (const channel of campaign.channels) {
    content += `### ${label(channel)}\n\n`;
    content += `${posts[channel]}\n\n`;
    content += `*State: ${metadata.approvalStates[channel] ? "approved" : metadata.editedStates[channel] ? "edited" : metadata.qualityStates[channel]}*\n\n`;
  }

  if (metadata.warnings.length) {
    content += `## Warnings\n\n${metadata.warnings.map((warning) => `- ${warning}`).join("\n")}\n`;
  }

  return {
    filename: `${slug(campaign.title)}.md`,
    content,
    mimeType: "text/markdown",
    campaign,
  };
}

export function projectCampaignJson(input) {
  const projection = projectCampaignExport(input);
  return {
    filename: `${slug(projection.campaign.title)}.json`,
    content: stableStringify(projection, 2),
    mimeType: "application/json",
    projection,
  };
}
