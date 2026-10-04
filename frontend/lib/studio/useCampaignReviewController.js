"use client";

import { useState } from "react";

export function useCampaignReviewController({
  channels,
  activeChannel,
  channelStates,
  generatedPosts,
  dispatchCampaign,
  setActiveChannel,
  setMessage,
  createArchiveId,
}) {
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const reviewIndex = Math.max(0, channels.indexOf(activeChannel));
  const canRestoreGenerated = Boolean(
    channelStates[activeChannel]?.edited && generatedPosts[activeChannel],
  );

  function moveReviewChannel(direction) {
    if (!channels.length) return;
    const nextIndex = (reviewIndex + direction + channels.length) % channels.length;
    setActiveChannel(channels[nextIndex]);
  }

  function editActivePost(text) {
    dispatchCampaign({
      type: "EDIT_POST",
      channel: activeChannel,
      text,
    });
  }

  function restoreActiveGeneratedPost() {
    dispatchCampaign({ type: "RESTORE_GENERATED", channel: activeChannel });
  }

  function toggleVersionHistory() {
    setVersionHistoryOpen((open) => !open);
  }

  function handleDraftApproval() {
    const current = channelStates[activeChannel] || {};
    if (current.approved) {
      dispatchCampaign({ type: "MARK_CHANNEL_NEEDS_REVIEW", channel: activeChannel });
      return;
    }

    if (current.status === "needs_review" && !current.qualityRiskAccepted) {
      const issueSummary = Array.isArray(current.issues) && current.issues.length
        ? current.issues.slice(0, 3).join("\n• ")
        : "One or more quality checks remain unresolved.";
      const accepted = window.confirm(
        `This draft still needs review:\n\n• ${issueSummary}\n\nApprove anyway and accept responsibility for these unresolved issues?`,
      );
      if (!accepted) return;
      dispatchCampaign({
        type: "MARK_CHANNEL_APPROVED",
        channel: activeChannel,
        acceptRisk: true,
      });
      return;
    }

    dispatchCampaign({ type: "MARK_CHANNEL_APPROVED", channel: activeChannel });
  }

  function restoreArchivedVersion(archiveId) {
    const restoredAt = new Date().toISOString();
    dispatchCampaign({
      type: "RESTORE_ARCHIVE",
      payload: {
        archiveId,
        currentArchiveId: createArchiveId(),
        restoredAt,
      },
    });
    setMessage({
      type: "success",
      text: "Archived campaign version restored. Save to keep it as the current local version.",
    });
  }

  function discardArchivedVersion(archiveId) {
    if (!window.confirm("Discard this archived campaign version? This cannot be undone.")) return;
    dispatchCampaign({ type: "DISCARD_ARCHIVE", archiveId });
  }

  return {
    versionHistoryOpen,
    canRestoreGenerated,
    moveReviewChannel,
    editActivePost,
    restoreActiveGeneratedPost,
    toggleVersionHistory,
    handleDraftApproval,
    restoreArchivedVersion,
    discardArchivedVersion,
  };
}
