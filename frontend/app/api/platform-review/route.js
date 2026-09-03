import { requireOwnerAccess } from "../_auth";
import { createHostedMediaPreviewReceiptService } from "../../../lib/server/hostedMediaPreviewReceipt.mjs";
import { createProductionHostedPlatformReviewApplications } from "../../../lib/server/hostedPlatformReviewDependencies.mjs";
import { createProductionHostedScreenshotProductionApplication } from "../../../lib/server/hostedScreenshotProductionDependencies.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 45;

const MAX_BODY_BYTES = 64 * 1024;
const ACTIONS = new Set([
  "generate_ready",
  "generate_variant",
  "regenerate_variant",
  "edit_revision",
  "produce_screenshot",
  "review_revision",
  "approve_revision",
  "reject_revision",
  "restore_revision",
]);

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, no-store, max-age=0",
      "x-content-type-options": "nosniff",
    },
  });
}

function opaque(value, field, maxLength = 320) {
  const normalized = String(value || "").trim();
  if (!normalized || normalized.length > maxLength || /[/\\]|^[a-zA-Z]:/.test(normalized)) {
    const error = new Error(`${field} must be an opaque identifier.`);
    error.code = "platform_review_invalid_request";
    error.status = 400;
    throw error;
  }
  return normalized;
}

function requireJson(request) {
  const type = String(request?.headers?.get("content-type") || "").toLowerCase();
  if (!type.startsWith("application/json")) {
    const error = new Error("Platform review actions require an application/json request body.");
    error.code = "platform_review_content_type_required";
    error.status = 415;
    throw error;
  }
}

async function readBody(request) {
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
    const error = new Error("Platform review action payload is too large.");
    error.code = "platform_review_payload_too_large";
    error.status = 413;
    throw error;
  }
  try {
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("shape");
    return parsed;
  } catch {
    const error = new Error("Platform review action payload must be a JSON object.");
    error.code = "platform_review_invalid_json";
    error.status = 400;
    throw error;
  }
}

function statusFor(error) {
  if (Number.isInteger(error?.status) && error.status >= 400 && error.status <= 599) return error.status;
  const code = String(error?.code || "");
  if ([
    "stale_revision_context",
    "stale_planning_contract",
    "review_required",
    "review_blocked",
    "strategy_approval_required",
    "hosted_media_preview_confirmation_required",
    "preview_receipt_expired",
    "preview_receipt_identity_mismatch",
  ].includes(code)) return 409;
  if (["platform_review_invalid_request", "platform_variant_omitted", "revision_already_current", "preview_receipt_invalid"].includes(code)) return 400;
  if (["voice_profile_required"].includes(code)) return 409;
  if (["preview_receipt_secret_unconfigured"].includes(code)) return 503;
  if (error instanceof TypeError) return 400;
  return 500;
}

function publicError(error) {
  const status = statusFor(error);
  return json({
    ok: false,
    code: String(error?.code || "hosted_platform_review_failed"),
    error: status >= 500
      ? "SignalFlow could not access the hosted platform review workspace."
      : String(error?.message || "The platform review action could not be completed."),
  }, status);
}

function applications(request) {
  return createProductionHostedPlatformReviewApplications({ origin: new URL(request.url).origin });
}

async function responseBundle(apps, contentPieceId) {
  const generation = await apps.generationApplication.getGenerationBundle(contentPieceId);
  const variants = [];
  for (const entry of generation.variants) {
    variants.push({
      ...entry,
      review: entry.currentRevision
        ? await apps.reviewApplication.getReviewBundle(entry.variant.platformVariantId)
        : null,
    });
  }
  return { contentPiece: generation.contentPiece, variants };
}

function staleRevisionError() {
  const error = new Error("This hosted review surface is stale because a newer current revision exists. Reload before changing it.");
  error.code = "stale_revision_context";
  error.status = 409;
  return error;
}

async function assertExpectedCurrent(apps, platformVariantId, expectedCurrentRevisionId) {
  const expected = opaque(expectedCurrentRevisionId, "expectedCurrentRevisionId");
  const bundle = await apps.reviewApplication.getReviewBundle(platformVariantId);
  if (!bundle.revision || bundle.revision.platformVariantRevisionId !== expected || !bundle.isCurrent) {
    throw staleRevisionError();
  }
  return bundle;
}

function mediaConfirmationError(message) {
  const error = new Error(message);
  error.code = "hosted_media_preview_confirmation_required";
  error.status = 409;
  return error;
}

function expectedVisibleMedia(mediaBindings = []) {
  return mediaBindings.map((binding) => ({
    role: opaque(binding.role, "mediaBinding.role", 80),
    assetId: opaque(binding.assetId, "mediaBinding.assetId"),
    assetVersionId: opaque(binding.assetVersionId, "mediaBinding.assetVersionId"),
  })).sort((left, right) => `${left.role}:${left.assetId}:${left.assetVersionId}`.localeCompare(`${right.role}:${right.assetId}:${right.assetVersionId}`));
}

function confirmedVisibleMedia(input) {
  if (!Array.isArray(input) || input.length > 4) {
    throw mediaConfirmationError("Hosted media approval requires the exact visible media confirmations for this revision.");
  }
  const confirmations = input.map((item, index) => ({
    role: opaque(item?.role, `visibleMedia[${index}].role`, 80),
    assetId: opaque(item?.assetId, `visibleMedia[${index}].assetId`),
    assetVersionId: opaque(item?.assetVersionId, `visibleMedia[${index}].assetVersionId`),
    previewReceipt: opaque(item?.previewReceipt, `visibleMedia[${index}].previewReceipt`, 4096),
  })).sort((left, right) => `${left.role}:${left.assetId}:${left.assetVersionId}`.localeCompare(`${right.role}:${right.assetId}:${right.assetVersionId}`));
  const identities = confirmations.map((item) => `${item.role}:${item.assetId}:${item.assetVersionId}`);
  if (new Set(identities).size !== identities.length) {
    throw mediaConfirmationError("Duplicate exact-media visibility confirmations are not valid.");
  }
  return confirmations;
}

function hasRequiredNonTextMedia(strategy) {
  return Boolean((strategy?.mediaRequirements || []).some((item) => {
    const type = String(item?.type || "").trim().toLowerCase();
    return item?.required === true && !["", "none", "text_only"].includes(type);
  }));
}

async function requireRequiredMediaBound(apps, revision) {
  if ((revision?.mediaBindings || []).length) return;
  const strategyId = opaque(revision?.narrativeStrategyId, "narrativeStrategyId");
  const strategy = await apps.contentPlanningRepository.get(strategyId);
  if (!strategy || strategy.kind !== "NarrativeStrategy" || !hasRequiredNonTextMedia(strategy)) return;
  const error = new Error("This strategy requires media before the revision can be approved.");
  error.code = "required_media_pending";
  error.status = 409;
  throw error;
}

async function requireMediaSafeApproval(apps, platformVariantId, platformVariantRevisionId, visibleMediaInput) {
  const bundle = await apps.reviewApplication.getReviewBundleForRevision(platformVariantId, platformVariantRevisionId);
  await requireRequiredMediaBound(apps, bundle.revision);
  const expected = expectedVisibleMedia(bundle.revision.mediaBindings || []);
  if (!expected.length) return bundle;

  const visible = confirmedVisibleMedia(visibleMediaInput);
  if (visible.length !== expected.length) {
    throw mediaConfirmationError("Every exact media binding on this revision must be visibly resolved before approval.");
  }
  for (let index = 0; index < expected.length; index += 1) {
    const target = expected[index];
    const confirmation = visible[index];
    if (
      target.role !== confirmation.role
      || target.assetId !== confirmation.assetId
      || target.assetVersionId !== confirmation.assetVersionId
    ) {
      throw mediaConfirmationError("Visible media confirmation does not match the exact media bound to this revision.");
    }
  }

  const receipts = createHostedMediaPreviewReceiptService({
    signingSecret: process.env.SIGNALFLOW_MEDIA_PREVIEW_RECEIPT_SECRET,
  });
  for (const confirmation of visible) {
    receipts.verify(confirmation.previewReceipt, {
      workspaceId: apps.workspaceId,
      assetId: confirmation.assetId,
      assetVersionId: confirmation.assetVersionId,
    });
  }
  return bundle;
}

function safeAssetIdentity(asset) {
  if (!asset) return null;
  return {
    assetId: asset.assetId,
    assetVersionId: asset.assetVersionId,
    assetType: asset.assetType,
    mimeType: asset.mimeType,
    dimensions: asset.dimensions || null,
    privacyClass: asset.privacy?.classification || null,
  };
}

function safeAutoReview(result) {
  if (!result) return null;
  return {
    status: result.status || null,
    platformVariantReviewId: result.review?.platformVariantReviewId || null,
    failureCode: result.failure?.code || null,
  };
}

function safeReviewPreparation(result) {
  const skipped = Array.isArray(result?.skipped) ? result.skipped : [];
  return {
    reviewedCount: Array.isArray(result?.reviewed) ? result.reviewed.length : 0,
    skippedCount: skipped.length,
    deferredCount: skipped.filter((item) => item.reason === "required_media_pending").length,
    failed: Array.isArray(result?.failed)
      ? result.failed.map((item) => ({
          platformVariantId: item.platformVariantId,
          platformVariantRevisionId: item.platformVariantRevisionId,
          destination: item.destination || null,
          code: item.code || "platform_review_failed",
        }))
      : [],
  };
}

function safeScreenshotResult(result, autoReview = null) {
  return {
    status: result.status,
    platformVariantId: result.platformVariantId,
    platformVariantRevisionId: result.platformVariantRevisionId || null,
    sourceRevisionId: result.sourceRevisionId || null,
    boundRevision: result.boundRevision || null,
    captureRecipeId: result.captureRecipeId || null,
    captureRecipeVersion: result.captureRecipeVersion || null,
    checkpoint: result.checkpoint || null,
    captureJobId: result.captureJob?.captureJobId || null,
    durableJobId: result.durableJob?.jobId || null,
    durableJobStatus: result.durableJob?.status || null,
    sourceAsset: safeAssetIdentity(result.sourceAsset),
    qualityReview: result.qualityReview || null,
    derivativePlan: result.derivativePlan || null,
    derivative: result.derivative || null,
    autoReview: safeAutoReview(autoReview),
  };
}

async function automaticallyReviewRevision(apps, revision, destination = null) {
  if (!revision) return null;
  return apps.preparationReviewApplication.reviewExactRevision(revision, { destination });
}

export async function GET(request) {
  const accessError = requireOwnerAccess(request);
  if (accessError) return accessError;
  try {
    const contentPieceId = opaque(new URL(request.url).searchParams.get("contentPieceId"), "contentPieceId");
    const apps = applications(request);
    return json({
      ok: true,
      workspaceId: apps.workspaceId,
      contentPieceId,
      bundle: await responseBundle(apps, contentPieceId),
    });
  } catch (error) {
    return publicError(error);
  }
}

export async function POST(request) {
  const accessError = requireOwnerAccess(request);
  if (accessError) return accessError;
  try {
    requireJson(request);
    const body = await readBody(request);
    const action = String(body.action || "").trim().toLowerCase();
    if (!ACTIONS.has(action)) {
      const error = new Error("Unsupported platform review action.");
      error.code = "platform_review_invalid_request";
      error.status = 400;
      throw error;
    }

    const apps = applications(request);

    if (action === "generate_ready") {
      const contentPieceId = opaque(body.contentPieceId, "contentPieceId");
      const result = await apps.generationApplication.generateReadyVariants(contentPieceId);
      const reviewPreparation = await apps.preparationReviewApplication.ensureContentPieceReviewed(contentPieceId);
      return json({
        ok: true,
        workspaceId: apps.workspaceId,
        action,
        result: {
          ...result,
          bundle: result.bundle,
          reviewPreparation: safeReviewPreparation(reviewPreparation),
        },
      });
    }

    const platformVariantId = opaque(body.platformVariantId, "platformVariantId");

    if (action === "generate_variant") {
      const revision = await apps.generationApplication.generateVariant(platformVariantId, { refresh: false });
      const autoReview = await automaticallyReviewRevision(apps, revision);
      return json({ ok: true, workspaceId: apps.workspaceId, action, revision, autoReview: safeAutoReview(autoReview) });
    }

    if (action === "regenerate_variant") {
      await assertExpectedCurrent(apps, platformVariantId, body.expectedCurrentRevisionId);
      const revision = await apps.generationApplication.regenerateVariant(platformVariantId);
      const autoReview = await automaticallyReviewRevision(apps, revision);
      return json({ ok: true, workspaceId: apps.workspaceId, action, revision, autoReview: safeAutoReview(autoReview) });
    }

    if (action === "edit_revision") {
      await assertExpectedCurrent(apps, platformVariantId, body.expectedCurrentRevisionId);
      const revision = await apps.reviewApplication.editCurrentVariant(platformVariantId, {
        content: body.content,
        segments: Array.isArray(body.segments) ? body.segments : [],
        format: body.format || null,
      });
      const autoReview = await automaticallyReviewRevision(apps, revision);
      return json({ ok: true, workspaceId: apps.workspaceId, action, revision, autoReview: safeAutoReview(autoReview) });
    }

    if (action === "produce_screenshot") {
      const expectedCurrentRevisionId = opaque(body.expectedCurrentRevisionId, "expectedCurrentRevisionId");
      const screenshot = createProductionHostedScreenshotProductionApplication({
        database: apps.database,
        contentPlanningRepository: apps.contentPlanningRepository,
      });
      const result = await screenshot.productionApplication.produceScreenshot({
        platformVariantId,
        expectedCurrentRevisionId,
        aspectRatio: String(body.aspectRatio || "").trim(),
        role: body.role ? opaque(body.role, "role", 80) : "primary_visual",
        captureRecipeId: body.captureRecipeId ? opaque(body.captureRecipeId, "captureRecipeId") : null,
        captureRecipeVersion: body.captureRecipeVersion ?? null,
        checkpoint: body.checkpoint ? opaque(body.checkpoint, "checkpoint", 160) : null,
      });
      const autoReview = result.status === "bound" && result.boundRevision
        ? await automaticallyReviewRevision(apps, result.boundRevision)
        : null;
      return json({ ok: true, workspaceId: apps.workspaceId, action, result: safeScreenshotResult(result, autoReview) });
    }

    const platformVariantRevisionId = opaque(body.platformVariantRevisionId, "platformVariantRevisionId");
    const expectedCurrentRevisionId = opaque(body.expectedCurrentRevisionId, "expectedCurrentRevisionId");

    if (action === "review_revision") {
      const review = await apps.reviewApplication.reviewRevision(platformVariantId, platformVariantRevisionId, {
        expectedCurrentRevisionId,
        refresh: body.refresh === true,
      });
      return json({ ok: true, workspaceId: apps.workspaceId, action, review });
    }

    if (action === "approve_revision") {
      await requireMediaSafeApproval(apps, platformVariantId, platformVariantRevisionId, body.visibleMedia);
      const approval = await apps.reviewApplication.approveRevision(platformVariantId, platformVariantRevisionId, {
        expectedCurrentRevisionId,
        note: String(body.note || "").trim(),
      });
      return json({ ok: true, workspaceId: apps.workspaceId, action, approval });
    }

    if (action === "reject_revision") {
      const approval = await apps.reviewApplication.rejectRevision(platformVariantId, platformVariantRevisionId, {
        expectedCurrentRevisionId,
        note: String(body.note || "").trim(),
      });
      return json({ ok: true, workspaceId: apps.workspaceId, action, approval });
    }

    const revision = await apps.reviewApplication.restoreRevision(platformVariantId, platformVariantRevisionId, {
      expectedCurrentRevisionId,
    });
    const autoReview = await automaticallyReviewRevision(apps, revision);
    return json({ ok: true, workspaceId: apps.workspaceId, action, revision, autoReview: safeAutoReview(autoReview) });
  } catch (error) {
    return publicError(error);
  }
}
