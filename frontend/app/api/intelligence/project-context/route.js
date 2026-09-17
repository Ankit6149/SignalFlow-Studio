import { requireOwnerAccess } from "../../_auth";
import { generateJSON } from "../../../../lib/ai/generateJSON";
import {
  acceptProjectContextSynthesis,
  buildProjectContextSynthesisPrompt,
  normalizeProjectContextTaskInput,
  PROJECT_CONTEXT_PROMPT_VERSION,
} from "../../../../lib/ai/projectContextSynthesis.mjs";
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
    if (task.taskType !== INFERENCE_TASK_TYPES.PROJECT_CONTEXT_SYNTHESIS) {
      return json({ ok: false, code: "unsupported_inference_task", error: "This endpoint only accepts project_context_synthesis tasks." }, 400);
    }
    const input = normalizeProjectContextTaskInput(body?.input || {});
    if (input.workspaceId !== task.workspaceId) {
      return json({ ok: false, code: "cross_workspace_inference", error: "Inference task and project context must belong to the same workspace." }, 403);
    }
    const inputRefs = new Set(task.inputRefs);
    if (!inputRefs.has(input.projectId) || input.evidence.some((item) => !inputRefs.has(item.sourceArtifactId))) {
      return json({ ok: false, code: "project_context_reference_mismatch", error: "Project-context task refs must cover the exact bounded evidence supplied to inference." }, 400);
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
        error: "No configured operational model route is available for project understanding. Configure or restore a permitted provider before analyzing repository context.",
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
      prompt: buildProjectContextSynthesisPrompt(input),
      modelOverride: model || null,
      config: {
        allowServerKey: isOwner,
        apiKey: providerId === "vercel_gateway" ? gatewayCredential : undefined,
        maxTokens: 3600,
      },
    });
    const output = acceptProjectContextSynthesis(raw);
    const generatedAt = new Date().toISOString();

    return json({
      ok: true,
      output,
      provenance: {
        taskId: task.taskId,
        taskType: task.taskType,
        provider: providerId,
        model: model || meta.defaultModel || "default",
        routeKind: route.routeKind,
        promptVersion: PROJECT_CONTEXT_PROMPT_VERSION,
        generatedAt,
      },
    });
  } catch (error) {
    const status = error?.code === "inference_privacy_route_denied" ? 403 : 500;
    return json({
      ok: false,
      code: error?.code || "project_context_synthesis_error",
      error: error?.message || "SignalFlow could not build project understanding from the bounded evidence.",
    }, status);
  }
}
