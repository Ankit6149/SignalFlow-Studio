import test from "node:test";
import assert from "node:assert/strict";

import { gp2ReadinessStatus } from "../lib/server/gp2Readiness.mjs";
import {
  probeVercelGatewayAccess,
  VERCEL_GATEWAY_AVAILABILITY_URL,
} from "../lib/server/vercelGatewayAccess.mjs";

const MODEL = "google/gemini-2.5-flash-lite";

test("Gateway readiness probe verifies configured model eligibility without exposing credentials or catalog metadata", async () => {
  let request = null;
  const result = await probeVercelGatewayAccess({
    credential: "opaque-runtime-token",
    modelId: MODEL,
    fetchImpl: async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            data: [
              {
                id: MODEL,
                type: "language",
                pricing: { input: "secretly-irrelevant-price" },
                model_eligibility: { status: "eligible" },
              },
            ],
          };
        },
      };
    },
  });

  assert.equal(result.available, true);
  assert.equal(result.status, "authorized");
  assert.equal(result.statusCode, 200);
  assert.equal(request.url, VERCEL_GATEWAY_AVAILABILITY_URL);
  assert.equal(request.options.method, "GET");
  assert.equal(request.options.headers.Authorization, "Bearer opaque-runtime-token");
  assert.doesNotMatch(JSON.stringify(result), /opaque-runtime-token|secretly-irrelevant-price|gemini-2\.5-flash-lite/);
});

test("Gateway model ineligibility fails closed with only a safe eligibility category", async () => {
  const access = await probeVercelGatewayAccess({
    credential: "opaque-runtime-token",
    modelId: MODEL,
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      async json() {
        return {
          data: [{
            id: MODEL,
            type: "language",
            model_eligibility: {
              status: "ineligible",
              category: "configuration",
              reason: "private-provider-detail-that-must-not-leak",
            },
          }],
        };
      },
    }),
  });

  assert.deepEqual(access, {
    available: false,
    status: "model_ineligible",
    statusCode: 200,
    eligibilityCategory: "configuration",
  });
  assert.doesNotMatch(JSON.stringify(access), /private-provider-detail|opaque-runtime-token/);

  const status = gp2ReadinessStatus({ VERCEL_OIDC_TOKEN: "opaque-runtime-token" }, {
    vercelOidcAvailable: true,
    vercelGatewayAccess: access,
  });
  const inference = status.checks.find((item) => item.id === "inference");
  assert.equal(inference.configured, false);
  assert.deepEqual(inference.missing, ["VERCEL_AI_GATEWAY_ACCESS"]);
  assert.equal(inference.provider, "vercel_gateway");
  assert.equal(inference.gatewayStatus, "model_ineligible");
  assert.equal(inference.gatewayStatusCode, 200);
});

test("Gateway readiness fails closed when the configured model is absent from the authenticated catalog", async () => {
  const access = await probeVercelGatewayAccess({
    credential: "opaque-runtime-token",
    modelId: MODEL,
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      async json() {
        return {
          data: [{
            id: "openai/some-other-model",
            type: "language",
            model_eligibility: { status: "eligible" },
          }],
        };
      },
    }),
  });

  assert.deepEqual(access, { available: false, status: "model_unavailable", statusCode: 200 });
});

test("Gateway 403 makes GP2 inference readiness fail closed when there is no direct fallback", async () => {
  const access = await probeVercelGatewayAccess({
    credential: "opaque-runtime-token",
    modelId: MODEL,
    fetchImpl: async () => ({ ok: false, status: 403 }),
  });
  assert.deepEqual(access, { available: false, status: "forbidden", statusCode: 403 });

  const status = gp2ReadinessStatus({ VERCEL_OIDC_TOKEN: "opaque-runtime-token" }, {
    vercelOidcAvailable: true,
    vercelGatewayAccess: access,
  });
  const inference = status.checks.find((item) => item.id === "inference");
  assert.equal(inference.configured, false);
  assert.deepEqual(inference.missing, ["VERCEL_AI_GATEWAY_ACCESS"]);
  assert.equal(inference.provider, "vercel_gateway");
  assert.equal(inference.gatewayStatus, "forbidden");
  assert.equal(inference.gatewayStatusCode, 403);
  assert.doesNotMatch(JSON.stringify(inference), /opaque-runtime-token/);
});

test("Gateway failure allows a configured direct remote fallback to satisfy inference readiness", () => {
  const status = gp2ReadinessStatus({
    VERCEL_OIDC_TOKEN: "opaque-runtime-token",
    GEMINI_API_KEY: "opaque-gemini-key",
  }, {
    vercelOidcAvailable: true,
    vercelGatewayAccess: { available: false, status: "model_ineligible", statusCode: 200 },
  });
  const inference = status.checks.find((item) => item.id === "inference");
  assert.equal(inference.configured, true);
  assert.deepEqual(inference.missing, []);
  assert.equal(inference.provider, "gemini");
  assert.equal(inference.selectionReason, "direct_fallback");
  assert.equal(inference.gatewayStatus, "model_ineligible");
  assert.equal(inference.gatewayStatusCode, 200);
  assert.doesNotMatch(JSON.stringify(inference), /opaque-runtime-token|opaque-gemini-key/);
});

test("configured DEFAULT_MODEL_PROVIDER is reflected consistently in readiness", () => {
  const status = gp2ReadinessStatus({
    VERCEL_OIDC_TOKEN: "opaque-runtime-token",
    DEFAULT_MODEL_PROVIDER: "openai",
    OPENAI_API_KEY: "opaque-openai-key",
  }, {
    vercelOidcAvailable: true,
    vercelGatewayAccess: { available: false, status: "forbidden", statusCode: 403 },
  });
  const inference = status.checks.find((item) => item.id === "inference");
  assert.equal(inference.configured, true);
  assert.equal(inference.provider, "openai");
  assert.equal(inference.selectionReason, "default");
});

test("Gateway model eligibility success makes request-scoped OIDC operationally ready", () => {
  const status = gp2ReadinessStatus({ VERCEL_OIDC_TOKEN: "opaque-runtime-token" }, {
    vercelOidcAvailable: true,
    vercelGatewayAccess: { available: true, status: "authorized", statusCode: 200 },
  });
  const inference = status.checks.find((item) => item.id === "inference");
  assert.equal(inference.configured, true);
  assert.deepEqual(inference.missing, []);
  assert.equal(inference.provider, "vercel_gateway");
  assert.equal(inference.gatewayStatus, "authorized");
  assert.equal(inference.gatewayStatusCode, 200);
});
