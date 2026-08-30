import test from "node:test";
import assert from "node:assert/strict";

import {
  CdpImageProcessorError,
  createCdpImageProcessorAdapter,
} from "../lib/infrastructure/cdpImageProcessorAdapter.mjs";

function fakeClientFactory({ analysis = null, renderBase64 = "AQIDBA==" } = {}) {
  const calls = [];
  const factory = async () => ({
    async send(method, params = {}, sessionId = null) {
      calls.push({ method, params, sessionId });
      if (method === "Target.createTarget") return { targetId: "target-1" };
      if (method === "Target.attachToTarget") return { sessionId: "session-1" };
      if (method === "Runtime.enable") return {};
      if (method === "Target.closeTarget") return { success: true };
      if (method === "Runtime.evaluate") {
        if (String(params.expression).includes("luminanceVariance")) {
          return {
            result: {
              value: analysis || {
                decodeOk: true,
                width: 2880,
                height: 1800,
                blankLike: false,
                blankConfidence: 0.91,
                opaqueRatio: 1,
                luminanceVariance: 815,
              },
            },
          };
        }
        return { result: { value: { ok: true, data: renderBase64 } } };
      }
      throw new Error(`Unexpected CDP method ${method}`);
    },
    async close() {},
  });
  factory.calls = calls;
  return factory;
}

test("CDP image processor analyzes bounded screenshot bytes without exposing an arbitrary execution surface", async () => {
  const clientFactory = fakeClientFactory();
  const adapter = createCdpImageProcessorAdapter({
    browserWSEndpoint: "wss://browser.example.test/devtools/browser/opaque-id",
    clientFactory,
  });
  const description = await adapter.describe();
  assert.equal(description.available, true);
  assert.equal(description.capabilities.includes("crop_resize"), true);

  const result = await adapter.analyze({
    bytes: new Uint8Array([137, 80, 78, 71]),
    mimeType: "image/png",
  });
  assert.equal(result.decodeOk, true);
  assert.equal(result.blankLike, false);
  assert.deepEqual(result.dimensions, { width: 2880, height: 1800 });
  assert.equal(typeof adapter.evaluate, "undefined");
  assert.equal(clientFactory.calls.some((call) => call.method === "Runtime.evaluate"), true);
});

test("CDP image processor renders only the explicit crop into the requested target size", async () => {
  const clientFactory = fakeClientFactory({ renderBase64: "AAECAwQF" });
  const adapter = createCdpImageProcessorAdapter({
    browserWSEndpoint: "wss://browser.example.test/devtools/browser/opaque-id",
    clientFactory,
  });
  const output = await adapter.render({
    bytes: new Uint8Array([1, 2, 3, 4]),
    mimeType: "image/png",
    crop: { x: 100, y: 50, width: 900, height: 900 },
    targetDimensions: { width: 1080, height: 1080 },
    aspectRatio: "1:1",
  });
  assert.equal(output.mimeType, "image/png");
  assert.deepEqual(output.dimensions, { width: 1080, height: 1080 });
  assert.equal(output.bytes.byteLength, 6);
  const evaluation = clientFactory.calls.find((call) => call.method === "Runtime.evaluate");
  assert.match(evaluation.params.expression, /"x":100/);
  assert.match(evaluation.params.expression, /"width":1080/);
});

test("remote insecure and credential-bearing browser endpoints fail closed without echoing credentials", () => {
  assert.throws(
    () => createCdpImageProcessorAdapter({ browserWSEndpoint: "ws://browser.example.test/devtools/browser/id" }),
    (error) => error instanceof CdpImageProcessorError && error.code === "image_processor_endpoint_insecure",
  );
  let captured;
  try {
    createCdpImageProcessorAdapter({ browserWSEndpoint: "wss://user:super-secret@browser.example.test/devtools/browser/id" });
  } catch (error) {
    captured = error;
  }
  assert.equal(captured.code, "image_processor_endpoint_invalid");
  assert.doesNotMatch(`${captured.message} ${JSON.stringify(captured.details)}`, /super-secret/);
});

test("oversized and unsupported image inputs are rejected before browser work", async () => {
  const clientFactory = fakeClientFactory();
  const adapter = createCdpImageProcessorAdapter({
    browserWSEndpoint: "wss://browser.example.test/devtools/browser/id",
    clientFactory,
  });
  await assert.rejects(
    () => adapter.analyze({ bytes: new Uint8Array([1, 2, 3]), mimeType: "image/svg+xml" }),
    (error) => error.code === "unsupported_image_format",
  );
  assert.equal(clientFactory.calls.length, 0);
});
