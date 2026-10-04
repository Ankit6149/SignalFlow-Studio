"use client";

import { createContext, useContext, useReducer, useState } from "react";
import {
  campaignReducer,
  createInitialCampaignState,
} from "./campaignState.mjs";
import { DEFAULT_CHANNELS } from "./studioCatalog.mjs";

const CampaignEditorSessionContext = createContext(null);

function initialForm() {
  return {
    projectName: "",
    notes: "",
    audience: "Founders, builders, and early users",
    links: "",
    repo: "",
    provider: "gemini",
    apiKey: "",
    model: "",
    baseUrl: "",
  };
}

function initialPublishOptions() {
  return {
    reddit: { subreddit: "", title: "" },
  };
}

export function CampaignEditorSessionProvider({ children }) {
  const [campaignState, dispatchCampaign] = useReducer(
    campaignReducer,
    undefined,
    createInitialCampaignState,
  );
  const [form, setForm] = useState(initialForm);
  const [channels, setChannels] = useState(DEFAULT_CHANNELS);
  const [files, setFiles] = useState([]);
  const [documentText, setDocumentText] = useState([]);
  const [strategyReview, setStrategyReview] = useState(null);
  const [currentCampaignId, setCurrentCampaignId] = useState("");
  const [publishOptions, setPublishOptions] = useState(initialPublishOptions);

  function resetEditorSession() {
    setCurrentCampaignId("");
    dispatchCampaign({ type: "RESET_CAMPAIGN" });
    setForm(initialForm());
    setChannels(DEFAULT_CHANNELS);
    setFiles([]);
    setDocumentText([]);
    setStrategyReview(null);
    setPublishOptions(initialPublishOptions());
  }

  function restoreEditorSession(restored) {
    setCurrentCampaignId(restored.campaignId);
    setForm((previous) => ({ ...previous, ...restored.brief, apiKey: "" }));
    setChannels(restored.channels);
    dispatchCampaign({
      type: "RESTORE_CAMPAIGN",
      payload: {
        posts: restored.posts,
        generatedPosts: restored.generatedPosts,
        channelStates: restored.channelStates,
        archives: restored.archives,
        result: restored.result,
        generationRun: restored.generationRun,
        revision: restored.revision,
        savedRevision: restored.savedRevision,
        exportedRevision: restored.exportedRevision,
        lastSavedAt: restored.lastSavedAt,
        lastExportedAt: restored.lastExportedAt,
        savedSourceFingerprint: restored.savedSourceFingerprint,
        activeChannel: restored.channels[0] || "linkedin",
      },
    });
    setPublishOptions(restored.publishOptions || initialPublishOptions());
    setFiles(restored.sourceFiles || []);
    setDocumentText(restored.documentText || []);
    setStrategyReview(null);
  }

  return (
    <CampaignEditorSessionContext.Provider
      value={{
        campaignState,
        dispatchCampaign,
        form,
        setForm,
        channels,
        setChannels,
        files,
        setFiles,
        documentText,
        setDocumentText,
        strategyReview,
        setStrategyReview,
        currentCampaignId,
        setCurrentCampaignId,
        publishOptions,
        setPublishOptions,
        resetEditorSession,
        restoreEditorSession,
      }}
    >
      {children}
    </CampaignEditorSessionContext.Provider>
  );
}

export function useCampaignEditorSession() {
  const session = useContext(CampaignEditorSessionContext);
  if (!session) {
    throw new Error("useCampaignEditorSession must be used inside CampaignEditorSessionProvider.");
  }
  return session;
}

export function createEmptyCampaignBrief() {
  return initialForm();
}

export function createEmptyPublishOptions() {
  return initialPublishOptions();
}
