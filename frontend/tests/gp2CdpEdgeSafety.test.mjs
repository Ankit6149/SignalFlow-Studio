import test from "node:test";
import assert from "node:assert/strict";

import {
  CdpCaptureError,
  createCdpCaptureWorkerAdapter,
} from "../lib/infrastructure/cdpCaptureWorkerAdapter.mjs";

function pngBase64(width, height) {
  const bytes = new Uint8Array(24);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10], 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width, false);
  view.setUint32(20, height, false);
  return Buffer.from(bytes).toString("base64");
}

function fakeClient({ redirectOrigin = null, region = null } = {}) {
  let currentUrl = "about:blank";
  const commands = [];
  return {
    commands,
    async send(method, params = {}) {
      commands.push({ method, params });
      if (method === "Target.createTarget") return { targetId: "target-edge" };
      if (method === "Target.attachToTarget") return { sessionId: "session-edge" };
      if (["Page.enable", "Runtime.enable", "DOM.enable", "Network.enable", "Emulation.setDeviceMetricsOverride", "Network.setCookies"].includes(method)) return {};
      if (method === "Page.navigate") {
        currentUrl = redirectOrigin ? `${redirectOrigin}/redirected` : params.url;
        return { frameId: "frame-edge" };
      }
      if (method === "Runtime.evaluate") {
        if (params.expression === "document.readyState") return { result: { value: "complete" } };
        if (params.expression === "location.href") return { result: { value: currentUrl } };
        if (params.expression.includes("getBoundingClientRect")) {
          return { result: { value: region } };
        }
        return { result: { value: true } };
      }
      if (method === "Page.captureScreenshot") {
        const width = params.clip ? Math.round(params.clip.width * 2) : 2880;
        const height = params.clip ? Math.round(params.clip.height * 2) : 1800;
        return { data: pngBase64(width, height) };
      }
      if (method === "Target.closeTarget") return { success: true };
      return {};
    },
    async close() {},
  };
}

function worker(client, overrides = {}) {
  return createCdpCaptureWorkerAdapter({
    browserWSEndpoint: "wss://browser.example.test/devtools/browser/opaque-id",
    allowedEnvironments: ["preview"],
    viewport: { width: 1440, height: 900, deviceScaleFactor: 2 },
    selectorTimeoutMs: 50,
    clientFactory: async () => client,
    ...overrides,
  });
}

test("same-origin request that redirects cross-origin is rejected using the browser's final URL", async () => {
  const capture = worker(fakeClient({ redirectOrigin: "https://evil.example.test" }));
  const session = await capture.open({ targetOrigin: "https://preview.example.test", environment: "preview" });

  await assert.rejects(
    () => capture.navigate(session, "https://preview.example.test/login"),
    (error) => error instanceof CdpCaptureError && error.code === "origin_changed",
  );

  await capture.close(session);
});

test("bounded secret references become target-origin cookies without exposing secret values through the session", async () => {
  const client = fakeClient();
  const calls = [];
  const capture = worker(client, {
    secretResolver: {
      async resolve(input) {
        calls.push(input);
        return {
          cookies: [{
            name: "signalflow_session",
            value: "super-secret-cookie-value",
            path: "/",
            secure: true,
            httpOnly: true,
            sameSite: "Lax",
          }],
        };
      },
    },
  });

  const session = await capture.open({
    targetOrigin: "https://preview.example.test",
    environment: "preview",
    secretReferenceIds: ["owner-preview-session"],
  });

  assert.deepEqual(calls, [{
    secretReferenceIds: ["owner-preview-session"],
    targetOrigin: "https://preview.example.test",
    environment: "preview",
  }]);
  const cookieCommand = client.commands.find((entry) => entry.method === "Network.setCookies");
  assert.equal(cookieCommand.params.cookies[0].url, "https://preview.example.test/");
  assert.equal(cookieCommand.params.cookies[0].name, "signalflow_session");
  assert.equal(JSON.stringify(session).includes("super-secret-cookie-value"), false, "resolved secrets must not become session/provenance state");

  await capture.close(session);
});

test("missing required selector fails with a bounded checkpoint code instead of hanging", async () => {
  const capture = worker(fakeClient({ region: null }));
  const session = await capture.open({ targetOrigin: "https://preview.example.test", environment: "preview" });
  await capture.navigate(session, "https://preview.example.test/demo");

  await assert.rejects(
    () => capture.waitFor(session, { selector: "#never-appears" }),
    (error) => error instanceof CdpCaptureError && error.code === "selector_checkpoint_missing",
  );

  await capture.close(session);
});

test("focused capture supports a semantic region larger than the viewport without blind cropping", async () => {
  const client = fakeClient({ region: { visible: true, x: 10, y: 30, width: 1800, height: 1400 } });
  const capture = worker(client);
  const session = await capture.open({ targetOrigin: "https://preview.example.test", environment: "preview" });
  await capture.navigate(session, "https://preview.example.test/demo");

  const output = await capture.captureCheckpoint(session, { checkpoint: "large-proof", selector: "#proof" });
  const command = client.commands.findLast((entry) => entry.method === "Page.captureScreenshot");

  assert.equal(command.params.captureBeyondViewport, true);
  assert.deepEqual(command.params.clip, { x: 10, y: 30, width: 1800, height: 1400, scale: 1 });
  assert.deepEqual(output.dimensions, { width: 3600, height: 2800 });
  assert.equal(output.captureMetadata.focusedSelector, "#proof");

  await capture.close(session);
});
