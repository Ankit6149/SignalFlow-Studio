export const CAMPAIGN_STATE_SCHEMA_VERSION = 2;

const ARCHIVE_LIMIT = 20;

function clone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function text(value) {
  return String(value ?? "").replace(/\r\n?/g, "\n");
}

function requirePayload(action) {
  if (!action?.payload || typeof action.payload !== "object") {
    throw new Error(`Campaign action ${action?.type || "unknown"} requires a payload.`);
  }
  return action.payload;
}

function qualityState(result, channel, fallback = "generated") {
  return String(result?.generation_status?.[channel]?.status || fallback || "generated");
}

function createChannelState({
  generatedContent = "",
  currentContent = "",
  status = "generated",
  approved = false,
  generationRunId = "",
} = {}) {
  const generated = text(generatedContent);
  const current = text(currentContent);
  const edited = current !== generated;
  return {
    status: String(status || "generated"),
    edited,
    approved: Boolean(approved && !edited),
    generationRunId: String(generationRunId || ""),
  };
}

function createChannelStates({ requestedChannels = [], posts = {}, result = {}, generationRun = null } = {}) {
  const channels = Array.from(new Set([
    ...(Array.isArray(requestedChannels) ? requestedChannels : []),
    ...Object.keys(result?.generation_status || {}),
    ...Object.keys(posts || {}),
  ].map((channel) => String(channel || "").trim()).filter(Boolean)));

  return Object.fromEntries(channels.map((channel) => [channel, createChannelState({
    generatedContent: posts[channel] || "",
    currentContent: posts[channel] || "",
    status: qualityState(result, channel, posts[channel] ? "generated" : "failed"),
    generationRunId: generationRun?.generationRunId || "",
  })]));
}

function archiveSnapshot(state, { archiveId, createdAt, reason }) {
  if (!state.result || !archiveId || !createdAt) return null;
  return {
    archiveId: String(archiveId),
    createdAt: String(createdAt),
    reason: String(reason || "regeneration"),
    generationRun: clone(state.generationRun),
    result: clone(state.result),
    posts: clone(state.posts),
    generatedPosts: clone(state.generatedPosts),
    channelStates: clone(state.channelStates),
    activeChannel: state.activeChannel,
    revision: state.revision,
  };
}

function appendArchive(state, archive) {
  if (!archive) return state.archives;
  return [archive, ...state.archives.filter((item) => item.archiveId !== archive.archiveId)].slice(0, ARCHIVE_LIMIT);
}

function mergeGenerationResult(previous, next) {
  if (!previous) return clone(next);
  return clone({
    ...previous,
    ...next,
    warnings: Array.from(new Set([...(previous.warnings || []), ...(next.warnings || [])])),
    generation_status: {
      ...(previous.generation_status || {}),
      ...(next.generation_status || {}),
    },
    posts: {
      ...(previous.posts || {}),
      ...(next.posts || {}),
    },
  });
}

export function createInitialCampaignState() {
  return {
    schemaVersion: CAMPAIGN_STATE_SCHEMA_VERSION,
    stage: "source",
    result: null,
    generationRun: null,
    posts: {},
    generatedPosts: {},
    channelStates: {},
    activeChannel: "linkedin",
    archives: [],
    revision: 0,
    savedRevision: null,
    exportedRevision: null,
    lastSavedAt: null,
    lastExportedAt: null,
    savedSourceFingerprint: "",
  };
}

export function campaignReducer(state, action) {
  switch (action?.type) {
    case "RESET_CAMPAIGN":
      return createInitialCampaignState();

    case "SET_STAGE":
      return { ...state, stage: String(action.stage || "source") };

    case "SET_ACTIVE_CHANNEL":
      return { ...state, activeChannel: String(action.channel || state.activeChannel) };

    case "EDIT_POST": {
      const channel = String(action.channel || "").trim();
      if (!channel) return state;
      const nextText = text(action.text);
      if (state.posts[channel] === nextText) return state;
      const generated = state.generatedPosts[channel] || "";
      const previousStatus = state.channelStates[channel] || {};
      return {
        ...state,
        posts: { ...state.posts, [channel]: nextText },
        channelStates: {
          ...state.channelStates,
          [channel]: {
            ...previousStatus,
            status: previousStatus.status === "failed" ? "needs_review" : previousStatus.status || "needs_review",
            edited: nextText !== generated,
            approved: false,
          },
        },
        revision: state.revision + 1,
      };
    }

    case "MARK_CHANNEL_APPROVED": {
      const channel = String(action.channel || "").trim();
      if (!channel || !state.posts[channel]) return state;
      const previous = state.channelStates[channel] || {};
      if (previous.approved) return state;
      return {
        ...state,
        channelStates: {
          ...state.channelStates,
          [channel]: { ...previous, approved: true },
        },
        revision: state.revision + 1,
      };
    }

    case "MARK_CHANNEL_NEEDS_REVIEW": {
      const channel = String(action.channel || "").trim();
      if (!channel) return state;
      const previous = state.channelStates[channel] || {};
      if (!previous.approved && previous.status === "needs_review") return state;
      return {
        ...state,
        channelStates: {
          ...state.channelStates,
          [channel]: { ...previous, approved: false, status: "needs_review" },
        },
        revision: state.revision + 1,
      };
    }

    case "RESTORE_GENERATED": {
      const channel = String(action.channel || "").trim();
      const generated = state.generatedPosts[channel];
      if (!channel || typeof generated !== "string" || state.posts[channel] === generated) return state;
      return {
        ...state,
        posts: { ...state.posts, [channel]: generated },
        channelStates: {
          ...state.channelStates,
          [channel]: {
            ...(state.channelStates[channel] || {}),
            edited: false,
            approved: false,
            status: state.channelStates[channel]?.status === "failed" ? "needs_review" : state.channelStates[channel]?.status || "generated",
          },
        },
        revision: state.revision + 1,
      };
    }

    case "ACCEPT_GENERATION": {
      const payload = requirePayload(action);
      const generatedPosts = { ...(payload.posts || {}) };
      return {
        ...state,
        stage: "review",
        result: clone(payload.result),
        generationRun: clone(payload.generationRun),
        posts: generatedPosts,
        generatedPosts,
        channelStates: createChannelStates({
          requestedChannels: payload.requestedChannels,
          posts: generatedPosts,
          result: payload.result,
          generationRun: payload.generationRun,
        }),
        activeChannel: payload.activeChannel,
        archives: [],
        revision: state.revision + 1,
        savedRevision: null,
        exportedRevision: null,
        lastSavedAt: null,
        lastExportedAt: null,
        savedSourceFingerprint: "",
      };
    }

    case "APPLY_REGENERATION": {
      const payload = requirePayload(action);
      const targetChannels = Array.from(new Set((payload.targetChannels || Object.keys(payload.posts || {}))
        .map((channel) => String(channel || "").trim())
        .filter(Boolean)));
      if (!targetChannels.length) return state;

      const nextPosts = { ...state.posts };
      const nextGeneratedPosts = { ...state.generatedPosts };
      const nextChannelStates = clone(state.channelStates);
      let changed = false;

      for (const channel of targetChannels) {
        const status = qualityState(payload.result, channel, payload.posts?.[channel] ? "regenerated" : "failed");
        if (typeof payload.posts?.[channel] === "string" && payload.posts[channel].trim()) {
          nextPosts[channel] = payload.posts[channel];
          nextGeneratedPosts[channel] = payload.posts[channel];
          nextChannelStates[channel] = createChannelState({
            generatedContent: payload.posts[channel],
            currentContent: payload.posts[channel],
            status,
            generationRunId: payload.generationRun?.generationRunId || "",
          });
          changed = true;
        } else if (status === "failed") {
          nextChannelStates[channel] = {
            ...(nextChannelStates[channel] || {}),
            status: "failed",
            approved: false,
          };
          changed = true;
        }
      }

      if (!changed) return state;
      const archive = archiveSnapshot(state, {
        archiveId: payload.archiveId,
        createdAt: payload.archivedAt,
        reason: payload.policy || "regeneration",
      });
      return {
        ...state,
        stage: "review",
        result: mergeGenerationResult(state.result, payload.result),
        generationRun: clone(payload.generationRun),
        posts: nextPosts,
        generatedPosts: nextGeneratedPosts,
        channelStates: nextChannelStates,
        archives: appendArchive(state, archive),
        activeChannel: payload.activeChannel || state.activeChannel,
        revision: state.revision + 1,
      };
    }

    case "RESTORE_ARCHIVE": {
      const payload = requirePayload(action);
      const selected = state.archives.find((archive) => archive.archiveId === payload.archiveId);
      if (!selected) return state;
      const currentArchive = archiveSnapshot(state, {
        archiveId: payload.currentArchiveId,
        createdAt: payload.restoredAt,
        reason: "before_archive_restore",
      });
      return {
        ...state,
        stage: "review",
        result: clone(selected.result),
        generationRun: clone(selected.generationRun),
        posts: clone(selected.posts),
        generatedPosts: clone(selected.generatedPosts),
        channelStates: clone(selected.channelStates),
        archives: appendArchive(state, currentArchive),
        activeChannel: selected.activeChannel || state.activeChannel,
        revision: state.revision + 1,
      };
    }

    case "DISCARD_ARCHIVE": {
      const archiveId = String(action.archiveId || "");
      if (!archiveId || !state.archives.some((archive) => archive.archiveId === archiveId)) return state;
      return {
        ...state,
        archives: state.archives.filter((archive) => archive.archiveId !== archiveId),
        revision: state.revision + 1,
      };
    }

    case "MARK_SAVED": {
      const payload = requirePayload(action);
      return {
        ...state,
        savedRevision: state.revision,
        lastSavedAt: payload.savedAt,
        savedSourceFingerprint: String(payload.sourceFingerprint || ""),
      };
    }

    case "MARK_EXPORTED": {
      const payload = requirePayload(action);
      return {
        ...state,
        exportedRevision: state.revision,
        lastExportedAt: payload.exportedAt,
      };
    }

    case "RESTORE_CAMPAIGN": {
      const payload = requirePayload(action);
      const revision = Number.isInteger(payload.revision) ? payload.revision : 1;
      return {
        ...state,
        stage: "review",
        result: clone(payload.result),
        generationRun: clone(payload.generationRun),
        posts: { ...(payload.posts || {}) },
        generatedPosts: { ...(payload.generatedPosts || payload.posts || {}) },
        channelStates: clone(payload.channelStates || createChannelStates({
          requestedChannels: Object.keys(payload.posts || {}),
          posts: payload.generatedPosts || payload.posts || {},
          result: payload.result,
          generationRun: payload.generationRun,
        })),
        activeChannel: payload.activeChannel || "linkedin",
        archives: clone(payload.archives || []),
        revision,
        savedRevision: Number.isInteger(payload.savedRevision) ? payload.savedRevision : revision,
        exportedRevision: Number.isInteger(payload.exportedRevision) ? payload.exportedRevision : null,
        lastSavedAt: payload.lastSavedAt || null,
        lastExportedAt: payload.lastExportedAt || null,
        savedSourceFingerprint: String(payload.savedSourceFingerprint || payload.generationRun?.sourceFingerprint || ""),
      };
    }

    default:
      return state;
  }
}
