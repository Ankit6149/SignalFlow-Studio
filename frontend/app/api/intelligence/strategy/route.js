import { requireOwnerAccess } from "../../_auth";
import { generateJSON } from "../../../../lib/ai/generateJSON";
import {
  acceptNarrativeStrategyProposal,
  buildNarrativeStrategyPrompt,
  normalizeStrategyTaskInput,
} from "../../../../lib/ai/narrativeStrategyPlanning.mjs";
import {
  assertInferenceRouteAllowed,
  INFERENCE_TASK_TYPES,
  normalizeInferenceTask,
} from "../../../../lib/inference/inferenceTasks.mjs";
import { selectOperationalHostedInferenceProvider } from "../../../../lib/server/hostedInferenceProviderSelection.mjs";
import { readVercelRuntimeOidcToken } from "../../../../lib/server/vercelRuntimeOidc.mjs";

export const maxDuration = 45;

const OWNER_ONLY_ENDPOINT_PROVIDERS = new Set(["custom"]);

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(request) {
  const accessError = requireOwnerAccess(request);
  const isOwner = accessError === null;
  const gatewayCredential = isOwner ? readVercelRuntimeOidcToken(request, process.env) : "";

  try {
    const body = await request.json();
    const task = normalizeInferenceTask(body?.task || {});
    if (task.taskType !== INFERENCE_TASK_TYPES.NARRATIVE_STRATEGY) {
      return json({ ok: false, code: "unsupported_inference_task", error: "This endpoint only accepts narrative_strategy tasks." }, 400);
    }
    const input = normalizeStrategyTaskInput(body?.input || {});
    if (input.identityContext.workspaceId !== task.workspaceId) {
      return json({ ok: false, code: "cross_workspace_inference", error: "Inference task and identity context must belong to the same workspace." }, 403);
    }
    if (input.dataClassification !== task.dataClassification) {
      return json({ ok: false, code: "inference_privacy_mismatch", error: "Narrative strategy classification must match the persisted source Signal classification." }, 400);
    }

    const requestedProvider = String(body?.provider || "").trim().toLowerCase();
    const selected = await selectOperationalHostedInferenceProvider({
      requestedProvider,
      env: process.env,
      gatewayCredential,
    });
    if (!selected) {
      return json({
        ok: false,
        code: "inference_route_unavailable",
        error: "No configured operational model route is available for campaign strategy. Configure or restore a permitted provider before asking SignalFlow to build the plan.",
      }, 503);
    }

    const { providerId, meta } = selected;
    if (!isOwner && OWNER_ONLY_ENDPOINT_PROVIDERS.has(providerId)) {
      return accessError || json({ ok: false, code: "owner_route_required", error: "This inference route requires an authenticated owner session." }, 401);
    }

    let route;
    try {
      route = assertInferenceRouteAllowed(task, { provider: providerId, isLocal: Boolean(meta.isLocal) });
    } catch (error) {
      return json({ ok: false, code: error.code || "inference_route_denied", error: error.message }, 403);
    }

    const model = String(body?.model || process.env.DEFAULT_MODEL_NAME || meta.defaultModel || "").trim();
    const raw = await generateJSON({
      provider: providerId,
      prompt: buildNarrativeStrategyPrompt(input),
      modelOverride: model || null,
      config: {
        allowServerKey: isOwner,
        apiKey: providerId === "vercel_gateway" ? gatewayCredential : undefined,
        maxTokens: 3200,
      },
    });
    const output = acceptNarrativeStrategyProposal(raw);
    const evaluatedAt = new Date().toISOString();

    return json({
      ok: true,
      output,
      provenance: {
        taskId: task.taskId,
        taskType: task.taskType,
        provider: providerId,
        model: model || meta.defaultModel || "default",
        routeKind: route.routeKind,
        evaluatedAt,
      },
    });
  } catch (error) {
    const status = error?.code === "inference_privacy_route_denied" ? 403 : 500;
    return json({
      ok: false,
      code: error?.code || "narrative_strategy_error",
      error: error?.message || "SignalFlow could not build this campaign strategy.",
    }, status);
  }
}
