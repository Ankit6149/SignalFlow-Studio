export const REGENERATION_POLICIES = Object.freeze({
  ARCHIVE_ALL: "archive_all",
  UNEDITED: "unedited",
  CHANNEL: "channel",
  CANCEL: "cancel",
});

function normalizeChannels(value) {
  return Array.from(new Set((Array.isArray(value) ? value : [])
    .map((channel) => String(channel || "").trim())
    .filter(Boolean)));
}

export function editedChannels({ channels = [], channelStates = {} } = {}) {
  return normalizeChannels(channels).filter((channel) => Boolean(channelStates[channel]?.edited));
}

export function regenerationTargets({
  policy,
  channels = [],
  channelStates = {},
  activeChannel = "",
} = {}) {
  const selected = normalizeChannels(channels);
  switch (policy) {
    case REGENERATION_POLICIES.ARCHIVE_ALL:
      return selected;
    case REGENERATION_POLICIES.UNEDITED:
      return selected.filter((channel) => !channelStates[channel]?.edited);
    case REGENERATION_POLICIES.CHANNEL:
      return selected.includes(activeChannel) ? [activeChannel] : [];
    case REGENERATION_POLICIES.CANCEL:
    default:
      return [];
  }
}

export function describeRegenerationPolicy({ policy, targetChannels = [], editedCount = 0 } = {}) {
  if (policy === REGENERATION_POLICIES.ARCHIVE_ALL) {
    return `Archive the current version and regenerate all ${targetChannels.length} selected destinations.`;
  }
  if (policy === REGENERATION_POLICIES.UNEDITED) {
    return `Regenerate ${targetChannels.length} unedited destinations and preserve ${editedCount} edited drafts exactly.`;
  }
  if (policy === REGENERATION_POLICIES.CHANNEL) {
    return `Regenerate only ${targetChannels[0] || "the active destination"}.`;
  }
  return "Cancel regeneration without changing campaign state.";
}
