import test from "node:test";
import assert from "node:assert/strict";

import { createServerWebSocketFactory } from "../lib/infrastructure/serverWebSocketFactory.mjs";

test("authenticated server WebSocket transport sends bearer token as a header, never in the endpoint", () => {
  const calls = [];
  class FakeWebSocket {
    constructor(endpoint, options) {
      calls.push({ endpoint, options });
    }
  }

  const factory = createServerWebSocketFactory({
    bearerToken: "top-secret-browser-token",
    WebSocketImpl: FakeWebSocket,
  });
  factory("wss://browser.example.test/devtools/browser/session");

  assert.equal(calls.length, 1);
  assert.equal(calls[0].endpoint, "wss://browser.example.test/devtools/browser/session");
  assert.equal(calls[0].endpoint.includes("top-secret-browser-token"), false);
  assert.deepEqual(calls[0].options, {
    headers: { Authorization: "Bearer top-secret-browser-token" },
  });
});

test("server WebSocket transport keeps authentication optional for providers that authenticate in their endpoint", () => {
  const calls = [];
  class FakeWebSocket {
    constructor(endpoint, options) {
      calls.push({ endpoint, options });
    }
  }

  createServerWebSocketFactory({ WebSocketImpl: FakeWebSocket })("wss://browser.example.test/session?token=provider-owned");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options, undefined);
});

test("server WebSocket transport rejects header-injection input without echoing the secret", () => {
  const secret = "secret-value\r\nX-Injected: yes";
  assert.throws(
    () => createServerWebSocketFactory({ bearerToken: secret, WebSocketImpl: class {} }),
    (error) => {
      assert.equal(error.code, "websocket_auth_configuration_invalid");
      assert.equal(String(error.message).includes("secret-value"), false);
      assert.equal(JSON.stringify(error.details).includes("secret-value"), false);
      return true;
    },
  );
});
