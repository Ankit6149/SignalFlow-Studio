import {
  createDomainRecord,
  parseDomainRecord,
  portableClone,
} from "./contracts.mjs";
import { PRIVACY_CLASSES } from "./sourceArtifacts.mjs";

export const CONTENT_SIGNAL_SCHEMA_VERSION = 1;

export const CONTENT_SIGNAL_STATUSES = Object.freeze({
  NEW: "new",
  INTERPRETED: "interpreted",
  USED: "used",
  IGNORED: "ignored",
  SNOOZED: "snoozed",
  ARCHIVED: "archived",
});

export const CONTENT_SIGNAL_KINDS = Object.freeze({
  FEATURE: "feature",
  BUGFIX: "bugfix",
  RELEASE: "release",
  MILESTONE: "milestone",
  LESSON: "lesson",
  THOUGHT: "thought",
  RESEARCH: "research",
  LAUNCH: "launch",
  PERSONAL_UPDATE: "personal_update",
  CAREER_UPDATE: "career_update",
  OPINION: "opinion",
  QUESTION: "question",
  EXTERNAL_TOPIC: "external_topic",
  OTHER: "other",
});

export const CONTENT_SIGNAL_SOURCE_TYPES = Object.freeze({
  MANUAL: "manual",
  GITHUB: "github",
  BROWSER: "browser",
  FILE: "file",
  API: "api",
  MCP: "mcp",
  OTHER: "other",
});

const STATUS_VALUES = new Set(Object.values(CONTENT_SIGNAL_STATUSES));
const KIND_VALUES = new Set(Object.values(CONTENT_SIGNAL_KINDS));
const SOURCE_TYPE_VALUES = new Set(Object.values(CONTENT_SIGNAL_SOURCE_TYPES));
const PRIVACY_VALUES = new Set(Object.values(PRIVACY_CLASSES));
const DEFAULT_PRIVACY = PRIVACY_CLASSES.WORKSPACE_PRIVATE;

function text(value, fallback = "", maxLength = 10000) {
  const normalized = String(value ?? "").replace(/\r\n?/g, "\n").trim();
  const resolved = normalized || fallback;
  if (resolved.length > maxLength) {
    throw new TypeError(`ContentSignal text exceeds the ${maxLength} character limit.`);
  }
  return resolved;
}

function optionalText(value, maxLength = 10000) {
  const normalized = text(value, "", maxLength);
  return normalized || null;
}

function enumValue(value, allowed, fallback, field) {
  const normalized = text(value, fallback, 80).toLowerCase();
  if (!allowed.has(normalized)) {
    throw new TypeError(`ContentSignal.${field} contains an unsupported value: ${normalized}.`);
  }
  return normalized;
}

function timestamp(value, fallback = null, field = "timestamp") {
  const candidate = value || fallback;
  if (!candidate) return null;
  const parsed = Date.parse(candidate);
  if (!Number.isFinite(parsed)) throw new TypeError(`ContentSignal.${field} must be an ISO-compatible timestamp.`);
  return new Date(parsed).toISOString();
}

function opaqueId(value, field, { required = false } = {}) {
  const normalized = text(value, "", 240);
  if (!normalized) {
    if (required) throw new TypeError(`ContentSignal.${field} is required.`);
    return null;
  }
  if (/[/\\]|^[a-zA-Z]:/.test(normalized)) {
    throw new TypeError(`ContentSignal.${field} must be an opaque ID, not a filesystem path.`);
  }
  return normalized;
}

function uniqueIds(values, field) {
  if (values === undefined || values === null) return [];
  if (!Array.isArray(values)) throw new TypeError(`ContentSignal.${field} must be an array of IDs.`);
  return Array.from(new Set(values.map((value) => opaqueId(value, field, { required: true })))).sort();
}

function uniqueHints(values) {
  if (values === undefined || values === null) return [];
  if (!Array.isArray(values)) throw new TypeError("ContentSignal.importanceHints must be an array.");
  return Array.from(new Set(values.map((value) => text(value, "", 120)).filter(Boolean))).sort();
}

function normalizeExternalEventRef(value) {
  if (value === undefined || value === null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("ContentSignal.externalEventRef must be a portable object.");
  }
  const provider = optionalText(value.provider, 80)?.toLowerCase() || null;
  const eventId = optionalText(value.eventId, 240);
  const idempotencyKey = optionalText(value.idempotencyKey, 240);
  if (!provider || !eventId) {
    throw new TypeError("ContentSignal.externalEventRef requires provider and eventId.");
  }
  return portableClone({ provider, eventId, idempotencyKey });
}

function normalizeProvenance(value, { sourceType, observedAt }) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("ContentSignal.provenance must be a portable object.");
  }
  const source = text(value.source, sourceType, 80).toLowerCase();
  const ingestionMethod = text(value.ingestionMethod, sourceType === CONTENT_SIGNAL_SOURCE_TYPES.MANUAL ? "user_input" : sourceType, 80).toLowerCase();
  const capturedAt = timestamp(value.capturedAt, observedAt, "provenance.capturedAt");
  const actorRef = optionalText(value.actorRef, 120);
  return portableClone({ source, ingestionMethod, capturedAt, actorRef });
}

function assertSignalSchema(input) {
  if (input?.signalSchemaVersion === undefined || input?.signalSchemaVersion === null) return;
  if (!Number.isInteger(input.signalSchemaVersion)) {
    throw new TypeError("ContentSignal.signalSchemaVersion must be an integer.");
  }
  if (input.signalSchemaVersion > CONTENT_SIGNAL_SCHEMA_VERSION) {
    throw new TypeError(
      `ContentSignal schema ${input.signalSchemaVersion} is newer than supported schema ${CONTENT_SIGNAL_SCHEMA_VERSION}. Upgrade SignalFlow before importing it.`,
    );
  }
}

export function normalizeContentSignal(input = {}) {
  assertSignalSchema(input);
  const parsed = input?.kind === "ContentSignal" ? parseDomainRecord(input, "ContentSignal") : input;
  const observedAt = timestamp(parsed.observedAt || parsed.createdAt, null, "observedAt");
  if (!observedAt) throw new TypeError("ContentSignal.observedAt is required.");
  const sourceType = enumValue(parsed.sourceType, SOURCE_TYPE_VALUES, CONTENT_SIGNAL_SOURCE_TYPES.MANUAL, "sourceType");
  const status = enumValue(parsed.status, STATUS_VALUES, CONTENT_SIGNAL_STATUSES.NEW, "status");
  const snoozedUntil = timestamp(parsed.snoozedUntil, null, "snoozedUntil");
  if (status === CONTENT_SIGNAL_STATUSES.SNOOZED && !snoozedUntil) {
    throw new TypeError("A snoozed ContentSignal requires snoozedUntil.");
  }

  return createDomainRecord("ContentSignal", {
    signalSchemaVersion: CONTENT_SIGNAL_SCHEMA_VERSION,
    signalId: opaqueId(parsed.signalId, "signalId", { required: true }),
    workspaceId: opaqueId(parsed.workspaceId, "workspaceId", { required: true }),
    projectId: opaqueId(parsed.projectId, "projectId"),
    sourceType,
    sourceConnectionId: opaqueId(parsed.sourceConnectionId, "sourceConnectionId"),
    sourceRevision: optionalText(parsed.sourceRevision, 240),
    sourceArtifactIds: uniqueIds(parsed.sourceArtifactIds, "sourceArtifactIds"),
    assetIds: uniqueIds(parsed.assetIds, "assetIds"),
    externalEventRef: normalizeExternalEventRef(parsed.externalEventRef),
    occurredAt: timestamp(parsed.occurredAt, null, "occurredAt"),
    observedAt,
    createdAt: timestamp(parsed.createdAt, observedAt, "createdAt"),
    updatedAt: timestamp(parsed.updatedAt, observedAt, "updatedAt"),
    headline: text(parsed.headline, "", 240),
    summary: text(parsed.summary, "", 12000),
    signalKind: enumValue(parsed.signalKind, KIND_VALUES, CONTENT_SIGNAL_KINDS.THOUGHT, "signalKind"),
    importanceHints: uniqueHints(parsed.importanceHints),
    privacyClassification: enumValue(parsed.privacyClassification, PRIVACY_VALUES, DEFAULT_PRIVACY, "privacyClassification"),
    boundaryNote: optionalText(parsed.boundaryNote, 4000),
    status,
    snoozedUntil: status === CONTENT_SIGNAL_STATUSES.SNOOZED ? snoozedUntil : null,
    statusChangedAt: timestamp(parsed.statusChangedAt, parsed.updatedAt || observedAt, "statusChangedAt"),
    provenance: normalizeProvenance(parsed.provenance, { sourceType, observedAt }),
  });
}

export function createManualContentSignal({
  signalId,
  workspaceId,
  projectId = null,
  headline,
  summary = "",
  signalKind = CONTENT_SIGNAL_KINDS.THOUGHT,
  sourceArtifactIds = [],
  assetIds = [],
  occurredAt = null,
  privacyClassification = DEFAULT_PRIVACY,
  boundaryNote = null,
  importanceHints = [],
  observedAt,
  actorRef = "local-owner",
} = {}) {
  const normalizedHeadline = text(headline || summary, "", 240);
  if (!normalizedHeadline) throw new TypeError("A manual ContentSignal requires a thought or headline.");
  return normalizeContentSignal({
    signalId,
    workspaceId,
    projectId,
    sourceType: CONTENT_SIGNAL_SOURCE_TYPES.MANUAL,
    sourceRevision: null,
    sourceArtifactIds,
    assetIds,
    occurredAt,
    observedAt,
    createdAt: observedAt,
    updatedAt: observedAt,
    headline: normalizedHeadline,
    summary: text(summary || headline, "", 12000),
    signalKind,
    importanceHints,
    privacyClassification,
    boundaryNote,
    status: CONTENT_SIGNAL_STATUSES.NEW,
    statusChangedAt: observedAt,
    provenance: {
      source: "manual",
      ingestionMethod: "user_input",
      capturedAt: observedAt,
      actorRef,
    },
  });
}

export function createConnectedContentSignal({
  signalId,
  workspaceId,
  projectId = null,
  sourceType,
  sourceConnectionId,
  sourceRevision = null,
  externalEventRef,
  headline,
  summary = "",
  signalKind = CONTENT_SIGNAL_KINDS.OTHER,
  sourceArtifactIds = [],
  assetIds = [],
  occurredAt = null,
  privacyClassification = DEFAULT_PRIVACY,
  boundaryNote = null,
  importanceHints = [],
  observedAt,
  actorRef = "source-ingestion",
} = {}) {
  const normalizedSourceType = enumValue(sourceType, SOURCE_TYPE_VALUES, CONTENT_SIGNAL_SOURCE_TYPES.OTHER, "sourceType");
  if (normalizedSourceType === CONTENT_SIGNAL_SOURCE_TYPES.MANUAL) {
    throw new TypeError("Connected ContentSignals cannot use the manual source type.");
  }
  const normalizedConnectionId = opaqueId(sourceConnectionId, "sourceConnectionId", { required: true });
  const normalizedEventRef = normalizeExternalEventRef(externalEventRef);
  if (normalizedSourceType !== CONTENT_SIGNAL_SOURCE_TYPES.OTHER && normalizedEventRef.provider !== normalizedSourceType) {
    throw new TypeError("Connected ContentSignal sourceType must match externalEventRef.provider.");
  }
  const normalizedHeadline = text(headline || summary, "", 240);
  if (!normalizedHeadline) throw new TypeError("A connected ContentSignal requires a headline or summary.");

  return normalizeContentSignal({
    signalId,
    workspaceId,
    projectId,
    sourceType: normalizedSourceType,
    sourceConnectionId: normalizedConnectionId,
    sourceRevision,
    sourceArtifactIds,
    assetIds,
    externalEventRef: normalizedEventRef,
    occurredAt,
    observedAt,
    createdAt: observedAt,
    updatedAt: observedAt,
    headline: normalizedHeadline,
    summary: text(summary || headline, "", 12000),
    signalKind,
    importanceHints,
    privacyClassification,
    boundaryNote,
    status: CONTENT_SIGNAL_STATUSES.NEW,
    statusChangedAt: observedAt,
    provenance: {
      source: normalizedSourceType,
      ingestionMethod: "provider_event",
      capturedAt: observedAt,
      actorRef,
    },
  });
}

export function updateContentSignalMetadata(signal, patch = {}, now) {
  const current = normalizeContentSignal(signal);
  const disallowed = ["signalId", "workspaceId", "sourceType", "sourceRevision", "externalEventRef", "provenance", "createdAt", "observedAt"];
  for (const field of disallowed) {
    if (Object.prototype.hasOwnProperty.call(patch, field)) {
      throw new TypeError(`ContentSignal.${field} is immutable metadata.`);
    }
  }
  return normalizeContentSignal({
    ...current,
    ...portableClone(patch),
    updatedAt: timestamp(now, current.updatedAt, "updatedAt"),
    provenance: current.provenance,
  });
}

export function transitionContentSignal(signal, status, now, { snoozedUntil = null } = {}) {
  const current = normalizeContentSignal(signal);
  const nextStatus = enumValue(status, STATUS_VALUES, current.status, "status");
  return normalizeContentSignal({
    ...current,
    status: nextStatus,
    snoozedUntil: nextStatus === CONTENT_SIGNAL_STATUSES.SNOOZED ? snoozedUntil : null,
    statusChangedAt: timestamp(now, current.updatedAt, "statusChangedAt"),
    updatedAt: timestamp(now, current.updatedAt, "updatedAt"),
    provenance: current.provenance,
  });
}

export function attachContentSignalReferences(signal, { sourceArtifactIds, assetIds } = {}, now) {
  const current = normalizeContentSignal(signal);
  return updateContentSignalMetadata(current, {
    sourceArtifactIds: sourceArtifactIds === undefined ? current.sourceArtifactIds : sourceArtifactIds,
    assetIds: assetIds === undefined ? current.assetIds : assetIds,
  }, now);
}
