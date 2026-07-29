import test from "node:test";
import assert from "node:assert/strict";

import { createCapabilitySnapshot } from "../../frontend/lib/capabilities/capabilityContract.mjs";
import { executeTool, TOOL_DEFINITIONS } from "../lib/tools.mjs";

test("MCP exposes capabilities, provider status, provider test, and campaign creation tools", () => {
  assert.deepEqual(
    TOOL_DEFINITIONS.map((tool) => tool.name),
    [
      "signalflow_capabilities",
      "signalflow_provider_status",
      "signalflow_test_provider",
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

test("API failures become MCP errors instead of fake campaign output", async () => {
  const fetchImpl = async () => new Response(
    JSON.stringify({ ok: false, error: "Provider connection failed" }),
    { status: 400, headers: { "Content-Type": "application/json" } },
  );

  await assert.rejects(
    executeTool("signalflow_create_campaign", {
      projectName: "SignalFlow",
      notes: "A real product brief",
      provider: "openai",
      channels: ["blog"],
    }, { fetchImpl, env: { SIGNALFLOW_BASE_URL: "https://signalflow.example" } }),
    /provider connection failed/i,
  );
});
