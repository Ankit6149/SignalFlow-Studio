"use client";

import { selectPublishAvailability } from "./campaignStatus.mjs";
import { publishPost as publishStudioPost } from "./studioApiClient.mjs";
import { OFFICIAL_CONNECTORS } from "./studioCatalog.mjs";

export function useCampaignPublishingController({
  connections,
  campaignFreshness,
  activeChannel,
  activeMeta,
  activeChannelStatus,
  currentPost,
  isOverLimit,
  xThreadMode,
  publishOptions,
  setPublishOptions,
  projectName,
  revision,
  setBusy,
  setMessage,
  refreshConnections,
}) {
  const currentConnection = connections[activeChannel] || null;
  const currentConnectionLabel =
    currentConnection?.profile?.username ||
    currentConnection?.profile?.name ||
    currentConnection?.profile?.displayName ||
    "No connected account";

  const canPublishCurrent = Boolean(
    campaignFreshness.canUseCurrentGeneration &&
      currentConnection?.connected &&
      currentConnection?.verified &&
      currentConnection?.canPublishText &&
      currentConnection?.scopeStatus === "verified" &&
      !currentConnection?.expired &&
      !currentConnection?.manualOnly,
  );

  const publishAvailability = selectPublishAvailability({
    channelStatus: activeChannelStatus,
    isStale: campaignFreshness.isStale,
    hasContent: Boolean(currentPost),
    isOverLimit,
    connectorReady: canPublishCurrent,
    manualRoute: Boolean(activeMeta.openUrl || !OFFICIAL_CONNECTORS.has(activeChannel)),
  });

  const directPublishAvailability = selectPublishAvailability({
    channelStatus: activeChannelStatus,
    isStale: campaignFreshness.isStale,
    hasContent: Boolean(currentPost),
    isOverLimit,
    connectorReady: canPublishCurrent,
    manualRoute: false,
  });

  function updatePublishOption(platform, key, value) {
    setPublishOptions((previous) => ({
      ...previous,
      [platform]: { ...(previous[platform] || {}), [key]: value },
    }));
  }

  function reportStaleCampaign() {
    setMessage({
      type: "warning",
      text: "Source inputs changed after generation. Regenerate the campaign before copying, exporting, or publishing these drafts.",
    });
  }

  async function copyCurrentPost(showMessage = true) {
    if (campaignFreshness.isStale) {
      reportStaleCampaign();
      return false;
    }
    if (!currentPost) return false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(currentPost);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = currentPost;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
      }
    } catch {
      setMessage({ type: "error", text: "The browser blocked clipboard access. Select the draft and copy it manually." });
      return false;
    }
    if (showMessage) {
      setMessage({ type: "success", text: `${activeMeta.label} draft copied.` });
    }
    return true;
  }

  async function copyAndOpenCurrent() {
    if (campaignFreshness.isStale) {
      reportStaleCampaign();
      return;
    }
    let openedWindow = null;
    if (activeMeta.openUrl) {
      openedWindow = window.open(activeMeta.openUrl, "_blank");
      if (openedWindow) openedWindow.opener = null;
    }

    const copied = await copyCurrentPost(false);
    if (!copied) return;

    if (activeMeta.openUrl) {
      setMessage({
        type: openedWindow ? "success" : "warning",
        text: openedWindow
          ? `${activeMeta.label} draft copied. The platform was opened in a new tab.`
          : `${activeMeta.label} draft copied, but the browser blocked the new tab. Open the platform manually.`,
      });
      return;
    }

    setMessage({ type: "success", text: `${activeMeta.label} draft copied. Paste it into your publishing tool.` });
  }

  async function publishCurrentPost() {
    if (!publishAvailability.ready) {
      setMessage({ type: "warning", text: publishAvailability.reason });
      return;
    }
    if (!canPublishCurrent) {
      await copyAndOpenCurrent();
      return;
    }

    if (isOverLimit) {
      setMessage({
        type: "error",
        text: activeChannel === "x" && xThreadMode
          ? "Every X thread post must stay within 280 characters and a thread may contain at most 25 posts."
          : `This ${activeMeta.label} draft is over the ${activeMeta.limit.toLocaleString()} character guide.`,
      });
      return;
    }

    let options = {};
    if (activeChannel === "reddit") {
      const subreddit = String(publishOptions.reddit?.subreddit || "")
        .trim()
        .replace(/^r\//i, "");
      const title = String(publishOptions.reddit?.title || projectName || "").trim();
      if (!/^[A-Za-z0-9_]{2,21}$/.test(subreddit)) {
        setMessage({ type: "error", text: "Enter a valid subreddit name before publishing. Do not include spaces or the r/ prefix." });
        return;
      }
      if (!title) {
        setMessage({ type: "error", text: "Add a Reddit post title before publishing." });
        return;
      }
      options = { subreddit, title };
    }

    if (!window.confirm(`Publish ${activeMeta.label} revision ${revision} to ${currentConnectionLabel}? This sends the exact approved draft currently shown.`)) return;

    setBusy(true);
    setMessage(null);
    try {
      const { data } = await publishStudioPost({
        platform: activeChannel,
        content: currentPost,
        projectName,
        options,
      });
      if (!data.ok) throw new Error(data.error || "The platform did not confirm publication.");
      setMessage({
        type: "success",
        text: data.message || `Published to ${activeMeta.label}.`,
      });
      await refreshConnections();
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setBusy(false);
    }
  }

  return {
    canPublishCurrent,
    currentConnectionLabel,
    publishAvailability,
    directPublishAvailability,
    updatePublishOption,
    copyCurrentPost,
    copyAndOpenCurrent,
    publishCurrentPost,
  };
}
