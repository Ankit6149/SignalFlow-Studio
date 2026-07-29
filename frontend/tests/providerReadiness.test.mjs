import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateProviderReadiness,
  isForbiddenGenerationMode,
  pickRecommendedProvider,
} from "../lib/studio/providerReadiness.mjs";
import {
  assertModelGenerationProvider,
  canUseServerProviderConfiguration,
} from "../lib/ai/generationPolicy.mjs";

test("template and prompt-only modes are rejected", () => {
  for (const provider of ["", "template", "offline", "prompt"]) {
    assert.equal(isForbiddenGenerationMode(provider), true);
    assert.throws(() => assertModelGenerationProvider(provider), /real model provider/i);
  }
});

test("configured server providers are ready without exposing a key", () => {
  const result = evaluateProviderReadiness({
    provider: "openai",
    status: { available: true, configured: true },
  });
  assert.equal(result.ready, true);
  assert.equal(result.source, "server");
});

test("capability-unavailable providers fail closed even with client configuration", () => {
  const result = evaluateProviderReadiness({
    provider: "ollama",
    baseUrl: "https://models.example.test",
    status: {
      available: false,
      reason: "Local model endpoints are owner-only on this hosted deployment.",
    },
  });
  assert.equal(result.ready, false);
  assert.equal(result.source, "unavailable");
  assert.match(result.reason, /owner-only/i);
});

test("hosted server keys remain owner-only", () => {
  assert.equal(
    canUseServerProviderConfiguration({ publicHosted: true, allowServerKey: false }),
    false,
  );
  assert.equal(
    canUseServerProviderConfiguration({ publicHosted: true, allowServerKey: true }),
    true,
  );
  assert.equal(
    canUseServerProviderConfiguration({ publicHosted: false, allowServerKey: false }),
    true,
  );
});

test("cloud providers require server configuration or a temporary key", () => {
  assert.equal(evaluateProviderReadiness({ provider: "gemini" }).ready, false);
  assert.equal(
    evaluateProviderReadiness({ provider: "gemini", apiKey: "temporary-key" }).ready,
    true,
  );
});

test("hosted local providers require a reachable endpoint", () => {
  assert.equal(
    evaluateProviderReadiness({
      provider: "ollama",
      status: { available: true, requiresBaseUrl: true },
    }).ready,
    false,
  );
  assert.equal(
    evaluateProviderReadiness({
      provider: "ollama",
      baseUrl: "https://trusted-model.example/v1",
      status: { available: true, requiresBaseUrl: true },
    }).ready,
    true,
  );
});

test("custom provider requires a base URL", () => {
  assert.equal(evaluateProviderReadiness({ provider: "custom", apiKey: "key" }).ready, false);
  assert.equal(
    evaluateProviderReadiness({ provider: "custom", baseUrl: "https://models.example.com/v1" }).ready,
    true,
  );
});

test("recommended provider prefers configured and available deployment routes", () => {
  assert.equal(
    pickRecommendedProvider({
      defaultProvider: "openai",
      statuses: {
        openai: { available: true, configured: true },
        gemini: { available: true, configured: true },
      },
    }),
    "openai",
  );
  assert.equal(
    pickRecommendedProvider({
      defaultProvider: "openai",
      statuses: {
        openai: { available: false, configured: true },
        groq: { available: true, configured: true },
      },
    }),
    "groq",
  );
});
