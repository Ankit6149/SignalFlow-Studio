import { assertPort } from "../domain/ports.mjs";
import {
  MEDIA_DECISION_KINDS,
  MEDIA_RECORD_STATUSES,
  MEDIA_REQUIREMENT_STATUSES,
  assertAssetOperationAllowed,
  createAssetRoleBinding,
  createMediaIntentResolution,
  normalizeAssetRoleBinding,
  normalizeMediaDecision,
  normalizeMediaRequirement,
  overrideMediaDecision,
  planMediaForContentPiece,
  reviseAssetRoleBinding,
} from "../domain/mediaIntelligence.mjs";

const PRIVACY_RANK = Object.freeze({ public: 0, workspace_private: 1, device_private: 2, restricted: 3 });
const EXISTING_MEDIA_OPERATIONS = Object.freeze({
  [MEDIA_DECISION_KINDS.EXISTING_SINGLE_IMAGE]: ["public_use"],
  [MEDIA_DECISION_KINDS.EDITED_IMAGE]: ["public_use", "edit"],
  [MEDIA_DECISION_KINDS.COMPOSITE_IMAGE]: ["public_use", "composite"],
  [MEDIA_DECISION_KINDS.UPLOADED_FOOTAGE_EDIT]: ["public_use", "edit"],
});

function requireServices({ mediaIntelligenceRepository, assetRepository, clock, idService } = {}) {
  return {
    repository: assertPort("mediaIntelligenceRepository", mediaIntelligenceRepository),
    assets: assertPort("assetRepository", assetRepository),
    clock: assertPort("clock", clock),
    ids: assertPort("idService", idService),
  };
}

function stricterPrivacy(canonical, requested = null) {
  const base = String(canonical || "workspace_private").toLowerCase();
  const override = requested ? String(requested).toLowerCase() : base;
  return (PRIVACY_RANK[override] ?? 3) > (PRIVACY_RANK[base] ?? 3) ? override : base;
}

function canPerform(binding, operations) {
  try {
    for (const operation of operations) assertAssetOperationAllowed(binding, operation);
    return true;
  } catch {
    return false;
  }
}

function assertSelectionAllowed(selectedKind, bindings, origin = "media selection") {
  const operations = EXISTING_MEDIA_OPERATIONS[selectedKind];
  if (!operations) return true;
  if (bindings.some((binding) => canPerform(binding, operations))) return true;
  const error = new Error(`${origin} requires a bound asset permitted for ${operations.join(" + ")}.`);
  error.code = "media_selection_policy_blocked";
  throw error;
}

export function createMediaIntelligenceApplication(dependencies = {}) {
  const { repository, assets: assetRepository, clock, ids } = requireServices(dependencies);

  async function resolveIntent({ workspaceId, scopeType = "content_piece", scopeId, assets = [], inferredIntent = null, unresolvedRisks = [] } = {}) {
    const now = clock.now();
    const bindings = [];
    for (const item of assets) {
      const canonicalAsset = await assetRepository.get(item.assetId);
      if (!canonicalAsset || canonicalAsset.kind !== "Asset") {
        const error = new Error(`Asset ${item.assetId || "missing"} was not found.`);
        error.code = "media_asset_not_found";
        throw error;
      }
      if (canonicalAsset.workspaceId !== workspaceId) {
        const error = new Error("Cross-workspace asset role binding is forbidden.");
        error.code = "cross_workspace_media_asset";
        throw error;
      }
      if (item.assetVersionId && item.assetVersionId !== canonicalAsset.assetVersionId) {
        const error = new Error("Asset role binding references a stale or unknown asset version.");
        error.code = "media_asset_version_mismatch";
        throw error;
      }
      const privacyClass = stricterPrivacy(canonicalAsset.privacy?.classification, item.privacyClass);
      const binding = createAssetRoleBinding({
        assetRoleBindingId: item.assetRoleBindingId || ids.create("asset-role-binding"),
        workspaceId,
        scopeType,
        scopeId,
        assetId: canonicalAsset.assetId,
        assetVersionId: canonicalAsset.assetVersionId,
        role: item.role,
        privacyClass,
        usePolicy: item.usePolicy,
        interpretation: item.interpretation || null,
        explicitUserInstruction: item.explicitUserInstruction || null,
        createdAt: now,
        updatedAt: now,
      });
      bindings.push(await repository.upsert(binding));
    }
    const resolution = createMediaIntentResolution({
      mediaIntentResolutionId: ids.create("media-intent"),
      workspaceId,
      scopeType,
      scopeId,
      bindings,
      inferredIntent,
      unresolvedRisks,
      createdAt: now,
    });
    return { resolution: await repository.upsert(resolution), bindings };
  }

  async function invalidateDownstream(binding, now) {
    if (binding.scopeType !== "content_piece") return [];
    const records = await repository.listByContentPiece(binding.scopeId);
    const changed = [];
    for (const record of records) {
      if (record.kind === "MediaDecision" && record.status !== MEDIA_RECORD_STATUSES.SUPERSEDED) {
        const stale = normalizeMediaDecision({
          ...record,
          revision: record.revision + 1,
          status: MEDIA_RECORD_STATUSES.STALE,
          policySnapshot: {
            ...record.policySnapshot,
            invalidatedByAssetRoleBindingId: binding.assetRoleBindingId,
            invalidatedByDependencyVersion: binding.dependencyVersion,
          },
          updatedAt: now,
        });
        changed.push(await repository.upsert(stale));
      }
      if (record.kind === "MediaRequirement" && record.status !== MEDIA_REQUIREMENT_STATUSES.SUPERSEDED) {
        const superseded = normalizeMediaRequirement({
          ...record,
          status: MEDIA_REQUIREMENT_STATUSES.SUPERSEDED,
          reason: `Media requirement must be replanned because asset policy ${binding.assetRoleBindingId} changed.`,
          updatedAt: now,
        });
        changed.push(await repository.upsert(superseded));
      }
    }
    return changed;
  }

  async function reviseBinding({ assetRoleBindingId, patch } = {}) {
    const current = await repository.get(assetRoleBindingId);
    if (!current || current.kind !== "AssetRoleBinding") {
      const error = new Error(`Asset role binding ${assetRoleBindingId || "missing"} was not found.`);
      error.code = "asset_role_binding_not_found";
      throw error;
    }
    if (patch?.assetId || patch?.assetVersionId || patch?.workspaceId || patch?.scopeId || patch?.scopeType || patch?.privacyClass) {
      const error = new Error("Binding identity, scope, asset version, and canonical privacy cannot be mutated in place.");
      error.code = "asset_role_binding_identity_mutation_forbidden";
      throw error;
    }
    const canonicalAsset = await assetRepository.get(current.assetId);
    if (!canonicalAsset || canonicalAsset.assetVersionId !== current.assetVersionId) {
      const error = new Error("The bound canonical asset version is no longer current; create a new binding for the new version.");
      error.code = "media_asset_version_stale";
      throw error;
    }
    const now = clock.now();
    const revised = reviseAssetRoleBinding(current, patch, now);
    const persisted = await repository.upsert(revised);
    const invalidated = await invalidateDownstream(persisted, now);
    return { binding: persisted, invalidated };
  }

  async function planContentPiece({ contentPiece, destinations, explicitRequest = null, visualPotential = 0.5, sequentialValue = 0.3, productEvidence = false, footageAvailable = false } = {}) {
    const now = clock.now();
    const scoped = await repository.listByScope("content_piece", contentPiece.contentPieceId);
    const bindings = scoped.filter((record) => record.kind === "AssetRoleBinding").map(normalizeAssetRoleBinding);
    if (explicitRequest && typeof explicitRequest === "object") {
      for (const selectedKind of Object.values(explicitRequest)) assertSelectionAllowed(selectedKind, bindings, "Explicit media request");
    }
    const { decision, requirements } = planMediaForContentPiece({
      mediaDecisionId: ids.create("media-decision"),
      contentPiece,
      destinations,
      assetBindings: bindings,
      explicitRequest,
      visualPotential,
      sequentialValue,
      productEvidence,
      footageAvailable,
      createdAt: now,
      idFactory: (prefix, destination) => ids.create(`${prefix}-${destination}`),
    });
    const persistedRequirements = [];
    for (const requirement of requirements) persistedRequirements.push(await repository.upsert(requirement));
    return {
      decision: await repository.upsert(decision),
      requirements: persistedRequirements,
    };
  }

  async function overrideDecision({ mediaDecisionId, destination, selectedKind, reason = null } = {}) {
    const current = await repository.get(mediaDecisionId);
    if (!current || current.kind !== "MediaDecision") {
      const error = new Error(`Media decision ${mediaDecisionId || "missing"} was not found.`);
      error.code = "media_decision_not_found";
      throw error;
    }
    const now = clock.now();
    const selected = current.destinationDecisions.find((item) => item.destination === destination);
    if (!selected) {
      const error = new Error(`Destination ${destination || "missing"} was not found in the media decision.`);
      error.code = "media_destination_not_found";
      throw error;
    }
    const bindings = (await repository.listByScope("content_piece", current.contentPieceId))
      .filter((record) => record.kind === "AssetRoleBinding")
      .map(normalizeAssetRoleBinding);
    assertSelectionAllowed(selectedKind, bindings, "Owner media override");

    const oldRequirement = selected.requirementId ? await repository.get(selected.requirementId) : null;
    let requirementId = selected.requirementId;
    let requirement = null;
    if (oldRequirement?.kind === "MediaRequirement") {
      requirementId = ids.create(`media-requirement-${destination}`);
      requirement = normalizeMediaRequirement({
        ...oldRequirement,
        mediaRequirementId: requirementId,
        kind: selectedKind,
        status: selectedKind === MEDIA_DECISION_KINDS.NONE ? MEDIA_REQUIREMENT_STATUSES.SATISFIED : MEDIA_REQUIREMENT_STATUSES.PLANNED,
        productionReadiness: selectedKind === MEDIA_DECISION_KINDS.NONE ? "not_needed" : "ready",
        reason: reason || "Owner selected another media direction.",
        createdAt: now,
        updatedAt: now,
      });
      await repository.upsert(normalizeMediaRequirement({
        ...oldRequirement,
        status: MEDIA_REQUIREMENT_STATUSES.SUPERSEDED,
        reason: `Superseded by owner media override ${requirementId}.`,
        updatedAt: now,
      }));
      requirement = await repository.upsert(requirement);
    }
    const revised = overrideMediaDecision(current, { destination, selectedKind, requirementId, reason: reason || undefined }, now);
    return { decision: await repository.upsert(revised), requirement };
  }

  return { resolveIntent, reviseBinding, planContentPiece, overrideDecision };
}
