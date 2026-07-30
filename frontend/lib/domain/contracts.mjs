export const DOMAIN_SCHEMA_VERSION = 1;

export const DOMAIN_KINDS = Object.freeze({
  WORKSPACE: "Workspace",
  PROJECT: "Project",
  CAMPAIGN: "Campaign",
  SOURCE_SNAPSHOT: "SourceSnapshot",
  SOURCE_ARTIFACT: "SourceArtifact",
  ASSET: "Asset",
  GENERATION_JOB: "GenerationJob",
  GENERATION_RUN: "GenerationRun",
  CHANNEL_DRAFT: "ChannelDraft",
  DRAFT_REVISION: "DraftRevision",
  APPROVAL: "Approval",
  EXPORT: "Export",
  PUBLICATION: "Publication",
  CONNECTION: "Connection",
  USAGE_EVENT: "UsageEvent",
  AUDIT_EVENT: "AuditEvent",
  TRANSFER_REPORT: "TransferReport",
});

export const DOMAIN_CONTRACTS = Object.freeze({
  Workspace: { idField: "workspaceId", owner: "workspace", required: ["workspaceId", "name"] },
  Project: { idField: "projectId", owner: "workspace", required: ["projectId", "name"] },
  Campaign: { idField: "campaignId", owner: "project", required: ["campaignId", "title", "drafts"] },
  SourceSnapshot: { idField: "sourceSnapshotId", owner: "campaign", required: ["sourceSnapshotId", "fingerprint"] },
  SourceArtifact: { idField: "sourceArtifactId", owner: "campaign", required: ["sourceArtifactId", "artifactType"] },
  Asset: { idField: "assetId", owner: "workspace", required: ["assetId", "assetType"] },
  GenerationJob: { idField: "generationJobId", owner: "campaign", required: ["generationJobId", "status"] },
  GenerationRun: { idField: "generationRunId", owner: "campaign", required: ["generationRunId", "provider"] },
  ChannelDraft: { idField: "draftId", owner: "campaign", required: ["draftId", "channel", "current"] },
  DraftRevision: { idField: "revisionId", owner: "draft", required: ["revisionId", "content", "origin"] },
  Approval: { idField: "approvalId", owner: "campaign", required: ["approvalId", "status"] },
  Export: { idField: "exportId", owner: "campaign", required: ["exportId", "format"] },
  Publication: { idField: "publicationId", owner: "campaign", required: ["publicationId", "channel", "status"] },
  Connection: { idField: "connectionId", owner: "workspace", required: ["connectionId", "provider", "status"] },
  UsageEvent: { idField: "usageEventId", owner: "workspace", required: ["usageEventId", "eventType"] },
  AuditEvent: { idField: "auditEventId", owner: "workspace", required: ["auditEventId", "eventType"] },
  TransferReport: { idField: "transferReportId", owner: "workspace", required: ["transferReportId", "archiveId", "status"] },
});

const FORBIDDEN_FIELD = /(api[_-]?key|access[_-]?token|refresh[_-]?token|oauth[_-]?token|client[_-]?secret|password|authorization|cookie|database|dbclient|request|response)/i;

function isPlainObject(value) {
  if (!value || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function clonePortable(value, path = "domain", ancestors = new WeakSet()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError(`${path} contains a non-finite number.`);
    return value;
  }
  if (value === undefined) return undefined;
  if (["function", "symbol", "bigint"].includes(typeof value)) {
    throw new TypeError(`${path} contains a non-portable ${typeof value} value.`);
  }
  if (typeof value !== "object") return value;
  if (ancestors.has(value)) throw new TypeError(`${path} contains a circular reference.`);
  if (!Array.isArray(value) && !isPlainObject(value)) {
    throw new TypeError(`${path} contains a non-portable runtime object.`);
  }

  ancestors.add(value);
  let result;
  if (Array.isArray(value)) {
    result = value.map((item, index) => clonePortable(item, `${path}[${index}]`, ancestors));
  } else {
    result = {};
    for (const [key, item] of Object.entries(value)) {
      if (FORBIDDEN_FIELD.test(key)) throw new TypeError(`${path}.${key} is forbidden in a domain record.`);
      const cloned = clonePortable(item, `${path}.${key}`, ancestors);
      if (cloned !== undefined) result[key] = cloned;
    }
  }
  ancestors.delete(value);
  return result;
}

export function portableClone(value) {
  return clonePortable(value);
}

export function createDomainRecord(kind, data = {}) {
  const contract = DOMAIN_CONTRACTS[kind];
  if (!contract) throw new TypeError(`Unknown domain record kind: ${kind}.`);
  const portable = portableClone(data);
  for (const field of contract.required) {
    if (portable[field] === undefined || portable[field] === null || portable[field] === "") {
      throw new TypeError(`${kind}.${field} is required.`);
    }
  }
  return {
    schemaVersion: DOMAIN_SCHEMA_VERSION,
    kind,
    ...portable,
  };
}

export function parseDomainRecord(value, expectedKind) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Domain record must be an object.");
  }
  if (value.schemaVersion !== DOMAIN_SCHEMA_VERSION) {
    throw new TypeError(`Unsupported domain schema version: ${value.schemaVersion ?? "missing"}.`);
  }
  if (expectedKind && value.kind !== expectedKind) {
    throw new TypeError(`Expected ${expectedKind}, received ${value.kind || "unknown"}.`);
  }
  return createDomainRecord(value.kind, value);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value).sort().reduce((result, key) => {
    result[key] = canonicalize(value[key]);
    return result;
  }, {});
}

export function stableStringify(value, space = 0) {
  return JSON.stringify(canonicalize(portableClone(value)), null, space);
}

export function serializeDomainRecord(record) {
  return stableStringify(parseDomainRecord(record));
}
