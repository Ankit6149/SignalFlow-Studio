import { assertPort } from "../domain/ports.mjs";
import { portableClone } from "../domain/contracts.mjs";

export function createHttpOpportunityEvaluator({
  fetchImpl = globalThis.fetch,
  endpoint = "/api/intelligence/opportunity",
} = {}) {
  if (typeof fetchImpl !== "function") throw new TypeError("HTTP opportunity evaluator requires fetch().");

  return assertPort("opportunityEvaluator", {
    async evaluate(payload) {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(portableClone(payload)),
      });
      let body = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }
      if (!response.ok || !body?.ok) {
        const error = new Error(body?.error || `Opportunity evaluation failed with HTTP ${response.status}.`);
        error.code = body?.code || "opportunity_evaluation_failed";
        error.status = response.status;
        error.recovery = body?.recovery || null;
        throw error;
      }
      return portableClone(body.result);
    },
  });
}

export function createMemoryOpportunityEvaluator(handler) {
  if (typeof handler !== "function") throw new TypeError("Memory opportunity evaluator requires a handler function.");
  return assertPort("opportunityEvaluator", {
    async evaluate(payload) {
      return portableClone(await handler(portableClone(payload)));
    },
  });
}
