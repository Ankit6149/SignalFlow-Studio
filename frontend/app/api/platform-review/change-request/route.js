import { requireOwnerAccess } from "../../_auth";
import { createProductionHostedPlatformReviewApplications } from "../../../../lib/server/hostedPlatformReviewDependencies.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 45;

const MAX_BODY_BYTES = 16 * 1024;
const MAX_CHANGE_REQUEST_LENGTH = 2000;

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
    error.code = "platform_change_invalid_request";
    error.status = 400;
    throw error;
  }
  return normalized;
}

function instruction(value) {
  const normalized = String(value ?? "").replace(/\r\n?/g, "\n").trim();
  if (!normalized || normalized.length > MAX_CHANGE_REQUEST_LENGTH) {
    const error = new Error(`changeRequest must contain 1-${MAX_CHANGE_REQUEST_LENGTH} characters.`);
    error.code = "platform_change_invalid_request";
    error.status = 400;
    throw error;
  }
  return normalized;
}

async function readBody(request) {
  const type = String(request?.headers?.get("content-type") || "").toLowerCase();
  if (!type.startsWith("application/json")) {
    const error = new Error("Hosted change requests require an application/json request body.");
    error.code = "platform_change_content_type_required";
    error.status = 415;
    throw error;
  }
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
    const error = new Error("Hosted change-request payload is too large.");
    error.code = "platform_change_payload_too_large";
    error.status = 413;
    throw error;
  }
  try {
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("shape");
    return parsed;
  } catch {
    const error = new Error("Hosted change-request payload must be a JSON object.");
    error.code = "platform_change_invalid_json";
    error.status = 400;
    throw error;
  }
}

function staleRevisionError() {
  const error = new Error("A newer hosted revision exists. Reload before requesting a change to unseen content.");
  error.code = "stale_revision_context";
  error.status = 409;
  return error;
}

function publicError(error) {
  const status = Number.isInteger(error?.status) && error.status >= 400 && error.status <= 599
    ? error.status
    : error?.code === "stale_revision_context"
      ? 409
      : error instanceof TypeError
        ? 400
        : 500;
  return json({
    ok: false,
    code: String(error?.code || "hosted_platform_change_failed"),
    error: status >= 500
      ? "SignalFlow could not apply the hosted change request."
      : String(error?.message || "The hosted change request could not be applied."),
  }, status);
}

export async function POST(request) {
  const accessError = requireOwnerAccess(request);
  if (accessError) return accessError;
  try {
    const body = await readBody(request);
    const platformVariantId = opaque(body.platformVariantId, "platformVariantId");
    const expectedCurrentRevisionId = opaque(body.expectedCurrentRevisionId, "expectedCurrentRevisionId");
    const changeRequest = instruction(body.changeRequest);
    const apps = createProductionHostedPlatformReviewApplications({
      origin: new URL(request.url).origin,
    });
    const visible = await apps.reviewApplication.getReviewBundle(platformVariantId);
    if (
      !visible.revision
      || visible.revision.platformVariantRevisionId !== expectedCurrentRevisionId
      || !visible.isCurrent
    ) {
      throw staleRevisionError();
    }
    const revision = await apps.changeApplication.requestChange(platformVariantId, changeRequest);
    return json({
      ok: true,
      workspaceId: apps.workspaceId,
      revision,
    });
  } catch (error) {
    return publicError(error);
  }
}
