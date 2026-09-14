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

test("Vercel runtime OIDC prefers the documented environment credential over a request header", () => {
  const request = requestWithHeader("request-token");
  const env = { VERCEL_OIDC_TOKEN: "environment-token" };
  assert.equal(readVercelRuntimeOidcToken(request, env), "environment-token");
  assert.equal(vercelRuntimeOidcAvailable(request, env), true);
});

test("Vercel runtime OIDC retains request-scoped header only as a compatibility fallback", () => {
  const request = requestWithHeader("request-token");
  assert.equal(readVercelRuntimeOidcToken(request, {}), "request-token");
});

test("Vercel runtime OIDC rejects absent, oversized, and newline-bearing credentials", () => {
  assert.equal(readVercelRuntimeOidcToken(requestWithHeader(""), {}), "");
  assert.equal(readVercelRuntimeOidcToken(fakeRequestWithHeader("line1\nline2"), {}), "");
  assert.equal(readVercelRuntimeOidcToken(fakeRequestWithHeader("x".repeat(20001)), {}), "");
  assert.equal(readVercelRuntimeOidcToken(requestWithHeader("request-token"), { VERCEL_OIDC_TOKEN: "line1\nline2" }), "request-token");
});
