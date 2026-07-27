export const CAMPAIGN_STATE_SCHEMA_VERSION = 1;

const SOURCE_CHANGE_LABELS = {
  projectName: "campaign name",
  notes: "brief",
  audience: "audience",
  links: "links",
  repository: "repository",
  destinations: "destinations",
  provider: "provider",
  model: "model",
  baseUrl: "endpoint",
  documents: "document text",
  media: "attached files",
};

function normalizeText(value) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .trim();
}

function normalizeBaseUrl(value) {
  return normalizeText(value).replace(/\/+$/g, "");
}

function normalizeStringList(values) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => normalizeText(value))
        .filter(Boolean),
    ),
  ).sort((left, right) => left.localeCompare(right));
}

function sortCanonical(values) {
  return [...values].sort((left, right) => stableSerialize(left).localeCompare(stableSerialize(right)));
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value)
    .sort()
    .reduce((result, key) => {
      result[key] = canonicalize(value[key]);
      return result;
    }, {});
}

export function stableSerialize(value) {
  return JSON.stringify(canonicalize(value));
}

function fnv1a64(value) {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * prime);
  }
  return hash.toString(16).padStart(16, "0");
}

export function normalizeGenerationSource({ form = {}, channels = [], files = [], documentText = [] } = {}) {
  const media = sortCanonical(
    (Array.isArray(files) ? files : []).map((file) => ({
      name: normalizeText(file?.name),
      type: normalizeText(file?.type || "file").toLowerCase(),
      size: Math.max(0, Number(file?.size) || 0),
      extracted: Boolean(file?.extracted),
      description: normalizeText(file?.description),
    })),
  );

  return {
    schemaVersion: CAMPAIGN_STATE_SCHEMA_VERSION,
    campaign: {
      projectName: normalizeText(form.projectName),
      notes: normalizeText(form.notes),
      audience: normalizeText(form.audience),
      links: normalizeText(form.links),
      repository: normalizeText(form.repo),
    },
    destinations: normalizeStringList(channels),
    modelRoute: {
      provider: normalizeText(form.provider).toLowerCase(),
      model: normalizeText(form.model),
      baseUrl: normalizeBaseUrl(form.baseUrl),
    },
    documents: normalizeStringList(documentText),
    media,
  };
}

export function createSourceFingerprint(source) {
  const normalized = source?.schemaVersion === CAMPAIGN_STATE_SCHEMA_VERSION
    ? source
    : normalizeGenerationSource(source);
  return `sf1-${fnv1a64(stableSerialize(normalized))}`;
}

export function createGenerationSourceSnapshot(input, { createdAt = new Date().toISOString() } = {}) {
  const normalizedSource = normalizeGenerationSource(input);
  const fingerprint = createSourceFingerprint(normalizedSource);
  return {
    schemaVersion: CAMPAIGN_STATE_SCHEMA_VERSION,
    sourceSnapshotId: `source-${fingerprint.slice(4)}`,
    fingerprint,
    normalizedSource,
    createdAt,
  };
}

export function createGenerationRun({
  sourceSnapshot,
  response = {},
  provider = "",
  model = "",
  createdAt = new Date().toISOString(),
  generationRunId,
} = {}) {
  if (!sourceSnapshot?.fingerprint || !sourceSnapshot?.normalizedSource) {
    throw new TypeError("A valid source snapshot is required to create a generation run.");
  }

  const resolvedId = normalizeText(
    generationRunId || response.generationRunId || response.generation_run_id || response.requestId || response.request_id,
  );

  return {
    schemaVersion: CAMPAIGN_STATE_SCHEMA_VERSION,
    generationRunId: resolvedId || `run-${sourceSnapshot.fingerprint.slice(4)}-${Date.parse(createdAt) || 0}`,
    sourceSnapshotId: sourceSnapshot.sourceSnapshotId,
    sourceFingerprint: sourceSnapshot.fingerprint,
    sourceSnapshot,
    provider: normalizeText(response.providerUsed || response.provider || provider),
    model: normalizeText(response.modelUsed || response.model || model),
    createdAt,
  };
}

export function restoreGenerationRun(item) {
  const stored = item?.generationRun;
  if (
    stored?.sourceFingerprint &&
    stored?.sourceSnapshot?.fingerprint === stored.sourceFingerprint &&
    stored?.sourceSnapshot?.normalizedSource
  ) {
    return stored;
  }

  const hasGeneratedContent = Boolean(item?.result || item?.markdown || Object.keys(item?.posts || {}).length);
  if (!hasGeneratedContent) return null;

  const sourceSnapshot = createGenerationSourceSnapshot(
    {
      form: item?.brief || {},
      channels: item?.channels || [],
      files: item?.sourceFiles || item?.files || [],
      documentText: item?.documentText || [],
    },
    { createdAt: item?.updatedAt || item?.createdAt || null },
  );

  return createGenerationRun({
    sourceSnapshot,
    response: item?.result || {},
    provider: item?.providerUsed || item?.brief?.provider,
    model: item?.brief?.model,
    createdAt: item?.updatedAt || item?.createdAt || new Date(0).toISOString(),
    generationRunId: `legacy-${item?.id || sourceSnapshot.fingerprint.slice(4)}`,
  });
}

export function getCampaignFreshness({ hasResult = false, currentSourceFingerprint = "", generationRun = null } = {}) {
  if (!hasResult) {
    return {
      status: "empty",
      isStale: false,
      canUseCurrentGeneration: false,
    };
  }

  if (!generationRun?.sourceFingerprint) {
    return {
      status: "untracked",
      isStale: true,
      canUseCurrentGeneration: false,
    };
  }

  const isStale = generationRun.sourceFingerprint !== currentSourceFingerprint;
  return {
    status: isStale ? "stale" : "current",
    isStale,
    canUseCurrentGeneration: !isStale,
  };
}

export function getGenerationSourceChanges(previousSnapshot, currentSnapshot) {
  const previous = previousSnapshot?.normalizedSource;
  const current = currentSnapshot?.normalizedSource;
  if (!previous || !current) return [];

  const changes = [];
  const compare = (key, left, right) => {
    if (stableSerialize(left) !== stableSerialize(right)) changes.push(SOURCE_CHANGE_LABELS[key]);
  };

  compare("projectName", previous.campaign?.projectName, current.campaign?.projectName);
  compare("notes", previous.campaign?.notes, current.campaign?.notes);
  compare("audience", previous.campaign?.audience, current.campaign?.audience);
  compare("links", previous.campaign?.links, current.campaign?.links);
  compare("repository", previous.campaign?.repository, current.campaign?.repository);
  compare("destinations", previous.destinations, current.destinations);
  compare("provider", previous.modelRoute?.provider, current.modelRoute?.provider);
  compare("model", previous.modelRoute?.model, current.modelRoute?.model);
  compare("baseUrl", previous.modelRoute?.baseUrl, current.modelRoute?.baseUrl);
  compare("documents", previous.documents, current.documents);
  compare("media", previous.media, current.media);

  return changes;
}
