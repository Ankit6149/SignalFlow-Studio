import { assertPort } from "../domain/ports.mjs";
import { acceptProjectContextSynthesis } from "../ai/projectContextSynthesis.mjs";
import { INFERENCE_TASK_TYPES, normalizeInferenceTask } from "../inference/inferenceTasks.mjs";

function normalizedOrigin(value) {
  const url = new URL(String(value || ""));
  if (!["http:", "https:"].includes(url.protocol)) throw new TypeError("Server inference origin must use http or https.");
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url.toString();
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
        headers: {
          "Content-Type": "application/json",
          ...(ownerKey ? { "x-signalflow-access-key": ownerKey } : {}),
        },
        body: JSON.stringify({ task, input }),
        cache: "no-store",
      });
      const raw = await response.text();
      let data = null;
      try { data = raw ? JSON.parse(raw) : null; } catch {
        const error = new Error("Project-context inference returned an unreadable response.");
        error.code = "project_context_synthesis_unreadable";
        throw error;
      }
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
