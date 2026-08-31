import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createInferenceTask, INFERENCE_TASK_TYPES } from "../lib/inference/inferenceTasks.mjs";
import { createServerPlatformWorkflowInferenceAdapter } from "../lib/infrastructure/serverInferenceAdapter.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NOW = "2026-08-31T04:20:00.000Z";

function task(taskType, taskId) {
  return createInferenceTask({
    taskId,
    workspaceId: "workspace-1",
    taskType,
    dataClassification: "workspace_private",
    inputRefs: ["input-1"],
    requirements: ["structured_output"],
    createdAt: NOW,
  });
}

test("server platform workflow inference reuses owner-authenticated intelligence routes", async () => {
  const calls = [];
  const adapter = createServerPlatformWorkflowInferenceAdapter({
    origin: "https://signalflow.test",
    accessKey: "owner-secret",
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      return new Response(JSON.stringify({
        ok: true,
        output: { format: "single_post", content: "A precise hosted draft.", segments: [] },
        provenance: { provider: "test", model: "test-model", routeKind: "remote", generatedAt: NOW },
      }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });

  const result = await adapter.execute({
    task: task(INFERENCE_TASK_TYPES.PLATFORM_VARIANT, "task-platform-1"),
    input: { variant: { destination: "linkedin" } },
  });

  assert.equal(result.output.content, "A precise hosted draft.");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://signalflow.test/api/intelligence/platform-variant");
  assert.equal(calls[0].options.headers["x-signalflow-access-key"], "owner-secret");
  assert.equal(calls[0].options.cache, "no-store");
});

test("server platform workflow inference routes both critics through the canonical critic endpoint", async () => {
  const urls = [];
  const adapter = createServerPlatformWorkflowInferenceAdapter({
    origin: "https://signalflow.test",
    fetchImpl: async (url) => {
      urls.push(String(url));
      return new Response(JSON.stringify({
        ok: true,
        output: { verdict: "pass", summary: "No blocking finding.", findings: [] },
        provenance: { provider: "test", model: "test-model", routeKind: "remote", reviewedAt: NOW },
      }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });

  const evidence = await adapter.execute({ task: task(INFERENCE_TASK_TYPES.EVIDENCE_CRITIQUE, "task-evidence-1"), input: {} });
  const authenticity = await adapter.execute({ task: task(INFERENCE_TASK_TYPES.AUTHENTICITY_CRITIQUE, "task-authenticity-1"), input: {} });

  assert.equal(evidence.output.verdict, "pass");
  assert.equal(authenticity.output.verdict, "pass");
  assert.deepEqual(urls, [
    "https://signalflow.test/api/intelligence/critic",
    "https://signalflow.test/api/intelligence/critic",
  ]);
});

test("server platform workflow inference preserves route failures instead of fabricating output", async () => {
  const adapter = createServerPlatformWorkflowInferenceAdapter({
    origin: "https://signalflow.test",
    fetchImpl: async () => new Response(JSON.stringify({
      ok: false,
      code: "inference_route_unavailable",
      error: "No configured model route.",
    }), { status: 503, headers: { "content-type": "application/json" } }),
  });

  await assert.rejects(
    () => adapter.execute({
      task: task(INFERENCE_TASK_TYPES.PLATFORM_VARIANT, "task-platform-2"),
      input: { variant: { destination: "x" } },
    }),
    (error) => error.code === "inference_route_unavailable" && error.status === 503,
  );
});

test("hosted platform review composition uses durable Postgres planning, identity and review repositories", () => {
  const dependencies = fs.readFileSync(path.join(ROOT, "lib", "server", "hostedPlatformReviewDependencies.mjs"), "utf8");
  assert.match(dependencies, /createPostgresContentPlanningRepository/);
  assert.match(dependencies, /createPostgresContentReviewRepository/);
  assert.match(dependencies, /createPostgresIdentityRepository/);
  assert.match(dependencies, /createPlatformGenerationApplication/);
  assert.match(dependencies, /createPlatformReviewApplication/);
  assert.match(dependencies, /createServerPlatformWorkflowInferenceAdapter/);
  assert.doesNotMatch(dependencies, /createBrowser|localStorage|signalflow_content_reviews_v1/);
});

test("hosted platform review API is owner-only, exact-revision scoped and requires signed exact-media visibility for media approval", () => {
  const route = fs.readFileSync(path.join(ROOT, "app", "api", "platform-review", "route.js"), "utf8");
  assert.match(route, /requireOwnerAccess\(request\)/);
  assert.match(route, /expectedCurrentRevisionId/);
  assert.match(route, /reviewRevision\(platformVariantId, platformVariantRevisionId/);
  assert.match(route, /approveRevision\(platformVariantId, platformVariantRevisionId/);
  assert.match(route, /requireMediaSafeApproval/);
  assert.match(route, /expectedVisibleMedia\(bundle\.revision\.mediaBindings \|\| \[\]\)/);
  assert.match(route, /visible\.length !== expected\.length/);
  assert.match(route, /createHostedMediaPreviewReceiptService/);
  assert.match(route, /receipts\.verify\(confirmation\.previewReceipt/);
  assert.match(route, /hosted_media_preview_confirmation_required/);
  assert.match(route, /private, no-store, max-age=0/);
  assert.doesNotMatch(route, /presign|signedUrl|objectKey|storageRef/);
});
