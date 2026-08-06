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

function hasOwn(value, key) {
  return Boolean(value && Object.prototype.hasOwnProperty.call(value, key));
}

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
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
  if (!isRecord(value)) return value;

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
  if (!isRecord(value)) return value;
  const canonical = canonicalChannelMap(value);
  return Object.fromEntries(
    Object.entries(canonical).map(([channel, item]) => [packageKeyForChannelId(channel), item]),
  );
}

function canonicalDraftMap(value) {
  if (!isRecord(value)) return value;
  return canonicalChannelMap(value, {
    mapValue: (draft, channel) => isRecord(draft)
      ? { ...draft, channel }
      : draft,
  });
}

function canonicalPackage(value) {
  if (!isRecord(value)) return value;
  return {
    ...value,
    ...(hasOwn(value, "posts") ? { posts: canonicalPackagePostMap(value.posts) } : {}),
  };
}

function canonicalResult(value) {
  if (!isRecord(value)) return value;
  return {
    ...value,
    ...(hasOwn(value, "posts") ? { posts: canonicalChannelMap(value.posts) } : {}),
    ...(hasOwn(value, "structuredPosts")
      ? { structuredPosts: canonicalChannelMap(value.structuredPosts) }
      : {}),
    ...(hasOwn(value, "generation_status")
      ? { generation_status: canonicalChannelMap(value.generation_status) }
      : {}),
    ...(hasOwn(value, "package") ? { package: canonicalPackage(value.package) } : {}),
  };
}

function canonicalArchive(value) {
  if (!isRecord(value)) return value;
  return {
    ...value,
    ...(hasOwn(value, "activeChannel")
      ? { activeChannel: canonicalChannelId(value.activeChannel) }
      : {}),
    ...(hasOwn(value, "posts") ? { posts: canonicalChannelMap(value.posts) } : {}),
    ...(hasOwn(value, "generatedPosts")
      ? { generatedPosts: canonicalChannelMap(value.generatedPosts) }
      : {}),
    ...(hasOwn(value, "channelStates")
      ? { channelStates: canonicalChannelMap(value.channelStates) }
      : {}),
    ...(hasOwn(value, "result") ? { result: canonicalResult(value.result) } : {}),
  };
}

export function normalizeLegacyChannelPayload(value) {
  if (!isRecord(value)) return value;

  return {
    ...value,
    ...(hasOwn(value, "channels") && Array.isArray(value.channels)
      ? { channels: canonicalChannelList(value.channels) }
      : {}),
    ...(hasOwn(value, "activeChannel")
      ? { activeChannel: canonicalChannelId(value.activeChannel) }
      : {}),
    ...(hasOwn(value, "posts") ? { posts: canonicalChannelMap(value.posts) } : {}),
    ...(hasOwn(value, "generatedPosts")
      ? { generatedPosts: canonicalChannelMap(value.generatedPosts) }
      : {}),
    ...(hasOwn(value, "channelStates")
      ? { channelStates: canonicalChannelMap(value.channelStates) }
      : {}),
    ...(hasOwn(value, "generationStatus")
      ? { generationStatus: canonicalChannelMap(value.generationStatus) }
      : {}),
    ...(hasOwn(value, "drafts") ? { drafts: canonicalDraftMap(value.drafts) } : {}),
    ...(hasOwn(value, "existingDrafts")
      ? { existingDrafts: canonicalDraftMap(value.existingDrafts) }
      : {}),
    ...(hasOwn(value, "publishOptions")
      ? { publishOptions: canonicalChannelMap(value.publishOptions) }
      : {}),
    ...(hasOwn(value, "result") ? { result: canonicalResult(value.result) } : {}),
    ...(hasOwn(value, "generationResult")
      ? { generationResult: canonicalResult(value.generationResult) }
      : {}),
    ...(hasOwn(value, "package") ? { package: canonicalPackage(value.package) } : {}),
    ...(hasOwn(value, "archives") && Array.isArray(value.archives)
      ? { archives: value.archives.map(canonicalArchive) }
      : {}),
    ...(hasOwn(value, "existingArchives") && Array.isArray(value.existingArchives)
      ? { existingArchives: value.existingArchives.map(canonicalArchive) }
      : {}),
    ...(hasOwn(value, "metadata") && isRecord(value.metadata)
      ? {
          metadata: {
            ...value.metadata,
            ...(hasOwn(value.metadata, "selectedChannels") && Array.isArray(value.metadata.selectedChannels)
              ? { selectedChannels: canonicalChannelList(value.metadata.selectedChannels) }
              : {}),
          },
        }
      : {}),
  };
}
