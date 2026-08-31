import { assertPort } from "../domain/ports.mjs";
import { acceptNarrativeStrategyProposal } from "../ai/narrativeStrategyPlanning.mjs";
import { acceptOpportunityEvaluation } from "../ai/opportunityEvaluation.mjs";
import { acceptProjectContextSynthesis } from "../ai/projectContextSynthesis.mjs";
import { normalizePlatformVariantDraft } from "../ai/platformVariantWriting.mjs";
import { acceptPlatformRevisionRequest } from "../ai/platformVariantRevisionRequest.mjs";
import { normalizeCriticResult } from "../domain/platformVariantReviews.mjs";
import { INFERENCE_TASK_TYPES, normalizeInferenceTask } from "../inference/inferenceTasks.mjs";

function normalizedOrigin(value) {
  const url = new URL(String(value || ""));
  if (!["http:", "https:"].includes(url.protocol)) throw new TypeError("Server inference origin must use http or https.");
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url.toString();
}

async function readJsonResponse(response, label, unreadableCode) {
  const raw = await response.text();
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    const error = new Error(`${label} returned an unreadable response.`);
    error.code = unreadableCode;
    throw error;
  }
}

function requestHeaders(ownerKey) {
  return {
    "Content-Type": "application/json",
    ...(ownerKey ? { "x-signalflow-access-key": ownerKey } : {}),
  };
}

export function createServerProjectContextInferenceAdapter({
  origin,
  accessKey = "",
  fetchImpl = globalThis.fetch,
} = {}) {
  if (typeof fetchImpl !== "function") throw new TypeError("Server inference adapter requires fetch().");
  const base = normalizedOrigin(origin);
  const ownerKey = String(accessKey || "").trim();

  return assertPort("inferenceAdapter", {
    async execute({ task: taskInput, input = {} } = {}) {
      const task = normalizeInferenceTask(taskInput);
      if (task.taskType !== INFERENCE_TASK_TYPES.PROJECT_CONTEXT_SYNTHESIS) {
        throw new TypeError("This server inference adapter only supports project_context_synthesis.");
      }
      const response = await fetchImpl(new URL("/api/intelligence/project-context", base), {
        method: "POST",
        headers: requestHeaders(ownerKey),
        body: JSON.stringify({ task, input }),
        cache: "no-store",
      });
      const data = await readJsonResponse(response, "Project-context inference", "project_context_synthesis_unreadable");
      if (!response.ok || !data?.ok) {
        const error = new Error(data?.error || `Project-context synthesis failed (HTTP ${response.status}).`);
        error.code = data?.code || "project_context_synthesis_failed";
        error.status = response.status;
        throw error;
      }
      return {
        output: acceptProjectContextSynthesis(data.output),
        provenance: data.provenance || {},
      };
    },
  });
}

export function createServerOpportunityInferenceAdapter({
  origin,
  accessKey = "",
  fetchImpl = globalThis.fetch,
} = {}) {
  if (typeof fetchImpl !== "function") throw new TypeError("Server inference adapter requires fetch().");
  const base = normalizedOrigin(origin);
  const ownerKey = String(accessKey || "").trim();

  return assertPort("inferenceAdapter", {
    async execute({ task: taskInput, input = {} } = {}) {
      const task = normalizeInferenceTask(taskInput);
      if (task.taskType !== INFERENCE_TASK_TYPES.OPPORTUNITY_EVALUATION) {
        throw new TypeError("This server inference adapter only supports opportunity_evaluation.");
      }
      const response = await fetchImpl(new URL("/api/intelligence/opportunity", base), {
        method: "POST",
        headers: requestHeaders(ownerKey),
        body: JSON.stringify({ task, input }),
        cache: "no-store",
      });
      const data = await readJsonResponse(response, "Opportunity inference", "opportunity_evaluation_unreadable");
      if (!response.ok || !data?.ok) {
        const error = new Error(data?.error || `Opportunity evaluation failed (HTTP ${response.status}).`);
        error.code = data?.code || "opportunity_evaluation_failed";
        error.status = response.status;
        throw error;
      }
      return {
        output: acceptOpportunityEvaluation(data.output),
        provenance: data.provenance || {},
      };
    },
  });
}

export function createServerNarrativeStrategyInferenceAdapter({
  origin,
  accessKey = "",
  fetchImpl = globalThis.fetch,
} = {}) {
  if (typeof fetchImpl !== "function") throw new TypeError("Server inference adapter requires fetch().");
  const base = normalizedOrigin(origin);
  const ownerKey = String(accessKey || "").trim();

  return assertPort("inferenceAdapter", {
    async execute({ task: taskInput, input = {} } = {}) {
      const task = normalizeInferenceTask(taskInput);
      if (task.taskType !== INFERENCE_TASK_TYPES.NARRATIVE_STRATEGY) {
        throw new TypeError("This server inference adapter only supports narrative_strategy.");
      }
      const response = await fetchImpl(new URL("/api/intelligence/strategy", base), {
        method: "POST",
        headers: requestHeaders(ownerKey),
        body: JSON.stringify({ task, input }),
        cache: "no-store",
      });
      const data = await readJsonResponse(response, "Narrative-strategy inference", "narrative_strategy_unreadable");
      if (!response.ok || !data?.ok) {
        const error = new Error(data?.error || `Narrative strategy failed (HTTP ${response.status}).`);
        error.code = data?.code || "narrative_strategy_failed";
        error.status = response.status;
        throw error;
      }
      return {
        output: acceptNarrativeStrategyProposal(data.output),
        provenance: data.provenance || {},
      };
    },
  });
}

const PLATFORM_WORKFLOW_ROUTES = Object.freeze({
  [INFERENCE_TASK_TYPES.PLATFORM_VARIANT]: {
    endpoint: "/api/intelligence/platform-variant",
    label: "Platform draft generation",
    unreadableCode: "platform_variant_generation_unreadable",
    fallbackCode: "platform_variant_generation_failed",
    normalize: (output, input) => normalizePlatformVariantDraft(output, input?.variant?.destination),
  },
  [INFERENCE_TASK_TYPES.PLATFORM_VARIANT_REVISION]: {
    endpoint: "/api/intelligence/platform-revision",
    label: "Platform change request",
    unreadableCode: "platform_variant_revision_unreadable",
    fallbackCode: "platform_variant_revision_failed",
    normalize: (output, input) => acceptPlatformRevisionRequest(
      output,
      input?.parentRevision?.destination,
      input?.parentRevision?.format,
    ),
  },
  [INFERENCE_TASK_TYPES.EVIDENCE_CRITIQUE]: {
    endpoint: "/api/intelligence/critic",
    label: "Evidence review",
    unreadableCode: "evidence_critique_unreadable",
    fallbackCode: "evidence_critique_failed",
    normalize: (output) => normalizeCriticResult(output, "evidence"),
  },
  [INFERENCE_TASK_TYPES.AUTHENTICITY_CRITIQUE]: {
    endpoint: "/api/intelligence/critic",
    label: "Authenticity review",
    unreadableCode: "authenticity_critique_unreadable",
    fallbackCode: "authenticity_critique_failed",
    normalize: (output) => normalizeCriticResult(output, "authenticity"),
  },
});

export function createServerPlatformWorkflowInferenceAdapter({
  origin,
  accessKey = "",
  fetchImpl = globalThis.fetch,
} = {}) {
  if (typeof fetchImpl !== "function") throw new TypeError("Server inference adapter requires fetch().");
  const base = normalizedOrigin(origin);
  const ownerKey = String(accessKey || "").trim();

  return assertPort("inferenceAdapter", {
    async execute({ task: taskInput, input = {} } = {}) {
      const task = normalizeInferenceTask(taskInput);
      const route = PLATFORM_WORKFLOW_ROUTES[task.taskType];
      if (!route) throw new TypeError(`This server inference adapter does not support ${task.taskType}.`);
      const response = await fetchImpl(new URL(route.endpoint, base), {
        method: "POST",
        headers: requestHeaders(ownerKey),
        body: JSON.stringify({ task, input }),
        cache: "no-store",
      });
      const data = await readJsonResponse(response, route.label, route.unreadableCode);
      if (!response.ok || !data?.ok) {
        const error = new Error(data?.error || `${route.label} failed (HTTP ${response.status}).`);
        error.code = data?.code || route.fallbackCode;
        error.status = response.status;
        throw error;
      }
      return {
        output: route.normalize(data.output, input),
        provenance: data.provenance || {},
      };
    },
  });
}
