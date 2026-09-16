import test from "node:test";
import assert from "node:assert/strict";

import { probeCdpBrowserAccess } from "../lib/server/cdpBrowserAccess.mjs";

test("live CDP probe verifies the root browser protocol and closes the client", async () => {
  let closed = false;
  let observedMethod = null;
  const result = await probeCdpBrowserAccess({
    endpoint: "wss://browser.example.invalid/devtools/browser/opaque",
    bearerToken: "server-only-token",
    clientFactory: async ({ endpoint, commandTimeoutMs }) => {
      assert.equal(endpoint, "wss://browser.example.invalid/devtools/browser/opaque");
      assert.ok(commandTimeoutMs >= 250 && commandTimeoutMs <= 10000);
      return {
        async send(method) {
          observedMethod = method;
          return { protocolVersion: "1.3", product: "Chrome/140" };
        },
        async close() {
          closed = true;
        },
      };
    },
  });

  assert.deepEqual(result, { available: true, status: "ready" });
  assert.equal(observedMethod, "Browser.getVersion");
  assert.equal(closed, true);
  assert.equal(JSON.stringify(result).includes("server-only-token"), false);
});

test("live CDP probe converts transport failures into a safe unavailable state", async () => {
  const result = await probeCdpBrowserAccess({
    endpoint: "wss://browser.example.invalid/devtools/browser/opaque",
    clientFactory: async () => {
      const error = new Error("private transport details must not escape");
      error.code = "worker_unavailable";
      throw error;
    },
  });

  assert.deepEqual(result, { available: false, status: "unreachable" });
  assert.equal(JSON.stringify(result).includes("private transport details"), false);
});

test("live CDP probe rejects insecure or credential-bearing endpoints before opening a socket", async () => {
  let called = false;
  for (const endpoint of [
    "https://browser.example.invalid/devtools/browser/opaque",
    "ws://browser.example.invalid/devtools/browser/opaque",
    "wss://user:password@browser.example.invalid/devtools/browser/opaque",
  ]) {
    const result = await probeCdpBrowserAccess({
      endpoint,
      clientFactory: async () => {
        called = true;
        throw new Error("should not run");
      },
    });
    assert.deepEqual(result, { available: false, status: "configuration_invalid" });
  }
  assert.equal(called, false);
});

test("live CDP probe fails closed when root protocol metadata is malformed", async () => {
  let closed = false;
  const result = await probeCdpBrowserAccess({
    endpoint: "wss://browser.example.invalid/devtools/browser/opaque",
    clientFactory: async () => ({
      async send() {
        return { protocolVersion: "" };
      },
      async close() {
        closed = true;
      },
    }),
  });

  assert.deepEqual(result, { available: false, status: "protocol_error" });
  assert.equal(closed, true);
});
