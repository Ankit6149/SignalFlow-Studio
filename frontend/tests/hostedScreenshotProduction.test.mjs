import test from "node:test";
import assert from "node:assert/strict";

import { createExactCaptureJobExecutionApplication } from "../lib/application/exactCaptureJobExecutionApplication.mjs";
import { createHostedScreenshotProductionApplication } from "../lib/application/hostedScreenshotProductionApplication.mjs";
import {
  approveNarrativeStrategy,
  createNarrativeStrategy,
  createPlannedPlatformVariant,
  createPrimaryContentPiece,
} from "../lib/domain/contentPlanning.mjs";
import {
  CAPTURE_JOB_STATUSES,
  activateCaptureRecipe,
  createCaptureJob,
  createCaptureRecipe,
  normalizeCaptureJob,
} from "../lib/domain/captureRecipes.mjs";
import { JOB_STATUSES, JOB_TYPES, succeedDurableJob } from "../lib/domain/durableJobs.mjs";
import { attachPlatformVariantRevision, createPlatformVariantRevision } from "../lib/domain/platformVariantRevisions.mjs";
import { normalizeAsset } from "../lib/domain/sourceArtifacts.mjs";
import { createMemoryContentPlanningRepository } from "../lib/infrastructure/contentPlanningAdapters.mjs";
import {
  createMemoryCaptureRepository,
  createMemoryDurableJobPort,
  createMemoryMediaIntelligenceRepository,
} from "../lib/infrastructure/productExecutionMemoryAdapters.mjs";

const WORKSPACE = "workspace-owner";
const PROJECT = "project-signalflow";
const T0 = "2026-08-31T06:00:00.000Z";
const T1 = "2026-08-31T06:00:01.000Z";
const T2 = "2026-08-31T06:00:02.000Z";

function recipe() {
  return activateCaptureRecipe(createCaptureRecipe({
    captureRecipeId: "recipe-hosted-product",
    workspaceId: WORKSPACE,
    projectId: PROJECT,
    name: "Hosted product proof",
    targetOrigin: "https://preview.example.test",
    allowedEnvironment: "preview",
    requiredCapabilities: ["screenshot"],
    secretReferenceIds: [],
    fixturePolicy: { allowedKeys: [], realUserDataAllowed: false },
    privacyRules: [{ code: "no-private-email", severity: "block", selector: "[data-private-email]" }],
    expectedCheckpoints: ["review"],
    steps: [
      { stepId: "open-review", action: "navigate", path: "/review" },
      { stepId: "capture-review", action: "capture_checkpoint", checkpoint: "review" },
    ],
    createdAt: T0,
    updatedAt: T0,
  }), T1);
}

function planningFixture() {
  const strategy = approveNarrativeStrategy(createNarrativeStrategy({
    narrativeStrategyId: "strategy-hosted-shot",
    workspaceId: WORKSPACE,
    opportunityId: "opportunity-hosted-shot",
    projectId: PROJECT,
    inputFingerprint: "hosted-shot-strategy",
    selectedAngle: {
      angleId: "angle-proof",
      title: "Show the proof",
      summary: "Use the exact shipped product evidence.",
      approach: "Lead with the visible behavior.",
    },
    identityContextSnapshotId: "identity-snapshot-linkedin",
    proposal: {
      coreIdea: "SignalFlow captures the evidence created by the work itself.",
      audienceTakeaway: "The owner can judge exact proof instead of manually manufacturing screenshots.",
      narrativeArc: ["Meaningful work happened", "SignalFlow prepared exact visual proof"],
      hookDirection: "Lead with the concrete product behavior.",
      evidencePlan: ["Use the exact hosted screenshot derivative."],
      factualConstraints: ["Do not claim automatic publication."],
      boundaryConstraints: ["Do not expose private source or storage metadata."],
      destinationPlan: [{
        destination: "linkedin",
        decision: "include",
        reason: "The product change benefits from visible evidence.",
        format: "single narrative post",
        adaptationNotes: [],
      }],
      mediaRequirements: [{ type: "screenshot", reason: "Visible product proof is useful.", required: true }],
      sequencingNotes: [],
    },
    taskId: "task-hosted-shot-strategy",
    createdAt: T0,
  }), T1);
  const piece = createPrimaryContentPiece({
    contentPieceId: "piece-hosted-shot",
    strategy,
    opportunityId: strategy.opportunityId,
    createdAt: T1,
  });
  const planned = createPlannedPlatformVariant({
    platformVariantId: "variant-hosted-shot",
    contentPiece: piece,
    strategy,
    destination: "linkedin",
    identityContextSnapshotId: "identity-snapshot-linkedin",
    createdAt: T1,
  });
  const revision = createPlatformVariantRevision({
    platformVariantRevisionId: "revision-hosted-shot-1",
    workspaceId: WORKSPACE,
    platformVariantId: planned.platformVariantId,
    contentPieceId: piece.contentPieceId,
    narrativeStrategyId: strategy.narrativeStrategyId,
    destination: "linkedin",
    revisionNumber: 1,
    strategyRevision: strategy.strategyRevision,
    output: {
      format: "single_post",
      content: "SignalFlow now captures exact visual proof from the product workflow.",
      segments: [],
    },
    inputFingerprint: "hosted-shot-write-1",
    identityContextSnapshotId: "identity-snapshot-linkedin",
    generationProvenance: {
      taskId: "task-hosted-shot-write",
      provider: "test",
      model: "writer",
      routeKind: "remote",
      promptVersion: "platform_variant_v1",
      generatedAt: T1,
    },
    createdAt: T1,
  });
  const variant = attachPlatformVariantRevision(planned, revision, T1);
  const repository = createMemoryContentPlanningRepository([strategy, piece, variant, revision]);
  return { strategy, piece, variant, revision, repository };
}

function capturedAsset() {
  return normalizeAsset({
    assetId: "asset-captured-hosted",
    assetVersionId: "asset-version-captured-hosted",
    workspaceId: WORKSPACE,
    projectId: PROJECT,
    assetType: "image",
    lifecycle: "original",
    originalName: "captured-review.png",
    mimeType: "image/png",
    byteSize: 2048,
    dimensions: { width: 1440, height: 900 },
    privacy: {
      classification: "workspace_private",
      processingAllowed: true,
      exportAllowed: true,
      remoteInferenceAllowed: false,
    },
    provenance: [{ eventType: "automatic_capture", method: "api", actorType: "worker", occurredAt: T2 }],
    createdAt: T2,
    updatedAt: T2,
  }, { workspaceId: WORKSPACE, projectId: PROJECT, now: T2 });
}

function orchestrationFixture({ qualityStatus = "ready", derivativeStatus = "rendered" } = {}) {
  const planning = planningFixture();
  const activeRecipe = recipe();
  const jobs = createMemoryDurableJobPort();
  const captures = createMemoryCaptureRepository({ recipes: [activeRecipe] });
  const media = createMemoryMediaIntelligenceRepository();
  const asset = capturedAsset();
  const calls = { exact: [], inspect: 0, render: 0, bind: 0 };

  const exactCaptureExecutionApplication = {
    async runJob(jobId) {
      calls.exact.push(jobId);
      const claimed = await jobs.claimById(jobId, {
        leaseOwner: "test-hosted-request",
        leaseSeconds: 90,
        now: T1,
        jobTypes: [JOB_TYPES.CAPTURE_SCREENSHOT],
      });
      if (!claimed) {
        return {
          executed: false,
          durableJob: await jobs.get(jobId),
          captureJob: null,
          assets: [],
        };
      }
      const pendingCapture = await captures.getJob(claimed.resourceId);
      const completedCapture = await captures.upsertJob(normalizeCaptureJob({
        ...pendingCapture,
        status: CAPTURE_JOB_STATUSES.SUCCEEDED,
        outputAssetIds: [asset.assetId],
        outputProvenance: [{
          assetId: asset.assetId,
          assetVersionId: asset.assetVersionId,
          checkpoint: "review",
          captureRecipeId: activeRecipe.captureRecipeId,
          captureRecipeVersion: activeRecipe.version,
          captureJobId: pendingCapture.captureJobId,
          sourceUrl: "https://preview.example.test/review",
          environment: "preview",
          viewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
          dimensions: asset.dimensions,
          capturedAt: T2,
          privacyReviewState: "passed",
          privacyIssueCodes: [],
          privacyWarningCodes: [],
          qualitySignals: {
            errorDetected: false,
            loadingDetected: false,
            subjectVisible: true,
          },
          workerAdapter: "test-capture-worker",
          workerAdapterVersion: 1,
          contentHash: "sha256:hosted-test",
        }],
        completedAt: T2,
        updatedAt: T2,
      }));
      const completedJob = await jobs.upsert(succeedDurableJob(claimed, {
        leaseOwner: "test-hosted-request",
        outputRefs: [asset.assetId],
        now: T2,
      }));
      return { executed: true, durableJob: completedJob, captureJob: completedCapture, assets: [asset] };
    },
  };

  const qualityReview = {
    kind: "ScreenshotQualityReview",
    screenshotQualityReviewId: "quality-hosted-shot",
    workspaceId: WORKSPACE,
    assetId: asset.assetId,
    assetVersionId: asset.assetVersionId,
    status: qualityStatus,
  };
  const plannedDerivative = {
    kind: "ImageDerivativePlan",
    imageDerivativePlanId: "plan-hosted-shot",
    workspaceId: WORKSPACE,
    sourceAssetId: asset.assetId,
    sourceAssetVersionId: asset.assetVersionId,
    screenshotQualityReviewId: qualityReview.screenshotQualityReviewId,
    variants: [{
      variantId: "derivative-hosted-16x9",
      aspectRatio: "16:9",
      status: qualityStatus === "ready" ? "ready_for_render" : "blocked",
    }],
  };
  const renderedDerivative = {
    ...plannedDerivative,
    variants: plannedDerivative.variants.map((item) => ({
      ...item,
      status: derivativeStatus,
      outputAssetId: derivativeStatus === "rendered" ? "asset-hosted-derivative" : null,
      outputAssetVersionId: derivativeStatus === "rendered" ? "asset-version-hosted-derivative" : null,
    })),
  };

  const screenshotDerivativeApplication = {
    async inspectAndPlan() {
      calls.inspect += 1;
      return { qualityReview, plan: plannedDerivative };
    },
    async renderPlan() {
      calls.render += 1;
      return { qualityReview, plan: renderedDerivative };
    },
  };

  const platformMediaBindingApplication = {
    async bindRenderedScreenshot(platformVariantId, options) {
      calls.bind += 1;
      assert.equal(platformVariantId, planning.variant.platformVariantId);
      assert.equal(options.expectedCurrentRevisionId, planning.revision.platformVariantRevisionId);
      assert.equal(options.imageDerivativePlanId, renderedDerivative.imageDerivativePlanId);
      assert.equal(options.imageDerivativeVariantId, renderedDerivative.variants[0].variantId);
      const current = await planning.repository.get(planning.variant.platformVariantId);
      await planning.repository.upsert({
        ...current,
        currentRevisionId: "revision-hosted-shot-2",
        updatedAt: T2,
      });
      return {
        kind: "PlatformVariantRevision",
        platformVariantRevisionId: "revision-hosted-shot-2",
        parentRevisionId: planning.revision.platformVariantRevisionId,
        content: planning.revision.content,
        mediaBindings: [{
          role: options.role,
          assetId: "asset-hosted-derivative",
          assetVersionId: "asset-version-hosted-derivative",
        }],
      };
    },
  };

  const application = createHostedScreenshotProductionApplication({
    workspaceId: WORKSPACE,
    userId: "owner",
    contentPlanningRepository: planning.repository,
    durableJobRepository: jobs,
    captureRepository: captures,
    mediaIntelligenceRepository: media,
    privateAssetStorage: {
      async readAsset({ workspaceId, assetId }) {
        assert.equal(workspaceId, WORKSPACE);
        assert.equal(assetId, asset.assetId);
        return { asset, bytes: new Uint8Array([1, 2, 3]) };
      },
    },
    exactCaptureExecutionApplication,
    screenshotDerivativeApplication,
    platformMediaBindingApplication,
    clock: { now: () => T1 },
  });

  return { ...planning, activeRecipe, jobs, captures, media, asset, calls, application };
}

test("exact request-scoped capture execution cannot steal another queued capture job", async () => {
  const activeRecipe = recipe();
  const captures = createMemoryCaptureRepository({ recipes: [activeRecipe] });
  const jobs = createMemoryDurableJobPort();
  const pairA = createCaptureJob({
    captureJobId: "capture-job-a",
    jobId: "durable-job-a",
    recipe: activeRecipe,
    captureKind: "screenshot",
    requestedCheckpoint: "review",
    idempotencyKey: "exact-a",
    createdAt: T0,
  });
  const pairB = createCaptureJob({
    captureJobId: "capture-job-b",
    jobId: "durable-job-b",
    recipe: activeRecipe,
    captureKind: "screenshot",
    requestedCheckpoint: "review",
    idempotencyKey: "exact-b",
    createdAt: T0,
  });
  await captures.upsertJob(pairA.captureJob);
  await captures.upsertJob(pairB.captureJob);
  await jobs.upsert(pairA.durableJob);
  await jobs.upsert(pairB.durableJob);
  const executed = [];
  const application = createExactCaptureJobExecutionApplication({
    durableJobRepository: jobs,
    captureRepository: captures,
    captureExecutionApplication: {
      async executeClaimedJob(job) {
        executed.push(job.jobId);
        return { durableJob: job, captureJob: await captures.getJob(job.resourceId), assets: [] };
      },
    },
    clock: { now: () => T1 },
    leaseOwner: "exact-test",
  });

  await application.runJob("durable-job-b");
  assert.deepEqual(executed, ["durable-job-b"]);
  assert.equal((await jobs.get("durable-job-b")).status, JOB_STATUSES.RUNNING);
  assert.equal((await jobs.get("durable-job-a")).status, JOB_STATUSES.QUEUED);
});

test("hosted screenshot production composes exact capture, quality, derivative and media binding once", async () => {
  const fixture = orchestrationFixture();
  const result = await fixture.application.produceScreenshot({
    platformVariantId: fixture.variant.platformVariantId,
    expectedCurrentRevisionId: fixture.revision.platformVariantRevisionId,
    aspectRatio: "16:9",
    checkpoint: "review",
  });

  assert.equal(result.status, "bound");
  assert.equal(result.sourceRevisionId, fixture.revision.platformVariantRevisionId);
  assert.equal(result.boundRevision.platformVariantRevisionId, "revision-hosted-shot-2");
  assert.equal(result.boundRevision.content, fixture.revision.content, "automatic media binding must not rewrite text");
  assert.equal(fixture.calls.exact.length, 1);
  assert.equal(fixture.calls.inspect, 1);
  assert.equal(fixture.calls.render, 1);
  assert.equal(fixture.calls.bind, 1);
  assert.equal((await fixture.jobs.list()).length, 1, "one exact revision/request creates one durable capture job");
  assert.equal((await fixture.captures.listJobs()).length, 1, "one exact revision/request creates one canonical CaptureJob");

  await assert.rejects(
    () => fixture.application.produceScreenshot({
      platformVariantId: fixture.variant.platformVariantId,
      expectedCurrentRevisionId: fixture.revision.platformVariantRevisionId,
      aspectRatio: "16:9",
      checkpoint: "review",
    }),
    (error) => error.code === "stale_revision_context",
  );
  assert.equal((await fixture.jobs.list()).length, 1, "a retried stale request cannot duplicate capture work");
  assert.equal(fixture.calls.bind, 1, "a retried stale request cannot create another bound revision");
});

test("hosted screenshot production fails stale review context before creating capture work", async () => {
  const fixture = orchestrationFixture();
  await assert.rejects(
    () => fixture.application.produceScreenshot({
      platformVariantId: fixture.variant.platformVariantId,
      expectedCurrentRevisionId: "revision-stale-unseen",
      aspectRatio: "16:9",
      checkpoint: "review",
    }),
    (error) => error.code === "stale_revision_context",
  );
  assert.equal((await fixture.jobs.list()).length, 0);
  assert.equal((await fixture.captures.listJobs()).length, 0);
  assert.equal(fixture.calls.exact.length, 0);
});

test("blocked screenshot quality stops before derivative rendering and exact media binding", async () => {
  const fixture = orchestrationFixture({ qualityStatus: "blocked" });
  const result = await fixture.application.produceScreenshot({
    platformVariantId: fixture.variant.platformVariantId,
    expectedCurrentRevisionId: fixture.revision.platformVariantRevisionId,
    aspectRatio: "16:9",
    checkpoint: "review",
  });
  assert.equal(result.status, "quality_blocked");
  assert.equal(fixture.calls.exact.length, 1);
  assert.equal(fixture.calls.inspect, 1);
  assert.equal(fixture.calls.render, 0);
  assert.equal(fixture.calls.bind, 0);
});

test("non-rendered derivative never becomes review media", async () => {
  const fixture = orchestrationFixture({ derivativeStatus: "blocked" });
  const result = await fixture.application.produceScreenshot({
    platformVariantId: fixture.variant.platformVariantId,
    expectedCurrentRevisionId: fixture.revision.platformVariantRevisionId,
    aspectRatio: "16:9",
    checkpoint: "review",
  });
  assert.equal(result.status, "derivative_blocked");
  assert.equal(fixture.calls.render, 1);
  assert.equal(fixture.calls.bind, 0);
});
