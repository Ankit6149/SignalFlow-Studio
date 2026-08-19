import { requireOwnerAccess } from "../../_auth";
import { generateJSON } from "../../../../lib/ai/generateJSON";
import { PROVIDERS } from "../../../../lib/ai/types";
import { assertModelGenerationProvider } from "../../../../lib/ai/generationPolicy.mjs";
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

export const maxDuration = 45;

const CANDIDATE_PROVIDERS = ["gemini", "openai", "claude", "openrouter", "groq", "custom", "ollama", "lmstudio"];
const OWNER_ONLY_ENDPOINT_PROVIDERS = new Set(["custom", "ollama", "lmstudio"]);

function normalizedProvider(value) {
  const candidate = String(value || "").trim().toLowerCase();
  if (!candidate) return "";
  return assertModelGenerationProvider(candidate);
}

function pickConfiguredProvider(requested = "") {
  const candidates = Array.from(new Set([
    requested,
    String(process.env.DEFAULT_MODEL_PROVIDER || "").trim().toLowerCase(),
    ...CANDIDATE_PROVIDERS,
  ].filter(Boolean)));
  for (const candidate of candidates) {
    let providerId;
    try {
      providerId = normalizedProvider(candidate);
    } catch {
      continue;
    }
    const meta = PROVIDERS[providerId];
    if (!meta || !CANDIDATE_PROVIDERS.includes(providerId)) continue;
    if (meta.isConfigured()) return { providerId, meta };
  }
  return null;
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(request) {
  const accessError = requireOwnerAccess(request);
  const isOwner = accessError === null;

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
    const selected = pickConfiguredProvider(requestedProvider);
    if (!selected) {
      return json({
        ok: false,
        code: "inference_route_unavailable",
        error: "No configured model route is available for opportunity evaluation. Configure a provider in SignalFlow before asking it to find ideas.",
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
