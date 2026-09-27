import test from "node:test";
import assert from "node:assert/strict";

import { createCapabilitySnapshot } from "../../frontend/lib/capabilities/capabilityContract.mjs";
import { executeTool, TOOL_DEFINITIONS } from "../lib/tools.mjs";

test("MCP exposes blocking compatibility plus trackable campaign workflow tools", () => {
  assert.deepEqual(
    TOOL_DEFINITIONS.map((tool) => tool.name),
    [
      "signalflow_capabilities",
      "signalflow_provider_status",
      "signalflow_test_provider",
      "signalflow_validate_campaign_input",
      "signalflow_build_strategy",
      "signalflow_start_campaign",
      "signalflow_campaign_status",
      "signalflow_cancel_campaign",
      "signalflow_create_campaign",
    ],
  );
});

test("capability tool consumes the versioned server contract", async () => {
  const snapshot = createCapabilitySnapshot({
    profile: "hosted",
    publicHosted: true,
    session: {
      authenticated: false,
      role: "anonymous",
      canGenerate: true,
    },
    providers: {
      gemini: {
        label: "Gemini",
        available: true,
        supportsTemporaryKey: true,
      },
      ollama: {
        label: "Ollama",
        available: false,
        isLocal: true,
      },
    },
  });
  const fetchImpl = async (url) => {
    assert.equal(url, "https://signalflow.example/api/capabilities");
    return new Response(JSON.stringify(snapshot), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const result = await executeTool("signalflow_capabilities", {}, {
    fetchImpl,
    env: { SIGNALFLOW_BASE_URL: "https://signalflow.example" },
  });

  assert.equal(result.structuredContent.deployment.profile, "hosted");
  assert.equal(result.structuredContent.capabilities.models.providers.gemini.available, true);
  assert.equal(result.structuredContent.capabilities.models.providers.ollama.available, false);
  assert.match(result.content[0].text, /extension delivery unavailable/i);
});

test("capability tool rejects incompatible server schema", async () => {
  const fetchImpl = async () => new Response(JSON.stringify({
    schemaVersion: 99,
    product: "signalflow-studio",
  }), { status: 200, headers: { "Content-Type": "application/json" } });

  await assert.rejects(
    executeTool("signalflow_capabilities", {}, {
      fetchImpl,
      env: { SIGNALFLOW_BASE_URL: "https://signalflow.example" },
    }),
    /unsupported signalflow capability schema/i,
  );
});

test("campaign validation reuses shared limits without calling the backend", async () => {
  let backendCalls = 0;
  const valid = await executeTool("signalflow_validate_campaign_input", {
    projectName: "SignalFlow",
    notes: "Evidence-backed product update.",
    channels: ["linkedin", "x"],
  }, {
    fetchImpl: async () => {
      backendCalls += 1;
      throw new Error("validation must not call the backend");
    },
  });

  assert.equal(valid.isError, false);
  assert.equal(valid.structuredContent.ok, true);
  assert.deepEqual(valid.structuredContent.errors, []);
  assert.equal(backendCalls, 0);

  const tooLarge = await executeTool("signalflow_validate_campaign_input", {
    projectName: "SignalFlow",
    notes: "x".repeat(40_001),
    channels: ["linkedin"],
  });
  assert.equal(tooLarge.isError, true);
  assert.equal(tooLarge.structuredContent.ok, false);
  assert.ok(
    tooLarge.structuredContent.limitIssues.some((issue) =>
      issue.code === "generation_limit.notes_chars" && issue.field === "notes"),
  );
});

test("campaign validation fails safely for cross-workspace source graphs", async () => {
  const result = await executeTool("signalflow_validate_campaign_input", {
    notes: "Evidence",
    channels: ["linkedin"],
    assets: [
      { schemaVersion: 1, assetId: "asset-a", workspaceId: "workspace-a", kind: "file", status: "ready" },
      { schemaVersion: 1, assetId: "asset-b", workspaceId: "workspace-b", kind: "file", status: "ready" },
    ],
  });

  assert.equal(result.isError, true);
  assert.equal(result.structuredContent.ok, false);
  assert.equal(result.structuredContent.sourceIssue.code, "cross_workspace_reference");
  assert.match(result.structuredContent.sourceIssue.message, /different workspaces/i);
});

test("strategy tool delegates to the owner-authorized hosted planning contract", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options, body: JSON.parse(options.body) });
    return new Response(JSON.stringify({
      ok: true,
      workspaceId: "owner-workspace",
      opportunityId: "opportunity-123",
      strategy: {
        kind: "NarrativeStrategy",
        narrativeStrategyId: "strategy-123",
        strategyRevision: 2,
        status: "proposed",
      },
      plan: {
        strategy: {
          kind: "NarrativeStrategy",
          narrativeStrategyId: "strategy-123",
          strategyRevision: 2,
          status: "proposed",
        },
        contentPiece: null,
        variants: [],
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  const result = await executeTool("signalflow_build_strategy", {
    opportunityId: "opportunity-123",
    refresh: true,
  }, {
    fetchImpl,
    env: {
      SIGNALFLOW_BASE_URL: "https://signalflow.example",
      SIGNALFLOW_ACCESS_KEY: "owner-workspace-key",
    },
  });

  assert.equal(result.isError, false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://signalflow.example/api/planning");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers["x-signalflow-access-key"], "owner-workspace-key");
  assert.deepEqual(calls[0].body, {
    action: "build_strategy",
    opportunityId: "opportunity-123",
    refresh: true,
  });
  assert.equal(result.structuredContent.strategy.narrativeStrategyId, "strategy-123");
  assert.match(result.content[0].text, /strategy-123 revision 2/i);
});

test("strategy tool preserves structured owner authorization failures", async () => {
  const fetchImpl = async () => new Response(JSON.stringify({
    ok: false,
    code: "owner_access_required",
    error: "Owner access is required for hosted planning.",
  }), { status: 401, headers: { "Content-Type": "application/json" } });

  const result = await executeTool("signalflow_build_strategy", {
    opportunityId: "opportunity-123",
  }, {
    fetchImpl,
    env: { SIGNALFLOW_BASE_URL: "https://signalflow.example" },
  });

  assert.equal(result.isError, true);
  assert.equal(result.structuredContent.code, "owner_access_required");
  assert.match(result.content[0].text, /owner access/i);
});

test("campaign tool refuses template generation", async () => {
  await assert.rejects(
    executeTool("signalflow_create_campaign", {
      projectName: "SignalFlow",
      notes: "Evidence",
      provider: "template",
      channels: ["linkedin"],
    }),
    /unsupported model provider/i,
  );
});

test("campaign tool forwards provider secrets from environment, not tool arguments", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options, body: JSON.parse(options.body) });
    return new Response(JSON.stringify({
      ok: true,
      providerUsed: "gemini",
      generation_status: { linkedin: { status: "generated" } },
      posts: { linkedin: "A generated draft" },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  const result = await executeTool("signalflow_create_campaign", {
    projectName: "SignalFlow",
    notes: "A real product brief",
    provider: "gemini",
    channels: ["linkedin"],
  }, {
    fetchImpl,
    env: {
      SIGNALFLOW_BASE_URL: "https://signalflow.example",
      SIGNALFLOW_ACCESS_KEY: "workspace-secret",
      SIGNALFLOW_GEMINI_API_KEY: "provider-secret",
    },
  });

  assert.equal(result.isError, false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://signalflow.example/api/launch_kit");
  assert.equal(calls[0].options.headers["x-signalflow-access-key"], "workspace-secret");
  assert.equal(calls[0].body.providerApiKey, "provider-secret");
  assert.equal(calls[0].body.generator, "gemini");
});

test("API failures become structured MCP errors instead of fake campaign output", async () => {
  const providerError = {
    code: "provider_invalid_credentials",
    message: "OpenAI rejected or is missing the configured credentials.",
    retryable: false,
    recoveryAction: "replace_key",
    httpStatus: 401,
    provider: "openai",
    model: "gpt-test",
    correlationId: "provider-test-1",
  };
  const fetchImpl = async () => new Response(
    JSON.stringify({
      ok: false,
      error: providerError.message,
      providerError,
      warnings: [providerError.message],
    }),
    { status: 401, headers: { "Content-Type": "application/json" } },
  );

  const result = await executeTool("signalflow_create_campaign", {
    projectName: "SignalFlow",
    notes: "A real product brief",
    provider: "openai",
    channels: ["blog"],
  }, { fetchImpl, env: { SIGNALFLOW_BASE_URL: "https://signalflow.example" } });

  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /rejected or is missing/i);
  assert.deepEqual(result.structuredContent.providerError, providerError);
  assert.equal(result.structuredContent.ok, false);
  assert.equal("posts" in result.structuredContent, false);
});


test("trackable campaign tools start, inspect, and cancel through the shared execution registry", async () => {
  const calls = [];
  const fakeRegistry = {
    start(run, options) {
      calls.push({ type: "start", run, options });
      return {
        id: "campaign-123",
        status: "queued",
        phase: "queued",
        metadata: options.metadata,
      };
    },
    get(jobId) {
      calls.push({ type: "get", jobId });
      return {
        id: jobId,
        status: "running",
        phase: "generating",
        progress: { completedDestinations: 1, totalDestinations: 2 },
      };
    },
    cancel(jobId) {
      calls.push({ type: "cancel", jobId });
      return {
        id: jobId,
        status: "running",
        phase: "cancelling",
        cancellationRequested: true,
      };
    },
  };

  const started = await executeTool("signalflow_start_campaign", {
    projectName: "SignalFlow",
    notes: "Evidence",
    provider: "gemini",
    channels: ["linkedin", "x"],
  }, { executionRegistry: fakeRegistry });

  assert.equal(started.isError, false);
  assert.equal(started.structuredContent.job.id, "campaign-123");
  assert.equal(calls[0].options.executionKey, "project:signalflow");
  assert.deepEqual(calls[0].options.metadata.channels, ["linkedin", "x"]);

  const status = await executeTool("signalflow_campaign_status", {
    jobId: "campaign-123",
  }, { executionRegistry: fakeRegistry });
  assert.equal(status.structuredContent.job.status, "running");
  assert.equal(status.structuredContent.job.progress.completedDestinations, 1);

  const cancelled = await executeTool("signalflow_cancel_campaign", {
    jobId: "campaign-123",
  }, { executionRegistry: fakeRegistry });
  assert.equal(cancelled.structuredContent.job.phase, "cancelling");
  assert.equal(cancelled.structuredContent.job.cancellationRequested, true);
});

test("trackable campaign status fails safely for unknown job IDs", async () => {
  const result = await executeTool("signalflow_campaign_status", {
    jobId: "missing",
  }, {
    executionRegistry: {
      get() { return null; },
      cancel() { return null; },
      start() { throw new Error("not used"); },
    },
  });

  assert.equal(result.isError, true);
  assert.equal(result.structuredContent.code, "campaign_job_not_found");
});
