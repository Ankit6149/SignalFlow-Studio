import { requireOwnerAccess } from "../../_auth";
import { generateJSON } from "../../../../lib/ai/generateJSON";
import { assertModelGenerationProvider } from "../../../../lib/ai/generationPolicy.mjs";
import { buildOpportunityEvaluationPrompt } from "../../../../lib/ai/opportunityPrompt.mjs";
import { portableClone } from "../../../../lib/domain/contracts.mjs";

export const maxDuration = 60;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function text(value, max = 12000) {
  const normalized = String(value || "").trim();
  if (normalized.length > max) throw new TypeError(`Input exceeds ${max} characters.`);
  return normalized;
}

function normalizeRequest(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new TypeError("Opportunity request must be an object.");
  if (body.task !== "evaluate_signal") throw new TypeError("Unsupported intelligence task.");
  const signal = body.signal;
  if (!signal || typeof signal !== "object" || Array.isArray(signal)) throw new TypeError("A signal payload is required.");
  const privacyClassification = text(signal.privacyClassification, 80).toLowerCase();
  if (["device_private", "restricted"].includes(privacyClassification)) {
    const error = new Error("This signal requires a local/private processing route. The current server evaluator will not send it to a remote model.");
    error.code = "private_route_required";
    throw error;
  }
  return portableClone({
    signal: {
      signalId: text(signal.signalId, 240),
      headline: text(signal.headline, 240),
      summary: text(signal.summary, 12000),
      signalKind: text(signal.signalKind, 80),
      occurredAt: signal.occurredAt || null,
      observedAt: signal.observedAt || null,
      projectId: signal.projectId ? text(signal.projectId, 240) : null,
      privacyClassification,
      sourceArtifactIds: Array.isArray(signal.sourceArtifactIds) ? signal.sourceArtifactIds.map((id) => text(id, 240)).slice(0, 100) : [],
      assetIds: Array.isArray(signal.assetIds) ? signal.assetIds.map((id) => text(id, 240)).slice(0, 100) : [],
    },
    context: {
      identitySummary: body.context?.identitySummary ? text(body.context.identitySummary, 1600) : null,
      desiredPerception: body.context?.desiredPerception ? text(body.context.desiredPerception, 1200) : null,
      explicitBoundaries: Array.isArray(body.context?.explicitBoundaries)
        ? body.context.explicitBoundaries.map((item) => text(item, 700)).filter(Boolean).slice(0, 20)
        : [],
      recentNarrativeSummaries: Array.isArray(body.context?.recentNarrativeSummaries)
        ? body.context.recentNarrativeSummaries.map((item) => text(item, 700)).filter(Boolean).slice(0, 20)
        : [],
    },
  });
}

function validateModelShape(result) {
  if (!result || typeof result !== "object" || Array.isArray(result)) throw new TypeError("Model returned an invalid opportunity object.");
  if (!result.evaluation || typeof result.evaluation !== "object") throw new TypeError("Model result is missing evaluation.");
  if (!Array.isArray(result.angles) || result.angles.length < 3 || result.angles.length > 5) {
    throw new TypeError("Model must return 3 to 5 materially different angles.");
  }
  if (!Array.isArray(result.recommendedDestinations) || result.recommendedDestinations.length === 0) {
    throw new TypeError("Model result is missing recommended destinations.");
  }
  if (!Array.isArray(result.recommendedFormats) || result.recommendedFormats.length === 0) {
    throw new TypeError("Model result is missing recommended formats.");
  }
  return portableClone(result);
}

export async function POST(request) {
  const accessError = requireOwnerAccess(request);
  if (accessError) return accessError;

  const publicHosted = process.env.SIGNALFLOW_PUBLIC_HOSTED === "true" || Boolean(process.env.VERCEL);
  if (publicHosted && !process.env.SIGNALFLOW_ACCESS_KEY) {
    return json({
      ok: false,
      code: "owner_lock_required",
      error: "Owner intelligence is disabled because this hosted deployment has no owner access lock.",
      recovery: "Configure SIGNALFLOW_ACCESS_KEY before allowing hosted server-funded AI evaluation.",
    }, 503);
  }

  try {
    const body = await request.json();
    const input = normalizeRequest(body);
    let provider;
    try {
      provider = assertModelGenerationProvider(process.env.DEFAULT_MODEL_PROVIDER);
    } catch {
      return json({
        ok: false,
        code: "provider_not_configured",
        error: "Opportunity intelligence needs one configured model provider for this Personal Alpha.",
        recovery: "Configure DEFAULT_MODEL_PROVIDER and that provider's server credential, then retry.",
      }, 503);
    }

    const prompt = buildOpportunityEvaluationPrompt(input);
    const result = await generateJSON({
      provider,
      prompt,
      config: {
        allowServerKey: true,
        maxTokens: 3500,
      },
    });

    return json({
      ok: true,
      task: "evaluate_signal",
      provider,
      result: validateModelShape(result),
    });
  } catch (error) {
    const code = error?.code || "opportunity_evaluation_failed";
    const status = code === "private_route_required" ? 403 : 500;
    return json({
      ok: false,
      code,
      error: error?.message || "Opportunity evaluation failed.",
    }, status);
  }
}
