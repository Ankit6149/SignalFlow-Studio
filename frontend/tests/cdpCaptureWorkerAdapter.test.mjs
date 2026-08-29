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

function createFakeCdpClient({ deviceScaleFactor = 2 } = {}) {
  let currentUrl = "about:blank";
  const commands = [];
  const regions = new Map([
    ["#app", { visible: true, x: 0, y: 0, width: 1200, height: 760 }],
    ["#input", { visible: true, x: 24, y: 40, width: 500, height: 48 }],
    ["#select", { visible: true, x: 24, y: 100, width: 320, height: 44 }],
    ["#hero", { visible: true, x: 40, y: 80, width: 300, height: 200 }],
    ["#private", { visible: true, x: 10, y: 10, width: 100, height: 20 }],
  ]);

  function selectorFromExpression(expression) {
    for (const selector of regions.keys()) {
      if (expression.includes(JSON.stringify(selector))) return selector;
    }
    return null;
  }

  return {
    commands,
    async send(method, params = {}, sessionId = null) {
      commands.push({ method, params, sessionId });
      if (method === "Target.createTarget") return { targetId: "target-1" };
      if (method === "Target.attachToTarget") return { sessionId: "session-1" };
      if (["Page.enable", "Runtime.enable", "DOM.enable", "Network.enable", "Emulation.setDeviceMetricsOverride", "Network.setCookies"].includes(method)) return {};
      if (method === "Page.navigate") {
        currentUrl = params.url;
        return { frameId: "frame-1" };
      }
      if (method === "Runtime.evaluate") {
        if (params.expression === "document.readyState") return { result: { value: "complete" } };
        if (params.expression === "location.href") return { result: { value: currentUrl } };
        const selector = selectorFromExpression(params.expression);
        if (params.expression.includes("getBoundingClientRect")) {
          return { result: { value: selector ? regions.get(selector) : null } };
        }
        return { result: { value: true } };
      }
      if (method === "Page.captureScreenshot") {
        const width = params.clip ? Math.round(params.clip.width * deviceScaleFactor) : 2880;
        const height = params.clip ? Math.round(params.clip.height * deviceScaleFactor) : 1800;
        return { data: pngBase64(width, height) };
      }
      if (method === "Target.closeTarget") return { success: true };
      return {};
    },
    async close() {},
  };
}

function createWorker(fakeClient) {
  return createCdpCaptureWorkerAdapter({
    browserWSEndpoint: "wss://browser.example.test/devtools/browser/opaque-id",
    allowedEnvironments: ["preview"],
    viewport: { width: 1440, height: 900, deviceScaleFactor: 2 },
    clientFactory: async () => fakeClient,
  });
}

test("CDP worker exposes screenshot capability but keeps screencast unavailable", async () => {
  const worker = createWorker(createFakeCdpClient());
  const description = await worker.describe();
  assert.equal(description.available, true);
  assert.equal(description.screenshot, true);
  assert.equal(description.screencast, false);
  assert.deepEqual(description.viewport, { width: 1440, height: 900, deviceScaleFactor: 2 });
  await assert.rejects(() => worker.startRecording(), (error) => error.code === "capture_capability_missing");
});

test("CDP worker executes the bounded screenshot action surface and returns real PNG bytes", async () => {
  const client = createFakeCdpClient();
  const worker = createWorker(client);
  const session = await worker.open({
    targetOrigin: "https://preview.example.test",
    environment: "preview",
    maxDurationSeconds: 60,
  });

  await worker.navigate(session, "https://preview.example.test/demo");
  await worker.waitFor(session, { selector: "#app" });
  await worker.click(session, { selector: "#app" });
  await worker.focus(session, { selector: "#input" });
  await worker.fillSafeFixture(session, { selector: "#input", value: "safe fixture" });
  await worker.select(session, { selector: "#select", optionValue: "option-a" });
  await worker.scroll(session, { scrollY: 120 });
  await worker.pause(session, { pauseMs: 0 });
  await worker.assertVisible(session, { selector: "#app" });

  const output = await worker.captureCheckpoint(session, { checkpoint: "hero" });
  assert.ok(output.payload instanceof Uint8Array);
  assert.equal(output.mimeType, "image/png");
  assert.deepEqual(output.dimensions, { width: 2880, height: 1800 });
  assert.equal(output.captureMetadata.sourceUrl, "https://preview.example.test/demo");
  assert.deepEqual(output.captureMetadata.viewport, { width: 1440, height: 900, deviceScaleFactor: 2 });
  assert.equal(output.captureMetadata.adapterKind, "cdp_remote_browser");
  assert.equal(client.commands.some((entry) => entry.method === "Page.captureScreenshot"), true);

  await worker.close(session);
});

test("CDP worker captures an explicit selector region instead of blind center cropping", async () => {
  const client = createFakeCdpClient();
  const worker = createWorker(client);
  const session = await worker.open({
    targetOrigin: "https://preview.example.test",
    environment: "preview",
  });
  await worker.navigate(session, "https://preview.example.test/demo");

  const output = await worker.captureCheckpoint(session, { checkpoint: "hero", selector: "#hero" });
  const captureCommand = client.commands.findLast((entry) => entry.method === "Page.captureScreenshot");
  assert.deepEqual(captureCommand.params.clip, {
    x: 40,
    y: 80,
    width: 300,
    height: 200,
    scale: 1,
  });
  assert.equal(captureCommand.params.captureBeyondViewport, true);
  assert.deepEqual(output.dimensions, { width: 600, height: 400 });
  assert.equal(output.captureMetadata.focusedSelector, "#hero");

  await worker.close(session);
});

test("CDP worker fails closed on cross-origin navigation and privacy blockers", async () => {
  const worker = createWorker(createFakeCdpClient());
  const session = await worker.open({
    targetOrigin: "https://preview.example.test",
    environment: "preview",
  });

  await assert.rejects(
    () => worker.navigate(session, "https://evil.example.test/steal"),
    (error) => error instanceof CdpCaptureError && error.code === "origin_changed",
  );

  await worker.navigate(session, "https://preview.example.test/demo");
  const privacy = await worker.evaluatePrivacy(session, [
    { code: "private-data-visible", severity: "block", selector: "#private" },
    { code: "non-blocking-note", severity: "warn", selector: "#missing" },
  ]);
  assert.equal(privacy.blocked, true);
  assert.deepEqual(privacy.issueCodes, ["private-data-visible"]);

  await worker.close(session);
});

test("CDP worker rejects unsafe endpoints without leaking endpoint credentials", () => {
  let thrown = null;
  try {
    createCdpCaptureWorkerAdapter({
      browserWSEndpoint: "wss://user:super-secret@browser.example.test/devtools/browser/secret",
      allowedEnvironments: ["preview"],
    });
  } catch (error) {
    thrown = error;
  }
  assert.ok(thrown instanceof CdpCaptureError);
  assert.equal(thrown.code, "browser_endpoint_invalid");
  assert.equal(String(thrown.message).includes("super-secret"), false);
  assert.equal(JSON.stringify(thrown.details).includes("super-secret"), false);
});
