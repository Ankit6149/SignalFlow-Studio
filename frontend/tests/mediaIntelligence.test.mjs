import test from "node:test";
import assert from "node:assert/strict";

import { createDeterministicIdService } from "../lib/domain/ports.mjs";
import { normalizeAsset } from "../lib/domain/sourceArtifacts.mjs";
import {
  ASSET_ROLES,
  MEDIA_DECISION_KINDS,
  MEDIA_RECORD_STATUSES,
  MEDIA_REQUIREMENT_STATUSES,
  MediaPolicyError,
  assertAssetOperationAllowed,
  createAssetRoleBinding,
  createDerivedAssetLineage,
  overrideMediaDecision,
  planMediaForContentPiece,
} from "../lib/domain/mediaIntelligence.mjs";
import { createMediaIntelligenceApplication } from "../lib/application/mediaIntelligenceApplication.mjs";
import { createMemoryMediaIntelligenceRepository } from "../lib/infrastructure/productExecutionMemoryAdapters.mjs";
import { createMemoryAssetRepository } from "../lib/infrastructure/transferAdapters.mjs";

const NOW = "2026-08-23T00:00:00.000Z";

function binding(overrides = {}) {
  return createAssetRoleBinding({
    assetRoleBindingId: overrides.assetRoleBindingId || "binding-1",
    workspaceId: overrides.workspaceId || "workspace-1",
    scopeType: "content_piece",
    scopeId: overrides.scopeId || "piece-1",
    assetId: overrides.assetId || "asset-1",
    assetVersionId: overrides.assetVersionId || "asset-version-1",
    role: overrides.role || ASSET_ROLES.FINAL_CANDIDATE,
    privacyClass: overrides.privacyClass || "workspace_private",
    usePolicy: {
      publicUseAllowed: true,
      aiInspectionAllowed: true,
      remoteAiInspectionAllowed: true,
      editingAllowed: true,
      croppingAllowed: true,
      compositingAllowed: true,
      rightsStatus: "user_created",
      ...overrides.usePolicy,
    },
    createdAt: NOW,
    updatedAt: NOW,
  });
}

function contentPiece(overrides = {}) {
  return {
    contentPieceId: overrides.contentPieceId || "piece-1",
    workspaceId: overrides.workspaceId || "workspace-1",
    purpose: "Explain a product architecture change clearly.",
    canonicalIntent: "Privacy became an architectural boundary.",
    claims: overrides.claims || ["Private context stays bounded", "Approval is exact"],
  };
}

function canonicalAsset(overrides = {}) {
  return normalizeAsset({
    assetId: overrides.assetId || "asset-1",
    assetVersionId: overrides.assetVersionId || "asset-v1",
    workspaceId: overrides.workspaceId || "workspace-1",
    projectId: "project-1",
    originalName: "product.png",
    mimeType: "image/png",
    byteSize: 120,
    lifecycle: "original",
    privacy: {
      classification: overrides.privacyClass || "workspace_private",
      exportAllowed: true,
      processingAllowed: true,
    },
    createdAt: NOW,
    updatedAt: NOW,
  }, { workspaceId: overrides.workspaceId || "workspace-1", projectId: "project-1", now: NOW });
}

function advancingClock() {
  let tick = 0;
  return {
    now() {
      const value = new Date(Date.parse(NOW) + tick * 1000).toISOString();
      tick += 1;
      return value;
    },
  };
}

function applicationFixture({ asset = canonicalAsset() } = {}) {
  const repository = createMemoryMediaIntelligenceRepository();
  const assetRepository = createMemoryAssetRepository(asset ? [asset] : []);
  const application = createMediaIntelligenceApplication({
    mediaIntelligenceRepository: repository,
    assetRepository,
    clock: advancingClock(),
    idService: createDeterministicIdService("test"),
  });
  return { repository, assetRepository, application };
}

test("reference and evidence roles fail closed for direct public use", () => {
  for (const role of [ASSET_ROLES.REFERENCE_ONLY, ASSET_ROLES.STYLE_REFERENCE, ASSET_ROLES.EVIDENCE]) {
    const record = binding({ assetRoleBindingId: `binding-${role}`, role });
    assert.equal(record.usePolicy.publicUseAllowed, false);
    assert.throws(() => assertAssetOperationAllowed(record, "public_use"), (error) => error instanceof MediaPolicyError && error.code === "media_operation_blocked");
  }
});

test("a final candidate with cleared rights may be used publicly", () => {
  const record = binding();
  assert.equal(record.usePolicy.publicUseAllowed, true);
  assert.equal(assertAssetOperationAllowed(record, "public_use"), true);
});

test("device-private media cannot silently leave the device for remote AI", () => {
  const record = binding({
    privacyClass: "device_private",
    usePolicy: { remoteAiInspectionAllowed: true },
  });
  assert.equal(record.usePolicy.remoteAiInspectionAllowed, false);
  assert.throws(() => assertAssetOperationAllowed(record, "remote_ai_inspection"), (error) => error.code === "media_operation_blocked");
});

test("derived lineage requires immutable parent versions and rejects self-parenting", () => {
  const lineage = createDerivedAssetLineage({
    assetLineageId: "lineage-1",
    workspaceId: "workspace-1",
    assetId: "asset-derived",
    assetVersionId: "derived-v2",
    parentAssetVersionIds: ["source-v1"],
    transformation: "crop_and_composite",
    sourceBindingIds: ["binding-1"],
    createdAt: NOW,
  });
  assert.deepEqual(lineage.parentAssetVersionIds, ["source-v1"]);
  assert.throws(() => createDerivedAssetLineage({
    ...lineage,
    kind: undefined,
    schemaVersion: undefined,
    assetLineageId: "lineage-2",
    assetVersionId: "same-version",
    parentAssetVersionIds: ["same-version"],
  }), (error) => error.code === "self_referential_media_lineage");
});

test("NONE is a valid successful media decision when media adds no value", () => {
  const result = planMediaForContentPiece({
    mediaDecisionId: "decision-1",
    contentPiece: contentPiece(),
    destinations: ["linkedin", "x"],
    assetBindings: [],
    visualPotential: 0.1,
    sequentialValue: 0.1,
    productEvidence: false,
    createdAt: NOW,
  });
  assert.deepEqual(result.decision.destinationDecisions.map((item) => item.selectedKind), [MEDIA_DECISION_KINDS.NONE, MEDIA_DECISION_KINDS.NONE]);
  assert.ok(result.requirements.every((item) => item.status === MEDIA_REQUIREMENT_STATUSES.SATISFIED));
});

test("real product evidence produces an explainable screenshot requirement", () => {
  const result = planMediaForContentPiece({
    mediaDecisionId: "decision-2",
    contentPiece: contentPiece(),
    destinations: ["linkedin"],
    assetBindings: [],
    visualPotential: 1,
    productEvidence: true,
    createdAt: NOW,
  });
  const choice = result.decision.destinationDecisions[0];
  assert.equal(choice.selectedKind, MEDIA_DECISION_KINDS.PRODUCT_SCREENSHOT);
  assert.match(choice.selectedReason, /real product state/i);
  assert.equal(result.requirements[0].productionReadiness, "needs_capture");
});

test("an already-permitted final asset is preferred over unnecessary generation", () => {
  const result = planMediaForContentPiece({
    mediaDecisionId: "decision-3",
    contentPiece: contentPiece(),
    destinations: ["linkedin"],
    assetBindings: [binding()],
    visualPotential: 1,
    productEvidence: false,
    createdAt: NOW,
  });
  assert.equal(result.decision.destinationDecisions[0].selectedKind, MEDIA_DECISION_KINDS.EXISTING_SINGLE_IMAGE);
  assert.equal(result.requirements[0].productionReadiness, "ready");
});

test("explicit owner media override creates a new decision revision", () => {
  const { decision } = planMediaForContentPiece({
    mediaDecisionId: "decision-4",
    contentPiece: contentPiece(),
    destinations: ["linkedin"],
    createdAt: NOW,
  });
  const revised = overrideMediaDecision(decision, {
    destination: "linkedin",
    selectedKind: MEDIA_DECISION_KINDS.CAROUSEL,
    reason: "The owner wants a sequential explanation.",
  }, "2026-08-23T00:01:00.000Z");
  assert.equal(revised.revision, 2);
  assert.equal(revised.destinationDecisions[0].selectedKind, MEDIA_DECISION_KINDS.CAROUSEL);
  assert.equal(revised.destinationDecisions[0].overrideOrigin, "user");
});

test("cross-workspace media bindings are rejected", () => {
  assert.throws(() => planMediaForContentPiece({
    mediaDecisionId: "decision-cross",
    contentPiece: contentPiece(),
    destinations: ["linkedin"],
    assetBindings: [binding({ workspaceId: "workspace-2" })],
    createdAt: NOW,
  }), (error) => error.code === "cross_workspace_media_binding");
});

test("intent resolution binds a real canonical asset version and inherits stricter privacy", async () => {
  const { application } = applicationFixture({ asset: canonicalAsset({ privacyClass: "device_private" }) });
  const result = await application.resolveIntent({
    workspaceId: "workspace-1",
    scopeType: "content_piece",
    scopeId: "piece-1",
    assets: [{
      assetId: "asset-1",
      assetVersionId: "asset-v1",
      role: ASSET_ROLES.FINAL_CANDIDATE,
      privacyClass: "public",
      usePolicy: { publicUseAllowed: true, remoteAiInspectionAllowed: true, rightsStatus: "user_created" },
    }],
  });
  assert.equal(result.bindings[0].assetVersionId, "asset-v1");
  assert.equal(result.bindings[0].privacyClass, "device_private");
  assert.equal(result.bindings[0].usePolicy.remoteAiInspectionAllowed, false);
});

test("intent resolution rejects missing and stale canonical asset versions", async () => {
  const missing = applicationFixture({ asset: null });
  await assert.rejects(() => missing.application.resolveIntent({
    workspaceId: "workspace-1",
    scopeId: "piece-1",
    assets: [{ assetId: "missing", role: ASSET_ROLES.REFERENCE_ONLY }],
  }), (error) => error.code === "media_asset_not_found");

  const fixture = applicationFixture();
  await assert.rejects(() => fixture.application.resolveIntent({
    workspaceId: "workspace-1",
    scopeId: "piece-1",
    assets: [{ assetId: "asset-1", assetVersionId: "old-version", role: ASSET_ROLES.REFERENCE_ONLY }],
  }), (error) => error.code === "media_asset_version_mismatch");
});

test("owner override cannot select existing media when bound policy forbids public use", async () => {
  const { application } = applicationFixture();
  const intent = await application.resolveIntent({
    workspaceId: "workspace-1",
    scopeType: "content_piece",
    scopeId: "piece-1",
    assets: [{ assetId: "asset-1", role: ASSET_ROLES.REFERENCE_ONLY, usePolicy: { rightsStatus: "user_created" } }],
  });
  assert.equal(intent.bindings[0].usePolicy.publicUseAllowed, false);
  const planned = await application.planContentPiece({ contentPiece: contentPiece(), destinations: ["linkedin"] });
  await assert.rejects(() => application.overrideDecision({
    mediaDecisionId: planned.decision.mediaDecisionId,
    destination: "linkedin",
    selectedKind: MEDIA_DECISION_KINDS.EXISTING_SINGLE_IMAGE,
  }), (error) => error.code === "media_selection_policy_blocked");
});

test("changing an asset role invalidates downstream media decisions and requirements", async () => {
  const { repository, application } = applicationFixture();
  const intent = await application.resolveIntent({
    workspaceId: "workspace-1",
    scopeType: "content_piece",
    scopeId: "piece-1",
    assets: [{
      assetId: "asset-1",
      assetVersionId: "asset-v1",
      role: ASSET_ROLES.FINAL_CANDIDATE,
      privacyClass: "workspace_private",
      usePolicy: { publicUseAllowed: true, rightsStatus: "user_created" },
    }],
  });
  const planned = await application.planContentPiece({ contentPiece: contentPiece(), destinations: ["linkedin"], visualPotential: 1 });
  assert.equal(planned.decision.status, MEDIA_RECORD_STATUSES.READY);

  const result = await application.reviseBinding({
    assetRoleBindingId: intent.bindings[0].assetRoleBindingId,
    patch: { role: ASSET_ROLES.REFERENCE_ONLY },
  });
  assert.equal(result.binding.dependencyVersion, 2);
  const records = await repository.listByContentPiece("piece-1");
  const decision = records.find((record) => record.kind === "MediaDecision");
  const requirement = records.find((record) => record.kind === "MediaRequirement" && record.mediaRequirementId === planned.requirements[0].mediaRequirementId);
  assert.equal(decision.status, MEDIA_RECORD_STATUSES.STALE);
  assert.equal(requirement.status, MEDIA_REQUIREMENT_STATUSES.SUPERSEDED);
});
