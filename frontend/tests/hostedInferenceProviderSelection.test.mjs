import test from "node:test";
import assert from "node:assert/strict";

import {
  selectHostedInferenceProvider,
  selectOperationalHostedInferenceProvider,
} from "../lib/server/hostedInferenceProviderSelection.mjs";

test("forbidden Gateway falls back to configured Gemini without probing generation", async () => {
  let probes = 0;
  const selected = await selectOperationalHostedInferenceProvider({
    env: {
      VERCEL_OIDC_TOKEN: "opaque-oidc",
      GEMINI_API_KEY: "opaque-gemini",
    },
    gatewayCredential: "opaque-oidc",
    probeGatewayAccess: async ({ credential }) => {
      probes += 1;
      assert.equal(credential, "opaque-oidc");
      return { available: false, status: "forbidden", statusCode: 403 };
    },
  });

  assert.equal(probes, 1);
  assert.equal(selected.providerId, "gemini");
  assert.equal(selected.reason, "direct_fallback");
  assert.equal(selected.gatewayAccess.statusCode, 403);
  assert.doesNotMatch(JSON.stringify(selected.gatewayAccess), /opaque-/);
});

test("healthy Gateway remains the automatic hosted route when no direct preference exists", async () => {
  const selected = await selectOperationalHostedInferenceProvider({
    env: { VERCEL_OIDC_TOKEN: "opaque-oidc", OPENAI_API_KEY: "opaque-openai" },
    gatewayCredential: "opaque-oidc",
    probeGatewayAccess: async () => ({ available: true, status: "authorized", statusCode: 200 }),
  });

  assert.equal(selected.providerId, "vercel_gateway");
  assert.equal(selected.reason, "gateway");
});

test("explicit configured direct provider wins without probing Gateway", async () => {
  let probed = false;
  const selected = await selectOperationalHostedInferenceProvider({
    requestedProvider: "openai",
    env: { OPENAI_API_KEY: "opaque-openai", VERCEL_OIDC_TOKEN: "opaque-oidc" },
    gatewayCredential: "opaque-oidc",
    probeGatewayAccess: async () => {
      probed = true;
      return { available: true, status: "authorized", statusCode: 200 };
    },
  });

  assert.equal(probed, false);
  assert.equal(selected.providerId, "openai");
  assert.equal(selected.reason, "requested");
});

test("configured direct DEFAULT_MODEL_PROVIDER wins without probing Gateway", async () => {
  let probed = false;
  const selected = await selectOperationalHostedInferenceProvider({
    env: {
      DEFAULT_MODEL_PROVIDER: "gemini",
      GEMINI_API_KEY: "opaque-gemini",
      VERCEL_OIDC_TOKEN: "opaque-oidc",
    },
    gatewayCredential: "opaque-oidc",
    probeGatewayAccess: async () => {
      probed = true;
      return { available: true, status: "authorized", statusCode: 200 };
    },
  });

  assert.equal(probed, false);
  assert.equal(selected.providerId, "gemini");
  assert.equal(selected.reason, "default");
});

test("unavailable explicit provider fails closed instead of falling back", async () => {
  let probed = false;
  const selected = await selectOperationalHostedInferenceProvider({
    requestedProvider: "openai",
    env: { GEMINI_API_KEY: "opaque-gemini", VERCEL_OIDC_TOKEN: "opaque-oidc" },
    gatewayCredential: "opaque-oidc",
    probeGatewayAccess: async () => {
      probed = true;
      return { available: true, status: "authorized", statusCode: 200 };
    },
  });

  assert.equal(probed, false);
  assert.equal(selected, null);
});

test("local providers are never selected by hosted automatic fallback", () => {
  const selected = selectHostedInferenceProvider({
    env: {
      DEFAULT_MODEL_PROVIDER: "ollama",
      OLLAMA_BASE_URL: "http://127.0.0.1:11434",
    },
    gatewayCredential: "",
    gatewayOperational: false,
  });

  assert.equal(selected, null);
});

test("no configured allowed hosted route fails closed", async () => {
  const selected = await selectOperationalHostedInferenceProvider({
    env: { VERCEL_OIDC_TOKEN: "opaque-oidc" },
    gatewayCredential: "opaque-oidc",
    probeGatewayAccess: async () => ({ available: false, status: "forbidden", statusCode: 403 }),
  });

  assert.equal(selected, null);
});
