export const CHANNEL_IDS = Object.freeze([
  "linkedin",
  "x",
  "instagram",
  "reddit",
  "facebook",
  "threads",
  "youtube",
  "tiktok",
  "hackernews",
  "newsletter",
  "blog",
  "release_notes",
]);

export const CHANNEL_ALIASES = Object.freeze({
  twitter: "x",
  hn: "hackernews",
  "hacker-news": "hackernews",
  hacker_news: "hackernews",
  releasenotes: "release_notes",
  "release-notes": "release_notes",
  releaseNotes: "release_notes",
});

const CHANNEL_ID_SET = new Set(CHANNEL_IDS);

function rawChannel(value) {
  return String(value ?? "").trim();
}

export function canonicalChannelId(value) {
  const raw = rawChannel(value);
  if (!raw) return "";
  const lower = raw.toLowerCase();
  return CHANNEL_ALIASES[raw] || CHANNEL_ALIASES[lower] || lower;
}

export function packageKeyForChannelId(value) {
  const channel = canonicalChannelId(value);
  return channel === "release_notes" ? "releaseNotes" : channel;
}

export function isCanonicalChannelId(value) {
  return CHANNEL_ID_SET.has(rawChannel(value));
}

export function canonicalChannelList(value) {
  return Array.from(new Set((Array.isArray(value) ? value : [])
    .map(canonicalChannelId)
    .filter(Boolean)));
}

export function canonicalChannelMap(value, { mapValue = (item) => item } = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const entries = Object.entries(value);
  const normalized = {};

  // Compatibility aliases are read first. An explicit canonical key wins when
  // both forms are present in one legacy payload.
  for (const [key, item] of entries) {
    const canonical = canonicalChannelId(key);
    if (!canonical || canonical === key) continue;
    normalized[canonical] = mapValue(item, canonical, key);
  }
  for (const [key, item] of entries) {
    const canonical = canonicalChannelId(key);
    if (!canonical) continue;
    if (canonical === key || normalized[canonical] === undefined) {
      normalized[canonical] = mapValue(item, canonical, key);
    }
  }

  return normalized;
}

function canonicalPackagePostMap(value) {
  const canonical = canonicalChannelMap(value);
  return Object.fromEntries(
    Object.entries(canonical).map(([channel, item]) => [packageKeyForChannelId(channel), item]),
  );
}

function canonicalDraftMap(value) {
  return canonicalChannelMap(value, {
    mapValue: (draft, channel) => draft && typeof draft === "object"
      ? { ...draft, channel }
      : draft,
  });
}

function canonicalPackage(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  return {
    ...value,
    posts: canonicalPackagePostMap(value.posts),
  };
}

function canonicalResult(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  return {
    ...value,
    posts: canonicalChannelMap(value.posts),
    structuredPosts: canonicalChannelMap(value.structuredPosts),
    generation_status: canonicalChannelMap(value.generation_status),
    package: canonicalPackage(value.package),
  };
}

function canonicalArchive(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  return {
    ...value,
    activeChannel: canonicalChannelId(value.activeChannel),
    posts: canonicalChannelMap(value.posts),
    generatedPosts: canonicalChannelMap(value.generatedPosts),
    channelStates: canonicalChannelMap(value.channelStates),
    result: canonicalResult(value.result),
  };
}

export function normalizeLegacyChannelPayload(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;

  return {
    ...value,
    channels: canonicalChannelList(value.channels),
    activeChannel: canonicalChannelId(value.activeChannel),
    posts: canonicalChannelMap(value.posts),
    generatedPosts: canonicalChannelMap(value.generatedPosts),
    channelStates: canonicalChannelMap(value.channelStates),
    generationStatus: canonicalChannelMap(value.generationStatus),
    drafts: canonicalDraftMap(value.drafts),
    existingDrafts: canonicalDraftMap(value.existingDrafts),
    publishOptions: canonicalChannelMap(value.publishOptions),
    result: canonicalResult(value.result),
    generationResult: canonicalResult(value.generationResult),
    package: canonicalPackage(value.package),
    archives: Array.isArray(value.archives) ? value.archives.map(canonicalArchive) : value.archives,
    existingArchives: Array.isArray(value.existingArchives)
      ? value.existingArchives.map(canonicalArchive)
      : value.existingArchives,
    metadata: value.metadata && typeof value.metadata === "object"
      ? {
          ...value.metadata,
          selectedChannels: canonicalChannelList(value.metadata.selectedChannels),
        }
      : value.metadata,
  };
}
