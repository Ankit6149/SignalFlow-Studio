import { requireOwnerAccess } from "../_auth";
import { createProductionHostedGp2PreparationApplication } from "../../../lib/server/hostedGp2PreparationDependencies.mjs";
import { createProductionHostedPlanningApplications } from "../../../lib/server/hostedPlanningDependencies.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 45;

const MAX_BODY_BYTES = 64 * 1024;
const ACTIONS = new Set(["build_strategy", "approve_strategy", "revise_strategy"]);
const PATCH_FIELDS = new Set([
  "title",
  "coreIdea",
  "audienceTakeaway",
  "narrativeArc",
  "hookDirection",
  "evidencePlan",
  "factualConstraints",
  "boundaryConstraints",
  "destinationPlan",
  "mediaRequirements",
  "sequencingNotes",
]);

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function opaque(value, field) {
  const normalized = String(value || "").trim();
  if (!normalized || /[/\\]|^[a-zA-Z]:/.test(normalized)) {
    const error = new Error(`${field} must be an opaque identifier.`);
    error.code = "planning_invalid_request";
    error.status = 400;
    throw error;
  }
  return normalized;
}

function requireJson(request) {
  const type = String(request?.headers?.get("content-type") || "").toLowerCase();
  if (!type.startsWith("application/json")) {
    const error = new Error("Planning actions require an application/json request body.");
    error.code = "planning_content_type_required";
    error.status = 415;
    throw error;
  }
}

async function readBody(request) {
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
    const error = new Error("Planning action payload is too large.");
    error.code = "planning_payload_too_large";
    error.status = 413;
    throw error;
  }
  try {
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("shape");
    return parsed;
  } catch {
    const error = new Error("Planning action payload must be a JSON object.");
    error.code = "planning_invalid_json";
    error.status = 400;
    throw error;
  }
}

function boundedPatch(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    const error = new Error("Strategy revision patch must be an object.");
    error.code = "planning_invalid_request";
    error.status = 400;
    throw error;
  }
  const patch = {};
  for (const [key, item] of Object.entries(value)) {
    if (!PATCH_FIELDS.has(key)) continue;
    patch[key] = item;
  }
  if (!Object.keys(patch).length) {
    const error = new Error("Strategy revision did not contain an editable planning field.");
    error.code = "planning_invalid_request";
    error.status = 400;
    throw error;
  }
  return patch;
}

function requireExpectedRevision(body, strategy) {
  const expected = Number(body.expectedStrategyRevision);
  if (!Number.isInteger(expected) || expected < 1) {
    const error = new Error("expectedStrategyRevision is required for strategy mutation.");
    error.code = "planning_expected_revision_required";
    error.status = 400;
    throw error;
  }
  if (expected !== strategy.strategyRevision) {
    const error = new Error("The strategy changed after this page loaded. Refresh before applying this judgment.");
    error.code = "planning_stale_strategy";
    error.status = 409;
    throw error;
  }
}

function publicError(error) {
  let status = Number(error?.status || 0);
  if (!status && error?.code === "voice_profile_required") status = 409;
  if (!status && error instanceof TypeError) status = 400;
  return json({
    ok: false,
    code: String(error?.code || "hosted_planning_failed"),
    error: status >= 500 || !status
      ? "SignalFlow could not access the hosted planning workspace."
      : String(error?.message || "The planning action could not be completed."),
  }, status >= 400 && status <= 599 ? status : 500);
}

function applications(request) {
  return createProductionHostedPlanningApplications({ origin: new URL(request.url).origin });
}

function failSoftPreparation(result, error) {
  return Object.freeze({
    status: "recovery_required",
    contentPieceId: result?.contentPiece?.contentPieceId || null,
    narrativeStrategyId: result?.strategy?.narrativeStrategyId || null,
    activeDestinationCount: Array.isArray(result?.variants)
      ? result.variants.filter((variant) => variant?.status !== "omitted").length
      : 0,
    generatedCount: 0,
    generationReusedCount: 0,
    mediaBoundCount: 0,
    mediaReusedCount: 0,
    reviewedCount: 0,
    reviewReusedCount: 0,
    failures: Object.freeze([Object.freeze({
      stage: "preparation",
      code: String(error?.code || "gp2_preparation_failed"),
      platformVariantId: null,
      platformVariantRevisionId: null,
      destination: null,
    })]),
    nextRoute: "/plan",
  });
}

export async function GET(request) {
  const accessError = requireOwnerAccess(request);
  if (accessError) return accessError;
  try {
    const opportunityId = opaque(new URL(request.url).searchParams.get("opportunityId"), "opportunityId");
    const { workspaceId, planningApplication } = applications(request);
    const plan = await planningApplication.getPlanBundle(opportunityId);
    return json({ ok: true, workspaceId, opportunityId, plan });
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
      const error = new Error("Unsupported planning action.");
      error.code = "planning_action_unsupported";
      error.status = 400;
      throw error;
    }

    const opportunityId = opaque(body.opportunityId, "opportunityId");
    const { workspaceId, planningApplication, database } = applications(request);

    if (action === "build_strategy") {
      const strategy = await planningApplication.buildStrategy(opportunityId, { refresh: body.refresh === true });
      const plan = await planningApplication.getPlanBundle(opportunityId);
      return json({ ok: true, workspaceId, opportunityId, strategy, plan });
    }

    const current = await planningApplication.getPlanBundle(opportunityId);
    if (!current.strategy) {
      const error = new Error("No hosted NarrativeStrategy exists for this opportunity yet.");
      error.code = "planning_strategy_missing";
      error.status = 409;
      throw error;
    }
    const strategyId = opaque(body.strategyId, "strategyId");
    if (current.strategy.narrativeStrategyId !== strategyId) {
      const error = new Error("The requested strategy is not the current strategy for this opportunity.");
      error.code = "planning_stale_strategy";
      error.status = 409;
      throw error;
    }
    requireExpectedRevision(body, current.strategy);

    if (action === "revise_strategy") {
      const strategy = await planningApplication.reviseStrategy(strategyId, boundedPatch(body.patch));
      const plan = await planningApplication.getPlanBundle(opportunityId);
      return json({ ok: true, workspaceId, opportunityId, strategy, plan });
    }

    const result = await planningApplication.approveStrategy(strategyId, {
      origin: "owner",
      reason: String(body.reason || "").trim() || null,
    });

    let preparation = null;
    try {
      const production = createProductionHostedGp2PreparationApplication({
        origin: new URL(request.url).origin,
        database,
      });
      preparation = await production.preparationApplication.prepareContentPiece(result.contentPiece.contentPieceId);
    } catch (error) {
      preparation = failSoftPreparation(result, error);
    }

    const plan = await planningApplication.getPlanBundle(opportunityId);
    return json({ ok: true, workspaceId, opportunityId, ...result, preparation, plan });
  } catch (error) {
    return publicError(error);
  }
}
