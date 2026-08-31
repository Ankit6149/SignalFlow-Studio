import { requireOwnerAccess } from "../_auth";
import { createProductionHostedPlatformReviewApplications } from "../../../lib/server/hostedPlatformReviewDependencies.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 45;

const MAX_BODY_BYTES = 64 * 1024;
const ACTIONS = new Set([
  "generate_ready",
  "generate_variant",
  "regenerate_variant",
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

function opaque(value, field) {
  const normalized = String(value || "").trim();
  if (!normalized || normalized.length > 320 || /[/\\]|^[a-zA-Z]:/.test(normalized)) {
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
  if (["stale_revision_context", "stale_planning_contract", "review_required", "review_blocked", "strategy_approval_required", "hosted_media_preview_confirmation_required"].includes(code)) return 409;
  if (["platform_review_invalid_request", "platform_variant_omitted", "revision_already_current"].includes(code)) return 400;
  if (code === "voice_profile_required") return 409;
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

async function requireMediaSafeApproval(apps, platformVariantId, platformVariantRevisionId) {
  const bundle = await apps.reviewApplication.getReviewBundleForRevision(platformVariantId, platformVariantRevisionId);
  if (bundle.revision.mediaBindings?.length) {
    const error = new Error("Hosted approval of a media-bound revision remains blocked until the owner-facing exact-media preview supplies an explicit visible-version confirmation.");
    error.code = "hosted_media_preview_confirmation_required";
    error.status = 409;
    throw error;
  }
  return bundle;
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
      return json({ ok: true, workspaceId: apps.workspaceId, action, result });
    }

    const platformVariantId = opaque(body.platformVariantId, "platformVariantId");

    if (action === "generate_variant") {
      const revision = await apps.generationApplication.generateVariant(platformVariantId, { refresh: false });
      return json({ ok: true, workspaceId: apps.workspaceId, action, revision });
    }
    if (action === "regenerate_variant") {
      const revision = await apps.generationApplication.regenerateVariant(platformVariantId);
      return json({ ok: true, workspaceId: apps.workspaceId, action, revision });
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
      await requireMediaSafeApproval(apps, platformVariantId, platformVariantRevisionId);
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
    return json({ ok: true, workspaceId: apps.workspaceId, action, revision });
  } catch (error) {
    return publicError(error);
  }
}
