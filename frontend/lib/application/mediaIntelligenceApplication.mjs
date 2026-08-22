import { assertPort } from "../domain/ports.mjs";
import {
  MEDIA_RECORD_STATUSES,
  MEDIA_REQUIREMENT_STATUSES,
  createAssetRoleBinding,
  createMediaIntentResolution,
  normalizeAssetRoleBinding,
  normalizeMediaDecision,
  normalizeMediaRequirement,
  overrideMediaDecision,
  planMediaForContentPiece,
  reviseAssetRoleBinding,
} from "../domain/mediaIntelligence.mjs";

function requireServices({ mediaIntelligenceRepository, clock, idService } = {}) {
  return {
    repository: assertPort("mediaIntelligenceRepository", mediaIntelligenceRepository),
    clock: assertPort("clock", clock),
    ids: assertPort("idService", idService),
  };
}

export function createMediaIntelligenceApplication(dependencies = {}) {
  const { repository, clock, ids } = requireServices(dependencies);

  async function resolveIntent({ workspaceId, scopeType = "content_piece", scopeId, assets = [], inferredIntent = null, unresolvedRisks = [] } = {}) {
    const now = clock.now();
    const bindings = [];
    for (const item of assets) {
      const binding = createAssetRoleBinding({
        assetRoleBindingId: item.assetRoleBindingId || ids.create("asset-role-binding"),
        workspaceId,
        scopeType,
        scopeId,
        assetId: item.assetId,
        assetVersionId: item.assetVersionId || null,
        role: item.role,
        privacyClass: item.privacyClass,
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
      if (record.kind === "MediaRequirement" && ![MEDIA_REQUIREMENT_STATUSES.SUPERSEDED].includes(record.status)) {
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
    const oldRequirement = selected.requirementId ? await repository.get(selected.requirementId) : null;
    let requirementId = selected.requirementId;
    let requirement = null;
    if (oldRequirement?.kind === "MediaRequirement") {
      requirementId = ids.create(`media-requirement-${destination}`);
      requirement = normalizeMediaRequirement({
        ...oldRequirement,
        mediaRequirementId: requirementId,
        kind: selectedKind,
        status: MEDIA_REQUIREMENT_STATUSES.PLANNED,
        productionReadiness: selectedKind === "none" ? "not_needed" : "ready",
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
