import test from "node:test";
import assert from "node:assert/strict";

import { executeTool } from "../lib/tools.mjs";

test("MCP links-only validation returns needs_verification without calling a backend", async () => {
  let calls = 0;
  const result = await executeTool("signalflow_validate_campaign_input", {
    projectName: "Links only",
    links: "https://example.com/docs",
    channels: ["linkedin"],
  }, {
    fetchImpl: async () => {
      calls += 1;
      throw new Error("validation must stay local");
    },
  });

  assert.equal(calls, 0);
  assert.equal(result.isError, false);
  assert.equal(result.structuredContent.ok, true);
  assert.equal(result.structuredContent.sourceHealth.status, "needs_verification");
  assert.equal(result.structuredContent.sourceHealth.counts.usable, 0);
  assert.equal(result.structuredContent.sourceHealth.counts.needsVerification, 1);
  assert.match(result.content[0].text, /verified before any model call/i);
});

test("MCP source validation blocks credential-bearing links through the shared contract", async () => {
  const result = await executeTool("signalflow_validate_campaign_input", {
    projectName: "Unsafe link",
    links: "https://example.com/private?token=secret",
    channels: ["linkedin"],
  });

  assert.equal(result.isError, true);
  assert.equal(result.structuredContent.ok, false);
  assert.match(result.structuredContent.errors.join(" "), /credentials or signed access parameters/i);
  assert.equal(result.structuredContent.sourceHealth.status, "blocked");
});

test("MCP mixed-source validation remains ready while retaining an ordinary invalid link", async () => {
  const result = await executeTool("signalflow_validate_campaign_input", {
    projectName: "Mixed",
    notes: "Known product evidence.",
    links: "ftp://example.com/file",
    channels: ["linkedin"],
  });

  assert.equal(result.isError, false);
  assert.equal(result.structuredContent.sourceHealth.status, "ready");
  assert.equal(result.structuredContent.sourceHealth.counts.usable, 1);
  assert.equal(result.structuredContent.sourceHealth.counts.invalid, 1);
});

test("MCP campaign creation forwards links to the same launch-kit source-health gate", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    return new Response(JSON.stringify({
      ok: true,
      providerUsed: "gemini",
      sourceHealth: {
        schemaVersion: 1,
        status: "ready",
        readyForGeneration: true,
        canAttemptVerification: false,
        reason: "At least one source is verified usable evidence.",
        counts: { usable: 1, needsVerification: 0, referenceOnly: 0, failed: 0, invalid: 0, duplicate: 0 },
        entries: [{ kind: "link", canonicalUrl: "https://example.com/docs", status: "usable", issueCode: null }],
      },
      generation_status: { linkedin: { status: "generated" } },
      posts: { linkedin: "Generated from verified link evidence." },
    }), { status: 200, headers: { "content-type": "application/json" } });
  };

  const result = await executeTool("signalflow_create_campaign", {
    projectName: "Links only",
    notes: "Minimal operator context",
    links: "https://example.com/docs",
    provider: "gemini",
    channels: ["linkedin"],
  }, {
    fetchImpl,
    env: {
      SIGNALFLOW_BASE_URL: "https://signalflow.example",
      SIGNALFLOW_GEMINI_API_KEY: "provider-secret",
    },
  });

  assert.equal(result.isError, false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://signalflow.example/api/launch_kit");
  assert.equal(calls[0].body.docs_url, "https://example.com/docs");
  assert.equal(result.structuredContent.sourceHealth.status, "ready");
});
