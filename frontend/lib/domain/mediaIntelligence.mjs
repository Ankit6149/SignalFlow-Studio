import { createDomainRecord, parseDomainRecord, portableClone } from "./contracts.mjs";
import { PRIVACY_CLASSES } from "./sourceArtifacts.mjs";

export const MEDIA_SCHEMA_VERSION = 1;

export const ASSET_ROLES = Object.freeze({
  REFERENCE_ONLY: "reference_only",
  STYLE_REFERENCE: "style_reference",
  EVIDENCE: "evidence",
  FINAL_CANDIDATE: "final_candidate",
  EDIT_SOURCE: "edit_source",
  COMPOSITE_SOURCE: "composite_source",
  BRAND_ASSET: "brand_asset",
  FOOTAGE_SOURCE: "footage_source",
  AUDIO_SOURCE: "audio_source",
  VOICE_SOURCE: "voice_source",
  BACKGROUND_SOURCE: "background_source",
  THUMBNAIL_SOURCE: "thumbnail_source",
  CAPTURE_OUTPUT: "capture_output",
  GENERATED_SOURCE: "generated_source",
  DERIVED_OUTPUT: "derived_output",
});

export const RIGHTS_STATUSES = Object.freeze({
  USER_CREATED: "user_created",
  ORGANIZATION_OWNED: "organization_owned",
  CLIENT_OWNED_WITH_PERMISSION: "client_owned_with_permission",
  LICENSED: "licensed",
  PUBLIC_DOMAIN_OR_COMPATIBLE: "public_domain_or_compatible",
  GENERATED: "generated",
  UNKNOWN: "unknown",
  RESTRICTED: "restricted",
});

export const MEDIA_DECISION_KINDS = Object.freeze({
  NONE: "none",
  EXISTING_SINGLE_IMAGE: "existing_single_image",
  EDITED_IMAGE: "edited_image",
  GENERATED_IMAGE: "generated_image",
  COMPOSITE_IMAGE: "composite_image",
  DIAGRAM: "diagram",
  INFOGRAPHIC: "infographic",
  CAROUSEL: "carousel",
  PRODUCT_SCREENSHOT: "product_screenshot",
  PRODUCT_DEMO_VIDEO: "product_demo_video",
  UPLOADED_FOOTAGE_EDIT: "uploaded_footage_edit",
  REEL_OR_SHORT: "reel_or_short",
  LONGER_VIDEO: "longer_video",
  THUMBNAIL: "thumbnail",
  AUDIO_OR_VOICEOVER: "audio_or_voiceover",
});

export const MEDIA_RECORD_STATUSES = Object.freeze({
  DRAFT: "draft",
  READY: "ready",
  NEEDS_RESOLUTION: "needs_resolution",
  BLOCKED: "blocked",
  STALE: "stale",
  SUPERSEDED: "superseded",
});

export const MEDIA_REQUIREMENT_STATUSES = Object.freeze({
  PLANNED: "planned",
  READY_FOR_PRODUCTION: "ready_for_production",
  BLOCKED: "blocked",
  SATISFIED: "satisfied",
  SUPERSEDED: "superseded",
});

const ROLE_VALUES = new Set(Object.values(ASSET_ROLES));
const RIGHTS_VALUES = new Set(Object.values(RIGHTS_STATUSES));
const DECISION_VALUES = new Set(Object.values(MEDIA_DECISION_KINDS));
const RECORD_STATUS_VALUES = new Set(Object.values(MEDIA_RECORD_STATUSES));
const REQUIREMENT_STATUS_VALUES = new Set(Object.values(MEDIA_REQUIREMENT_STATUSES));
const PRIVACY_VALUES = new Set(Object.values(PRIVACY_CLASSES));
const SCOPE_TYPES = new Set(["content_piece", "direct_create_request", "media_plan"]);
const DESTINATIONS = new Set(["linkedin", "x", "instagram", "youtube", "tiktok", "facebook", "threads", "generic"]);
const SAFE_TRANSFORM = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

export class MediaPolicyError extends TypeError {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "MediaPolicyError";
    this.code = code;
    this.details = portableClone(details);
  }
}

function text(value, fallback = "", maxLength = 4000) {
  const normalized = String(value ?? "").replace(/\r\n?/g, "\n").trim();
  const resolved = normalized || fallback;
  if (resolved.length > maxLength) throw new MediaPolicyError("media_text_too_long", `Media field exceeds ${maxLength} characters.`);
  return resolved;
}

function optionalText(value, maxLength = 4000) {
  return text(value, "", maxLength) || null;
}

function opaqueId(value, field, required = true) {
  const normalized = text(value, "", 240);
  if (!normalized && !required) return null;
  if (!normalized) throw new MediaPolicyError("missing_media_id", `${field} is required.`, { field });
  if (/[/\\]|^[a-zA-Z]:/.test(normalized)) throw new MediaPolicyError("non_opaque_media_id", `${field} must be an opaque ID.`, { field });
  return normalized;
}

function timestamp(value, fallback, field) {
  const candidate = value || fallback;
  const parsed = Date.parse(candidate || "");
  if (!Number.isFinite(parsed)) throw new MediaPolicyError("invalid_media_timestamp", `${field} must be an ISO timestamp.`, { field });
  return new Date(parsed).toISOString();
}

function enumValue(value, allowed, fallback, field) {
  const normalized = text(value, fallback, 100).toLowerCase();
  if (!allowed.has(normalized)) throw new MediaPolicyError("invalid_media_enum", `${field} contains unsupported value: ${normalized}.`, { field, value: normalized });
  return normalized;
}

function bool(value, fallback = false) {
  return value === undefined || value === null ? fallback : value === true;
}

function uniqueIds(values, field, maxItems = 100) {
  if (values === undefined || values === null) return [];
  if (!Array.isArray(values)) throw new MediaPolicyError("invalid_media_list", `${field} must be an array.`, { field });
  const result = [];
  const seen = new Set();
  for (const value of values) {
    const normalized = opaqueId(value, field, false);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= maxItems) break;
  }
  return result;
}

function uniqueText(values, maxItems = 40, maxLength = 800) {
  if (!Array.isArray(values)) return [];
  const result = [];
  const seen = new Set();
  for (const value of values) {
    const normalized = text(value, "", maxLength);
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
    if (result.length >= maxItems) break;
  }
  return result;
}

export function normalizeAssetUsePolicy(input = {}, { role = null, privacyClass = PRIVACY_CLASSES.WORKSPACE_PRIVATE } = {}) {
  const normalizedRole = role ? enumValue(role, ROLE_VALUES, ASSET_ROLES.REFERENCE_ONLY, "AssetUsePolicy.role") : null;
  const normalizedPrivacy = enumValue(privacyClass, PRIVACY_VALUES, PRIVACY_CLASSES.WORKSPACE_PRIVATE, "AssetUsePolicy.privacyClass");
  const rightsStatus = enumValue(input.rightsStatus, RIGHTS_VALUES, RIGHTS_STATUSES.UNKNOWN, "AssetUsePolicy.rightsStatus");

  const roleBlocksPublic = [ASSET_ROLES.REFERENCE_ONLY, ASSET_ROLES.STYLE_REFERENCE, ASSET_ROLES.EVIDENCE].includes(normalizedRole);
  const privacyBlocksRemote = [PRIVACY_CLASSES.DEVICE_PRIVATE, PRIVACY_CLASSES.RESTRICTED].includes(normalizedPrivacy);
  const rightsBlockPublic = [RIGHTS_STATUSES.UNKNOWN, RIGHTS_STATUSES.RESTRICTED].includes(rightsStatus);

  return portableClone({
    publicUseAllowed: roleBlocksPublic || rightsBlockPublic ? false : bool(input.publicUseAllowed, false),
    aiInspectionAllowed: bool(input.aiInspectionAllowed, false),
    remoteAiInspectionAllowed: privacyBlocksRemote ? false : bool(input.remoteAiInspectionAllowed, false),
    editingAllowed: bool(input.editingAllowed, false),
    croppingAllowed: bool(input.croppingAllowed, false),
    compositingAllowed: bool(input.compositingAllowed, false),
    generationReferenceAllowed: bool(input.generationReferenceAllowed, false),
    styleReferenceAllowed: bool(input.styleReferenceAllowed, false),
    faceModificationAllowed: bool(input.faceModificationAllowed, false),
    voiceSynthesisAllowed: bool(input.voiceSynthesisAllowed, false),
    reuseAcrossCampaignsAllowed: bool(input.reuseAcrossCampaignsAllowed, false),
    rightsStatus,
  });
}

export function normalizeAssetRoleBinding(input = {}) {
  const parsed = input?.kind === "AssetRoleBinding" && input?.schemaVersion ? parseDomainRecord(input, "AssetRoleBinding") : input;
  const createdAt = timestamp(parsed.createdAt, null, "AssetRoleBinding.createdAt");
  const role = enumValue(parsed.role, ROLE_VALUES, ASSET_ROLES.REFERENCE_ONLY, "AssetRoleBinding.role");
  const privacyClass = enumValue(parsed.privacyClass, PRIVACY_VALUES, PRIVACY_CLASSES.WORKSPACE_PRIVATE, "AssetRoleBinding.privacyClass");
  const scopeType = enumValue(parsed.scopeType, SCOPE_TYPES, "content_piece", "AssetRoleBinding.scopeType");
  return createDomainRecord("AssetRoleBinding", {
    mediaSchemaVersion: MEDIA_SCHEMA_VERSION,
    assetRoleBindingId: opaqueId(parsed.assetRoleBindingId, "AssetRoleBinding.assetRoleBindingId"),
    workspaceId: opaqueId(parsed.workspaceId, "AssetRoleBinding.workspaceId"),
    scopeType,
    scopeId: opaqueId(parsed.scopeId, "AssetRoleBinding.scopeId"),
    assetId: opaqueId(parsed.assetId, "AssetRoleBinding.assetId"),
    assetVersionId: opaqueId(parsed.assetVersionId, "AssetRoleBinding.assetVersionId", false),
    role,
    privacyClass,
    usePolicy: normalizeAssetUsePolicy(parsed.usePolicy, { role, privacyClass }),
    interpretation: optionalText(parsed.interpretation, 1600),
    explicitUserInstruction: optionalText(parsed.explicitUserInstruction, 1600),
    status: enumValue(parsed.status, RECORD_STATUS_VALUES, MEDIA_RECORD_STATUSES.READY, "AssetRoleBinding.status"),
    dependencyVersion: Number.isInteger(parsed.dependencyVersion) && parsed.dependencyVersion > 0 ? parsed.dependencyVersion : 1,
    createdAt,
    updatedAt: timestamp(parsed.updatedAt, createdAt, "AssetRoleBinding.updatedAt"),
  });
}

export function createAssetRoleBinding(input = {}) {
  return normalizeAssetRoleBinding({ ...input, status: input.status || MEDIA_RECORD_STATUSES.READY });
}

export function reviseAssetRoleBinding(bindingInput, patch = {}, now) {
  const binding = normalizeAssetRoleBinding(bindingInput);
  return normalizeAssetRoleBinding({
    ...binding,
    ...patch,
    usePolicy: patch.usePolicy ? { ...binding.usePolicy, ...patch.usePolicy } : binding.usePolicy,
    dependencyVersion: binding.dependencyVersion + 1,
    updatedAt: timestamp(now, binding.updatedAt, "AssetRoleBinding.updatedAt"),
  });
}

export function normalizeMediaIntentResolution(input = {}) {
  const parsed = input?.kind === "MediaIntentResolution" && input?.schemaVersion ? parseDomainRecord(input, "MediaIntentResolution") : input;
  const createdAt = timestamp(parsed.createdAt, null, "MediaIntentResolution.createdAt");
  const unresolvedRisks = uniqueText(parsed.unresolvedRisks, 30, 600);
  return createDomainRecord("MediaIntentResolution", {
    mediaSchemaVersion: MEDIA_SCHEMA_VERSION,
    mediaIntentResolutionId: opaqueId(parsed.mediaIntentResolutionId, "MediaIntentResolution.mediaIntentResolutionId"),
    workspaceId: opaqueId(parsed.workspaceId, "MediaIntentResolution.workspaceId"),
    scopeType: enumValue(parsed.scopeType, SCOPE_TYPES, "content_piece", "MediaIntentResolution.scopeType"),
    scopeId: opaqueId(parsed.scopeId, "MediaIntentResolution.scopeId"),
    revision: Number.isInteger(parsed.revision) && parsed.revision > 0 ? parsed.revision : 1,
    bindingIds: uniqueIds(parsed.bindingIds, "MediaIntentResolution.bindingIds"),
    inferredIntent: optionalText(parsed.inferredIntent, 2400),
    unresolvedRisks,
    status: enumValue(parsed.status, RECORD_STATUS_VALUES, unresolvedRisks.length ? MEDIA_RECORD_STATUSES.NEEDS_RESOLUTION : MEDIA_RECORD_STATUSES.READY, "MediaIntentResolution.status"),
    createdAt,
    updatedAt: timestamp(parsed.updatedAt, createdAt, "MediaIntentResolution.updatedAt"),
  });
}

export function createMediaIntentResolution({ mediaIntentResolutionId, workspaceId, scopeType, scopeId, bindings = [], inferredIntent = null, unresolvedRisks = [], createdAt } = {}) {
  const normalizedBindings = bindings.map(normalizeAssetRoleBinding);
  for (const binding of normalizedBindings) {
    if (binding.workspaceId !== workspaceId || binding.scopeType !== scopeType || binding.scopeId !== scopeId) {
      throw new MediaPolicyError("media_binding_scope_mismatch", "Media role bindings must belong to the same workspace and request scope as the intent resolution.");
    }
  }
  return normalizeMediaIntentResolution({
    mediaIntentResolutionId,
    workspaceId,
    scopeType,
    scopeId,
    revision: 1,
    bindingIds: normalizedBindings.map((item) => item.assetRoleBindingId),
    inferredIntent,
    unresolvedRisks,
    createdAt,
    updatedAt: createdAt,
  });
}

export function normalizeAssetLineage(input = {}) {
  const parsed = input?.kind === "AssetLineage" && input?.schemaVersion ? parseDomainRecord(input, "AssetLineage") : input;
  const transformation = text(parsed.transformation, "", 120).toLowerCase();
  if (!SAFE_TRANSFORM.test(transformation)) throw new MediaPolicyError("invalid_media_transformation", "AssetLineage.transformation must be a stable lowercase identifier.");
  const parentAssetVersionIds = uniqueIds(parsed.parentAssetVersionIds, "AssetLineage.parentAssetVersionIds");
  if (!parentAssetVersionIds.length) throw new MediaPolicyError("missing_media_parent", "Derived asset lineage requires at least one parent asset version.");
  return createDomainRecord("AssetLineage", {
    mediaSchemaVersion: MEDIA_SCHEMA_VERSION,
    assetLineageId: opaqueId(parsed.assetLineageId, "AssetLineage.assetLineageId"),
    workspaceId: opaqueId(parsed.workspaceId, "AssetLineage.workspaceId"),
    assetId: opaqueId(parsed.assetId, "AssetLineage.assetId"),
    assetVersionId: opaqueId(parsed.assetVersionId, "AssetLineage.assetVersionId"),
    parentAssetVersionIds,
    transformation,
    processorRef: optionalText(parsed.processorRef, 240),
    rendererRef: optionalText(parsed.rendererRef, 240),
    generationRunId: opaqueId(parsed.generationRunId, "AssetLineage.generationRunId", false),
    sourceBindingIds: uniqueIds(parsed.sourceBindingIds, "AssetLineage.sourceBindingIds"),
    createdAt: timestamp(parsed.createdAt, null, "AssetLineage.createdAt"),
  });
}

export function createDerivedAssetLineage(input = {}) {
  if (input.assetVersionId && Array.isArray(input.parentAssetVersionIds) && input.parentAssetVersionIds.includes(input.assetVersionId)) {
    throw new MediaPolicyError("self_referential_media_lineage", "A derived asset version cannot be its own parent.");
  }
  return normalizeAssetLineage(input);
}

export function assertAssetOperationAllowed(bindingInput, operation) {
  const binding = normalizeAssetRoleBinding(bindingInput);
  const policy = binding.usePolicy;
  const operationMap = {
    public_use: "publicUseAllowed",
    ai_inspection: "aiInspectionAllowed",
    remote_ai_inspection: "remoteAiInspectionAllowed",
    edit: "editingAllowed",
    crop: "croppingAllowed",
    composite: "compositingAllowed",
    generation_reference: "generationReferenceAllowed",
    style_reference: "styleReferenceAllowed",
    face_modification: "faceModificationAllowed",
    voice_synthesis: "voiceSynthesisAllowed",
    reuse: "reuseAcrossCampaignsAllowed",
  };
  const field = operationMap[String(operation || "").toLowerCase()];
  if (!field) throw new MediaPolicyError("unknown_media_operation", `Unsupported media operation: ${operation}.`);
  if (binding.status === MEDIA_RECORD_STATUSES.BLOCKED || policy[field] !== true) {
    throw new MediaPolicyError("media_operation_blocked", `Media operation ${operation} is not permitted for this asset binding.`, {
      assetRoleBindingId: binding.assetRoleBindingId,
      role: binding.role,
      operation,
    });
  }
  if (operation === "public_use" && [ASSET_ROLES.REFERENCE_ONLY, ASSET_ROLES.STYLE_REFERENCE, ASSET_ROLES.EVIDENCE].includes(binding.role)) {
    throw new MediaPolicyError("media_role_not_publishable", `Asset role ${binding.role} cannot be bound directly to publication.`);
  }
  return true;
}

function score(kind, value, reasons = []) {
  return { kind, score: Math.max(0, Math.min(1, Number(value.toFixed(2)))), reasons: uniqueText(reasons, 8, 500) };
}

function suitablePublicImage(bindings) {
  return bindings.find((binding) => {
    try {
      assertAssetOperationAllowed(binding, "public_use");
      return [ASSET_ROLES.FINAL_CANDIDATE, ASSET_ROLES.BRAND_ASSET, ASSET_ROLES.CAPTURE_OUTPUT, ASSET_ROLES.DERIVED_OUTPUT].includes(binding.role);
    } catch {
      return false;
    }
  }) || null;
}

function destinationCandidates({ destination, contentPiece, bindings, explicitKind, visualPotential = 0.5, sequentialValue = 0.3, productEvidence = false, footageAvailable = false }) {
  if (explicitKind) return [score(explicitKind, 1, ["Requested explicitly by the user."])];
  const candidates = [score(MEDIA_DECISION_KINDS.NONE, 0.55, ["Text-only remains a valid successful outcome."])];
  const reusableImage = suitablePublicImage(bindings);
  if (reusableImage) candidates.push(score(MEDIA_DECISION_KINDS.EXISTING_SINGLE_IMAGE, 0.72 + visualPotential * 0.18, ["A suitable public-use asset already exists.", "Reuse avoids unnecessary generation."]));
  if (productEvidence) candidates.push(score(MEDIA_DECISION_KINDS.PRODUCT_SCREENSHOT, 0.68 + visualPotential * 0.24, ["The story benefits from showing the real product state.", "Product evidence is available or capturable."]));
  if (sequentialValue >= 0.55 && ["linkedin", "instagram"].includes(destination)) candidates.push(score(MEDIA_DECISION_KINDS.CAROUSEL, 0.58 + sequentialValue * 0.35, ["The story has sequential explanation value.", `${destination} can support a multi-step visual narrative.`]));
  if (footageAvailable && ["instagram", "tiktok", "youtube"].includes(destination)) candidates.push(score(MEDIA_DECISION_KINDS.UPLOADED_FOOTAGE_EDIT, 0.68 + visualPotential * 0.22, ["User-provided footage can carry the story without synthetic media."]));
  if (contentPiece?.claims?.length >= 4 && visualPotential >= 0.6) candidates.push(score(MEDIA_DECISION_KINDS.DIAGRAM, 0.56 + visualPotential * 0.25, ["The content contains several factual relationships that may be clearer visually."]));
  return candidates.sort((left, right) => right.score - left.score || left.kind.localeCompare(right.kind));
}

export function normalizeMediaRequirement(input = {}) {
  const parsed = input?.kind === "MediaRequirement" && input?.schemaVersion ? parseDomainRecord(input, "MediaRequirement") : input;
  const createdAt = timestamp(parsed.createdAt, null, "MediaRequirement.createdAt");
  return createDomainRecord("MediaRequirement", {
    mediaSchemaVersion: MEDIA_SCHEMA_VERSION,
    mediaRequirementId: opaqueId(parsed.mediaRequirementId, "MediaRequirement.mediaRequirementId"),
    workspaceId: opaqueId(parsed.workspaceId, "MediaRequirement.workspaceId"),
    contentPieceId: opaqueId(parsed.contentPieceId, "MediaRequirement.contentPieceId"),
    destination: enumValue(parsed.destination, DESTINATIONS, "generic", "MediaRequirement.destination"),
    kind: enumValue(parsed.kind, DECISION_VALUES, MEDIA_DECISION_KINDS.NONE, "MediaRequirement.kind"),
    purpose: text(parsed.purpose, "Support the content piece without weakening authenticity.", 1600),
    subject: optionalText(parsed.subject, 1200),
    mustShow: uniqueText(parsed.mustShow, 20, 600),
    mustAvoid: uniqueText(parsed.mustAvoid, 20, 600),
    preferredAspectRatios: uniqueText(parsed.preferredAspectRatios, 8, 40),
    captionIntent: optionalText(parsed.captionIntent, 800),
    priority: enumValue(parsed.priority, new Set(["required", "preferred", "optional"]), "preferred", "MediaRequirement.priority"),
    sourceBindingIds: uniqueIds(parsed.sourceBindingIds, "MediaRequirement.sourceBindingIds"),
    productionReadiness: enumValue(parsed.productionReadiness, new Set(["ready", "needs_capture", "needs_processing", "blocked", "not_needed"]), parsed.kind === MEDIA_DECISION_KINDS.NONE ? "not_needed" : "ready", "MediaRequirement.productionReadiness"),
    status: enumValue(parsed.status, REQUIREMENT_STATUS_VALUES, parsed.kind === MEDIA_DECISION_KINDS.NONE ? MEDIA_REQUIREMENT_STATUSES.SATISFIED : MEDIA_REQUIREMENT_STATUSES.PLANNED, "MediaRequirement.status"),
    reason: optionalText(parsed.reason, 1600),
    createdAt,
    updatedAt: timestamp(parsed.updatedAt, createdAt, "MediaRequirement.updatedAt"),
  });
}

export function normalizeMediaDecision(input = {}) {
  const parsed = input?.kind === "MediaDecision" && input?.schemaVersion ? parseDomainRecord(input, "MediaDecision") : input;
  const createdAt = timestamp(parsed.createdAt, null, "MediaDecision.createdAt");
  if (!Array.isArray(parsed.destinationDecisions) || !parsed.destinationDecisions.length) throw new MediaPolicyError("missing_destination_media_decisions", "MediaDecision requires at least one destination decision.");
  const destinationDecisions = parsed.destinationDecisions.map((item) => ({
    destination: enumValue(item.destination, DESTINATIONS, "generic", "MediaDecision.destination"),
    selectedKind: enumValue(item.selectedKind, DECISION_VALUES, MEDIA_DECISION_KINDS.NONE, "MediaDecision.selectedKind"),
    candidates: Array.isArray(item.candidates) ? item.candidates.slice(0, 8).map((candidate) => ({
      kind: enumValue(candidate.kind, DECISION_VALUES, MEDIA_DECISION_KINDS.NONE, "MediaDecision.candidate.kind"),
      score: Math.max(0, Math.min(1, Number(candidate.score || 0))),
      reasons: uniqueText(candidate.reasons, 8, 500),
    })) : [],
    selectedReason: text(item.selectedReason, "Selected using the current media planning factors.", 1200),
    overrideOrigin: optionalText(item.overrideOrigin, 80),
    requirementId: opaqueId(item.requirementId, "MediaDecision.requirementId", false),
  }));
  return createDomainRecord("MediaDecision", {
    mediaSchemaVersion: MEDIA_SCHEMA_VERSION,
    mediaDecisionId: opaqueId(parsed.mediaDecisionId, "MediaDecision.mediaDecisionId"),
    workspaceId: opaqueId(parsed.workspaceId, "MediaDecision.workspaceId"),
    contentPieceId: opaqueId(parsed.contentPieceId, "MediaDecision.contentPieceId"),
    revision: Number.isInteger(parsed.revision) && parsed.revision > 0 ? parsed.revision : 1,
    status: enumValue(parsed.status, RECORD_STATUS_VALUES, MEDIA_RECORD_STATUSES.READY, "MediaDecision.status"),
    policySnapshot: portableClone(parsed.policySnapshot || {}),
    destinationDecisions,
    createdAt,
    updatedAt: timestamp(parsed.updatedAt, createdAt, "MediaDecision.updatedAt"),
  });
}

export function planMediaForContentPiece({
  mediaDecisionId,
  contentPiece,
  destinations = ["linkedin", "x"],
  assetBindings = [],
  explicitRequest = null,
  visualPotential = 0.5,
  sequentialValue = 0.3,
  productEvidence = false,
  footageAvailable = false,
  createdAt,
  idFactory = (prefix, destination) => `${prefix}-${destination}`,
} = {}) {
  if (!contentPiece?.contentPieceId || !contentPiece?.workspaceId) throw new MediaPolicyError("invalid_content_piece_for_media", "Media planning requires a canonical ContentPiece.");
  const bindings = assetBindings.map(normalizeAssetRoleBinding);
  if (bindings.some((binding) => binding.workspaceId !== contentPiece.workspaceId)) throw new MediaPolicyError("cross_workspace_media_binding", "Media planning cannot use another workspace's asset binding.");
  const normalizedDestinations = uniqueText(destinations, 12, 80).map((item) => enumValue(item, DESTINATIONS, "generic", "MediaDecision.destination"));
  const explicitByDestination = explicitRequest && typeof explicitRequest === "object" ? explicitRequest : {};
  const requirements = [];
  const destinationDecisions = normalizedDestinations.map((destination) => {
    const requested = explicitByDestination[destination] || explicitByDestination.all || null;
    const explicitKind = requested ? enumValue(requested, DECISION_VALUES, MEDIA_DECISION_KINDS.NONE, "MediaDecision.explicitRequest") : null;
    const candidates = destinationCandidates({ destination, contentPiece, bindings, explicitKind, visualPotential, sequentialValue, productEvidence, footageAvailable });
    const selected = candidates[0] || score(MEDIA_DECISION_KINDS.NONE, 1, ["No useful media candidate was available."]);
    let productionReadiness = "ready";
    if (selected.kind === MEDIA_DECISION_KINDS.NONE) productionReadiness = "not_needed";
    else if (selected.kind === MEDIA_DECISION_KINDS.PRODUCT_SCREENSHOT) productionReadiness = suitablePublicImage(bindings) ? "ready" : "needs_capture";
    else if ([MEDIA_DECISION_KINDS.EXISTING_SINGLE_IMAGE, MEDIA_DECISION_KINDS.EDITED_IMAGE, MEDIA_DECISION_KINDS.COMPOSITE_IMAGE].includes(selected.kind) && !suitablePublicImage(bindings)) productionReadiness = "needs_processing";
    const requirementId = idFactory("media-requirement", destination);
    requirements.push(normalizeMediaRequirement({
      mediaRequirementId: requirementId,
      workspaceId: contentPiece.workspaceId,
      contentPieceId: contentPiece.contentPieceId,
      destination,
      kind: selected.kind,
      purpose: contentPiece.purpose || contentPiece.canonicalIntent,
      subject: contentPiece.canonicalIntent,
      mustShow: productEvidence ? ["The real product state that supports the claim"] : [],
      mustAvoid: ["Private or reference-only material without explicit public-use permission"],
      preferredAspectRatios: destination === "linkedin" ? ["4:5", "1:1", "16:9"] : destination === "x" ? ["16:9", "1:1"] : ["9:16", "4:5", "1:1"],
      priority: selected.kind === MEDIA_DECISION_KINDS.NONE ? "optional" : "preferred",
      sourceBindingIds: bindings.map((item) => item.assetRoleBindingId),
      productionReadiness,
      reason: selected.reasons.join(" "),
      createdAt,
      updatedAt: createdAt,
    }));
    return {
      destination,
      selectedKind: selected.kind,
      candidates,
      selectedReason: selected.reasons.join(" ") || "Selected by media policy.",
      overrideOrigin: explicitKind ? "user" : null,
      requirementId,
    };
  });
  const decision = normalizeMediaDecision({
    mediaDecisionId,
    workspaceId: contentPiece.workspaceId,
    contentPieceId: contentPiece.contentPieceId,
    revision: 1,
    status: MEDIA_RECORD_STATUSES.READY,
    policySnapshot: {
      bindingIds: bindings.map((item) => item.assetRoleBindingId),
      productEvidence: productEvidence === true,
      footageAvailable: footageAvailable === true,
      visualPotential: Math.max(0, Math.min(1, Number(visualPotential || 0))),
      sequentialValue: Math.max(0, Math.min(1, Number(sequentialValue || 0))),
    },
    destinationDecisions,
    createdAt,
    updatedAt: createdAt,
  });
  return { decision, requirements };
}

export function overrideMediaDecision(decisionInput, { destination, selectedKind, requirementId = null, reason = "Owner selected another media direction." } = {}, now) {
  const decision = normalizeMediaDecision(decisionInput);
  const normalizedDestination = enumValue(destination, DESTINATIONS, "generic", "MediaDecision.override.destination");
  const normalizedKind = enumValue(selectedKind, DECISION_VALUES, MEDIA_DECISION_KINDS.NONE, "MediaDecision.override.selectedKind");
  let changed = false;
  const destinationDecisions = decision.destinationDecisions.map((item) => {
    if (item.destination !== normalizedDestination) return item;
    changed = true;
    return {
      ...item,
      selectedKind: normalizedKind,
      selectedReason: text(reason, "Owner selected another media direction.", 1200),
      overrideOrigin: "user",
      requirementId: requirementId || item.requirementId,
    };
  });
  if (!changed) throw new MediaPolicyError("media_destination_not_found", `Media decision does not contain destination ${normalizedDestination}.`);
  return normalizeMediaDecision({
    ...decision,
    revision: decision.revision + 1,
    destinationDecisions,
    updatedAt: timestamp(now, decision.updatedAt, "MediaDecision.updatedAt"),
  });
}
