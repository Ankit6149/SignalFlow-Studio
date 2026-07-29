export const CAMPAIGN_STATE_SCHEMA_VERSION = 1;

export function createInitialCampaignState() {
  return {
    schemaVersion: CAMPAIGN_STATE_SCHEMA_VERSION,
    stage: "source",
    result: null,
    generationRun: null,
    posts: {},
    activeChannel: "linkedin",
  };
}

function requirePayload(action) {
  if (!action?.payload || typeof action.payload !== "object") {
    throw new Error(`Campaign action ${action?.type || "unknown"} requires a payload.`);
  }
  return action.payload;
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
      return {
        ...state,
        posts: {
          ...state.posts,
          [channel]: String(action.text ?? ""),
        },
      };
    }

    case "ACCEPT_GENERATION": {
      const payload = requirePayload(action);
      return {
        ...state,
        stage: "review",
        result: payload.result,
        generationRun: payload.generationRun,
        posts: { ...payload.posts },
        activeChannel: payload.activeChannel,
      };
    }

    case "RESTORE_CAMPAIGN": {
      const payload = requirePayload(action);
      return {
        ...state,
        stage: "review",
        result: payload.result,
        generationRun: payload.generationRun,
        posts: { ...(payload.posts || {}) },
        activeChannel: payload.activeChannel || "linkedin",
      };
    }

    default:
      return state;
  }
}
