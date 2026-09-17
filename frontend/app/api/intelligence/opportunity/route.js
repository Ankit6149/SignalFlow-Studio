import { requireOwnerAccess } from "../../_auth";
import { generateJSON } from "../../../../lib/ai/generateJSON";
import {
  acceptOpportunityEvaluation,
  buildOpportunityEvaluationPrompt,
  normalizeOpportunityTaskInput,
} from "../../../../lib/ai/opportunityEvaluation.mjs";
import {
  assertInferenceRouteAllowed,
  INFERENCE_TASK_TYPES,
  mostRestrictivePrivacyClassification,
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
    if (task.taskType !== INFERENCE_TASK_TYPES.OPPORTUNITY_EVALUATION) {
      return json({ ok: false, code: "unsupported_inference_task", error: "This endpoint only accepts opportunity_evaluation tasks." }, 400);
    }
    const input = normalizeOpportunityTaskInput(body?.input || {});
    if (input.signal.workspaceId !== task.workspaceId) {
      return json({ ok: false, code: "cross_workspace_inference", error: "Inference task and signal must belong to the same workspace." }, 403);
    }
    const expectedClassification = mostRestrictivePrivacyClassification(
      input.signal.privacyClassification,
      input.projectContext?.privacyClass,
    );
    if (expectedClassification !== task.dataClassification) {
      return json({ ok: false, code: "inference_privacy_mismatch", error: "Inference task classification must match the most restrictive supplied persisted input." }, 400);
    }
    const requiredRefs = [input.signal.signalId, input.projectContext?.projectContextSnapshotId].filter(Boolean);
    if (requiredRefs.some((ref) => !task.inputRefs.includes(ref))) {
      return json({ ok: false, code: "inference_provenance_mismatch", error: "Inference task refs must bind every supplied canonical input." }, 400);
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
        error: "No configured operational model route is available for opportunity evaluation. Configure or restore a permitted provider before asking SignalFlow to find ideas.",
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
      prompt: buildOpportunityEvaluationPrompt(input),
      modelOverride: model || null,
      config: {
        allowServerKey: isOwner,
        apiKey: providerId === "vercel_gateway" ? gatewayCredential : undefined,
        maxTokens: 2600,
      },
    });
    const output = acceptOpportunityEvaluation(raw);
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
      code: error?.code || "opportunity_evaluation_error",
      error: error?.message || "SignalFlow could not evaluate this opportunity.",
    }, status);
  }
}
