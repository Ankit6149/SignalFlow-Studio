import { requireOwnerAccess } from "../_auth";
import { createProductionHostedPlanningApplications } from "../../../lib/server/hostedPlanningDependencies.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_BODY_BYTES = 96 * 1024;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function requireJson(request) {
  const type = String(request?.headers?.get("content-type") || "").toLowerCase();
  if (!type.startsWith("application/json")) {
    const error = new Error("Identity updates require an application/json request body.");
    error.code = "identity_content_type_required";
    error.status = 415;
    throw error;
  }
}

async function readBody(request) {
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
    const error = new Error("Identity update payload is too large.");
    error.code = "identity_payload_too_large";
    error.status = 413;
    throw error;
  }
  try {
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("shape");
    return parsed;
  } catch {
    const error = new Error("Identity update payload must be a JSON object.");
    error.code = "identity_invalid_json";
    error.status = 400;
    throw error;
  }
}

function publicError(error) {
  const status = Number(error?.status || 0);
  return json({
    ok: false,
    code: String(error?.code || "hosted_identity_failed"),
    error: status >= 500
      ? "SignalFlow could not access the hosted identity workspace."
      : String(error?.message || "The identity action could not be completed."),
  }, status >= 400 && status <= 599 ? status : 500);
}

function applications(request) {
  return createProductionHostedPlanningApplications({ origin: new URL(request.url).origin });
}

export async function GET(request) {
  const accessError = requireOwnerAccess(request);
  if (accessError) return accessError;
  try {
    const { workspaceId, userId, identityApplication } = applications(request);
    const profile = await identityApplication.getMinimalProfile();
    return json({ ok: true, workspaceId, userId, profile });
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
    if (!body.profile || typeof body.profile !== "object" || Array.isArray(body.profile)) {
      const error = new Error("profile must be an object.");
      error.code = "identity_profile_required";
      error.status = 400;
      throw error;
    }
    const { workspaceId, userId, identityApplication } = applications(request);
    const profile = await identityApplication.saveMinimalProfile(body.profile);
    return json({ ok: true, workspaceId, userId, profile }, 201);
  } catch (error) {
    return publicError(error);
  }
}
