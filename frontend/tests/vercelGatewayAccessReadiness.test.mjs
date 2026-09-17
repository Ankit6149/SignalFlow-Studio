import test from "node:test";
import assert from "node:assert/strict";

import { gp2ReadinessStatus } from "../lib/server/gp2Readiness.mjs";
import {
  probeVercelGatewayAccess,
  VERCEL_GATEWAY_CREDITS_URL,
} from "../lib/server/vercelGatewayAccess.mjs";

test("Gateway readiness probe verifies auth without reading or exposing credit balances", async () => {
  let request = null;
  let bodyRead = false;
  const result = await probeVercelGatewayAccess({
    credential: "opaque-runtime-token",
    fetchImpl: async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        status: 200,
        async json() { bodyRead = true; return { balance: "5.00" }; },
        async text() { bodyRead = true; return "5.00"; },
      };
    },
  });

  assert.equal(result.available, true);
  assert.equal(result.status, "authorized");
  assert.equal(result.statusCode, 200);
  assert.equal(request.url, VERCEL_GATEWAY_CREDITS_URL);
  assert.equal(request.options.method, "GET");
  assert.equal(request.options.headers.Authorization, "Bearer opaque-runtime-token");
  assert.equal(bodyRead, false);
  assert.doesNotMatch(JSON.stringify(result), /opaque-runtime-token|5\.00/);
});

test("Gateway 403 makes GP2 inference readiness fail closed when there is no direct fallback", async () => {
  const access = await probeVercelGatewayAccess({
    credential: "opaque-runtime-token",
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

test("Gateway 403 allows a configured direct remote fallback to satisfy inference readiness", () => {
  const status = gp2ReadinessStatus({
    VERCEL_OIDC_TOKEN: "opaque-runtime-token",
    GEMINI_API_KEY: "opaque-gemini-key",
  }, {
    vercelOidcAvailable: true,
    vercelGatewayAccess: { available: false, status: "forbidden", statusCode: 403 },
  });
  const inference = status.checks.find((item) => item.id === "inference");
  assert.equal(inference.configured, true);
  assert.deepEqual(inference.missing, []);
  assert.equal(inference.provider, "gemini");
  assert.equal(inference.selectionReason, "direct_fallback");
  assert.equal(inference.gatewayStatus, "forbidden");
  assert.equal(inference.gatewayStatusCode, 403);
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

test("Gateway auth success makes request-scoped OIDC operationally ready", () => {
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
