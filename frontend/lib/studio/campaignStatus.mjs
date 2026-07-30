const CHANNEL_LABELS = Object.freeze({
  generated: "Generated",
  regenerated: "Regenerated",
  edited: "Edited",
  needs_review: "Needs review",
  failed: "Generation failed",
  stale: "Source changed",
  approved: "Approved",
  empty: "No draft",
});

function text(value) {
  return String(value ?? "").trim();
}

export function selectChannelStatus({ channelState = {}, isStale = false, content = "" } = {}) {
  let key = "generated";
  if (!text(content) && channelState.status === "failed") key = "failed";
  else if (!text(content)) key = "empty";
  else if (isStale) key = "stale";
  else if (channelState.status === "failed") key = "failed";
  else if (channelState.approved) key = "approved";
  else if (channelState.edited) key = "edited";
  else if (channelState.status === "needs_review") key = "needs_review";
  else if (channelState.status === "regenerated") key = "regenerated";

  return {
    key,
    label: CHANNEL_LABELS[key],
    isBlocked: ["failed", "stale", "empty"].includes(key),
    isApproved: Boolean(channelState.approved),
    isEdited: Boolean(channelState.edited),
  };
}

export function selectCampaignStatus({
  state,
  isStale = false,
  currentSourceFingerprint = "",
  hasCampaignId = false,
} = {}) {
  const channelEntries = Object.keys(state?.channelStates || {}).map((channel) => ({
    channel,
    ...selectChannelStatus({
      channelState: state.channelStates[channel],
      isStale,
      content: state.posts?.[channel] || "",
    }),
  }));
  const sourceDirty = Boolean(
    state?.savedSourceFingerprint &&
      currentSourceFingerprint &&
      state.savedSourceFingerprint !== currentSourceFingerprint,
  );
  const revisionDirty = state?.savedRevision !== state?.revision;
  const isDirty = Boolean(state?.result && (revisionDirty || sourceDirty || !hasCampaignId));
  const isSaved = Boolean(state?.result && hasCampaignId && !isDirty);
  const isExportedCurrent = Boolean(
    state?.result &&
      state.exportedRevision === state.revision &&
      !sourceDirty &&
      !isStale,
  );
  const editedCount = channelEntries.filter((item) => item.isEdited).length;
  const approvedCount = channelEntries.filter((item) => item.isApproved).length;
  const failedCount = channelEntries.filter((item) => item.key === "failed").length;
  const needsReviewCount = channelEntries.filter((item) => !item.isApproved && ["generated", "regenerated", "needs_review", "edited"].includes(item.key)).length;

  let campaignKey = "not_generated";
  let campaignLabel = "Not generated";
  if (state?.result && isStale) {
    campaignKey = "stale";
    campaignLabel = "Source changed";
  } else if (state?.result && isDirty) {
    campaignKey = "unsaved";
    campaignLabel = "Unsaved changes";
  } else if (isSaved) {
    campaignKey = "saved";
    campaignLabel = "Saved";
  } else if (state?.result) {
    campaignKey = "generated";
    campaignLabel = "Generated";
  }

  return {
    campaignKey,
    campaignLabel,
    channelEntries,
    isDirty,
    isSaved,
    isExportedCurrent,
    sourceDirty,
    editedCount,
    approvedCount,
    failedCount,
    needsReviewCount,
    hasEditedDrafts: editedCount > 0,
    copyBlockedReason: isStale
      ? "Source inputs changed. Regenerate from the current source before copying."
      : "",
    exportBlockedReason: isStale
      ? "Source inputs changed. Regenerate from the current source before exporting."
      : !state?.result
        ? "Generate a campaign before exporting."
        : "",
  };
}

export function selectPublishAvailability({
  channelStatus,
  isStale = false,
  hasContent = false,
  isOverLimit = false,
  connectorReady = false,
  manualRoute = false,
} = {}) {
  if (isStale) return { ready: false, reason: "Source inputs changed. Regenerate before publishing." };
  if (!hasContent) return { ready: false, reason: "This destination has no usable draft." };
  if (channelStatus?.key === "failed") return { ready: false, reason: "Generation failed for this destination. Regenerate it before publishing." };
  if (!channelStatus?.isApproved) return { ready: false, reason: "Mark this draft approved before publishing or opening its handoff." };
  if (isOverLimit) return { ready: false, reason: "This draft exceeds the destination character guide." };
  if (!connectorReady && !manualRoute) return { ready: false, reason: "Connect the destination or use an available manual handoff." };
  return { ready: true, reason: "" };
}
