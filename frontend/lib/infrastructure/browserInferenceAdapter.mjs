import { assertPort } from "../domain/ports.mjs";
import { normalizeInferenceTask, INFERENCE_TASK_TYPES } from "../inference/inferenceTasks.mjs";
import { normalizeOpportunityEvaluation } from "../domain/contentOpportunities.mjs";
import { normalizeStrategyProposal } from "../domain/contentPlanning.mjs";

const TASK_ROUTES = Object.freeze({
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
        output: route.normalize(data.output),
        provenance: data.provenance,
      };
    },
  });
}
