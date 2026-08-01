/**
 * Converts a unified package object into a clean, structured Markdown file.
 */
export function buildMarkdown({ projectName, package: pkg, prompt = "" }) {
  if (!pkg) return `# ${projectName || "SignalFlow"} Content Package\n\nNo package generated yet.`;

  const project = pkg.project || {};
  const context = pkg.context || {};
  const strategy = pkg.strategy || {};
  const posts = pkg.posts || {};
  const media = pkg.media || {};
  const publishing = pkg.publishing || {};

  let md = `# ${project.name || projectName} Studio Package\n\n`;
  md += `> Generated on: ${new Date().toISOString()}\n`;
  md += `> Description: ${project.description || project.oneLine || ""}\n`;
  md += `> Target Audience: ${project.audience || ""}\n\n`;

  md += `## Table of Contents\n`;
  md += `- [1. Strategy & Positioning](#1-strategy--positioning)\n`;
  md += `- [2. Product Context & Insights](#2-product-context--insights)\n`;
  md += `- [3. Social Platform Drafts](#3-social-platform-drafts)\n`;
  md += `- [4. Visual & Media Plans](#4-visual--media-plans)\n`;
  md += `- [5. Publishing Checklist](#5-publishing-checklist)\n\n`;

  md += `## 1. Strategy & Positioning\n\n`;
  md += `**Core Posting Angle**\n${strategy.coreAngle || "N/A"}\n\n`;
  md += `**Market Positioning**\n${strategy.positioning || "N/A"}\n\n`;

  if (Array.isArray(strategy.hooks) && strategy.hooks.length) {
    md += `### Suggested Hooks\n`;
    strategy.hooks.forEach(h => { md += `- ${h}\n`; });
    md += `\n`;
  }

  if (Array.isArray(strategy.proofPoints) && strategy.proofPoints.length) {
    md += `### Proof Points & Supporting Facts\n`;
    strategy.proofPoints.forEach(p => { md += `- ${p}\n`; });
    md += `\n`;
  }

  if (Array.isArray(strategy.safeClaims) && strategy.safeClaims.length) {
    md += `### Safe Claims\n`;
    strategy.safeClaims.forEach(sc => { md += `- ${sc}\n`; });
    md += `\n`;
  }

  if (Array.isArray(strategy.avoidClaims) && strategy.avoidClaims.length) {
    md += `### Claims to Avoid\n`;
    strategy.avoidClaims.forEach(ac => { md += `- ${ac}\n`; });
    md += `\n`;
  }

  md += `## 2. Product Context & Insights\n\n`;
  
  if (Array.isArray(context.confirmedFacts) && context.confirmedFacts.length) {
    md += `### Confirmed Facts\n`;
    context.confirmedFacts.forEach(cf => { md += `- ${cf}\n`; });
    md += `\n`;
  }

  if (Array.isArray(context.inferredFacts) && context.inferredFacts.length) {
    md += `### Inferred Facts & Assumptions\n`;
    context.inferredFacts.forEach(ifact => { md += `- ${ifact}\n`; });
    md += `\n`;
  }

  if (Array.isArray(context.missingContext) && context.missingContext.length) {
    md += `### Missing Context Warnings\n`;
    context.missingContext.forEach(mc => { md += `- ⚠️ ${mc}\n`; });
    md += `\n`;
  }

  if (Array.isArray(context.techStack) && context.techStack.length) {
    md += `**Detected Tech Stack**: ${context.techStack.join(", ")}\n\n`;
  }

  if (Array.isArray(context.features) && context.features.length) {
    md += `**Detected Key Features**:\n`;
    context.features.forEach(f => { md += `- ${f}\n`; });
    md += `\n`;
  }

  md += `## 3. Social Platform Drafts\n\n`;

  if (posts.linkedin) {
    md += `### LinkedIn Post\n\n`;
    if (posts.linkedin.title) md += `**Title**: ${posts.linkedin.title}\n\n`;
    md += `${posts.linkedin.body || posts.linkedin}\n\n`;
    if (posts.linkedin.hashtags?.length) md += `*Hashtags*: ${posts.linkedin.hashtags.map(h => `#${h}`).join(" ")}\n\n`;
    if (posts.linkedin.cta) md += `*CTA*: ${posts.linkedin.cta}\n\n`;
    md += `***\n\n`;
  }

  if (posts.x) {
    md += `### X/Twitter Post or Thread\n\n`;
    const xPosts = Array.isArray(posts.x.posts) ? posts.x.posts : [posts.x.body || posts.x];
    xPosts.forEach((postText, index) => {
      md += `**Post ${index + 1}**\n\`\`\`text\n${postText}\n\`\`\`\n\n`;
    });
    md += `***\n\n`;
  }

  if (posts.instagram) {
    md += `### Instagram Caption\n\n`;
    md += `\`\`\`text\n${posts.instagram.caption || posts.instagram}\n\`\`\`\n`;
    if (posts.instagram.hashtags?.length) md += `*Hashtags*: ${posts.instagram.hashtags.map(h => `#${h}`).join(" ")}\n\n`;
    if (posts.instagram.visualDirection) md += `**Suggested Visual**: ${posts.instagram.visualDirection}\n\n`;
    md += `***\n\n`;
  }

  if (posts.reddit) {
    md += `### Reddit Post\n\n`;
    md += `**Title**: ${posts.reddit.title || "Reddit Post"}\n\n`;
    md += `${posts.reddit.body || posts.reddit}\n\n`;
    if (posts.reddit.subredditSuggestions?.length) {
      md += `*Suggested Subreddits*: ${posts.reddit.subredditSuggestions.join(", ")}\n\n`;
    }
    md += `***\n\n`;
  }

  if (posts.hackernews) {
    md += `### Hacker News Post\n\n`;
    md += `**Title**: ${posts.hackernews.title || "HN Show"}\n\n`;
    md += `${posts.hackernews.body || posts.hackernews}\n\n`;
    md += `***\n\n`;
  }

  if (posts.blog) {
    md += `### Blog Post Draft\n\n`;
    md += `**Title**: ${posts.blog.title || "Blog Post"}\n\n`;
    if (Array.isArray(posts.blog.outline) && posts.blog.outline.length) {
      md += `#### Outline\n`;
      posts.blog.outline.forEach(o => { md += `- ${o}\n`; });
      md += `\n`;
    }
    md += `${posts.blog.draft || posts.blog}\n\n`;
    md += `***\n\n`;
  }

  if (posts.newsletter) {
    md += `### Newsletter Draft\n\n`;
    md += `**Subject**: ${posts.newsletter.subject || "Newsletter Subject"}\n`;
    if (posts.newsletter.preview) md += `**Preview**: ${posts.newsletter.preview}\n`;
    md += `\n${posts.newsletter.body || posts.newsletter}\n\n`;
    md += `***\n\n`;
  }

  if (posts.releaseNotes) {
    md += `### Release Notes\n\n`;
    md += `**Title**: ${posts.releaseNotes.title || "Release Notes"}\n\n`;
    const sections = Array.isArray(posts.releaseNotes.sections) ? posts.releaseNotes.sections : [];
    sections.forEach(s => {
      md += `#### ${s.title}\n`;
      if (Array.isArray(s.items)) {
        s.items.forEach(i => { md += `- ${i}\n`; });
      } else {
        md += `${s.items || s.body || ""}\n`;
      }
      md += `\n`;
    });
  }

  md += `## 4. Visual & Media Plans\n\n`;
  
  if (Array.isArray(media.screenshotPlan) && media.screenshotPlan.length) {
    md += `### Screenshot Plan\n`;
    media.screenshotPlan.forEach(sp => { md += `- [ ] ${sp}\n`; });
    md += `\n`;
  }

  if (Array.isArray(media.videoScript) && media.videoScript.length) {
    md += `### Reels/Shorts Script Plan\n`;
    media.videoScript.forEach(vs => { md += `- ${vs}\n`; });
    md += `\n`;
  }

  if (Array.isArray(media.voiceoverScript) && media.voiceoverScript.length) {
    md += `### Voiceover Script Plan\n`;
    media.voiceoverScript.forEach(vo => { md += `- ${vo}\n`; });
    md += `\n`;
  }

  if (Array.isArray(media.shotList) && media.shotList.length) {
    md += `### Scene-by-Scene Shot List\n`;
    media.shotList.forEach(sl => { md += `- ${sl}\n`; });
    md += `\n`;
  }

  if (Array.isArray(media.recordingGuide) && media.recordingGuide.length) {
    md += `### Screen Recording Guide\n`;
    media.recordingGuide.forEach(rg => { md += `- ${rg}\n`; });
    md += `\n`;
  }

  if (Array.isArray(media.carouselPlan) && media.carouselPlan.length) {
    md += `### Carousel Slides Layout\n`;
    media.carouselPlan.forEach(cp => { md += `- ${cp}\n`; });
    md += `\n`;
  }

  if (Array.isArray(media.thumbnailIdeas) && media.thumbnailIdeas.length) {
    md += `### Thumbnail Ideas\n`;
    media.thumbnailIdeas.forEach(ti => { md += `- ${ti}\n`; });
    md += `\n`;
  }

  if (Array.isArray(media.videoTimeline) && media.videoTimeline.length) {
    md += `### Video Editing Timeline\n`;
    media.videoTimeline.forEach(vt => { md += `- ${vt}\n`; });
    md += `\n`;
  }

  if (media.thumbnailPrompt) {
    md += `### Thumbnail Generation Prompt\n`;
    md += `\`\`\`text\n${media.thumbnailPrompt}\n\`\`\`\n\n`;
  }

  if (Array.isArray(media.assetChecklist) && media.assetChecklist.length) {
    md += `### Required Media Asset Checklist\n`;
    media.assetChecklist.forEach(ac => { md += `- [ ] ${ac}\n`; });
    md += `\n`;
  }

  md += `## 5. Publishing Checklist\n\n`;

  if (Array.isArray(publishing.platformChecklist) && publishing.platformChecklist.length) {
    md += `### Platform Steps\n`;
    publishing.platformChecklist.forEach(pc => { md += `- [ ] ${pc}\n`; });
    md += `\n`;
  }

  if (Array.isArray(publishing.manualPostingSteps) && publishing.manualPostingSteps.length) {
    md += `### Manual Handoff Steps\n`;
    publishing.manualPostingSteps.forEach(mps => { md += `${mps}\n`; });
    md += `\n`;
  }

  if (publishing.apiPublishingNotes) {
    md += `**Distribution Notes**: ${publishing.apiPublishingNotes}\n\n`;
  }

  if (prompt) {
    md += `## Appendix: Generated Prompt Details\n\n`;
    md += `\`\`\`text\n${prompt}\n\`\`\`\n`;
  }

  return md;
}
