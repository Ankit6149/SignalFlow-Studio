import {
  createDomainRecord,
  DOMAIN_SCHEMA_VERSION,
  parseDomainRecord,
  portableClone,
  stableStringify,
} from "./contracts.mjs";

export const SOURCE_CONTRACT_SCHEMA_VERSION = 1;

export const SOURCE_KINDS = Object.freeze({
  UPLOAD: "upload",
  LINK: "link",
  REPOSITORY: "repository",
  REPOSITORY_FILE: "repository_file",
  TRUSTED_LOCAL_REPOSITORY: "trusted_local_repository",
  EXTENSION_PAGE: "extension_page",
  SCREENSHOT: "screenshot",
  RECORDING: "recording",
  NOTE: "note",
  IMPORTED_ARCHIVE: "imported_archive",
});

export const INGESTION_METHODS = Object.freeze({
  BROWSER_UPLOAD: "browser_upload",
  REMOTE_FETCH: "remote_fetch",
  REPOSITORY_SCAN: "repository_scan",
  TRUSTED_LOCAL: "trusted_local",
  EXTENSION: "extension",
  API: "api",
  MCP: "mcp",
  USER_NOTE: "user_note",
  ARCHIVE_IMPORT: "archive_import",
});

export const ASSET_TYPES = Object.freeze({
  DOCUMENT: "document",
  IMAGE: "image",
  VIDEO: "video",
  AUDIO: "audio",
  ARCHIVE: "archive",
  DATA: "data",
  CODE: "code",
  OTHER: "other",
});

export const SOURCE_USABILITY_STATES = Object.freeze({
  USABLE_EVIDENCE: "usable_evidence",
  REFERENCE_ONLY: "reference_only",
  PROCESSING: "processing",
  FAILED: "failed",
  UNSUPPORTED: "unsupported",
});

export const EVIDENCE_STATES = Object.freeze({
  VERIFIED: "verified",
  UNVERIFIED: "unverified",
  NOT_APPLICABLE: "not_applicable",
});

export const PROCESSING_STATES = Object.freeze({
  NOT_REQUESTED: "not_requested",
  QUEUED: "queued",
  PROCESSING: "processing",
  COMPLETE: "complete",
  PARTIAL: "partial",
  FAILED: "failed",
  UNSUPPORTED: "unsupported",
  CANCELLED: "cancelled",
});

export const UPLOAD_STATES = Object.freeze({
  NOT_REQUIRED: "not_required",
  PENDING: "pending",
  UPLOADING: "uploading",
  COMPLETE: "complete",
  FAILED: "failed",
  CANCELLED: "cancelled",
});

export const PRIVACY_CLASSES = Object.freeze({
  PUBLIC: "public",
  WORKSPACE_PRIVATE: "workspace_private",
  DEVICE_PRIVATE: "device_private",
  RESTRICTED: "restricted",
});

export const RETENTION_STATES = Object.freeze({
  ACTIVE: "active",
  EXPIRING: "expiring",
  RETAINED: "retained",
  DELETION_REQUESTED: "deletion_requested",
  DELETED: "deleted",
});

export const DELETION_STATES = Object.freeze({
  ACTIVE: "active",
  REQUESTED: "requested",
  IN_PROGRESS: "in_progress",
  DELETED: "deleted",
  FAILED: "failed",
});

export const PROCESSING_RECORD_STATUSES = Object.freeze({
  QUEUED: "queued",
  RUNNING: "running",
  COMPLETE: "complete",
  PARTIAL: "partial",
  FAILED: "failed",
  UNSUPPORTED: "unsupported",
  CANCELLED: "cancelled",
});

const SOURCE_KIND_VALUES = new Set(Object.values(SOURCE_KINDS));
const INGESTION_METHOD_VALUES = new Set(Object.values(INGESTION_METHODS));
const ASSET_TYPE_VALUES = new Set(Object.values(ASSET_TYPES));
const USABILITY_VALUES = new Set(Object.values(SOURCE_USABILITY_STATES));
const EVIDENCE_VALUES = new Set(Object.values(EVIDENCE_STATES));
const PROCESSING_VALUES = new Set(Object.values(PROCESSING_STATES));
const UPLOAD_VALUES = new Set(Object.values(UPLOAD_STATES));
const PRIVACY_VALUES = new Set(Object.values(PRIVACY_CLASSES));
const RETENTION_VALUES = new Set(Object.values(RETENTION_STATES));
const DELETION_VALUES = new Set(Object.values(DELETION_STATES));
const PROCESSING_RECORD_VALUES = new Set(Object.values(PROCESSING_RECORD_STATUSES));

const SECRET_FIELD = /(api[_-]?key|access[_-]?token|refresh[_-]?token|oauth|authorization|cookie|password|client[_-]?secret|private[_-]?key|session)/i;
const TEMPORARY_REFERENCE_FIELD = /(signed[_-]?url|temporary[_-]?url|presigned|download[_-]?url|upload[_-]?url)/i;
const LOCAL_PATH_FIELD = /(^|_)(path|filepath|filesystempath|localpath|absolutepath|workingdirectory|rootdirectory)$/i;
const SIGNED_QUERY = /(^|[-_])(token|key|signature|sig|credential|authorization|expires|x-amz-)/i;
const SAFE_ISSUE_CODE = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const HASH_VALUE = /^(?:sha256:)?[a-f0-9]{32,128}$/i;

export class SourceContractError extends TypeError {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "SourceContractError";
    this.code = code;
    this.details = portableClone(details);
  }
}

function text(value, fallback = "") {
  const normalized = String(value ?? "").replace(/\r\n?/g, "\n").trim();
  return normalized || fallback;
}

function optionalText(value) {
  const valueText = text(value);
  return valueText || null;
}

function integer(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : fallback;
}

function timestamp(value, fallback) {
  const candidate = value || fallback;
  const parsed = Date.parse(candidate || "");
  if (!Number.isFinite(parsed)) {
    throw new SourceContractError("invalid_timestamp", "Source records require ISO-compatible timestamps.");
  }
  return new Date(parsed).toISOString();
}

function enumValue(value, allowed, fallback, field) {
  const normalized = text(value, fallback).toLowerCase();
  if (!allowed.has(normalized)) {
    throw new SourceContractError("invalid_enum", `${field} contains an unsupported value.`, {
      field,
      value: normalized,
    });
  }
  return normalized;
}

function uniqueTextList(value, { lowercase = false } = {}) {
  const values = Array.isArray(value) ? value : [];
  return Array.from(new Set(values
    .map((item) => text(item))
    .filter(Boolean)
    .map((item) => lowercase ? item.toLowerCase() : item)))
    .sort((left, right) => left.localeCompare(right));
}

function isPlainObject(value) {
  if (!value || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
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

function stableId(prefix, value) {
  return `${prefix}-${fnv1a64(stableStringify(value))}`;
}

function assertSupportedSourceSchema(input) {
  if (input?.schemaVersion === undefined || input?.schemaVersion === null) return;
  if (!Number.isInteger(input.schemaVersion)) {
    throw new SourceContractError("invalid_source_schema", "Source schema version must be an integer.");
  }
  if (input.schemaVersion > SOURCE_CONTRACT_SCHEMA_VERSION) {
    throw new SourceContractError(
      "future_source_schema",
      `Source schema ${input.schemaVersion} is newer than supported schema ${SOURCE_CONTRACT_SCHEMA_VERSION}. Upgrade SignalFlow before importing it.`,
    );
  }
}

function requiredId(value, field) {
  const normalized = text(value);
  if (!normalized) throw new SourceContractError("missing_owner", `${field} is required.`);
  return normalized;
}

function opaqueId(value, field) {
  const normalized = text(value);
  if (!normalized) return null;
  if (/[/\\]|^[a-zA-Z]:/.test(normalized)) {
    throw new SourceContractError("private_path_forbidden", `${field} must be an opaque ID, not a filesystem path.`, { field });
  }
  return normalized;
}

function safeIssueCodes(value) {
  const codes = uniqueTextList(value, { lowercase: true });
  for (const code of codes) {
    if (!SAFE_ISSUE_CODE.test(code)) {
      throw new SourceContractError("unsafe_issue_code", "Issue codes must be stable lowercase identifiers.", { code });
    }
  }
  return codes;
}

function sanitizedUserMetadata(value = {}) {
  const metadata = isPlainObject(value) ? value : {};
  return portableClone({
    description: text(metadata.description),
    tags: uniqueTextList(metadata.tags, { lowercase: true }),
    altText: text(metadata.altText),
    intendedUse: uniqueTextList(metadata.intendedUse, { lowercase: true }),
  });
}

function dimensions(value = {}) {
  const source = isPlainObject(value) ? value : {};
  const width = integer(source.width);
  const height = integer(source.height);
  return width && height ? { width, height } : null;
}

function contentHash(value) {
  const normalized = text(value).toLowerCase();
  if (!normalized) return null;
  if (!HASH_VALUE.test(normalized)) {
    throw new SourceContractError("invalid_content_hash", "Content hashes must be hexadecimal SHA-style values.");
  }
  return normalized.startsWith("sha256:") ? normalized : `sha256:${normalized}`;
}

function sanitizeObject(input, path = "source", exclusions = [], ancestors = new WeakSet()) {
  if (input === null || ["string", "number", "boolean"].includes(typeof input)) return input;
  if (input === undefined) return undefined;
  if (["function", "symbol", "bigint"].includes(typeof input)) {
    exclusions.push({ path, code: "runtime_value_excluded" });
    return undefined;
  }
  if (typeof input !== "object") return input;
  if (ancestors.has(input)) throw new SourceContractError("circular_source_record", "Source input contains a circular reference.");
  ancestors.add(input);
  try {
    if (Array.isArray(input)) {
      return input.map((item, index) => sanitizeObject(item, `${path}[${index}]`, exclusions, ancestors))
        .filter((item) => item !== undefined);
    }
    if (!isPlainObject(input)) {
      exclusions.push({ path, code: "runtime_object_excluded" });
      return undefined;
    }
    const output = {};
    for (const [key, value] of Object.entries(input)) {
      const fieldPath = `${path}.${key}`;
      if (SECRET_FIELD.test(key)) {
        exclusions.push({ path: fieldPath, code: "secret_field_excluded" });
        continue;
      }
      if (TEMPORARY_REFERENCE_FIELD.test(key)) {
        exclusions.push({ path: fieldPath, code: "temporary_reference_excluded" });
        continue;
      }
      if (LOCAL_PATH_FIELD.test(key)) {
        exclusions.push({ path: fieldPath, code: "local_path_excluded" });
        continue;
      }
      const sanitized = sanitizeObject(value, fieldPath, exclusions, ancestors);
      if (sanitized !== undefined) output[key] = sanitized;
    }
    return output;
  } finally {
    ancestors.delete(input);
  }
}

function normalizePublicUrl(value) {
  const raw = text(value);
  if (!raw) return null;
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new SourceContractError("invalid_source_url", "Source URL is invalid.");
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new SourceContractError("unsupported_source_url_protocol", "Only HTTP and HTTPS source URLs are portable.");
  }
  if (url.username || url.password) {
    throw new SourceContractError("credentialed_url_forbidden", "Source URLs cannot contain credentials.");
  }
  for (const key of url.searchParams.keys()) {
    if (SIGNED_QUERY.test(key)) {
      throw new SourceContractError("temporary_url_forbidden", "Signed or credential-bearing source URLs are not canonical fields.");
    }
  }
  url.hash = "";
  const sorted = [...url.searchParams.entries()].sort(([leftKey, leftValue], [rightKey, rightValue]) =>
    leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue));
  url.search = "";
  for (const [key, item] of sorted) url.searchParams.append(key, item);
  return url.toString();
}

function normalizeRepositoryReference(value = {}) {
  const input = isPlainObject(value) ? value : {};
  const provider = text(input.provider, "git").toLowerCase();
  const owner = text(input.owner);
  const repository = text(input.repository || input.repo);
  if (!owner || !repository) {
    throw new SourceContractError("invalid_repository_reference", "Repository references require owner and repository names.");
  }
  const relativePath = text(input.relativePath).replace(/^\/+/, "");
  if (/\.\.(?:[/\\]|$)|^[a-zA-Z]:|^[/\\]/.test(relativePath)) {
    throw new SourceContractError("unsafe_repository_path", "Repository references require safe relative paths.");
  }
  return portableClone({
    kind: "repository",
    provider,
    owner,
    repository,
    revision: text(input.revision || input.ref, "default"),
    relativePath,
    canonicalUrl: input.canonicalUrl ? normalizePublicUrl(input.canonicalUrl) : null,
  });
}

function normalizeSourceReference(kind, value = {}, privacyClass) {
  const input = isPlainObject(value) ? value : {};
  if (kind === SOURCE_KINDS.LINK || kind === SOURCE_KINDS.EXTENSION_PAGE) {
    return portableClone({
      kind: "url",
      canonicalUrl: normalizePublicUrl(input.canonicalUrl || input.url),
      title: text(input.title),
      privacyClass,
      safetyVerification: text(input.safetyVerification, "unverified"),
    });
  }
  if ([SOURCE_KINDS.REPOSITORY, SOURCE_KINDS.REPOSITORY_FILE].includes(kind)) {
    return normalizeRepositoryReference(input);
  }
  if (kind === SOURCE_KINDS.TRUSTED_LOCAL_REPOSITORY) {
    return portableClone({
      kind: "trusted_local_repository",
      localReferenceId: opaqueId(input.localReferenceId, "localReferenceId"),
      displayName: text(input.displayName),
      revision: text(input.revision, "working-tree"),
      relativePath: normalizeRepositoryReference({
        owner: "local",
        repository: text(input.displayName, "repository"),
        relativePath: input.relativePath || "",
      }).relativePath,
      privacyClass: PRIVACY_CLASSES.DEVICE_PRIVATE,
    });
  }
  if (kind === SOURCE_KINDS.EXTENSION_PAGE || kind === SOURCE_KINDS.SCREENSHOT || kind === SOURCE_KINDS.RECORDING) {
    return portableClone({
      kind: "capture",
      captureId: opaqueId(input.captureId, "captureId"),
      pageUrl: input.pageUrl ? normalizePublicUrl(input.pageUrl) : null,
      pageTitle: text(input.pageTitle),
      captureScope: text(input.captureScope, "user_selected"),
    });
  }
  if (kind === SOURCE_KINDS.IMPORTED_ARCHIVE) {
    return portableClone({
      kind: "archive",
      archiveId: opaqueId(input.archiveId, "archiveId"),
      sourceArtifactId: opaqueId(input.sourceArtifactId, "sourceArtifactId"),
    });
  }
  return portableClone({
    kind: kind === SOURCE_KINDS.NOTE ? "note" : "upload",
    clientReferenceId: opaqueId(input.clientReferenceId, "clientReferenceId"),
    displayName: text(input.displayName || input.originalName),
  });
}

function normalizePrivacy(value = {}, fallbackClass = PRIVACY_CLASSES.WORKSPACE_PRIVATE) {
  const input = isPlainObject(value) ? value : {};
  return portableClone({
    classification: enumValue(input.classification, PRIVACY_VALUES, fallbackClass, "privacy.classification"),
    containsPersonalData: Boolean(input.containsPersonalData),
    exportAllowed: input.exportAllowed !== false,
    processingAllowed: input.processingAllowed !== false,
  });
}

function normalizeRetention(value = {}) {
  const input = isPlainObject(value) ? value : {};
  const state = enumValue(input.state, RETENTION_VALUES, RETENTION_STATES.ACTIVE, "retention.state");
  return portableClone({
    state,
    retainUntil: input.retainUntil ? timestamp(input.retainUntil) : null,
    policy: text(input.policy, "workspace_default"),
  });
}

function normalizeDeletion(value = {}) {
  const input = isPlainObject(value) ? value : {};
  return portableClone({
    state: enumValue(input.state, DELETION_VALUES, DELETION_STATES.ACTIVE, "deletion.state"),
    requestedAt: input.requestedAt ? timestamp(input.requestedAt) : null,
    deletedAt: input.deletedAt ? timestamp(input.deletedAt) : null,
    issueCodes: safeIssueCodes(input.issueCodes),
  });
}

function normalizeProvenance(value, fallback, ownership) {
  const events = Array.isArray(value) && value.length ? value : [fallback];
  const normalized = events.map((event, index) => {
    const input = isPlainObject(event) ? event : {};
    const occurredAt = timestamp(input.occurredAt || input.createdAt || fallback.occurredAt);
    const eventType = text(input.eventType || fallback.eventType, "ingested").toLowerCase();
    const method = enumValue(input.method || fallback.method, INGESTION_METHOD_VALUES, fallback.method, "provenance.method");
    const eventId = text(input.provenanceEventId) || stableId("provenance", {
      index,
      eventType,
      method,
      occurredAt,
      ownership,
      parentSourceArtifactIds: input.parentSourceArtifactIds || [],
      parentAssetIds: input.parentAssetIds || [],
    });
    return portableClone({
      provenanceEventId: eventId,
      eventType,
      method,
      occurredAt,
      actorType: text(input.actorType, "user"),
      actorId: opaqueId(input.actorId, "actorId"),
      parentSourceArtifactIds: uniqueTextList(input.parentSourceArtifactIds),
      parentAssetIds: uniqueTextList(input.parentAssetIds),
      processor: input.processor ? {
        name: text(input.processor.name),
        version: text(input.processor.version),
        model: text(input.processor.model),
      } : null,
      issueCodes: safeIssueCodes(input.issueCodes),
    });
  });
  normalized.sort((left, right) => left.occurredAt.localeCompare(right.occurredAt)
    || left.provenanceEventId.localeCompare(right.provenanceEventId));
  return normalized;
}

function normalizeStorageReference(value = {}) {
  const input = isPlainObject(value) ? value : {};
  for (const key of Object.keys(input)) {
    if (SECRET_FIELD.test(key) || TEMPORARY_REFERENCE_FIELD.test(key) || LOCAL_PATH_FIELD.test(key)) {
      throw new SourceContractError("unsafe_storage_reference", "Canonical storage references cannot contain credentials, temporary URLs, or local paths.", { field: key });
    }
  }
  const provider = text(input.provider);
  const blobId = opaqueId(input.blobId, "blobId");
  const objectKey = text(input.objectKey);
  if (objectKey && (/^https?:/i.test(objectKey) || /^[a-zA-Z]:|^[/\\]|\.\.(?:[/\\]|$)/.test(objectKey))) {
    throw new SourceContractError("unsafe_storage_reference", "Storage object keys must be deployment-relative, not URLs or filesystem paths.");
  }
  if (!provider && !blobId && !objectKey) return null;
  return portableClone({
    provider: provider || "application",
    blobId,
    objectKey: objectKey || null,
    region: text(input.region) || null,
  });
}

function inferAssetType({ assetType, mimeType, originalName }) {
  if (ASSET_TYPE_VALUES.has(text(assetType).toLowerCase())) return text(assetType).toLowerCase();
  const mime = text(mimeType).toLowerCase();
  const name = text(originalName).toLowerCase();
  if (mime.startsWith("image/")) return ASSET_TYPES.IMAGE;
  if (mime.startsWith("video/")) return ASSET_TYPES.VIDEO;
  if (mime.startsWith("audio/")) return ASSET_TYPES.AUDIO;
  if (mime.startsWith("text/") || /\.(md|txt|pdf|docx?)$/.test(name)) return ASSET_TYPES.DOCUMENT;
  if (/\.(js|jsx|ts|tsx|py|go|rs|java|cpp|c|h|html|css)$/.test(name)) return ASSET_TYPES.CODE;
  if (/\.(json|csv|parquet|xml|yaml|yml)$/.test(name)) return ASSET_TYPES.DATA;
  if (/\.(zip|tar|gz|7z|rar)$/.test(name)) return ASSET_TYPES.ARCHIVE;
  return ASSET_TYPES.OTHER;
}

export function normalizeAsset(input = {}, {
  workspaceId,
  projectId = null,
  campaignId = null,
  now = new Date().toISOString(),
} = {}) {
  assertSupportedSourceSchema(input);
  const exclusions = [];
  const sanitized = sanitizeObject(input, "asset", exclusions) || {};
  const ownerWorkspaceId = requiredId(sanitized.workspaceId || workspaceId, "workspaceId");
  const createdAt = timestamp(sanitized.createdAt || sanitized.uploadedAt || now);
  const updatedAt = timestamp(sanitized.updatedAt || createdAt);
  const originalName = text(sanitized.originalName || sanitized.name, "Untitled asset");
  const mimeType = text(sanitized.mimeType || sanitized.type, "application/octet-stream").toLowerCase();
  const byteSize = integer(sanitized.byteSize ?? sanitized.size);
  const hash = contentHash(sanitized.contentHash || sanitized.hash);
  const assetType = inferAssetType({ assetType: sanitized.assetType, mimeType, originalName });
  const lifecycle = text(sanitized.lifecycle || (sanitized.parentAssetIds?.length ? "derived" : "original"), "original").toLowerCase();
  if (!["original", "derived"].includes(lifecycle)) {
    throw new SourceContractError("invalid_asset_lifecycle", "Asset lifecycle must be original or derived.");
  }
  const storageRef = normalizeStorageReference(sanitized.storageRef || {
    provider: sanitized.storageProvider,
    blobId: sanitized.blobId,
    objectKey: sanitized.objectKey,
  });
  const owner = {
    workspaceId: ownerWorkspaceId,
    projectId: opaqueId(sanitized.projectId || projectId, "projectId"),
    campaignId: opaqueId(sanitized.campaignId || campaignId, "campaignId"),
  };
  const assetId = text(sanitized.assetId) || stableId("asset", {
    ownerWorkspaceId,
    contentHash: hash,
    originalName,
    mimeType,
    byteSize,
    storageRef,
  });
  const provenance = normalizeProvenance(sanitized.provenance, {
    eventType: lifecycle === "derived" ? "derived" : "captured",
    method: sanitized.ingestionMethod || INGESTION_METHODS.BROWSER_UPLOAD,
    occurredAt: createdAt,
  }, owner);
  return createDomainRecord("Asset", {
    assetId,
    assetVersionId: text(sanitized.assetVersionId) || stableId("asset-version", {
      assetId,
      contentHash: hash,
      byteSize,
      updatedAt,
    }),
    workspaceId: ownerWorkspaceId,
    projectId: owner.projectId,
    campaignId: owner.campaignId,
    assetType,
    lifecycle,
    originalName,
    mimeType,
    byteSize,
    dimensions: dimensions(sanitized.dimensions),
    durationMs: integer(sanitized.durationMs) || null,
    contentHash: hash,
    storageRef,
    blobId: storageRef?.blobId || null,
    contentType: mimeType,
    availability: text(sanitized.availability, storageRef ? "available" : "metadata_only"),
    userMetadata: sanitizedUserMetadata(sanitized.userMetadata || {
      description: sanitized.description,
      tags: sanitized.tags,
      altText: sanitized.altText,
      intendedUse: sanitized.intendedUse,
    }),
    privacy: normalizePrivacy(sanitized.privacy, PRIVACY_CLASSES.WORKSPACE_PRIVATE),
    provenance,
    parentAssetIds: uniqueTextList(sanitized.parentAssetIds),
    derivedAssetIds: uniqueTextList(sanitized.derivedAssetIds),
    uploadState: enumValue(sanitized.uploadState, UPLOAD_VALUES, storageRef ? UPLOAD_STATES.COMPLETE : UPLOAD_STATES.PENDING, "uploadState"),
    processingState: enumValue(sanitized.processingState, PROCESSING_VALUES, PROCESSING_STATES.NOT_REQUESTED, "processingState"),
    retention: normalizeRetention(sanitized.retention),
    deletion: normalizeDeletion(sanitized.deletion),
    normalizationExclusions: exclusions,
    transferProvenance: sanitized.transferProvenance ? portableClone(sanitized.transferProvenance) : null,
    importedHistoricalRecord: Boolean(sanitized.importedHistoricalRecord),
    createdAt,
    updatedAt,
  });
}

function defaultUsability({ extractedText, extractionState, sourceKind }) {
  if (text(extractedText)) return SOURCE_USABILITY_STATES.USABLE_EVIDENCE;
  if (extractionState === PROCESSING_STATES.PROCESSING || extractionState === PROCESSING_STATES.QUEUED) {
    return SOURCE_USABILITY_STATES.PROCESSING;
  }
  if (extractionState === PROCESSING_STATES.FAILED) return SOURCE_USABILITY_STATES.FAILED;
  if (extractionState === PROCESSING_STATES.UNSUPPORTED) return SOURCE_USABILITY_STATES.REFERENCE_ONLY;
  if ([SOURCE_KINDS.NOTE, SOURCE_KINDS.REPOSITORY_FILE].includes(sourceKind)) return SOURCE_USABILITY_STATES.USABLE_EVIDENCE;
  return SOURCE_USABILITY_STATES.REFERENCE_ONLY;
}

function normalizeExtraction(value = {}, legacy = {}) {
  const input = isPlainObject(value) ? value : {};
  const state = enumValue(
    input.state || (legacy.extracted ? PROCESSING_STATES.COMPLETE : undefined),
    PROCESSING_VALUES,
    PROCESSING_STATES.NOT_REQUESTED,
    "extraction.state",
  );
  const charCount = integer(input.charCount ?? legacy.charCount);
  return portableClone({
    state,
    textHash: contentHash(input.textHash),
    textFingerprint: text(input.textFingerprint) || null,
    charCount,
    truncated: Boolean(input.truncated),
    processor: input.processor ? {
      name: text(input.processor.name),
      version: text(input.processor.version),
      model: text(input.processor.model),
    } : null,
    issueCodes: safeIssueCodes(input.issueCodes),
  });
}

export function normalizeSourceArtifact(input = {}, {
  workspaceId,
  projectId = null,
  campaignId = null,
  now = new Date().toISOString(),
} = {}) {
  assertSupportedSourceSchema(input);
  const exclusions = [];
  const sanitized = sanitizeObject(input, "sourceArtifact", exclusions) || {};
  const ownerWorkspaceId = requiredId(sanitized.workspaceId || workspaceId, "workspaceId");
  const ownerCampaignId = opaqueId(sanitized.campaignId || campaignId, "campaignId");
  const ownerProjectId = opaqueId(sanitized.projectId || projectId, "projectId");
  const sourceKind = enumValue(
    sanitized.sourceKind || sanitized.artifactType,
    SOURCE_KIND_VALUES,
    SOURCE_KINDS.UPLOAD,
    "sourceKind",
  );
  const ingestionMethod = enumValue(
    sanitized.ingestionMethod,
    INGESTION_METHOD_VALUES,
    sourceKind === SOURCE_KINDS.NOTE ? INGESTION_METHODS.USER_NOTE : INGESTION_METHODS.BROWSER_UPLOAD,
    "ingestionMethod",
  );
  const createdAt = timestamp(sanitized.createdAt || sanitized.capturedAt || sanitized.uploadedAt || now);
  const updatedAt = timestamp(sanitized.updatedAt || createdAt);
  const privacy = normalizePrivacy(
    sanitized.privacy,
    sourceKind === SOURCE_KINDS.LINK ? PRIVACY_CLASSES.PUBLIC
      : sourceKind === SOURCE_KINDS.TRUSTED_LOCAL_REPOSITORY ? PRIVACY_CLASSES.DEVICE_PRIVATE
        : PRIVACY_CLASSES.WORKSPACE_PRIVATE,
  );
  const reference = normalizeSourceReference(sourceKind, sanitized.sourceReference || sanitized, privacy.classification);
  const extraction = normalizeExtraction(sanitized.extraction, {
    extracted: sanitized.extracted,
    charCount: text(sanitized.extractedText || sanitized.documentText).length,
  });
  const usabilityState = enumValue(
    sanitized.usability?.state || sanitized.usabilityState,
    USABILITY_VALUES,
    defaultUsability({
      extractedText: sanitized.extractedText || sanitized.documentText,
      extractionState: extraction.state,
      sourceKind,
    }),
    "usability.state",
  );
  const evidenceState = enumValue(
    sanitized.usability?.evidenceState || sanitized.evidenceState,
    EVIDENCE_VALUES,
    usabilityState === SOURCE_USABILITY_STATES.USABLE_EVIDENCE
      ? EVIDENCE_STATES.VERIFIED
      : EVIDENCE_STATES.UNVERIFIED,
    "usability.evidenceState",
  );
  if (usabilityState === SOURCE_USABILITY_STATES.USABLE_EVIDENCE
    && [SOURCE_KINDS.LINK, SOURCE_KINDS.EXTENSION_PAGE].includes(sourceKind)
    && reference.safetyVerification !== "verified") {
    throw new SourceContractError(
      "unverified_remote_evidence",
      "Remote URL artifacts cannot be usable evidence until the hardened fetch boundary verifies them.",
    );
  }
  const contentHashValue = contentHash(sanitized.contentHash || sanitized.hash || extraction.textHash);
  const assetIds = uniqueTextList(sanitized.assetIds || (sanitized.assetId ? [sanitized.assetId] : []));
  const ownership = {
    workspaceId: ownerWorkspaceId,
    projectId: ownerProjectId,
    campaignId: ownerCampaignId,
  };
  const sourceArtifactId = text(sanitized.sourceArtifactId) || stableId("source-artifact", {
    ownership,
    sourceKind,
    ingestionMethod,
    reference,
    assetIds: sanitized.assetIds || [],
    contentHash: contentHashValue,
    createdAt,
  });
  const provenance = normalizeProvenance(sanitized.provenance, {
    eventType: sourceKind === SOURCE_KINDS.IMPORTED_ARCHIVE ? "imported" : "ingested",
    method: ingestionMethod,
    occurredAt: createdAt,
  }, ownership);
  return createDomainRecord("SourceArtifact", {
    sourceArtifactId,
    sourceArtifactVersionId: text(sanitized.sourceArtifactVersionId) || stableId("source-version", {
      sourceArtifactId,
      contentHash: contentHashValue,
      extraction,
      updatedAt,
    }),
    workspaceId: ownerWorkspaceId,
    projectId: ownerProjectId,
    campaignId: ownerCampaignId,
    artifactType: sourceKind,
    sourceKind,
    ingestionMethod,
    sourceReference: reference,
    originalName: text(sanitized.originalName || sanitized.name || reference.displayName || reference.title, "Untitled source"),
    mimeType: text(sanitized.mimeType || sanitized.type, "application/octet-stream").toLowerCase(),
    byteSize: integer(sanitized.byteSize ?? sanitized.size),
    contentHash: contentHashValue,
    assetIds,
    assetId: assetIds[0] || null,
    extraction,
    usability: {
      state: usabilityState,
      evidenceState,
      issueCodes: safeIssueCodes(sanitized.usability?.issueCodes || sanitized.issueCodes),
    },
    userMetadata: sanitizedUserMetadata(sanitized.userMetadata || {
      description: sanitized.description,
      tags: sanitized.tags,
      altText: sanitized.altText,
      intendedUse: sanitized.intendedUse,
    }),
    privacy,
    provenance,
    parentSourceArtifactIds: uniqueTextList(sanitized.parentSourceArtifactIds),
    derivedSourceArtifactIds: uniqueTextList(sanitized.derivedSourceArtifactIds),
    generationRunIds: uniqueTextList(sanitized.generationRunIds),
    sourceSnapshotIds: uniqueTextList(sanitized.sourceSnapshotIds),
    retention: normalizeRetention(sanitized.retention),
    deletion: normalizeDeletion(sanitized.deletion),
    normalizationExclusions: exclusions,
    transferProvenance: sanitized.transferProvenance ? portableClone(sanitized.transferProvenance) : null,
    importedHistoricalRecord: Boolean(sanitized.importedHistoricalRecord),
    createdAt,
    updatedAt,
  });
}

export function normalizeAssetProcessing(input = {}, {
  workspaceId,
  now = new Date().toISOString(),
} = {}) {
  assertSupportedSourceSchema(input);
  const exclusions = [];
  const sanitized = sanitizeObject(input, "assetProcessing", exclusions) || {};
  const ownerWorkspaceId = requiredId(sanitized.workspaceId || workspaceId, "workspaceId");
  const sourceArtifactId = requiredId(sanitized.sourceArtifactId, "sourceArtifactId");
  const processorName = text(sanitized.processor?.name || sanitized.processorName);
  const processorVersion = text(sanitized.processor?.version || sanitized.processorVersion);
  if (!processorName || !processorVersion) {
    throw new SourceContractError("missing_processor_identity", "Processing records require processor name and version.");
  }
  const createdAt = timestamp(sanitized.createdAt || sanitized.startedAt || now);
  const status = enumValue(sanitized.status, PROCESSING_RECORD_VALUES, PROCESSING_RECORD_STATUSES.QUEUED, "status");
  const processingId = text(sanitized.processingId) || stableId("processing", {
    ownerWorkspaceId,
    sourceArtifactId,
    processorName,
    processorVersion,
    createdAt,
  });
  return createDomainRecord("AssetProcessing", {
    processingId,
    workspaceId: ownerWorkspaceId,
    projectId: opaqueId(sanitized.projectId, "projectId"),
    campaignId: opaqueId(sanitized.campaignId, "campaignId"),
    sourceArtifactId,
    inputAssetIds: uniqueTextList(sanitized.inputAssetIds),
    outputAssetIds: uniqueTextList(sanitized.outputAssetIds),
    outputSourceArtifactIds: uniqueTextList(sanitized.outputSourceArtifactIds),
    processor: {
      name: processorName,
      version: processorVersion,
      model: text(sanitized.processor?.model || sanitized.model) || null,
    },
    status,
    issueCodes: safeIssueCodes(sanitized.issueCodes),
    startedAt: sanitized.startedAt ? timestamp(sanitized.startedAt) : null,
    completedAt: sanitized.completedAt ? timestamp(sanitized.completedAt) : null,
    normalizationExclusions: exclusions,
    transferProvenance: sanitized.transferProvenance ? portableClone(sanitized.transferProvenance) : null,
    importedHistoricalRecord: Boolean(sanitized.importedHistoricalRecord),
    createdAt,
    updatedAt: timestamp(sanitized.updatedAt || sanitized.completedAt || createdAt),
  });
}

export function migrateLegacyAsset(input = {}, context = {}) {
  if (input?.kind === "Asset" && input?.schemaVersion === DOMAIN_SCHEMA_VERSION) {
    return normalizeAsset(parseDomainRecord(input, "Asset"), context);
  }
  return normalizeAsset({
    ...input,
    originalName: input.originalName || input.name,
    mimeType: input.mimeType || input.type,
    byteSize: input.byteSize ?? input.size,
    userMetadata: input.userMetadata || { description: input.description },
    uploadState: input.uploadState || (input.blobId ? UPLOAD_STATES.COMPLETE : UPLOAD_STATES.PENDING),
  }, context);
}

export function migrateLegacySourceArtifact(input = {}, context = {}) {
  const source = input?.kind === "SourceArtifact" && input?.schemaVersion === DOMAIN_SCHEMA_VERSION
    ? parseDomainRecord(input, "SourceArtifact")
    : input;
  const requestedKind = text(source.sourceKind || source.artifactType).toLowerCase();
  const legacyKindMap = Object.freeze({
    document: SOURCE_KINDS.UPLOAD,
    image: SOURCE_KINDS.UPLOAD,
    video: SOURCE_KINDS.UPLOAD,
    audio: SOURCE_KINDS.UPLOAD,
    file: SOURCE_KINDS.UPLOAD,
    media: SOURCE_KINDS.UPLOAD,
    webpage: SOURCE_KINDS.LINK,
    page: SOURCE_KINDS.LINK,
    url: SOURCE_KINDS.LINK,
    repo: SOURCE_KINDS.REPOSITORY,
    github: SOURCE_KINDS.REPOSITORY,
  });
  const legacyKind = SOURCE_KIND_VALUES.has(requestedKind)
    ? requestedKind
    : legacyKindMap[requestedKind] || SOURCE_KINDS.UPLOAD;
  return normalizeSourceArtifact({
    ...source,
    sourceKind: legacyKind,
    ingestionMethod: source.ingestionMethod || INGESTION_METHODS.BROWSER_UPLOAD,
    originalName: source.originalName || source.name,
    mimeType: source.mimeType || source.type,
    byteSize: source.byteSize ?? source.size,
    extraction: source.extraction || {
      state: source.extracted ? PROCESSING_STATES.COMPLETE : PROCESSING_STATES.NOT_REQUESTED,
      charCount: text(source.documentText || source.extractedText).length,
    },
    usability: source.usability || {
      state: source.extracted ? SOURCE_USABILITY_STATES.USABLE_EVIDENCE : SOURCE_USABILITY_STATES.REFERENCE_ONLY,
      evidenceState: source.extracted ? EVIDENCE_STATES.VERIFIED : EVIDENCE_STATES.UNVERIFIED,
      issueCodes: source.extracted ? [] : ["legacy.reference_only"],
    },
    userMetadata: source.userMetadata || { description: source.description },
  }, context);
}

export function createUploadSourceBundle({
  file,
  extractedText = "",
  extractionFailed = false,
  workspaceId,
  projectId = null,
  campaignId = null,
  assetId,
  sourceArtifactId,
  now = new Date().toISOString(),
} = {}) {
  if (!isPlainObject(file)) {
    throw new SourceContractError("runtime_file_forbidden", "Upload normalization accepts plain metadata, not a browser File object.");
  }
  const asset = normalizeAsset({
    assetId,
    workspaceId,
    projectId,
    campaignId,
    originalName: file.name,
    mimeType: file.type || "application/octet-stream",
    byteSize: file.size,
    assetType: file.assetType,
    storageRef: file.blobId ? { provider: "browser", blobId: file.blobId } : null,
    uploadState: file.blobId ? UPLOAD_STATES.COMPLETE : UPLOAD_STATES.PENDING,
    processingState: text(extractedText) ? PROCESSING_STATES.COMPLETE
      : extractionFailed ? PROCESSING_STATES.FAILED : PROCESSING_STATES.NOT_REQUESTED,
    userMetadata: { description: file.description || "" },
    privacy: file.privacy,
    ingestionMethod: INGESTION_METHODS.BROWSER_UPLOAD,
    createdAt: now,
    updatedAt: now,
  }, { workspaceId, projectId, campaignId, now });
  const textValue = text(extractedText);
  const textFingerprint = textValue ? `sftext1-${fnv1a64(textValue)}` : null;
  const sourceArtifact = normalizeSourceArtifact({
    sourceArtifactId,
    workspaceId,
    projectId,
    campaignId,
    sourceKind: SOURCE_KINDS.UPLOAD,
    ingestionMethod: INGESTION_METHODS.BROWSER_UPLOAD,
    sourceReference: {
      displayName: file.name,
      clientReferenceId: file.clientReferenceId || null,
    },
    originalName: file.name,
    mimeType: file.type || "application/octet-stream",
    byteSize: file.size,
    assetIds: [asset.assetId],
    extraction: {
      state: textValue ? PROCESSING_STATES.COMPLETE
        : extractionFailed ? PROCESSING_STATES.FAILED : PROCESSING_STATES.NOT_REQUESTED,
      textHash: file.textHash || null,
      textFingerprint,
      charCount: textValue.length,
      truncated: Boolean(file.truncated),
      processor: textValue ? { name: "browser-text-reader", version: "1" } : null,
      issueCodes: extractionFailed ? ["browser.extraction_failed"] : [],
    },
    usability: {
      state: textValue ? SOURCE_USABILITY_STATES.USABLE_EVIDENCE : SOURCE_USABILITY_STATES.REFERENCE_ONLY,
      evidenceState: textValue ? EVIDENCE_STATES.VERIFIED : EVIDENCE_STATES.UNVERIFIED,
      issueCodes: textValue ? [] : [extractionFailed ? "browser.extraction_failed" : "browser.reference_only"],
    },
    userMetadata: {
      description: textValue
        ? "Text content extracted in the browser."
        : extractionFailed
          ? "Browser extraction failed; retained as a reference."
          : "Asset metadata retained as a reference; semantic analysis is unavailable.",
    },
    privacy: file.privacy,
    createdAt: now,
    updatedAt: now,
  }, { workspaceId, projectId, campaignId, now });
  return { asset, sourceArtifact, extractedText: textValue };
}

export function sourceArtifactSnapshotReference(input, context = {}) {
  const artifact = migrateLegacySourceArtifact(input, context);
  return portableClone({
    sourceArtifactId: artifact.sourceArtifactId,
    sourceArtifactVersionId: artifact.sourceArtifactVersionId,
    sourceKind: artifact.sourceKind,
    usabilityState: artifact.usability.state,
    evidenceState: artifact.usability.evidenceState,
    contentHash: artifact.contentHash,
    assetIds: artifact.assetIds,
  });
}

export function projectGenerationMediaItem(input, context = {}) {
  const artifact = migrateLegacySourceArtifact(input, context);
  return portableClone({
    sourceArtifactId: artifact.sourceArtifactId,
    sourceArtifactVersionId: artifact.sourceArtifactVersionId,
    name: artifact.originalName,
    type: artifact.mimeType,
    size: artifact.byteSize,
    description: artifact.userMetadata.description,
    usabilityState: artifact.usability.state,
    evidenceState: artifact.usability.evidenceState,
    assetIds: artifact.assetIds,
  });
}

export function updateSourceArtifactMetadata(input, metadata, context = {}) {
  const artifact = migrateLegacySourceArtifact(input, context);
  return normalizeSourceArtifact({
    ...artifact,
    userMetadata: sanitizedUserMetadata({ ...artifact.userMetadata, ...metadata }),
    provenance: artifact.provenance,
    createdAt: artifact.createdAt,
    updatedAt: context.now || new Date().toISOString(),
  }, {
    workspaceId: artifact.workspaceId,
    projectId: artifact.projectId,
    campaignId: artifact.campaignId,
    now: context.now || new Date().toISOString(),
  });
}

function detectParentCycle(records, idField, parentsField) {
  const recordsById = new Map(records.map((record) => [record[idField], record]));
  const visiting = new Set();
  const visited = new Set();
  function visit(id) {
    if (visited.has(id)) return;
    if (visiting.has(id)) {
      throw new SourceContractError("provenance_cycle", "Source provenance cannot contain parent cycles.", { id });
    }
    visiting.add(id);
    const record = recordsById.get(id);
    for (const parentId of record?.[parentsField] || []) {
      if (recordsById.has(parentId)) visit(parentId);
    }
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of recordsById.keys()) visit(id);
}

export function validateSourceGraph({
  assets = [],
  sourceArtifacts = [],
  processingRecords = [],
  workspaceId,
  campaignId = null,
} = {}) {
  const ownerWorkspaceId = requiredId(workspaceId, "workspaceId");
  const normalizedAssets = assets.map((asset) => migrateLegacyAsset(asset, {
    workspaceId: ownerWorkspaceId,
    campaignId,
  }));
  const normalizedArtifacts = sourceArtifacts.map((artifact) => migrateLegacySourceArtifact(artifact, {
    workspaceId: ownerWorkspaceId,
    campaignId,
  }));
  const normalizedProcessing = processingRecords.map((record) => normalizeAssetProcessing(record, {
    workspaceId: ownerWorkspaceId,
  }));
  const unique = (records, field) => {
    const seen = new Set();
    for (const record of records) {
      if (seen.has(record[field])) throw new SourceContractError("duplicate_source_id", `${field} must be unique.`, { id: record[field] });
      seen.add(record[field]);
    }
  };
  unique(normalizedAssets, "assetId");
  unique(normalizedArtifacts, "sourceArtifactId");
  unique(normalizedProcessing, "processingId");
  const assetsById = new Map(normalizedAssets.map((asset) => [asset.assetId, asset]));
  const artifactsById = new Map(normalizedArtifacts.map((artifact) => [artifact.sourceArtifactId, artifact]));
  for (const asset of normalizedAssets) {
    if (asset.workspaceId !== ownerWorkspaceId) {
      throw new SourceContractError("cross_workspace_reference", "Asset belongs to another workspace.", { assetId: asset.assetId });
    }
    if (campaignId && asset.campaignId && asset.campaignId !== campaignId) {
      throw new SourceContractError("cross_campaign_reference", "Asset belongs to another campaign.", { assetId: asset.assetId });
    }
    for (const parentId of asset.parentAssetIds) {
      const parent = assetsById.get(parentId);
      if (!parent) {
        throw new SourceContractError("missing_asset_reference", "Derived asset references a missing parent asset.", { assetId: asset.assetId, parentId });
      }
      if (parent.workspaceId !== asset.workspaceId) {
        throw new SourceContractError("cross_workspace_reference", "Derived assets cannot reference another workspace.", { assetId: asset.assetId, parentId });
      }
    }
    for (const derivedId of asset.derivedAssetIds) {
      const derived = assetsById.get(derivedId);
      if (!derived) {
        throw new SourceContractError("missing_asset_reference", "Asset references a missing derived asset.", { assetId: asset.assetId, derivedId });
      }
      if (derived.workspaceId !== asset.workspaceId) {
        throw new SourceContractError("cross_workspace_reference", "Asset derivation links cannot cross workspaces.", { assetId: asset.assetId, derivedId });
      }
    }
  }
  for (const artifact of normalizedArtifacts) {
    if (artifact.workspaceId !== ownerWorkspaceId) {
      throw new SourceContractError("cross_workspace_reference", "Source artifact belongs to another workspace.", { sourceArtifactId: artifact.sourceArtifactId });
    }
    if (campaignId && artifact.campaignId && artifact.campaignId !== campaignId) {
      throw new SourceContractError("cross_campaign_reference", "Source artifact belongs to another campaign.", { sourceArtifactId: artifact.sourceArtifactId });
    }
    for (const assetId of artifact.assetIds) {
      const asset = assetsById.get(assetId);
      if (!asset) throw new SourceContractError("missing_asset_reference", "Source artifact references a missing asset.", { sourceArtifactId: artifact.sourceArtifactId, assetId });
      if (asset.workspaceId !== artifact.workspaceId) {
        throw new SourceContractError("cross_workspace_reference", "Source artifact and asset must share a workspace.", { sourceArtifactId: artifact.sourceArtifactId, assetId });
      }
    }
    for (const parentId of artifact.parentSourceArtifactIds) {
      const parent = artifactsById.get(parentId);
      if (!parent) {
        throw new SourceContractError("missing_source_artifact", "Source artifact references a missing parent artifact.", { sourceArtifactId: artifact.sourceArtifactId, parentId });
      }
      if (parent.workspaceId !== artifact.workspaceId) {
        throw new SourceContractError("cross_workspace_reference", "Source provenance cannot cross workspaces.", { sourceArtifactId: artifact.sourceArtifactId, parentId });
      }
    }
    for (const derivedId of artifact.derivedSourceArtifactIds) {
      const derived = artifactsById.get(derivedId);
      if (!derived) {
        throw new SourceContractError("missing_source_artifact", "Source artifact references a missing derived artifact.", { sourceArtifactId: artifact.sourceArtifactId, derivedId });
      }
      if (derived.workspaceId !== artifact.workspaceId) {
        throw new SourceContractError("cross_workspace_reference", "Source derivation links cannot cross workspaces.", { sourceArtifactId: artifact.sourceArtifactId, derivedId });
      }
    }
  }
  for (const record of normalizedProcessing) {
    const artifact = artifactsById.get(record.sourceArtifactId);
    if (!artifact) throw new SourceContractError("missing_source_artifact", "Processing record references a missing source artifact.", { processingId: record.processingId });
    if (record.workspaceId !== artifact.workspaceId) {
      throw new SourceContractError("cross_workspace_reference", "Processing record and source artifact must share a workspace.", { processingId: record.processingId });
    }
    for (const assetId of [...record.inputAssetIds, ...record.outputAssetIds]) {
      const asset = assetsById.get(assetId);
      if (!asset) throw new SourceContractError("missing_asset_reference", "Processing record references a missing asset.", { processingId: record.processingId, assetId });
      if (asset.workspaceId !== record.workspaceId) {
        throw new SourceContractError("cross_workspace_reference", "Processing record cannot reference another workspace.", { processingId: record.processingId, assetId });
      }
    }
    for (const artifactId of record.outputSourceArtifactIds) {
      const output = artifactsById.get(artifactId);
      if (!output) {
        throw new SourceContractError("missing_source_artifact", "Processing record references a missing output source artifact.", { processingId: record.processingId, artifactId });
      }
      if (output.workspaceId !== record.workspaceId) {
        throw new SourceContractError("cross_workspace_reference", "Processing output cannot cross workspaces.", { processingId: record.processingId, artifactId });
      }
    }
  }
  detectParentCycle(normalizedAssets, "assetId", "parentAssetIds");
  detectParentCycle(normalizedArtifacts, "sourceArtifactId", "parentSourceArtifactIds");
  return portableClone({
    schemaVersion: SOURCE_CONTRACT_SCHEMA_VERSION,
    workspaceId: ownerWorkspaceId,
    campaignId: campaignId || null,
    assets: normalizedAssets,
    sourceArtifacts: normalizedArtifacts,
    processingRecords: normalizedProcessing,
  });
}
