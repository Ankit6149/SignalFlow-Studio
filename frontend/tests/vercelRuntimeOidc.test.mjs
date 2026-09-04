import test from "node:test";
import assert from "node:assert/strict";

import {
  readVercelRuntimeOidcToken,
  vercelRuntimeOidcAvailable,
} from "../lib/server/vercelRuntimeOidc.mjs";

function requestWithHeader(value) {
  return new Request("https://signal-flow-studio.vercel.app/api/gp2/readiness", {
    headers: value ? { "x-vercel-oidc-token": value } : {},
  });
}

function fakeRequestWithHeader(value) {
  return { headers: { get: () => value } };
}

test("Vercel runtime OIDC prefers the request-scoped function token over environment fallback", () => {
  const request = requestWithHeader("request-token");
  const env = { VERCEL_OIDC_TOKEN: "environment-token" };
  assert.equal(readVercelRuntimeOidcToken(request, env), "request-token");
  assert.equal(vercelRuntimeOidcAvailable(request, env), true);
});

test("Vercel runtime OIDC falls back to the environment token outside request-scoped production execution", () => {
  const request = requestWithHeader("");
  assert.equal(readVercelRuntimeOidcToken(request, { VERCEL_OIDC_TOKEN: "environment-token" }), "environment-token");
});

test("Vercel runtime OIDC rejects absent, oversized, and newline-bearing credentials", () => {
  assert.equal(readVercelRuntimeOidcToken(requestWithHeader(""), {}), "");
  assert.equal(readVercelRuntimeOidcToken(fakeRequestWithHeader("line1\nline2"), {}), "");
  assert.equal(readVercelRuntimeOidcToken(fakeRequestWithHeader("x".repeat(20001)), {}), "");
});
