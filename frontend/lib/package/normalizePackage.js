import { generateLocalTemplatePackage } from "./templatePackage";
import { buildVideoPrompt } from "../video/buildVideoPrompt";

function list(value, fallback = []) {
  return Array.isArray(value) ? value.filter((item) => item !== null && item !== undefined) : fallback;
}

function text(value, fallback = "") {
  if (typeof value === "string" && value.trim()) return value.trim();
  return fallback;
}

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function normalizeLinkedIn(value, fallback) {
  if (typeof value === "string") return { ...fallback, body: value };
  const val = object(value);
  if (!val) return fallback;
  return {
    title: text(val.title, fallback.title),
    body: text(val.body || val.text, fallback.body),
    hashtags: list(val.hashtags, fallback.hashtags),
    cta: text(val.cta, fallback.cta),
  };
}

function normalizeX(value, fallback) {
  if (typeof value === "string") return { mode: "post_or_thread", posts: [value] };
  if (Array.isArray(value)) return { mode: "post_or_thread", posts: value };
  const val = object(value);
  if (!val) return fallback;
  const posts = list(val.posts || val.thread, []);
  return {
    mode: text(val.mode, fallback.mode || "post_or_thread"),
    posts: posts.length ? posts : val.body ? [val.body] : fallback.posts,
  };
}

function normalizeInstagram(value, fallback) {
  if (typeof value === "string") return { ...fallback, caption: value };
  const val = object(value);
  if (!val) return fallback;
  return {
    caption: text(val.caption || val.body, fallback.caption),
    hashtags: list(val.hashtags, fallback.hashtags),
    visualDirection: text(val.visualDirection || val.visual_direction, fallback.visualDirection),
  };
}

function normalizeReddit(value, fallback) {
  if (typeof value === "string") return { ...fallback, body: value };
  const val = object(value);
  if (!val) return fallback;
  return {
    title: text(val.title, fallback.title),
    body: text(val.body || val.text, fallback.body),
    subredditSuggestions: list(val.subredditSuggestions || val.subreddits, fallback.subredditSuggestions),
  };
}

function normalizeSimpleBody(value, fallback) {
  if (typeof value === "string") return { ...fallback, body: value };
  const val = object(value);
  if (!val) return fallback;
  return {
    ...fallback,
    ...val,
    body: text(val.body || val.text || val.caption, fallback.body),
  };
}

function normalizeYouTube(value, fallback) {
  if (typeof value === "string") return { ...fallback, description: value };
  const val = object(value);
  if (!val) return fallback;
  return {
    title: text(val.title, fallback.title),
    description: text(val.description || val.body, fallback.description),
    tags: list(val.tags, fallback.tags),
  };
}

function normalizeTikTok(value, fallback) {
  if (typeof value === "string") return { ...fallback, caption: value };
  const val = object(value);
  if (!val) return fallback;
  return {
    caption: text(val.caption || val.body, fallback.caption),
    hook: text(val.hook, fallback.hook),
    shotList: list(val.shotList || val.shots, fallback.shotList),
  };
}

function normalizeHackerNews(value, fallback) {
  if (typeof value === "string") return { ...fallback, body: value };
  const val = object(value);
  if (!val) return fallback;
  return {
    title: text(val.title, fallback.title),
    body: text(val.body || val.text, fallback.body),
  };
}

function normalizeBlog(value, fallback) {
  if (typeof value === "string") return { ...fallback, draft: value };
  const val = object(value);
  if (!val) return fallback;
  return {
    title: text(val.title, fallback.title),
    outline: list(val.outline, fallback.outline),
    draft: text(val.draft || val.body, fallback.draft),
  };
}

function normalizeNewsletter(value, fallback) {
  if (typeof value === "string") return { ...fallback, body: value };
  const val = object(value);
  if (!val) return fallback;
  return {
    subject: text(val.subject || val.title, fallback.subject),
    preview: text(val.preview || val.preheader, fallback.preview),
    body: text(val.body, fallback.body),
  };
}

function normalizeReleaseNotes(value, fallback) {
  if (typeof value === "string") {
    return { title: fallback.title, sections: [{ title: "Notes", items: [value] }] };
  }
  const val = object(value);
  if (!val) return fallback;
  const sections = list(val.sections, []).map((section) => {
    const item = object(section) || {};
    return {
      title: text(item.title, "Update"),
      items: list(item.items || item.changes, item.body ? [item.body] : []),
    };
  });
  return {
    title: text(val.title, fallback.title),
    sections: sections.length ? sections : fallback.sections,
  };
}

/** Ensures every provider response is complete and safe for the active UI. */
export function normalizePackage(rawPackage, inputs) {
  const baseline = generateLocalTemplatePackage(inputs).package;
  const raw = object(rawPackage);
  if (!raw) return baseline;

  const rawProject = object(raw.project) || {};
  const rawContext = object(raw.context) || {};
  const rawStrategy = object(raw.strategy) || {};
  const rawPosts = object(raw.posts) || {};
  const rawMedia = object(raw.media) || {};
  const rawPublishing = object(raw.publishing) || {};

  const normalized = {
    project: {
      name: text(rawProject.name || raw.project_name, baseline.project.name),
      oneLine: text(rawProject.oneLine || rawProject.one_line, baseline.project.oneLine),
      description: text(rawProject.description || raw.description, baseline.project.description),
      audience: text(rawProject.audience, baseline.project.audience),
      category: text(rawProject.category, baseline.project.category),
      stage: text(rawProject.stage, baseline.project.stage),
    },
    context: {
      confirmedFacts: list(rawContext.confirmedFacts || rawContext.confirmed_facts, baseline.context.confirmedFacts),
      inferredFacts: list(rawContext.inferredFacts || rawContext.inferred_facts, baseline.context.inferredFacts),
      missingContext: list(rawContext.missingContext || rawContext.missing_context, baseline.context.missingContext),
      features: list(rawContext.features, baseline.context.features),
      techStack: list(rawContext.techStack || rawContext.tech_stack, baseline.context.techStack),
      repoInsights: list(rawContext.repoInsights || rawContext.repo_insights, baseline.context.repoInsights),
      docsInsights: list(rawContext.docsInsights || rawContext.docs_insights, baseline.context.docsInsights),
      linkInsights: list(rawContext.linkInsights || rawContext.link_insights, baseline.context.linkInsights),
      mediaInsights: list(rawContext.mediaInsights || rawContext.media_insights, baseline.context.mediaInsights),
    },
    strategy: {
      coreAngle: text(rawStrategy.coreAngle || rawStrategy.core_angle, baseline.strategy.coreAngle),
      positioning: text(rawStrategy.positioning, baseline.strategy.positioning),
      hooks: list(rawStrategy.hooks, baseline.strategy.hooks),
      proofPoints: list(rawStrategy.proofPoints || rawStrategy.proof_points, baseline.strategy.proofPoints),
      risks: list(rawStrategy.risks, baseline.strategy.risks),
      safeClaims: list(rawStrategy.safeClaims || rawStrategy.safe_claims, baseline.strategy.safeClaims),
      avoidClaims: list(rawStrategy.avoidClaims || rawStrategy.avoid_claims, baseline.strategy.avoidClaims),
    },
    posts: {
      linkedin: normalizeLinkedIn(rawPosts.linkedin, baseline.posts.linkedin),
      x: normalizeX(rawPosts.x || rawPosts.twitter, baseline.posts.x),
      instagram: normalizeInstagram(rawPosts.instagram, baseline.posts.instagram),
      reddit: normalizeReddit(rawPosts.reddit, baseline.posts.reddit),
      facebook: normalizeSimpleBody(rawPosts.facebook, baseline.posts.facebook),
      threads: normalizeSimpleBody(rawPosts.threads, baseline.posts.threads),
      youtube: normalizeYouTube(rawPosts.youtube, baseline.posts.youtube),
      tiktok: normalizeTikTok(rawPosts.tiktok, baseline.posts.tiktok),
      hackernews: normalizeHackerNews(rawPosts.hackernews || rawPosts.hacker_news || rawPosts.hn, baseline.posts.hackernews),
      blog: normalizeBlog(rawPosts.blog, baseline.posts.blog),
      newsletter: normalizeNewsletter(rawPosts.newsletter, baseline.posts.newsletter),
      releaseNotes: normalizeReleaseNotes(rawPosts.releaseNotes || rawPosts.release_notes, baseline.posts.releaseNotes),
    },
    media: {
      screenshotPlan: list(rawMedia.screenshotPlan || rawMedia.screenshot_plan, baseline.media.screenshotPlan),
      videoScript: list(rawMedia.videoScript || rawMedia.video_script, baseline.media.videoScript),
      voiceoverScript: list(rawMedia.voiceoverScript || rawMedia.voiceover_script, baseline.media.voiceoverScript),
      shotList: list(rawMedia.shotList || rawMedia.shot_list, baseline.media.shotList),
      recordingGuide: list(rawMedia.recordingGuide || rawMedia.recording_guide, baseline.media.recordingGuide),
      carouselPlan: list(rawMedia.carouselPlan || rawMedia.carousel_plan, baseline.media.carouselPlan),
      thumbnailIdeas: list(rawMedia.thumbnailIdeas || rawMedia.thumbnail_ideas, baseline.media.thumbnailIdeas),
      videoTimeline: list(rawMedia.videoTimeline || rawMedia.videoEditingTimeline || rawMedia.video_timeline, baseline.media.videoTimeline),
      altText: list(rawMedia.altText || rawMedia.alt_text, baseline.media.altText),
      assetChecklist: list(rawMedia.assetChecklist || rawMedia.asset_checklist, baseline.media.assetChecklist),
      videoPrompt: text(rawMedia.videoPrompt || rawMedia.video_prompt, ""),
      thumbnailPrompt: text(rawMedia.thumbnailPrompt || rawMedia.thumbnail_prompt, baseline.media.thumbnailPrompt),
    },
    publishing: {
      platformChecklist: list(rawPublishing.platformChecklist || rawPublishing.platform_checklist, baseline.publishing.platformChecklist),
      manualPostingSteps: list(rawPublishing.manualPostingSteps || rawPublishing.manual_posting_steps, baseline.publishing.manualPostingSteps),
      apiPublishingNotes: text(rawPublishing.apiPublishingNotes || rawPublishing.api_publishing_notes, baseline.publishing.apiPublishingNotes),
      warnings: list(rawPublishing.warnings, baseline.publishing.warnings),
    },
  };

  if (!normalized.media.videoPrompt) {
    normalized.media.videoPrompt = buildVideoPrompt(normalized);
  }

  return normalized;
}
