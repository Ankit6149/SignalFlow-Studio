export const DOMAIN_SCHEMA_VERSION = 1;

export const DOMAIN_KINDS = Object.freeze({
  WORKSPACE: "Workspace",
  PROJECT: "Project",
  CONTENT_SIGNAL: "ContentSignal",
  SOURCE_CONNECTION: "SourceConnection",
  CONTENT_OPPORTUNITY: "ContentOpportunity",
  PROJECT_CONTEXT_SNAPSHOT: "ProjectContextSnapshot",
  IDENTITY_PROFILE: "IdentityProfile",
  PERCEPTION_PROFILE: "PerceptionProfile",
  VOICE_PROFILE: "VoiceProfile",
  BOUNDARY_PROFILE: "BoundaryProfile",
  PLATFORM_EXPRESSION_PROFILE: "PlatformExpressionProfile",
  PROJECT_GUIDANCE_PROFILE: "ProjectGuidanceProfile",
  IDENTITY_CONTEXT_SNAPSHOT: "IdentityContextSnapshot",
  NARRATIVE_STRATEGY: "NarrativeStrategy",
  CONTENT_PIECE: "ContentPiece",
  PLATFORM_VARIANT: "PlatformVariant",
  PLATFORM_VARIANT_REVISION: "PlatformVariantRevision",
  PLATFORM_VARIANT_REVIEW: "PlatformVariantReview",
  PLATFORM_VARIANT_APPROVAL: "PlatformVariantApproval",
  NARRATIVE_MEMORY: "NarrativeMemory",
  FEEDBACK_EVENT: "FeedbackEvent",
  STYLE_MEMORY_HYPOTHESIS: "StyleMemoryHypothesis",
  MEDIA_INTENT_RESOLUTION: "MediaIntentResolution",
  ASSET_ROLE_BINDING: "AssetRoleBinding",
  ASSET_LINEAGE: "AssetLineage",
  MEDIA_DECISION: "MediaDecision",
  MEDIA_REQUIREMENT: "MediaRequirement",
  SCREENSHOT_QUALITY_REVIEW: "ScreenshotQualityReview",
  IMAGE_DERIVATIVE_PLAN: "ImageDerivativePlan",
  DURABLE_JOB: "DurableJob",
  CAPTURE_RECIPE: "CaptureRecipe",
  CAPTURE_JOB: "CaptureJob",
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
  SourceConnection: { idField: "sourceConnectionId", owner: "workspace", required: ["sourceConnectionId", "workspaceId", "provider", "status", "createdAt", "updatedAt"] },
  ContentOpportunity: { idField: "opportunityId", owner: "workspace", required: ["opportunityId", "workspaceId", "signalIds", "recommendation", "title", "status", "evaluationProvenance"] },
  ProjectContextSnapshot: { idField: "projectContextSnapshotId", owner: "workspace", required: ["projectContextSnapshotId", "workspaceId", "projectId", "version", "fingerprint", "privacyClass", "synthesis", "createdAt"] },
  IdentityProfile: { idField: "identityProfileId", owner: "workspace", required: ["identityProfileId", "workspaceId", "userId", "version"] },
  PerceptionProfile: { idField: "perceptionProfileId", owner: "workspace", required: ["perceptionProfileId", "workspaceId", "userId", "version"] },
  VoiceProfile: { idField: "voiceProfileId", owner: "workspace", required: ["voiceProfileId", "workspaceId", "userId", "version"] },
  BoundaryProfile: { idField: "boundaryProfileId", owner: "workspace", required: ["boundaryProfileId", "workspaceId", "userId", "version"] },
  PlatformExpressionProfile: { idField: "platformExpressionProfileId", owner: "workspace", required: ["platformExpressionProfileId", "workspaceId", "userId", "version", "platform"] },
  ProjectGuidanceProfile: { idField: "projectGuidanceProfileId", owner: "workspace", required: ["projectGuidanceProfileId", "workspaceId", "userId", "version", "projectId"] },
  IdentityContextSnapshot: { idField: "identityContextSnapshotId", owner: "workspace", required: ["identityContextSnapshotId", "workspaceId", "userId", "profileRefs", "precedence", "createdAt"] },
  NarrativeStrategy: { idField: "narrativeStrategyId", owner: "workspace", required: ["narrativeStrategyId", "workspaceId", "opportunityId", "status", "selectedAngle", "identityContextSnapshotId", "coreIdea", "audienceTakeaway"] },
  ContentPiece: { idField: "contentPieceId", owner: "workspace", required: ["contentPieceId", "workspaceId", "narrativeStrategyId", "opportunityId", "status", "canonicalIntent"] },
  PlatformVariant: { idField: "platformVariantId", owner: "workspace", required: ["platformVariantId", "workspaceId", "contentPieceId", "narrativeStrategyId", "destination", "status"] },
  PlatformVariantRevision: { idField: "platformVariantRevisionId", owner: "workspace", required: ["platformVariantRevisionId", "workspaceId", "platformVariantId", "contentPieceId", "narrativeStrategyId", "destination", "revisionNumber", "strategyRevision", "content", "identityContextSnapshotId", "origin", "createdAt"] },
  PlatformVariantReview: { idField: "platformVariantReviewId", owner: "workspace", required: ["platformVariantReviewId", "workspaceId", "platformVariantId", "platformVariantRevisionId", "contentPieceId", "narrativeStrategyId", "sourceSignalId", "identityContextSnapshotId", "destination", "strategyRevision", "overallVerdict", "evidence", "authenticity", "createdAt"] },
  PlatformVariantApproval: { idField: "platformVariantApprovalId", owner: "workspace", required: ["platformVariantApprovalId", "workspaceId", "platformVariantId", "platformVariantRevisionId", "destination", "decision", "decidedBy", "decidedAt"] },
  NarrativeMemory: { idField: "narrativeMemoryId", owner: "workspace", required: ["narrativeMemoryId", "workspaceId", "opportunityId", "narrativeStrategyId", "contentPieceId", "platformVariantId", "platformVariantRevisionId", "platformVariantApprovalId", "platform", "historyStrength", "topic", "angle", "coreIdea", "semanticFingerprint", "approvedAt", "createdAt"] },
  FeedbackEvent: { idField: "feedbackEventId", owner: "workspace", required: ["feedbackEventId", "workspaceId", "userId", "targetType", "targetId", "feedbackKind", "learningEligibility", "createdAt"] },
  StyleMemoryHypothesis: { idField: "styleMemoryId", owner: "workspace", required: ["styleMemoryId", "workspaceId", "userId", "hypothesisKey", "hypothesis", "category", "scope", "confidence", "evidenceCount", "status", "lastEvaluatedAt", "createdAt", "updatedAt"] },
  MediaIntentResolution: { idField: "mediaIntentResolutionId", owner: "workspace", required: ["mediaIntentResolutionId", "workspaceId", "scopeType", "scopeId", "status", "bindingIds", "createdAt", "updatedAt"] },
  AssetRoleBinding: { idField: "assetRoleBindingId", owner: "workspace", required: ["assetRoleBindingId", "workspaceId", "scopeType", "scopeId", "assetId", "role", "usePolicy", "status", "createdAt", "updatedAt"] },
  AssetLineage: { idField: "assetLineageId", owner: "workspace", required: ["assetLineageId", "workspaceId", "assetId", "assetVersionId", "parentAssetVersionIds", "transformation", "createdAt"] },
  MediaDecision: { idField: "mediaDecisionId", owner: "workspace", required: ["mediaDecisionId", "workspaceId", "contentPieceId", "revision", "status", "destinationDecisions", "createdAt", "updatedAt"] },
  MediaRequirement: { idField: "mediaRequirementId", owner: "workspace", required: ["mediaRequirementId", "workspaceId", "contentPieceId", "destination", "mediaKind", "purpose", "status", "createdAt", "updatedAt"] },
  ScreenshotQualityReview: { idField: "screenshotQualityReviewId", owner: "workspace", required: ["screenshotQualityReviewId", "workspaceId", "assetId", "assetVersionId", "status", "checks", "createdAt", "updatedAt"] },
  ImageDerivativePlan: { idField: "imageDerivativePlanId", owner: "workspace", required: ["imageDerivativePlanId", "workspaceId", "sourceAssetId", "sourceAssetVersionId", "screenshotQualityReviewId", "variants", "status", "createdAt", "updatedAt"] },
  DurableJob: { idField: "jobId", owner: "workspace", required: ["jobId", "workspaceId", "jobType", "resourceType", "resourceId", "idempotencyKey", "status", "createdAt", "updatedAt"] },
  CaptureRecipe: { idField: "captureRecipeId", owner: "workspace", required: ["captureRecipeId", "workspaceId", "projectId", "version", "targetOrigin", "allowedEnvironment", "steps", "status", "createdAt", "updatedAt"] },
  CaptureJob: { idField: "captureJobId", owner: "workspace", required: ["captureJobId", "workspaceId", "captureRecipeId", "captureRecipeVersion", "jobId", "status", "createdAt", "updatedAt"] },
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
  ancestors.add(value);

  try {
    if (Array.isArray(value)) {
      return value.map((item, index) => clonePortable(item, `${path}[${index}]`, ancestors));
    }

    if (!isPlainObject(value)) {
      const name = value?.constructor?.name || "runtime object";
      throw new TypeError(`${path} contains non-portable ${name}. Use IDs and metadata instead.`);
    }

    const result = {};
    for (const [key, item] of Object.entries(value)) {
      if (FORBIDDEN_FIELD.test(key) || FORBIDDEN_FRAMEWORK_FIELD.test(key)) {
        throw new TypeError(`${path}.${key} is forbidden in domain serialization.`);
      }
      const cloned = clonePortable(item, `${path}.${key}`, ancestors);
      if (cloned !== undefined) result[key] = cloned;
    }
    return result;
  } finally {
    ancestors.delete(value);
  }
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
  return JSON.stringify(canonicalize(clonePortable(value)), null, space);
}

export function assertDomainRecord(record, expectedKind = "") {
  if (!isPlainObject(record)) throw new TypeError("Domain record must be a plain object.");
  if (record.schemaVersion !== DOMAIN_SCHEMA_VERSION) {
    throw new TypeError(`Unsupported domain schema version: ${record.schemaVersion ?? "missing"}.`);
  }
  const kind = String(record.kind || "");
  const contract = DOMAIN_CONTRACTS[kind];
  if (!contract) throw new TypeError(`Unknown domain record kind: ${kind || "missing"}.`);
  if (expectedKind && kind !== expectedKind) {
    throw new TypeError(`Expected ${expectedKind}, received ${kind}.`);
  }
  for (const field of contract.required) {
    const value = record[field];
    const missing = value === null || value === undefined || value === "";
    if (missing) throw new TypeError(`${kind}.${field} is required.`);
  }
  clonePortable(record, kind);
  return record;
}

export function createDomainRecord(kind, values = {}) {
  const contract = DOMAIN_CONTRACTS[kind];
  if (!contract) throw new TypeError(`Unknown domain record kind: ${kind}.`);
  const record = {
    ...values,
    schemaVersion: DOMAIN_SCHEMA_VERSION,
    kind,
  };
  assertDomainRecord(record, kind);
  return portableClone(record);
}

export function serializeDomainRecord(record) {
  assertDomainRecord(record);
  return stableStringify(record);
}

export function parseDomainRecord(serialized, expectedKind = "") {
  const parsed = typeof serialized === "string" ? JSON.parse(serialized) : serialized;
  assertDomainRecord(parsed, expectedKind);
  return portableClone(parsed);
}

export function portableClone(value) {
  return clonePortable(value);
}
