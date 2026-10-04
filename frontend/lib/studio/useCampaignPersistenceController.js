"use client";

import { useMemo } from "react";
import { createBrowserCampaignApplication } from "../application/browserCampaignApplication.mjs";
import { downloadBinary, downloadText } from "../browser/browserDownload.mjs";
import { createSourceSnapshot } from "./clientReliability.mjs";
import { channelMeta } from "./studioCatalog.mjs";

const LIBRARY_KEY = "signalflow_recovery_library";

export function useCampaignPersistenceController({
  campaignState,
  form,
  channels,
  files,
  documentText,
  publishOptions,
  currentCampaignId,
  setCurrentCampaignId,
  currentSourceSnapshot,
  exportBlockedReason,
  dispatchCampaign,
  setBusy,
  setMessage,
}) {
  const {
    result,
    generationRun,
    posts,
    generatedPosts,
    channelStates,
    archives,
    revision,
    savedRevision,
    exportedRevision,
    lastSavedAt,
    lastExportedAt,
    savedSourceFingerprint,
  } = campaignState;

  const campaignApplication = useMemo(() => createBrowserCampaignApplication({
    getStorage: () => window.localStorage,
    key: LIBRARY_KEY,
    limit: 30,
  }), []);

  function currentEditorState(overrides = {}) {
    return {
      revision,
      savedRevision,
      exportedRevision,
      lastSavedAt,
      lastExportedAt,
      savedSourceFingerprint,
      ...overrides,
    };
  }

  function currentCampaignInput(overrides = {}) {
    return {
      campaignId: currentCampaignId,
      title: form.projectName.trim() || result?.package?.project?.name || "Untitled campaign",
      channels: [...channels],
      posts: { ...posts },
      generatedPosts: { ...generatedPosts },
      channelStates: structuredClone(channelStates),
      archives: structuredClone(archives),
      result,
      generationRun,
      editorState: currentEditorState(),
      brief: { ...form },
      publishOptions,
      ...createSourceSnapshot(files, documentText),
      ...overrides,
    };
  }

  async function persistCampaign({ asCopy = false } = {}) {
    if (!result) return;
    const savedAt = new Date().toISOString();
    const input = currentCampaignInput({
      updatedAt: savedAt,
      editorState: currentEditorState({
        savedRevision: revision,
        lastSavedAt: savedAt,
        savedSourceFingerprint: currentSourceSnapshot.fingerprint,
      }),
    });

    try {
      const saved = asCopy
        ? await campaignApplication.saveAsCopy(input)
        : await campaignApplication.saveCampaign(input);
      setCurrentCampaignId(saved.campaignId);
      dispatchCampaign({
        type: "MARK_SAVED",
        payload: { savedAt, sourceFingerprint: currentSourceSnapshot.fingerprint },
      });
      setMessage({
        type: "success",
        text: asCopy
          ? "Saved as a separate local campaign copy. The original remains unchanged."
          : "Campaign saved to your local library.",
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: `The browser could not save this campaign${error?.name === "QuotaExceededError" ? " because local storage is full" : ""}. Export Markdown or JSON now before leaving this page.`,
      });
    }
  }

  async function saveCampaign() {
    await persistCampaign();
  }

  async function saveCampaignAsCopy() {
    await persistCampaign({ asCopy: true });
  }

  function exportMarkdown() {
    if (exportBlockedReason) {
      setMessage({ type: "warning", text: exportBlockedReason });
      return;
    }
    try {
      const projection = campaignApplication.projectMarkdown(currentCampaignInput());
      downloadText(projection.filename, projection.content, projection.mimeType);
      dispatchCampaign({ type: "MARK_EXPORTED", payload: { exportedAt: new Date().toISOString() } });
      setMessage({ type: "success", text: "Current campaign revision exported as Markdown." });
    } catch {
      setMessage({ type: "error", text: "SignalFlow could not project the current campaign into Markdown." });
    }
  }

  function exportJson() {
    if (exportBlockedReason) {
      setMessage({ type: "warning", text: exportBlockedReason });
      return;
    }
    try {
      const projection = campaignApplication.projectJson(currentCampaignInput());
      downloadText(projection.filename, projection.content, projection.mimeType);
      dispatchCampaign({ type: "MARK_EXPORTED", payload: { exportedAt: new Date().toISOString() } });
      setMessage({ type: "success", text: "Current campaign revision exported as versioned JSON." });
    } catch {
      setMessage({ type: "error", text: "SignalFlow could not project the current campaign into JSON." });
    }
  }

  async function exportZip() {
    if (exportBlockedReason) {
      setMessage({ type: "warning", text: exportBlockedReason });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const projection = await campaignApplication.projectZip(currentCampaignInput());
      downloadBinary(projection.filename, projection.content, projection.mimeType);
      const exportedAt = new Date().toISOString();
      dispatchCampaign({ type: "MARK_EXPORTED", payload: { exportedAt } });
      const failedChannels = projection.summary?.failedChannels || [];
      setMessage({
        type: failedChannels.length ? "warning" : "success",
        text: failedChannels.length
          ? `ZIP exported with ${projection.summary.channelCount} destinations. ${failedChannels.map((channel) => channelMeta(channel).label).join(", ")} are included with explicit failure status instead of substitute content.`
          : `ZIP exported with ${projection.summary.channelCount} destinations and ${projection.summary.fileCount} files.`,
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: `SignalFlow could not build the ZIP archive. Your current drafts are unchanged. ${error.message || "Try Markdown or JSON export instead."}`,
      });
    } finally {
      setBusy(false);
    }
  }

  return {
    saveCampaign,
    saveCampaignAsCopy,
    exportMarkdown,
    exportJson,
    exportZip,
  };
}
