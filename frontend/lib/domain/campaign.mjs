import {
  createDomainRecord,
  DOMAIN_SCHEMA_VERSION,
  parseDomainRecord,
  portableClone,
  stableStringify,
} from "./contracts.mjs";

const DEFAULT_CHANNEL = "linkedin";

function text(value, fallback = "") {
  const normalized = String(value ?? "").replace(/\r\n?/g, "\n").trim();
  return normalized || fallback;
}

function stringList(value) {
  return Array.from(new Set((Array.isArray(value) ? value : [])
    .map((item) => text(item).toLowerCase())
    .filter(Boolean)));
}

function fnv1a64(value) {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * prime);
  }
  return hash.toString(16).padStart(16, "0");
}

export function deriveCampaignId({ campaignId = "", generationRun = null, title = "" } = {}) {
  const existing = text(campaignId);
  if (existing) return existing;
  const seed = generationRun?.generationRunId || generationRun?.sourceFingerprint || title || "untitled";
  return `campaign-${fnv1a64(String(seed))}`;
}

function cleanBrief(brief = {}) {
  return portableClone({
    projectName: text(brief.projectName),
    notes: text(brief.notes),
    audience: text(brief.audience),
    links: text(brief.links),
    repo: text(brief.repo),
    provider: text(brief.provider).toLowerCase(),
    model: text(brief.model),
    baseUrl: text(brief.baseUrl),
  });
}

function stripActiveDraftsFromPackage(pkg) {
  if (!pkg || typeof pkg !== "object" || Array.isArray(pkg)) return null;
  const { posts, ...rest } = pkg;
  void posts;
  return portableClone(rest);
}

function stripDuplicateGenerationFields(result = {}) {
  if (!result || typeof result !== "object" || Array.isArray(result)) return {};
  const {
    posts,
    markdown,
    json,
    chatbot_prompt: chatbotPrompt,
    package: pkg,
    ...rest
  } = result;
  void posts;
  void markdown;
  void json;
  void chatbotPrompt;
  return portableClone({
    ...rest,
    package: stripActiveDraftsFromPackage(pkg),
  });
}

function revisionId(campaignId, channel, origin, content) {
  return `revision-${fnv1a64(`${campaignId}:${channel}:${origin}:${content}`)}`;
}

function createRevision({ campaignId, channel, content, origin, createdAt }) {
  return createDomainRecord("DraftRevision", {
    revisionId: revisionId(campaignId, channel, origin, content),
    content,
    origin,
    createdAt,
  });
}

function createDraft({ campaignId, channel, currentContent, generatedContent, qualityState, updatedAt }) {
  const generated = text(generatedContent);
  const current = text(currentContent);
  const edited = Boolean(generated && generated !== current);
  const history = edited
    ? [createRevision({
        campaignId,
        channel,
        content: generated,
        origin: "generated",
        createdAt: updatedAt,
      })]
    : [];

  return createDomainRecord("ChannelDraft", {
    draftId: `draft-${fnv1a64(`${campaignId}:${channel}`)}`,
    campaignId,
    channel,
    qualityState: text(qualityState, "unknown"),
    current: createRevision({
      campaignId,
      channel,
      content: current,
      origin: edited ? "edited" : "generated",
      createdAt: updatedAt,
    }),
    history,
    updatedAt,
  });
}

function sourceSnapshotFrom(input, generationRun) {
  const snapshot = input.sourceSnapshot || generationRun?.sourceSnapshot || null;
  if (!snapshot) return null;
  return createDomainRecord("SourceSnapshot", {
    sourceSnapshotId: text(snapshot.sourceSnapshotId, `source-${fnv1a64(stableStringify(snapshot))}`),
    fingerprint: text(snapshot.fingerprint || generationRun?.sourceFingerprint, "unknown"),
    normalizedSource: portableClone(snapshot.normalizedSource || {}),
    createdAt: snapshot.createdAt || generationRun?.createdAt || input.updatedAt,
  });
}

function generationRunFrom(input) {
  const run = input.generationRun;
  if (!run) return null;
  return createDomainRecord("GenerationRun", {
    generationRunId: text(run.generationRunId, `run-${fnv1a64(stableStringify(run))}`),
    sourceSnapshotId: text(run.sourceSnapshotId),
    sourceFingerprint: text(run.sourceFingerprint),
    provider: text(run.provider || input.result?.providerUsed || input.providerUsed, "unknown"),
    model: text(run.model || input.result?.modelUsed),
    createdAt: run.createdAt || input.updatedAt,
  });
}

export function currentPostsFromCampaign(campaign) {
  const parsed = parseDomainRecord(campaign, "Campaign");
  return Object.fromEntries(
    Object.entries(parsed.drafts || {}).map(([channel, draft]) => [channel, text(draft?.current?.content)]),
  );
}

export function createCampaignAggregate(input = {}) {
  const updatedAt = input.updatedAt || input.generationRun?.createdAt || input.createdAt || new Date(0).toISOString();
  const createdAt = input.createdAt || updatedAt;
  const title = text(
    input.title || input.brief?.projectName || input.result?.package?.project?.name,
    "Untitled campaign",
  );
  const generationRun = generationRunFrom({ ...input, updatedAt });
  const campaignId = deriveCampaignId({
    campaignId: input.campaignId || input.id,
    generationRun,
    title,
  });
  const channels = stringList(input.channels?.length ? input.channels : Object.keys(input.posts || {}));
  const activeChannels = channels.length ? channels : [DEFAULT_CHANNEL];
  const authoritativePosts = input.posts || {};
  const generatedPosts = input.result?.posts || input.generatedPosts || {};
  const statuses = input.result?.generation_status || input.generationStatus || {};
  const drafts = {};

  for (const channel of activeChannels) {
    const currentContent = text(authoritativePosts[channel]);
    if (!currentContent) continue;
    drafts[channel] = createDraft({
      campaignId,
      channel,
      currentContent,
      generatedContent: generatedPosts[channel],
      qualityState: statuses[channel]?.status,
      updatedAt,
    });
  }

  if (!Object.keys(drafts).length) {
    throw new TypeError("Campaign requires at least one authoritative current draft.");
  }

  const sourceSnapshot = sourceSnapshotFrom({ ...input, updatedAt }, input.generationRun);
  const generationResult = stripDuplicateGenerationFields(input.result || {});
  const warnings = Array.from(new Set((input.warnings || input.result?.warnings || []).map(text).filter(Boolean)));
  const firstDraft = drafts[activeChannels.find((channel) => drafts[channel]) || Object.keys(drafts)[0]];

  return createDomainRecord("Campaign", {
    campaignId,
    workspaceId: input.workspaceId || null,
    projectId: input.projectId || null,
    title,
    status: text(input.status, "draft"),
    channels: Object.keys(drafts),
    drafts,
    sourceSnapshot,
    generationRun,
    generationResult,
    brief: cleanBrief(input.brief || {}),
    publishOptions: portableClone(input.publishOptions || {}),
    sourceFiles: portableClone(input.sourceFiles || []),
    documentText: portableClone(input.documentText || []),
    warnings,
    providerUsed: text(input.providerUsed || input.result?.providerUsed || generationRun?.provider, "unknown"),
    modelUsed: text(input.modelUsed || input.result?.modelUsed || generationRun?.model),
    preview: text(firstDraft?.current?.content).slice(0, 280),
    createdAt,
    updatedAt,
  });
}

function packagePostText(posts, channel) {
  const value = posts?.[channel === "release_notes" ? "releaseNotes" : channel];
  if (!value) return "";
  if (typeof value === "string") return value;
  if (channel === "x") return Array.isArray(value.posts) ? value.posts.join("\n\n") : text(value.body);
  if (channel === "instagram") return text(value.caption);
  if (["reddit", "hackernews"].includes(channel)) return [value.title, value.body].map(text).filter(Boolean).join("\n\n");
  if (["youtube"].includes(channel)) return [value.title, value.description].map(text).filter(Boolean).join("\n\n");
  if (channel === "tiktok") return [value.hook, value.caption].map(text).filter(Boolean).join("\n\n");
  if (channel === "newsletter") return [value.subject, value.body].map(text).filter(Boolean).join("\n\n");
  if (channel === "blog") return text(value.draft);
  if (channel === "release_notes") {
    const sections = Array.isArray(value.sections) ? value.sections : [];
    return [value.title, ...sections.map((section) => {
      const body = Array.isArray(section.items) ? section.items.join("\n") : section.items || section.body;
      return [section.title, body].map(text).filter(Boolean).join("\n");
    })].map(text).filter(Boolean).join("\n\n");
  }
  return text(value.body || value.caption || value.draft);
}

export function campaignFromPackagePayload({ package: pkg, projectName = "", metadata = {} } = {}) {
  if (!pkg || typeof pkg !== "object") throw new TypeError("Missing package object.");
  const channels = stringList(metadata.selectedChannels?.length ? metadata.selectedChannels : Object.keys(pkg.posts || {}));
  const normalizedChannels = channels.map((channel) => channel === "hackernews" ? "hackernews" : channel);
  const posts = Object.fromEntries(
    normalizedChannels
      .map((channel) => [channel, packagePostText(pkg.posts, channel)])
      .filter(([, content]) => Boolean(content)),
  );
  const createdAt = metadata.createdAt || new Date(0).toISOString();
  return createCampaignAggregate({
    title: projectName || pkg.project?.name,
    channels: Object.keys(posts),
    posts,
    generatedPosts: posts,
    result: {
      ok: true,
      providerUsed: metadata.providerUsed || "unknown",
      modelUsed: metadata.modelUsed || "",
      warnings: metadata.warnings || [],
      generation_status: Object.fromEntries(Object.keys(posts).map((channel) => [channel, { status: "generated" }])),
      package: pkg,
    },
    generationRun: metadata.generationRun || {
      generationRunId: metadata.generationRunId || `legacy-export-${fnv1a64(stableStringify(pkg))}`,
      provider: metadata.providerUsed || "unknown",
      model: metadata.modelUsed || "",
      createdAt,
    },
    createdAt,
    updatedAt: createdAt,
  });
}

export function migrateLegacyCampaign(input) {
  if (input?.kind === "Campaign" && input?.schemaVersion === DOMAIN_SCHEMA_VERSION) {
    return parseDomainRecord(input, "Campaign");
  }
  const sourceFiles = input?.sourceSnapshot?.sourceFiles || input?.sourceFiles || input?.files || [];
  return createCampaignAggregate({
    campaignId: input?.campaignId || input?.id,
    title: input?.title,
    channels: input?.channels,
    posts: input?.posts || {},
    result: input?.result || {
      providerUsed: input?.providerUsed,
      warnings: input?.warnings || [],
      posts: input?.generatedPosts || {},
      generation_status: input?.generationStatus || {},
      package: input?.package || null,
    },
    generationRun: input?.generationRun || null,
    brief: input?.brief || {},
    publishOptions: input?.publishOptions || {},
    sourceFiles,
    documentText: input?.documentText || input?.sourceSnapshot?.documentText || [],
    providerUsed: input?.providerUsed,
    warnings: input?.warnings,
    createdAt: input?.createdAt || input?.updatedAt || new Date(0).toISOString(),
    updatedAt: input?.updatedAt || input?.createdAt || new Date(0).toISOString(),
  });
}

export function campaignToEditorState(input) {
  const campaign = migrateLegacyCampaign(input);
  const posts = currentPostsFromCampaign(campaign);
  const result = portableClone({
    ...campaign.generationResult,
    providerUsed: campaign.providerUsed,
    modelUsed: campaign.modelUsed,
    warnings: campaign.warnings,
    posts,
    package: campaign.generationResult?.package
      ? { ...campaign.generationResult.package, posts: {} }
      : null,
  });
  return {
    campaignId: campaign.campaignId,
    title: campaign.title,
    channels: campaign.channels,
    posts,
    result,
    generationRun: campaign.generationRun
      ? { ...campaign.generationRun, sourceSnapshot: campaign.sourceSnapshot }
      : null,
    brief: campaign.brief,
    publishOptions: campaign.publishOptions,
    sourceFiles: campaign.sourceFiles,
    documentText: campaign.documentText,
  };
}
