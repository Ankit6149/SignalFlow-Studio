import { createDomainRecord, parseDomainRecord, portableClone } from "./contracts.mjs";

export const SOURCE_CONNECTION_SCHEMA_VERSION = 1;

export const SOURCE_CONNECTION_STATUSES = Object.freeze({
  PENDING: "pending",
  ACTIVE: "active",
  PAUSED: "paused",
  ERROR: "error",
  REVOKED: "revoked",
});

const STATUS_VALUES = new Set(Object.values(SOURCE_CONNECTION_STATUSES));
const SAFE_PROVIDER = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const SAFE_CAPABILITY = /^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/;

function text(value, fallback = "", maxLength = 4000) {
  const normalized = String(value ?? "").replace(/\r\n?/g, "\n").trim();
  const resolved = normalized || fallback;
  if (resolved.length > maxLength) throw new TypeError(`SourceConnection text exceeds ${maxLength} characters.`);
  return resolved;
}

function optionalText(value, maxLength = 4000) {
  const normalized = text(value, "", maxLength);
  return normalized || null;
}

function opaqueId(value, field, { required = false } = {}) {
  const normalized = text(value, "", 300);
  if (!normalized) {
    if (required) throw new TypeError(`SourceConnection.${field} is required.`);
    return null;
  }
  if (/[/\\]|^[a-zA-Z]:/.test(normalized)) {
    throw new TypeError(`SourceConnection.${field} must be an opaque ID, not a path.`);
  }
  return normalized;
}

function timestamp(value, fallback = null, field = "timestamp") {
  const candidate = value || fallback;
  if (!candidate) return null;
  const parsed = Date.parse(candidate);
  if (!Number.isFinite(parsed)) throw new TypeError(`SourceConnection.${field} must be an ISO-compatible timestamp.`);
  return new Date(parsed).toISOString();
}

function normalizeProvider(value) {
  const provider = text(value, "", 80).toLowerCase();
  if (!provider || !SAFE_PROVIDER.test(provider)) throw new TypeError("SourceConnection.provider must be a stable lowercase provider identifier.");
  return provider;
}

function normalizeStatus(value) {
  const status = text(value, SOURCE_CONNECTION_STATUSES.PENDING, 80).toLowerCase();
  if (!STATUS_VALUES.has(status)) throw new TypeError(`Unsupported SourceConnection status: ${status}.`);
  return status;
}

function uniqueCapabilities(value, field) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new TypeError(`SourceConnection.${field} must be an array.`);
  const normalized = Array.from(new Set(value.map((item) => text(item, "", 120).toLowerCase()).filter(Boolean))).sort();
  for (const item of normalized) {
    if (!SAFE_CAPABILITY.test(item)) throw new TypeError(`SourceConnection.${field} contains an unsafe identifier: ${item}.`);
  }
  return normalized;
}

function normalizeResourceScope(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("SourceConnection resource scope must be an object.");
  const resourceRef = opaqueId(value.resourceRef, "resourceScopes.resourceRef", { required: true });
  const resourceType = text(value.resourceType, "repository", 80).toLowerCase();
  if (!SAFE_PROVIDER.test(resourceType)) throw new TypeError("SourceConnection resourceType must be a stable lowercase identifier.");
  return portableClone({
    resourceRef,
    resourceType,
    projectId: opaqueId(value.projectId, "resourceScopes.projectId"),
    displayName: optionalText(value.displayName, 240),
    eventFamilies: uniqueCapabilities(value.eventFamilies, "resourceScopes.eventFamilies"),
    enabled: value.enabled !== false,
  });
}

function normalizeResourceScopes(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new TypeError("SourceConnection.resourceScopes must be an array.");
  const byRef = new Map();
  for (const item of value) {
    const normalized = normalizeResourceScope(item);
    if (byRef.has(normalized.resourceRef)) throw new TypeError(`Duplicate SourceConnection resource scope: ${normalized.resourceRef}.`);
    byRef.set(normalized.resourceRef, normalized);
  }
  return Array.from(byRef.values()).sort((left, right) => left.resourceRef.localeCompare(right.resourceRef));
}

function assertSchema(input) {
  if (input?.sourceConnectionSchemaVersion === undefined || input?.sourceConnectionSchemaVersion === null) return;
  if (!Number.isInteger(input.sourceConnectionSchemaVersion)) throw new TypeError("SourceConnection schema version must be an integer.");
  if (input.sourceConnectionSchemaVersion > SOURCE_CONNECTION_SCHEMA_VERSION) {
    throw new TypeError(`SourceConnection schema ${input.sourceConnectionSchemaVersion} is newer than supported schema ${SOURCE_CONNECTION_SCHEMA_VERSION}.`);
  }
}

export function normalizeSourceConnection(input = {}) {
  assertSchema(input);
  const parsed = input?.kind === "SourceConnection" ? parseDomainRecord(input, "SourceConnection") : input;
  const createdAt = timestamp(parsed.createdAt || parsed.updatedAt, null, "createdAt");
  if (!createdAt) throw new TypeError("SourceConnection.createdAt is required.");
  const status = normalizeStatus(parsed.status);
  const verifiedAt = timestamp(parsed.verifiedAt, null, "verifiedAt");
  if (status === SOURCE_CONNECTION_STATUSES.ACTIVE && !verifiedAt) {
    throw new TypeError("An active SourceConnection requires verifiedAt.");
  }
  return createDomainRecord("SourceConnection", {
    sourceConnectionSchemaVersion: SOURCE_CONNECTION_SCHEMA_VERSION,
    sourceConnectionId: opaqueId(parsed.sourceConnectionId, "sourceConnectionId", { required: true }),
    workspaceId: opaqueId(parsed.workspaceId, "workspaceId", { required: true }),
    provider: normalizeProvider(parsed.provider),
    providerAccountRef: opaqueId(parsed.providerAccountRef, "providerAccountRef"),
    installationRef: opaqueId(parsed.installationRef, "installationRef"),
    credentialRef: opaqueId(parsed.credentialRef, "credentialRef"),
    status,
    permissionScopes: uniqueCapabilities(parsed.permissionScopes, "permissionScopes"),
    capabilities: uniqueCapabilities(parsed.capabilities, "capabilities"),
    resourceScopes: normalizeResourceScopes(parsed.resourceScopes),
    verifiedAt,
    lastEventAt: timestamp(parsed.lastEventAt, null, "lastEventAt"),
    lastErrorCode: optionalText(parsed.lastErrorCode, 160)?.toLowerCase() || null,
    createdAt,
    updatedAt: timestamp(parsed.updatedAt, createdAt, "updatedAt"),
  });
}

export function createSourceConnection({
  sourceConnectionId,
  workspaceId,
  provider,
  providerAccountRef = null,
  installationRef = null,
  credentialRef = null,
  permissionScopes = [],
  capabilities = [],
  resourceScopes = [],
  status = SOURCE_CONNECTION_STATUSES.PENDING,
  verifiedAt = null,
  createdAt,
} = {}) {
  return normalizeSourceConnection({
    sourceConnectionId,
    workspaceId,
    provider,
    providerAccountRef,
    installationRef,
    credentialRef,
    permissionScopes,
    capabilities,
    resourceScopes,
    status,
    verifiedAt,
    createdAt,
    updatedAt: createdAt,
  });
}

export function updateSourceConnection(connection, patch = {}, now) {
  const current = normalizeSourceConnection(connection);
  const immutable = ["sourceConnectionId", "workspaceId", "provider", "createdAt"];
  for (const field of immutable) {
    if (Object.prototype.hasOwnProperty.call(patch, field)) throw new TypeError(`SourceConnection.${field} is immutable.`);
  }
  return normalizeSourceConnection({ ...current, ...portableClone(patch), updatedAt: timestamp(now, current.updatedAt, "updatedAt") });
}

export function transitionSourceConnection(connection, status, now, patch = {}) {
  const current = normalizeSourceConnection(connection);
  return updateSourceConnection(current, {
    ...patch,
    status,
    verifiedAt: status === SOURCE_CONNECTION_STATUSES.ACTIVE ? (patch.verifiedAt || current.verifiedAt || now) : current.verifiedAt,
  }, now);
}

export function resolveSourceConnectionResource(connection, resourceRef) {
  const current = normalizeSourceConnection(connection);
  const normalizedRef = opaqueId(resourceRef, "resourceRef", { required: true });
  return current.resourceScopes.find((item) => item.resourceRef === normalizedRef && item.enabled) || null;
}
