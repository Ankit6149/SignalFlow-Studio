import { requireOwnerAccess } from "../../_auth";
import { createProductionHostedGp2PreparationApplication } from "../../../../lib/server/hostedGp2PreparationDependencies.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 45;

const MAX_BODY_BYTES = 16 * 1024;

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

function requireJson(request) {
  const type = String(request?.headers?.get("content-type") || "").toLowerCase();
  if (!type.startsWith("application/json")) {
    const error = new Error("GP2 preparation requires an application/json request body.");
    error.code = "gp2_preparation_content_type_required";
    error.status = 415;
    throw error;
  }
}

async function readBody(request) {
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
    const error = new Error("GP2 preparation payload is too large.");
    error.code = "gp2_preparation_payload_too_large";
    error.status = 413;
    throw error;
  }
  try {
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("shape");
    return parsed;
  } catch {
    const error = new Error("GP2 preparation payload must be a JSON object.");
    error.code = "gp2_preparation_invalid_json";
    error.status = 400;
    throw error;
  }
}

function opaque(value, field) {
  const normalized = String(value || "").trim();
  if (!normalized || normalized.length > 320 || /[/\\]|^[a-zA-Z]:/.test(normalized)) {
    const error = new Error(`${field} must be an opaque identifier.`);
    error.code = "gp2_preparation_invalid_request";
    error.status = 400;
    throw error;
  }
  return normalized;
}

function publicError(error) {
  const status = Number.isInteger(error?.status) && error.status >= 400 && error.status <= 599 ? error.status : 500;
  return json({
    ok: false,
    code: String(error?.code || "hosted_gp2_preparation_failed"),
    error: status >= 500
      ? "SignalFlow could not continue hosted GP2 preparation."
      : String(error?.message || "Hosted GP2 preparation could not continue."),
  }, status);
}

export async function POST(request) {
  const accessError = requireOwnerAccess(request);
  if (accessError) return accessError;
  try {
    requireJson(request);
    const body = await readBody(request);
    const contentPieceId = opaque(body.contentPieceId, "contentPieceId");
    const origin = new URL(request.url).origin;
    const production = createProductionHostedGp2PreparationApplication({ origin });
    const preparation = await production.preparationApplication.prepareContentPiece(contentPieceId);
    return json({ ok: true, workspaceId: production.workspaceId, contentPieceId, preparation });
  } catch (error) {
    return publicError(error);
  }
}
