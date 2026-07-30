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

function canonicalChannel(value) {
  const channel = text(value).toLowerCase();
  if (["releasenotes", "release-notes", "release_notes"].includes(channel)) return "release_notes";
  if (["hn", "hacker-news", "hacker_news"].includes(channel)) return "hackernews";
  return channel;
}

function stringList(value) {
  return Array.from(new Set((Array.isArray(value) ? value : [])
    .map(canonicalChannel)
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

function revisionId(campaignId, channel, origin, content, createdAt = "") {
  return `revision-${fnv1a64(`${campaignId}:${channel}:${origin}:${content}:${createdAt}`)}`;
}

function createRevision({ campaignId, channel, content, origin, createdAt }) {
  return createDomainRecord("DraftRevision", {
    revisionId: revisionId(campaignId, channel, origin, content, createdAt),
    content,
    origin,
    createdAt,
  });
}

function pushUniqueRevision(history, revision) {
  if (!revision?.content) return history;
  if (history.some((item) => item?.content === revision.content && item?.origin === revision.origin)) return history;
  history.push(revision);
  return history;
}

function createDraft({
  campaignId,
  channel,
  currentContent,
  generatedContent,
  qualityState,
  updatedAt,
  existingDraft = null,
  draftState = null,
  generationRunId = "",
}) {
  const existingGenerated = text(existingDraft?.generated?.content);
  const generated = text(generatedContent, existingGenerated || text(currentContent));
  const current = text(currentContent, generated);
  const history = Array.isArray(existingDraft?.history)
    ? portableClone(existingDraft.history)
    : [];

  if (existingDraft?.generated?.content && existingDraft.generated.content !== generated) {
    pushUniqueRevision(history, createRevision({
      campaignId,
      channel,
      content: existingDraft.generated.content,
      origin: "generated",
      createdAt: existingDraft.generated.createdAt || existingDraft.updatedAt || updatedAt,
    }));
  }

  if (existingDraft?.current?.content && existingDraft.current.content !== current) {
    pushUniqueRevision(history, createRevision({
      campaignId,
      channel,
      content: existingDraft.current.content,
      origin: existingDraft.current.origin || "edited",
      createdAt: existingDraft.current.createdAt || existingDraft.updatedAt || updatedAt,
    }));
  }

  const edited = current !== generated;
  const generatedRevision = createRevision({
    campaignId,
    channel,
    content: generated,
    origin: "generated",
    createdAt: draftState?.generatedAt || updatedAt,
  });
  const currentRevision = createRevision({
    campaignId,
    channel,
    content: current,
    origin: edited ? "edited" : "generated",
    createdAt: updatedAt,
  });

  if (edited) pushUniqueRevision(history, generatedRevision);

  return createDomainRecord("ChannelDraft", {
    draftId: `draft-${fnv1a64(`${campaignId}:${channel}`)}`,
    campaignId,
    channel,
    qualityState: text(qualityState, "unknown"),
    generated: generatedRevision,
    current: currentRevision,
    history,
    edited,
    approved: Boolean(draftState?.approved ?? existingDraft?.approved),
    generationRunId: text(draftState?.generationRunId || generationRunId || existingDraft?.generationRunId),
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

function cleanChannelStates(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([channel, state]) => [canonicalChannel(channel), {
    status: text(state?.status, "generated"),
    edited: Boolean(state?.edited),
    approved: Boolean(state?.approved),
    generationRunId: text(state?.generationRunId),
  }]));
}

function cleanEditorState(value = {}, fallback = {}) {
  const revision = Number.isInteger(value.revision) ? value.revision : Number.isInteger(fallback.revision) ? fallback.revision : 1;
  return portableClone({
    revision,
    savedRevision: Number.isInteger(value.savedRevision) ? value.savedRevision : revision,
    exportedRevision: Number.isInteger(value.exportedRevision) ? value.exportedRevision : null,
    lastSavedAt: value.lastSavedAt || fallback.lastSavedAt || null,
    lastExportedAt: value.lastExportedAt || fallback.lastExportedAt || null,
    savedSourceFingerprint: text(value.savedSourceFingerprint || fallback.savedSourceFingerprint),
  });
}

function cleanArchive(archive = {}) {
  const posts = portableClone(archive.posts || {});
  const generatedPosts = portableClone(archive.generatedPosts || posts);
  return portableClone({
    archiveId: text(archive.archiveId, `archive-${fnv1a64(stableStringify(archive))}`),
    createdAt: archive.createdAt || new Date(0).toISOString(),
    reason: text(archive.reason, "regeneration"),
    generationRun: archive.generationRun ? portableClone(archive.generationRun) : null,
    result: stripDuplicateGenerationFields(archive.result || {}),
    posts,
    generatedPosts,
    channelStates: cleanChannelStates(archive.channelStates || {}),
    activeChannel: canonicalChannel(archive.activeChannel || Object.keys(posts)[0] || DEFAULT_CHANNEL),
    revision: Number.isInteger(archive.revision) ? archive.revision : 0,
  });
}

function cleanArchives(input = [], existing = []) {
  const combined = [...(Array.isArray(input) ? input : []), ...(Array.isArray(existing) ? existing : [])];
  const byId = new Map();
  for (const item of combined) {
    const archive = cleanArchive(item);
    if (!byId.has(archive.archiveId)) byId.set(archive.archiveId, archive);
  }
  return Array.from(byId.values())
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
    .slice(0, 20);
}

export function currentPostsFromCampaign(campaign) {
  const parsed = parseDomainRecord(campaign, "Campaign");
  return Object.fromEntries(
    Object.entries(parsed.drafts || {}).map(([channel, draft]) => [channel, text(draft?.current?.content)]),
  );
}

export function generatedPostsFromCampaign(campaign) {
  const parsed = parseDomainRecord(campaign, "Campaign");
  return Object.fromEntries(
    Object.entries(parsed.drafts || {}).map(([channel, draft]) => [
      channel,
      text(draft?.generated?.content || (draft?.current?.origin === "generated" ? draft.current.content : ""), draft?.current?.content || ""),
    ]),
  );
}

export function channelStatesFromCampaign(campaign) {
  const parsed = parseDomainRecord(campaign, "Campaign");
  return Object.fromEntries(Object.entries(parsed.drafts || {}).map(([channel, draft]) => {
    const generated = text(draft?.generated?.content, draft?.current?.content || "");
    const current = text(draft?.current?.content);
    return [channel, {
      status: text(draft?.qualityState, "generated"),
      edited: current !== generated,
      approved: Boolean(draft?.approved),
      generationRunId: text(draft?.generationRunId),
    }];
  }));
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
  const generatedPosts = input.generatedPosts || input.result?.posts || {};
  const statuses = input.result?.generation_status || input.generationStatus || {};
  const draftStates = cleanChannelStates(input.channelStates || {});
  const drafts = {};

  for (const channel of activeChannels) {
    const currentContent = text(authoritativePosts[channel]);
    const generatedContent = text(generatedPosts[channel], currentContent);
    if (!currentContent && !generatedContent) continue;
    drafts[channel] = createDraft({
      campaignId,
      channel,
      currentContent,
      generatedContent,
      qualityState: draftStates[channel]?.status || statuses[channel]?.status || input.existingDrafts?.[channel]?.qualityState,
      updatedAt,
      existingDraft: input.existingDrafts?.[channel] || null,
      draftState: draftStates[channel] || null,
      generationRunId: generationRun?.generationRunId || "",
    });
  }

  if (!Object.keys(drafts).length) {
    throw new TypeError("Campaign requires at least one authoritative current draft.");
  }

  const sourceSnapshot = sourceSnapshotFrom({ ...input, updatedAt }, input.generationRun);
  const generationResult = stripDuplicateGenerationFields(input.result || {});
  const warnings = Array.from(new Set((input.warnings || input.result?.warnings || []).map(text).filter(Boolean)));
  const firstDraft = drafts[activeChannels.find((channel) => drafts[channel]) || Object.keys(drafts)[0]];
  const editorState = cleanEditorState(input.editorState || {}, {
    lastSavedAt: input.lastSavedAt || updatedAt,
    lastExportedAt: input.lastExportedAt || null,
    savedSourceFingerprint: input.savedSourceFingerprint || generationRun?.sourceFingerprint || "",
  });

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
    archives: cleanArchives(input.archives, input.existingArchives),
    editorState,
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
  const posts = Object.fromEntries(
    channels
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
    editorState: {
      revision: 1,
      savedRevision: 1,
      exportedRevision: 1,
      lastSavedAt: createdAt,
      lastExportedAt: createdAt,
    },
    createdAt,
    updatedAt: createdAt,
  });
}

export function migrateLegacyCampaign(input) {
  if (input?.kind === "Campaign" && input?.schemaVersion === DOMAIN_SCHEMA_VERSION) {
    const parsed = parseDomainRecord(input, "Campaign");
    const posts = currentPostsFromCampaign(parsed);
    const generatedPosts = generatedPostsFromCampaign(parsed);
    return createCampaignAggregate({
      ...parsed,
      posts,
      generatedPosts,
      channelStates: channelStatesFromCampaign(parsed),
      existingDrafts: parsed.drafts,
      existingArchives: parsed.archives,
      editorState: parsed.editorState || {
        revision: 1,
        savedRevision: 1,
        lastSavedAt: parsed.updatedAt,
        savedSourceFingerprint: parsed.generationRun?.sourceFingerprint || "",
      },
      result: {
        ...parsed.generationResult,
        providerUsed: parsed.providerUsed,
        modelUsed: parsed.modelUsed,
        warnings: parsed.warnings,
        generation_status: Object.fromEntries(Object.entries(parsed.drafts || {}).map(([channel, draft]) => [channel, { status: draft.qualityState || "generated" }])),
      },
      generationRun: parsed.generationRun
        ? { ...parsed.generationRun, sourceSnapshot: parsed.sourceSnapshot }
        : null,
      sourceSnapshot: parsed.sourceSnapshot,
      createdAt: parsed.createdAt,
      updatedAt: parsed.updatedAt,
    });
  }

  const sourceFiles = input?.sourceSnapshot?.sourceFiles || input?.sourceFiles || input?.files || [];
  const posts = input?.posts || {};
  const generatedPosts = input?.generatedPosts || input?.result?.posts || posts;
  const legacyRevision = Math.max(1, Number(input?.revision) || 1);
  return createCampaignAggregate({
    campaignId: input?.campaignId || input?.id,
    title: input?.title,
    channels: input?.channels,
    posts,
    generatedPosts,
    channelStates: input?.channelStates || {},
    result: input?.result || {
      providerUsed: input?.providerUsed,
      warnings: input?.warnings || [],
      posts: generatedPosts,
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
    archives: input?.archives || [],
    editorState: input?.editorState || {
      revision: legacyRevision,
      savedRevision: legacyRevision,
      exportedRevision: null,
      lastSavedAt: input?.updatedAt || input?.createdAt || null,
      lastExportedAt: null,
      savedSourceFingerprint: input?.generationRun?.sourceFingerprint || "",
    },
    createdAt: input?.createdAt || input?.updatedAt || new Date(0).toISOString(),
    updatedAt: input?.updatedAt || input?.createdAt || new Date(0).toISOString(),
  });
}

export function campaignToEditorState(input) {
  const campaign = migrateLegacyCampaign(input);
  const posts = currentPostsFromCampaign(campaign);
  const generatedPosts = generatedPostsFromCampaign(campaign);
  const channelStates = channelStatesFromCampaign(campaign);
  const result = portableClone({
    ...campaign.generationResult,
    providerUsed: campaign.providerUsed,
    modelUsed: campaign.modelUsed,
    warnings: campaign.warnings,
    posts: generatedPosts,
    generation_status: Object.fromEntries(Object.entries(channelStates).map(([channel, state]) => [channel, { status: state.status }])),
    package: campaign.generationResult?.package
      ? { ...campaign.generationResult.package, posts: {} }
      : null,
  });
  return {
    campaignId: campaign.campaignId,
    title: campaign.title,
    channels: campaign.channels,
    posts,
    generatedPosts,
    channelStates,
    result,
    generationRun: campaign.generationRun
      ? { ...campaign.generationRun, sourceSnapshot: campaign.sourceSnapshot }
      : null,
    archives: portableClone(campaign.archives || []),
    revision: campaign.editorState?.revision || 1,
    savedRevision: campaign.editorState?.savedRevision ?? campaign.editorState?.revision ?? 1,
    exportedRevision: campaign.editorState?.exportedRevision ?? null,
    lastSavedAt: campaign.editorState?.lastSavedAt || campaign.updatedAt,
    lastExportedAt: campaign.editorState?.lastExportedAt || null,
    savedSourceFingerprint: campaign.editorState?.savedSourceFingerprint || campaign.generationRun?.sourceFingerprint || "",
    brief: campaign.brief,
    publishOptions: campaign.publishOptions,
    sourceFiles: campaign.sourceFiles,
    documentText: campaign.documentText,
  };
}
