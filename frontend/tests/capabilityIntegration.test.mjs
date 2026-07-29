import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");

test("Studio consumes the capability endpoint and serves the extension handshake", () => {
  const page = read("../app/page.js");
  const route = read("../app/api/capabilities/route.js");

  assert.match(page, /fetch\("\/api\/capabilities"/);
  assert.match(page, /parseCapabilitySnapshot\(raw\)/);
  assert.match(page, /SignalFlowRequestCapabilities/);
  assert.match(page, /SignalFlowCapabilitiesAvailable/);
  assert.match(route, /createCapabilitySnapshot/);
  assert.match(route, /Cache-Control/);
});

test("Studio validates a generation response before the atomic state commit", () => {
  const page = read("../app/page.js");
  const validationIndex = page.indexOf("const accepted = acceptGenerationResponse");
  const mutationIndex = page.indexOf('type: "ACCEPT_GENERATION"');

  assert.ok(validationIndex >= 0, "generation acceptance boundary is missing");
  assert.ok(mutationIndex > validationIndex, "generation state is committed before validation");
  assert.doesNotMatch(page, /setResult\(data\)[\s\S]{0,300}data\.fallbackUsed/);
  assert.doesNotMatch(page, /setPosts\(generatedPosts\)/);
});

test("extension reads capabilities and refuses unacknowledged delivery", () => {
  const background = read("../../extension/background.js");
  const content = read("../../extension/content.js");
  const popup = read("../../extension/popup.js");

  assert.match(background, /get_capabilities/);
  assert.match(background, /acknowledged === true/);
  assert.match(content, /GET_SIGNALFLOW_CAPABILITIES/);
  assert.match(content, /SignalFlowRequestCapabilities/);
  assert.match(popup, /capabilities\?\.extension\?\.available/);
  assert.match(popup, /sendBtn\.disabled/);
});

test("MCP exposes the shared capability contract", () => {
  const tools = read("../../mcp/lib/tools.mjs");
  assert.match(tools, /signalflow_capabilities/);
  assert.match(tools, /\/api\/capabilities/);
  assert.match(tools, /parseCapabilitySnapshot/);
});
