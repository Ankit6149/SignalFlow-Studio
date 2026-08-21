import { requireOwnerAccess } from "../_auth";
import { createProductionHostedOpportunityApplications } from "../../../lib/server/hostedOpportunityDependencies.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 45;

const MAX_BODY_BYTES = 32 * 1024;
const ACTIONS = new Set(["select_angle", "select_recommended", "custom_angle", "reject", "snooze", "refresh"]);

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function requireJsonContentType(request) {
  const contentType = String(request?.headers?.get("content-type") || "").toLowerCase();
  if (!contentType.startsWith("application/json")) {
    const error = new Error("Opportunity actions require an application/json request body.");
    error.code = "opportunity_action_content_type_required";
    error.status = 415;
    throw error;
  }
}

async function readBody(request) {
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
    const error = new Error("Opportunity action payload is too large.");
    error.code = "opportunity_action_too_large";
    error.status = 413;
    throw error;
  }
  try {
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("shape");
    return parsed;
  } catch {
    const error = new Error("Opportunity action payload must be a JSON object.");
    error.code = "opportunity_action_invalid_json";
    error.status = 400;
    throw error;
  }
}

function required(value, field) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    const error = new Error(`${field} is required.`);
    error.code = "opportunity_action_invalid";
    error.status = 400;
    throw error;
  }
  if (/[/\\]|^[a-zA-Z]:/.test(normalized)) {
    const error = new Error(`${field} must be an opaque identifier.`);
    error.code = "opportunity_action_invalid";
    error.status = 400;
    throw error;
  }
  return normalized;
}

function publicError(error) {
  const status = Number(error?.status || 0);
  return json({
    ok: false,
    code: String(error?.code || "hosted_opportunity_failed"),
    error: status >= 500
      ? "SignalFlow could not access the hosted opportunity workspace."
      : String(error?.message || "The opportunity action could not be completed."),
  }, status >= 400 && status <= 599 ? status : 500);
}

function applications(request) {
  return createProductionHostedOpportunityApplications({ origin: new URL(request.url).origin });
}

export async function GET(request) {
  const accessError = requireOwnerAccess(request);
  if (accessError) return accessError;
  try {
    const includeRejected = new URL(request.url).searchParams.get("includeRejected") === "1";
    const { workspaceId, opportunityApplication } = applications(request);
    const opportunities = await opportunityApplication.listRankedOpportunities({ includeRejected });
    return json({ ok: true, workspaceId, opportunities });
  } catch (error) {
    return publicError(error);
  }
}

export async function PATCH(request) {
  const accessError = requireOwnerAccess(request);
  if (accessError) return accessError;
  try {
    requireJsonContentType(request);
    const body = await readBody(request);
    const action = String(body.action || "").trim().toLowerCase();
    if (!ACTIONS.has(action)) {
      const error = new Error("Unsupported opportunity action.");
      error.code = "opportunity_action_unsupported";
      error.status = 400;
      throw error;
    }
    const { opportunityApplication, continuationApplication } = applications(request);
    let opportunity;

    if (action === "refresh") {
      const result = await continuationApplication.continueToOpportunity(required(body.signalId, "signalId"), { refresh: true });
      opportunity = result.opportunity;
    } else {
      const opportunityId = required(body.opportunityId, "opportunityId");
      if (action === "select_angle") {
        opportunity = await opportunityApplication.selectAngle(opportunityId, required(body.angleId, "angleId"));
      } else if (action === "select_recommended") {
        const current = await opportunityApplication.readOpportunity(opportunityId);
        if (!current?.recommendedAngleId) {
          const error = new Error("This opportunity has no explicit recommended angle. Choose one of the visible directions instead.");
          error.code = "opportunity_recommended_angle_required";
          error.status = 409;
          throw error;
        }
        opportunity = await opportunityApplication.selectAngle(opportunityId, current.recommendedAngleId);
      } else if (action === "custom_angle") {
        opportunity = await opportunityApplication.setCustomAngle(opportunityId, body.customAngle || {});
      } else if (action === "reject") {
        opportunity = await opportunityApplication.rejectOpportunity(opportunityId);
      } else if (action === "snooze") {
        opportunity = await opportunityApplication.snoozeOpportunity(opportunityId, body.snoozedUntil);
      }
    }

    return json({ ok: true, opportunity });
  } catch (error) {
    return publicError(error);
  }
}
