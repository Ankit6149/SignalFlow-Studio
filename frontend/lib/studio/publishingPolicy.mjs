function text(value) {
  return String(value ?? "").trim();
}

export function connectionIdentity(connection = {}, platformLabel = "Destination") {
  const profile = connection?.profile || {};
  const name = text(profile.name);
  const username = text(profile.username).replace(/^@/, "");
  const id = text(profile.id);

  if (name && username) return `${name} (@${username})`;
  if (name) return name;
  if (username) return `@${username}`;
  if (id) return `${platformLabel} account ${id}`;
  return `Connected ${platformLabel} account`;
}

export function selectDirectPublishAvailability({
  channelStatus,
  isStale = false,
  hasContent = false,
  isOverLimit = false,
  connection = null,
  permissionValid = false,
} = {}) {
  if (isStale) {
    return { ready: false, code: "stale", reason: "Source inputs changed. Regenerate before publishing." };
  }
  if (!hasContent) {
    return { ready: false, code: "empty", reason: "This destination has no usable draft." };
  }
  if (channelStatus?.key === "failed") {
    return {
      ready: false,
      code: "failed",
      reason: "Generation failed for this destination. Regenerate it before publishing.",
    };
  }
  if (channelStatus?.key === "needs_review") {
    return {
      ready: false,
      code: "needs_review",
      reason: "Resolve the draft review state and mark the current revision approved before publishing.",
    };
  }
  if (!channelStatus?.isApproved) {
    return {
      ready: false,
      code: "unapproved",
      reason: "Mark the current draft revision approved before publishing.",
    };
  }
  if (isOverLimit) {
    return {
      ready: false,
      code: "over_limit",
      reason: "This draft exceeds the destination character guide.",
    };
  }
  if (!permissionValid) {
    return {
      ready: false,
      code: "permission_required",
      reason: "Unlock the owner session before using a live connector.",
    };
  }
  if (!connection?.connected) {
    return {
      ready: false,
      code: "not_connected",
      reason: "Connect and verify the destination account before direct publishing.",
    };
  }
  if (connection?.expired || connection?.readiness?.authorization === "expired") {
    return {
      ready: false,
      code: "expired",
      reason: "The connected account session expired. Reconnect it before publishing.",
    };
  }
  if (connection?.manualOnly) {
    return {
      ready: false,
      code: "manual_only",
      reason: connection.reason || "This destination supports manual handoff, not direct publishing.",
    };
  }
  if (
    connection?.readiness?.authorization &&
    connection.readiness.authorization !== "ready"
  ) {
    return {
      ready: false,
      code: "connector_unverified",
      reason: "The connector is not currently authorized for direct publishing.",
    };
  }

  return { ready: true, code: "ready", reason: "" };
}

export function buildPublishConfirmation({
  platformId = "",
  platformLabel = "Destination",
  connection = null,
  revision = 0,
  channelStatus = null,
} = {}) {
  const draftRevision = Number.isFinite(Number(revision)) ? Number(revision) : 0;
  const accountLabel = connectionIdentity(connection, platformLabel);

  return {
    platformId: text(platformId),
    platformLabel: text(platformLabel) || "Destination",
    accountLabel,
    draftRevision,
    draftState: channelStatus?.label || "Approved",
    title: `Publish to ${text(platformLabel) || "this destination"}?`,
    description: `This live action will publish approved draft revision ${draftRevision} to ${accountLabel}.`,
  };
}

export function isConfirmedPublishResponse({
  responseOk = false,
  data = null,
  expectedPlatform = "",
} = {}) {
  if (!responseOk || data?.ok !== true) return false;
  if (text(expectedPlatform) && text(data?.platform) !== text(expectedPlatform)) return false;
  return Boolean(text(data?.postId) || text(data?.postUrl));
}
