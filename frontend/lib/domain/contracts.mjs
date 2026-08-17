export const DOMAIN_SCHEMA_VERSION = 1;

export const DOMAIN_KINDS = Object.freeze({
  WORKSPACE: "Workspace",
  PROJECT: "Project",
  CONTENT_SIGNAL: "ContentSignal",
  CONTENT_OPPORTUNITY: "ContentOpportunity",
  NARRATIVE_STRATEGY: "NarrativeStrategy",
  CONTENT_PIECE: "ContentPiece",
  CAMPAIGN: "Campaign",
  SOURCE_SNAPSHOT: "SourceSnapshot",
  SOURCE_ARTIFACT: "SourceArtifact",
  ASSET: "Asset",
  ASSET_PROCESSING: "AssetProcessing",
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
  ContentSignal: { idField: "signalId", owner: "workspace", required: ["signalId", "workspaceId", "sourceType", "headline", "signalKind", "status", "provenance"] },
  ContentOpportunity: { idField: "opportunityId", owner: "workspace", required: ["opportunityId", "workspaceId", "signalId", "status", "evaluation", "angles"] },
  NarrativeStrategy: { idField: "strategyId", owner: "workspace", required: ["strategyId", "workspaceId", "opportunityId", "thesis", "selectedAngle", "destinationPlan"] },
  ContentPiece: { idField: "contentPieceId", owner: "workspace", required: ["contentPieceId", "workspaceId", "opportunityId", "strategyId", "campaignId", "status", "channels"] },
  Campaign: { idField: "campaignId", owner: "project", required: ["campaignId", "title", "drafts"] },
  SourceSnapshot: { idField: "sourceSnapshotId", owner: "campaign", required: ["sourceSnapshotId", "fingerprint"] },
  SourceArtifact: { idField: "sourceArtifactId", owner: "campaign", required: ["sourceArtifactId", "artifactType"] },
  Asset: { idField: "assetId", owner: "workspace", required: ["assetId", "assetType"] },
  AssetProcessing: { idField: "processingId", owner: "workspace", required: ["processingId", "sourceArtifactId", "status"] },
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

const FORBIDDEN_FIELD = /(api[_-]?key|access[_-]?token|refresh[_-]?token|oauth[_-]?token|client[_-]?secret|password|authorization|cookie|database|dbclient)/i;
const FORBIDDEN_FRAMEWORK_FIELD = /^(request|response|httpRequest|httpResponse|req|res)$/i;
function isPlainObject(value) { if (!value || typeof value !== "object") return false; const p = Object.getPrototypeOf(value); return p === Object.prototype || p === null; }
function clonePortable(value, path = "domain", ancestors = new WeakSet()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") { if (!Number.isFinite(value)) throw new TypeError(`${path} contains a non-finite number.`); return value; }
  if (value === undefined) return undefined;
  if (["function", "symbol", "bigint"].includes(typeof value)) throw new TypeError(`${path} contains a non-portable ${typeof value} value.`);
  if (typeof value !== "object") return value;
  if (ancestors.has(value)) throw new TypeError(`${path} contains a circular reference.`);
  ancestors.add(value);
  try {
    if (Array.isArray(value)) return value.map((item, index) => clonePortable(item, `${path}[${index}]`, ancestors));
    if (!isPlainObject(value)) throw new TypeError(`${path} contains non-portable ${value?.constructor?.name || "runtime object"}. Use IDs and metadata instead.`);
    const result = {};
    for (const [key, item] of Object.entries(value)) {
      if (FORBIDDEN_FIELD.test(key) || FORBIDDEN_FRAMEWORK_FIELD.test(key)) throw new TypeError(`${path}.${key} is forbidden in domain serialization.`);
      const cloned = clonePortable(item, `${path}.${key}`, ancestors); if (cloned !== undefined) result[key] = cloned;
    }
    return result;
  } finally { ancestors.delete(value); }
}
function canonicalize(value) { if (Array.isArray(value)) return value.map(canonicalize); if (!value || typeof value !== "object") return value; return Object.keys(value).sort().reduce((result, key) => { result[key] = canonicalize(value[key]); return result; }, {}); }
export function stableStringify(value, space = 0) { return JSON.stringify(canonicalize(clonePortable(value)), null, space); }
export function assertDomainRecord(record, expectedKind = "") {
  if (!isPlainObject(record)) throw new TypeError("Domain record must be a plain object.");
  if (record.schemaVersion !== DOMAIN_SCHEMA_VERSION) throw new TypeError(`Unsupported domain schema version: ${record.schemaVersion ?? "missing"}.`);
  const kind = String(record.kind || ""); const contract = DOMAIN_CONTRACTS[kind];
  if (!contract) throw new TypeError(`Unknown domain record kind: ${kind || "missing"}.`);
  if (expectedKind && kind !== expectedKind) throw new TypeError(`Expected ${expectedKind}, received ${kind}.`);
  for (const field of contract.required) { const value = record[field]; if (value === null || value === undefined || value === "") throw new TypeError(`${kind}.${field} is required.`); }
  clonePortable(record, kind); return record;
}
export function createDomainRecord(kind, values = {}) { if (!DOMAIN_CONTRACTS[kind]) throw new TypeError(`Unknown domain record kind: ${kind}.`); return assertDomainRecord(clonePortable({ schemaVersion: DOMAIN_SCHEMA_VERSION, kind, ...values }, kind), kind); }
export function serializeDomainRecord(record, space = 0) { assertDomainRecord(record); return stableStringify(record, space); }
export function parseDomainRecord(input, expectedKind = "") { return assertDomainRecord(typeof input === "string" ? JSON.parse(input) : clonePortable(input), expectedKind); }
export function portableClone(value) { return clonePortable(value); }
