import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateProviderReadiness,
  isForbiddenGenerationMode,
  pickRecommendedProvider,
} from "../lib/studio/providerReadiness.mjs";
import { assertModelGenerationProvider } from "../lib/ai/generationPolicy.mjs";

test("template and prompt-only modes are rejected", () => {
  for (const provider of ["", "template", "offline", "prompt"]) {
    assert.equal(isForbiddenGenerationMode(provider), true);
    assert.throws(() => assertModelGenerationProvider(provider), /real model provider/i);
  }
});

test("configured server providers are ready without exposing a key", () => {
  const result = evaluateProviderReadiness({
    provider: "openai",
    status: { configured: true },
  });
  assert.equal(result.ready, true);
  assert.equal(result.source, "server");
});

test("cloud providers require server configuration or a temporary key", () => {
  assert.equal(evaluateProviderReadiness({ provider: "gemini" }).ready, false);
  assert.equal(
    evaluateProviderReadiness({ provider: "gemini", apiKey: "temporary-key" }).ready,
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

test("recommended provider prefers configured deployment routes", () => {
  assert.equal(
    pickRecommendedProvider({
      defaultProvider: "openai",
      statuses: { openai: { configured: true }, gemini: { configured: true } },
    }),
    "openai",
  );
  assert.equal(
    pickRecommendedProvider({ statuses: { groq: { configured: true } } }),
    "groq",
  );
});
