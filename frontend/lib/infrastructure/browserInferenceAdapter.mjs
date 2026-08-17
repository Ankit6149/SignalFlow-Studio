import { assertPort } from "../domain/ports.mjs";
import { normalizeInferenceTask } from "../inference/inferenceTasks.mjs";
import { normalizeOpportunityEvaluation } from "../domain/contentOpportunities.mjs";

export function createBrowserInferenceAdapter({ fetchImpl } = {}) {
  const executeFetch = fetchImpl || ((...args) => fetch(...args));
  if (typeof executeFetch !== "function") throw new TypeError("Browser inference adapter requires fetch().");

  return assertPort("inferenceAdapter", {
    async execute({ task: taskInput, input = {} } = {}) {
      const task = normalizeInferenceTask(taskInput);
      const response = await executeFetch("/api/intelligence/opportunity", {
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
        const error = new Error(data?.error || `Opportunity evaluation failed (HTTP ${response.status}).`);
        error.code = data?.code || "opportunity_evaluation_failed";
        throw error;
      }
      return {
        output: normalizeOpportunityEvaluation(data.output),
        provenance: data.provenance,
      };
    },
  });
}
