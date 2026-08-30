import test from "node:test";
import assert from "node:assert/strict";

import { createPlatformMediaBindingApplication } from "../lib/application/platformMediaBindingApplication.mjs";
import {
  approveNarrativeStrategy,
  createNarrativeStrategy,
  createPlannedPlatformVariant,
  createPrimaryContentPiece,
} from "../lib/domain/contentPlanning.mjs";
import {
  PLATFORM_VARIANT_MEDIA_ROLES,
  PLATFORM_VARIANT_MEDIA_SOURCES,
  attachPlatformVariantRevision,
  createEditedPlatformVariantRevision,
  createPlatformVariantRevision,
  createRequestedPlatformVariantRevision,
  createRestoredPlatformVariantRevision,
} from "../lib/domain/platformVariantRevisions.mjs";
import { createDeterministicIdService } from "../lib/domain/ports.mjs";
import { normalizeAsset } from "../lib/domain/sourceArtifacts.mjs";
import {
  createScreenshotQualityReview,
  normalizeImageDerivativePlan,
  planScreenshotDerivatives,
} from "../lib/domain/screenshotProduction.mjs";
import { createMemoryContentPlanningRepository } from "../lib/infrastructure/contentPlanningAdapters.mjs";
import { createMemoryMediaIntelligenceRepository } from "../lib/infrastructure/productExecutionMemoryAdapters.mjs";
import { createMemoryAssetRepository } from "../lib/infrastructure/transferAdapters.mjs";

const NOW = "2026-08-30T15:00:00.000Z";
const WORKSPACE = "local-personal";

function strategy() {
  return approveNarrativeStrategy(createNarrativeStrategy({
    narrativeStrategyId: "strategy-media-review",
    workspaceId: WORKSPACE,
    opportunityId: "opportunity-media-review",
    inputFingerprint: "strategy-media-review-input",
    selectedAngle: { angleId: "angle-1", title: "Proof", summary: "Show the exact product evidence.", approach: "Lead with the shipped behavior." },
    identityContextSnapshotId: "snapshot-linkedin",
    proposal: {
      coreIdea: "The product now captures its own evidence.",
      audienceTakeaway: "Evidence can come from work instead of manual content operations.",
      narrativeArc: ["The work happened", "SignalFlow captured proof"],
      hookDirection: "Lead with the concrete behavior.",
      evidencePlan: ["Use the exact automatic screenshot derivative."],
      factualConstraints: ["Do not claim publication is automatic yet."],
      boundaryConstraints: ["Do not expose private repository content."],
      destinationPlan: [{ destination: "linkedin", decision: "include", reason: "The engineering context benefits from explanation.", format: "single narrative post", adaptationNotes: [] }],
      mediaRequirements: [{ type: "screenshot", reason: "The story is about visible product behavior." }],
      sequencingNotes: [],
    },
    taskId: "task-strategy-media",
    createdAt: NOW,
  }), NOW);
}

function planningFixture() {
  const approved = strategy();
  const piece = createPrimaryContentPiece({
    contentPieceId: "piece-media-review",
    strategy: approved,
    opportunityId: approved.opportunityId,
    createdAt: NOW,
  });
  const planned = createPlannedPlatformVariant({
    platformVariantId: "variant-media-review",
    contentPiece: piece,
    strategy: approved,
    destination: "linkedin",
    identityContextSnapshotId: "snapshot-linkedin",
    createdAt: NOW,
  });
  const revision = createPlatformVariantRevision({
    platformVariantRevisionId: "revision-media-1",
    workspaceId: WORKSPACE,
    platformVariantId: planned.platformVariantId,
    contentPieceId: piece.contentPieceId,
    narrativeStrategyId: approved.narrativeStrategyId,
    destination: "linkedin",
    revisionNumber: 1,
    strategyRevision: approved.strategyRevision,
    output: { format: "single_post", content: "SignalFlow now captures the proof created by the work itself.", segments: [] },
    inputFingerprint: "media-review-write-v1",
    identityContextSnapshotId: "snapshot-linkedin",
    generationProvenance: { taskId: "task-write-media", provider: "test", model: "writer", routeKind: "remote", promptVersion: "platform_variant_v1", generatedAt: NOW },
    createdAt: NOW,
  });
  const variant = attachPlatformVariantRevision(planned, revision, NOW);
  return { approved, piece, variant, revision };
}

function mediaFixture() {
  const sourceAsset = normalizeAsset({
    assetId: "asset-raw-shot",
    assetVersionId: "asset-version-raw-shot",
    workspaceId: WORKSPACE,
    projectId: "project-1",
    assetType: "image",
    lifecycle: "original",
    originalName: "raw-shot.png",
    mimeType: "image/png",
    byteSize: 1200,
    dimensions: { width: 1600, height: 900 },
    privacy: { classification: "workspace_private", processingAllowed: true, exportAllowed: true, remoteInferenceAllowed: false },
    provenance: [{ eventType: "automatic_capture", method: "api", actorType: "worker", occurredAt: NOW }],
    createdAt: NOW,
    updatedAt: NOW,
  }, { workspaceId: WORKSPACE, now: NOW });
  const quality = createScreenshotQualityReview({
    screenshotQualityReviewId: "quality-shot-1",
    workspaceId: WORKSPACE,
    asset: sourceAsset,
    observations: {
      decodeOk: true,
      blankLike: false,
      blankConfidence: 1,
      errorDetected: false,
      errorConfidence: 1,
      loadingDetected: false,
      loadingConfidence: 1,
      subjectVisible: true,
      subjectConfidence: 1,
      privacyState: "passed",
      legible: true,
      legibilityConfidence: 1,
    },
    evaluator: { name: "test", version: "1" },
    createdAt: NOW,
  });
  const planned = planScreenshotDerivatives({
    imageDerivativePlanId: "derivative-plan-1",
    workspaceId: WORKSPACE,
    sourceAsset,
    qualityReview: quality,
    aspectRatios: ["16:9"],
    idFactory: () => "derivative-16x9",
    createdAt: NOW,
  });
  const outputAsset = normalizeAsset({
    assetId: "asset-social-shot",
    assetVersionId: "asset-version-social-shot",
    workspaceId: WORKSPACE,
    projectId: "project-1",
    assetType: "image",
    lifecycle: "derived",
    originalName: "social-shot-16x9.png",
    mimeType: "image/png",
    byteSize: 980,
    dimensions: { width: 1600, height: 900 },
    privacy: { classification: "workspace_private", processingAllowed: true, exportAllowed: true, remoteInferenceAllowed: false },
    parentAssetIds: [sourceAsset.assetId],
    provenance: [{ eventType: "derived", method: "api", actorType: "worker", occurredAt: NOW }],
    createdAt: NOW,
    updatedAt: NOW,
  }, { workspaceId: WORKSPACE, now: NOW });
  const renderedPlan = normalizeImageDerivativePlan({
    ...planned,
    variants: planned.variants.map((variant) => ({
      ...variant,
      status: "rendered",
      outputAssetId: outputAsset.assetId,
      outputAssetVersionId: outputAsset.assetVersionId,
    })),
  });
  const binding = {
    role: PLATFORM_VARIANT_MEDIA_ROLES.PRIMARY_VISUAL,
    source: PLATFORM_VARIANT_MEDIA_SOURCES.SCREENSHOT_DERIVATIVE,
    assetId: outputAsset.assetId,
    assetVersionId: outputAsset.assetVersionId,
    screenshotQualityReviewId: quality.screenshotQualityReviewId,
    imageDerivativePlanId: renderedPlan.imageDerivativePlanId,
    imageDerivativeVariantId: renderedPlan.variants[0].variantId,
  };
  return { sourceAsset, outputAsset, quality, renderedPlan, binding };
}

function applicationFixture() {
  const planning = planningFixture();
  const media = mediaFixture();
  const planningRepository = createMemoryContentPlanningRepository([
    planning.approved,
    planning.piece,
    planning.variant,
    planning.revision,
  ]);
  const assetRepository = createMemoryAssetRepository([media.sourceAsset, media.outputAsset]);
  const mediaIntelligenceRepository = createMemoryMediaIntelligenceRepository([media.quality, media.renderedPlan]);
  const application = createPlatformMediaBindingApplication({
    contentPlanningRepository: planningRepository,
    assetRepository,
    mediaIntelligenceRepository,
    workspaceId: WORKSPACE,
    userId: "owner",
    clock: { now: () => NOW },
    idService: createDeterministicIdService("media-review"),
  });
  return { ...planning, ...media, planningRepository, assetRepository, mediaIntelligenceRepository, application };
}

test("platform revision carries one exact screenshot derivative binding and text revisions preserve it", () => {
  const { revision, binding } = applicationFixture();
  const withMedia = createPlatformVariantRevision({
    platformVariantRevisionId: "revision-bound-1",
    workspaceId: revision.workspaceId,
    platformVariantId: revision.platformVariantId,
    contentPieceId: revision.contentPieceId,
    narrativeStrategyId: revision.narrativeStrategyId,
    destination: revision.destination,
    revisionNumber: 1,
    strategyRevision: revision.strategyRevision,
    output: { format: revision.format, content: revision.content, segments: revision.segments },
    inputFingerprint: "bound-media-v1",
    identityContextSnapshotId: revision.identityContextSnapshotId,
    mediaBindings: [binding],
    generationProvenance: revision.generationProvenance,
    createdAt: NOW,
  });
  assert.deepEqual(withMedia.mediaBindings, [binding]);

  const edited = createEditedPlatformVariantRevision({
    platformVariantRevisionId: "revision-bound-2",
    parentRevision: withMedia,
    revisionNumber: 2,
    content: "SignalFlow captures proof from the work itself, then keeps the selected visual exact through review.",
    editedBy: "owner",
    createdAt: NOW,
  });
  assert.deepEqual(edited.mediaBindings, withMedia.mediaBindings);

  const requested = createRequestedPlatformVariantRevision({
    platformVariantRevisionId: "revision-bound-3",
    parentRevision: edited,
    revisionNumber: 3,
    output: { format: "single_post", content: "The work creates the proof; SignalFlow keeps the exact visual attached through review.", segments: [] },
    changeRequest: "Make the opening tighter without changing the visual.",
    generationProvenance: { taskId: "task-change", provider: "test", model: "writer", routeKind: "remote", promptVersion: "platform_change_v1", generatedAt: NOW },
    createdAt: NOW,
  });
  assert.deepEqual(requested.mediaBindings, withMedia.mediaBindings);
});

test("media replacement creates a new immutable current revision without rewriting text", async () => {
  const fixture = applicationFixture();
  const rebound = await fixture.application.bindCurrentMedia(fixture.variant.platformVariantId, {
    expectedCurrentRevisionId: fixture.revision.platformVariantRevisionId,
    mediaBindings: [fixture.binding],
    reason: "Use the safe 16:9 evidence derivative.",
  });
  assert.equal(rebound.origin, "media_rebound");
  assert.equal(rebound.parentRevisionId, fixture.revision.platformVariantRevisionId);
  assert.equal(rebound.content, fixture.revision.content);
  assert.equal(rebound.format, fixture.revision.format);
  assert.deepEqual(rebound.segments, fixture.revision.segments);
  assert.deepEqual(rebound.mediaBindings, [fixture.binding]);
  assert.equal(rebound.mediaChangeProvenance.changedBy, "owner");

  const currentVariant = await fixture.planningRepository.get(fixture.variant.platformVariantId);
  assert.equal(currentVariant.currentRevisionId, rebound.platformVariantRevisionId);
  assert.equal((await fixture.planningRepository.get(fixture.revision.platformVariantRevisionId)).content, fixture.revision.content);
});

test("rebinding the exact same AssetVersion is idempotent and does not create revision churn", async () => {
  const fixture = applicationFixture();
  const first = await fixture.application.bindCurrentMedia(fixture.variant.platformVariantId, {
    expectedCurrentRevisionId: fixture.revision.platformVariantRevisionId,
    mediaBindings: [fixture.binding],
  });
  const before = (await fixture.planningRepository.list()).filter((record) => record.kind === "PlatformVariantRevision").length;
  const second = await fixture.application.bindCurrentMedia(fixture.variant.platformVariantId, {
    expectedCurrentRevisionId: first.platformVariantRevisionId,
    mediaBindings: [fixture.binding],
  });
  const after = (await fixture.planningRepository.list()).filter((record) => record.kind === "PlatformVariantRevision").length;
  assert.equal(second.platformVariantRevisionId, first.platformVariantRevisionId);
  assert.equal(after, before);
});

test("stale AssetVersion, stale review surface, and mismatched derivative lineage fail closed", async () => {
  const fixture = applicationFixture();
  await assert.rejects(
    () => fixture.application.bindCurrentMedia(fixture.variant.platformVariantId, {
      expectedCurrentRevisionId: fixture.revision.platformVariantRevisionId,
      mediaBindings: [{ ...fixture.binding, assetVersionId: "asset-version-stale" }],
    }),
    (error) => error.code === "stale_media_asset",
  );
  await assert.rejects(
    () => fixture.application.bindCurrentMedia(fixture.variant.platformVariantId, {
      expectedCurrentRevisionId: "revision-unseen-newer",
      mediaBindings: [fixture.binding],
    }),
    (error) => error.code === "stale_revision_context",
  );
  await assert.rejects(
    () => fixture.application.bindCurrentMedia(fixture.variant.platformVariantId, {
      expectedCurrentRevisionId: fixture.revision.platformVariantRevisionId,
      mediaBindings: [{ ...fixture.binding, imageDerivativeVariantId: "derivative-wrong" }],
    }),
    (error) => error.code === "derivative_variant_not_found",
  );
});

test("restore returns the exact historical text and exact historical media as one composite revision", async () => {
  const fixture = applicationFixture();
  const rebound = await fixture.application.bindCurrentMedia(fixture.variant.platformVariantId, {
    expectedCurrentRevisionId: fixture.revision.platformVariantRevisionId,
    mediaBindings: [fixture.binding],
  });
  const textOnly = createEditedPlatformVariantRevision({
    platformVariantRevisionId: "revision-text-only-child",
    parentRevision: rebound,
    revisionNumber: rebound.revisionNumber + 1,
    content: "A later text edit still carries the same exact visual.",
    editedBy: "owner",
    createdAt: NOW,
  });
  const restored = createRestoredPlatformVariantRevision({
    platformVariantRevisionId: "revision-restored-composite",
    currentRevision: textOnly,
    sourceRevision: rebound,
    revisionNumber: textOnly.revisionNumber + 1,
    restoredBy: "owner",
    createdAt: NOW,
  });
  assert.equal(restored.content, rebound.content);
  assert.deepEqual(restored.mediaBindings, rebound.mediaBindings);
});

test("resolved revision media returns exact AssetVersion and verified derivative provenance", async () => {
  const fixture = applicationFixture();
  const rebound = await fixture.application.bindCurrentMedia(fixture.variant.platformVariantId, {
    expectedCurrentRevisionId: fixture.revision.platformVariantRevisionId,
    mediaBindings: [fixture.binding],
  });
  const resolved = await fixture.application.getRevisionMedia(rebound.platformVariantRevisionId);
  assert.equal(resolved.items.length, 1);
  assert.equal(resolved.items[0].asset.assetId, fixture.outputAsset.assetId);
  assert.equal(resolved.items[0].asset.assetVersionId, fixture.outputAsset.assetVersionId);
  assert.equal(resolved.items[0].screenshot.aspectRatio, "16:9");
  assert.equal(resolved.items[0].screenshot.screenshotQualityReviewId, fixture.quality.screenshotQualityReviewId);
});
