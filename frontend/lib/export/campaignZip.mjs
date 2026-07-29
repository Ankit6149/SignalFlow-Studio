import JSZip from "jszip";

import { currentPostsFromCampaign, migrateLegacyCampaign } from "../domain/campaign.mjs";
import { projectCampaignJson, projectCampaignMarkdown } from "./campaignExport.mjs";

function filename(channel) {
  const names = {
    linkedin: "linkedin.txt",
    x: "x.txt",
    instagram: "instagram.txt",
    facebook: "facebook.txt",
    threads: "threads.txt",
    reddit: "reddit.txt",
    hackernews: "hacker-news.txt",
    youtube: "youtube.txt",
    tiktok: "tiktok.txt",
    newsletter: "newsletter.md",
    blog: "blog.md",
    release_notes: "release-notes.md",
  };
  return names[channel] || `${channel}.txt`;
}

export async function buildCampaignZipExport(input) {
  const campaign = migrateLegacyCampaign(input);
  const markdown = projectCampaignMarkdown(campaign);
  const json = projectCampaignJson(campaign);
  const posts = currentPostsFromCampaign(campaign);
  const zip = new JSZip();

  zip.file("campaign.md", markdown.content, { date: new Date(campaign.updatedAt) });
  zip.file("campaign.json", json.content, { date: new Date(campaign.updatedAt) });

  for (const channel of campaign.channels) {
    zip.file(`drafts/${filename(channel)}`, posts[channel], { date: new Date(campaign.updatedAt) });
  }

  return {
    filename: `${json.filename.replace(/\.json$/, "")}.zip`,
    content: await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    }),
    mimeType: "application/zip",
    campaign,
  };
}
