import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  acceptProjectContextSynthesis,
  buildProjectContextSynthesisPrompt,
  MAX_PROJECT_CONTEXT_EVIDENCE_CHARS,
  MAX_PROJECT_CONTEXT_EVIDENCE_ITEMS,
  normalizeProjectContextTaskInput,
} from "../lib/ai/projectContextSynthesis.mjs";
import { createInferenceTask, INFERENCE_TASK_TYPES, assertInferenceRouteAllowed } from "../lib/inference/inferenceTasks.mjs";
import { createBrowserInferenceAdapter } from "../lib/infrastructure/browserInferenceAdapter.mjs";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(testDir, "..");
const readFrontend = (relative) => fs.readFileSync(path.join(frontendRoot, relative), "utf8");

const evidence = [
  { sourceArtifactId: "source-readme", kind: "readme", title: "README", excerpt: "A content operating system that turns meaningful work into owner judgment." },
  { sourceArtifactId: "source-architecture", kind: "architecture_doc", title: "Architecture", excerpt: "Source ingestion stays separate from editorial destination planning." },
];

function task(dataClassification = "workspace_private") {
  return createInferenceTask({
    taskId: "task-project-context-1",
    workspaceId: "workspace-1",
    taskType: INFERENCE_TASK_TYPES.PROJECT_CONTEXT_SYNTHESIS,
    dataClassification,
    inputRefs: ["project-1", ...evidence.map((item) => item.sourceArtifactId)],
    requirements: ["bounded_evidence", "structured_output", "project_understanding"],
    createdAt: "2026-08-19T00:00:00.000Z",
  });
}

test("project understanding accepts only bounded evidence and does not smuggle destination decisions into input", () => {
  const normalized = normalizeProjectContextTaskInput({ workspaceId: "workspace-1", projectId: "project-1", evidence });
  assert.equal(normalized.evidence.length, 2);
  assert.equal("destination" in normalized, false);
  assert.equal("platform" in normalized, false);
  assert.equal("repositoryPayload" in normalized, false);
  assert.equal(JSON.stringify(normalized).includes("accessToken"), false);

  const prompt = buildProjectContextSynthesisPrompt(normalized);
  assert.match(prompt, /Do not generate social posts, content ideas, destinations/i);
  assert.match(prompt, /record the uncertainty explicitly/i);
  assert.match(prompt, /project context, not as the person's identity or voice/i);
});

test("project understanding clamps evidence item count and aggregate text instead of sending an unrestricted repository", () => {
  const oversized = Array.from({ length: MAX_PROJECT_CONTEXT_EVIDENCE_ITEMS + 10 }, (_, index) => ({
    sourceArtifactId: `source-${index + 1}`,
    kind: "representative_source",
    title: `Source ${index + 1}`,
    excerpt: "x".repeat(12000),
  }));
  const normalized = normalizeProjectContextTaskInput({ workspaceId: "workspace-1", projectId: "project-1", evidence: oversized });
  assert.ok(normalized.evidence.length <= MAX_PROJECT_CONTEXT_EVIDENCE_ITEMS);
  assert.ok(normalized.evidence.reduce((sum, item) => sum + item.excerpt.length, 0) <= MAX_PROJECT_CONTEXT_EVIDENCE_CHARS);
});

test("project-context inference stays under the same privacy-route policy as every other task", () => {
  assert.equal(assertInferenceRouteAllowed(task("workspace_private"), { provider: "test", isLocal: false }).routeKind, "remote");
  assert.throws(
    () => assertInferenceRouteAllowed(task("restricted"), { provider: "test", isLocal: false }),
    /cannot be sent to a remote inference provider/i,
  );
  assert.equal(assertInferenceRouteAllowed(task("restricted"), { provider: "local-test", isLocal: true }).routeKind, "local");
});

test("project-context output must contain evidence-backed project substance", () => {
  const accepted = acceptProjectContextSynthesis({
    projectName: "SignalFlow",
    purpose: "Reduce content-thinking burden after real work.",
    capabilities: ["Project understanding"],
    uncertainties: ["Publishing configuration is unknown."],
  });
  assert.equal(accepted.projectName, "SignalFlow");
  assert.throws(() => acceptProjectContextSynthesis({ uncertainties: ["Everything is unknown."] }), /not contain enough/i);
});

test("browser inference adapter routes project understanding through its dedicated task endpoint", async () => {
  const requests = [];
  const adapter = createBrowserInferenceAdapter({
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return {
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify({
            ok: true,
            output: { projectName: "SignalFlow", purpose: "Prepare content judgments." },
            provenance: { taskId: "task-project-context-1", provider: "test", model: "test", routeKind: "remote" },
          });
        },
      };
    },
  });
  const input = normalizeProjectContextTaskInput({ workspaceId: "workspace-1", projectId: "project-1", evidence });
  const result = await adapter.execute({ task: task(), input });
  assert.equal(requests[0].url, "/api/intelligence/project-context");
  assert.equal(result.output.projectName, "SignalFlow");
});

test("server route checks exact project/evidence refs and reuses the shared privacy gate", () => {
  const route = readFrontend("app/api/intelligence/project-context/route.js");
  assert.match(route, /PROJECT_CONTEXT_SYNTHESIS/);
  assert.match(route, /project_context_reference_mismatch/);
  assert.match(route, /assertInferenceRouteAllowed/);
  assert.match(route, /buildProjectContextSynthesisPrompt/);
  assert.match(route, /acceptProjectContextSynthesis/);
  assert.doesNotMatch(route, /linkedin|twitter|instagram|tiktok/i);
});

test("project-context inference rejects secret-shaped and path-shaped payload fields before prompt construction", () => {
  assert.throws(
    () => normalizeProjectContextTaskInput({ workspaceId: "workspace-1", projectId: "project-1", evidence, accessToken: "secret" }),
    /forbidden/i,
  );
  assert.throws(
    () => normalizeProjectContextTaskInput({ workspaceId: "workspace-1", projectId: "project-1", evidence: [{ ...evidence[0], localPath: "C:\\repo\\README.md" }] }),
    /forbidden/i,
  );
});
