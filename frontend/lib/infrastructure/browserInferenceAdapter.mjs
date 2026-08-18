import { assertPort } from "../domain/ports.mjs";
import { normalizeInferenceTask, INFERENCE_TASK_TYPES } from "../inference/inferenceTasks.mjs";
import { normalizeOpportunityEvaluation } from "../domain/contentOpportunities.mjs";
import { normalizeStrategyProposal } from "../domain/contentPlanning.mjs";
import { acceptProjectContextSynthesis } from "../ai/projectContextSynthesis.mjs";
import { normalizePlatformVariantDraft } from "../ai/platformVariantWriting.mjs";
import { acceptPlatformRevisionRequest } from "../ai/platformVariantRevisionRequest.mjs";
import { normalizeCriticResult } from "../domain/platformVariantReviews.mjs";

const TASK_ROUTES = Object.freeze({
  [INFERENCE_TASK_TYPES.PROJECT_CONTEXT_SYNTHESIS]: {
    endpoint: "/api/intelligence/project-context",
    normalize: acceptProjectContextSynthesis,
    fallbackCode: "project_context_synthesis_failed",
    label: "Project understanding",
  },
  [INFERENCE_TASK_TYPES.OPPORTUNITY_EVALUATION]: {
    endpoint: "/api/intelligence/opportunity",
    normalize: normalizeOpportunityEvaluation,
    fallbackCode: "opportunity_evaluation_failed",
    label: "Opportunity evaluation",
  },
  [INFERENCE_TASK_TYPES.NARRATIVE_STRATEGY]: {
    endpoint: "/api/intelligence/strategy",
    normalize: normalizeStrategyProposal,
    fallbackCode: "narrative_strategy_failed",
    label: "Narrative strategy",
  },
  [INFERENCE_TASK_TYPES.PLATFORM_VARIANT]: {
    endpoint: "/api/intelligence/platform-variant",
    normalize: (output, input) => normalizePlatformVariantDraft(output, input?.variant?.destination),
    fallbackCode: "platform_variant_generation_failed",
    label: "Platform draft generation",
  },
  [INFERENCE_TASK_TYPES.PLATFORM_VARIANT_REVISION]: {
    endpoint: "/api/intelligence/platform-revision",
    normalize: (output, input) => acceptPlatformRevisionRequest(
      output,
      input?.parentRevision?.destination,
      input?.parentRevision?.format,
    ),
    fallbackCode: "platform_variant_revision_failed",
    label: "Platform change request",
  },
  [INFERENCE_TASK_TYPES.EVIDENCE_CRITIQUE]: {
    endpoint: "/api/intelligence/critic",
    normalize: (output) => normalizeCriticResult(output, "evidence"),
    fallbackCode: "evidence_critique_failed",
    label: "Evidence review",
  },
  [INFERENCE_TASK_TYPES.AUTHENTICITY_CRITIQUE]: {
    endpoint: "/api/intelligence/critic",
    normalize: (output) => normalizeCriticResult(output, "authenticity"),
    fallbackCode: "authenticity_critique_failed",
    label: "Authenticity review",
  },
});

export function createBrowserInferenceAdapter({ fetchImpl } = {}) {
  const executeFetch = fetchImpl || ((...args) => fetch(...args));
  if (typeof executeFetch !== "function") throw new TypeError("Browser inference adapter requires fetch().");

  return assertPort("inferenceAdapter", {
    async execute({ task: taskInput, input = {} } = {}) {
      const task = normalizeInferenceTask(taskInput);
      const route = TASK_ROUTES[task.taskType];
      if (!route) throw new TypeError(`No browser inference route is registered for ${task.taskType}.`);
      const response = await executeFetch(route.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, input }),
      });
      const text = await response.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        throw new Error("SignalFlow returned an unreadable intelligence response.");
      }
      if (!response.ok || !data?.ok) {
        const error = new Error(data?.error || `${route.label} failed (HTTP ${response.status}).`);
        error.code = data?.code || route.fallbackCode;
        throw error;
      }
      return {
        output: route.normalize(data.output, input),
        provenance: data.provenance,
      };
    },
  });
}