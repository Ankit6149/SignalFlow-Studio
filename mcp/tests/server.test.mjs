import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createServer } from "node:http";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.resolve(currentDir, "../server.mjs");

function waitForLine(lines, predicate, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timed out waiting for MCP response.")), timeoutMs);
    const check = () => {
      const match = lines.find(predicate);
      if (match) {
        clearTimeout(timeout);
        resolve(match);
        return;
      }
      setTimeout(check, 10);
    };
    check();
  });
}

function send(child, message) {
  child.stdin.write(`${JSON.stringify(message)}\n`);
}

test("stdio server enforces lifecycle, initializes, and lists SignalFlow tools", async (t) => {
  const child = spawn(process.execPath, [serverPath], {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, SIGNALFLOW_BASE_URL: "http://localhost:3000" },
  });
  t.after(() => child.kill("SIGTERM"));

  const lines = [];
  const output = readline.createInterface({ input: child.stdout });
  output.on("line", (line) => lines.push(JSON.parse(line)));

  send(child, { jsonrpc: "2.0", id: 0, method: "tools/list", params: {} });
  const beforeInitialize = await waitForLine(lines, (message) => message.id === 0);
  assert.equal(beforeInitialize.error.code, -32002);

  send(child, {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "test", version: "1" } },
  });

  const initializeResponse = await waitForLine(lines, (message) => message.id === 1);
  assert.equal(initializeResponse.result.protocolVersion, "2025-11-25");
  assert.equal(initializeResponse.result.serverInfo.name, "signalflow-studio");
  assert.equal(initializeResponse.result.capabilities.tools.listChanged, false);

  send(child, { jsonrpc: "2.0", method: "notifications/initialized", params: {} });
  send(child, { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });

  const toolList = await waitForLine(lines, (message) => message.id === 2);
  assert.equal(toolList.result.tools.length, 8);
  assert.equal(toolList.result.tools[0].name, "signalflow_capabilities");
  assert.equal(toolList.result.tools[3].name, "signalflow_validate_campaign_input");
  assert.equal(toolList.result.tools[4].name, "signalflow_start_campaign");
  assert.equal(toolList.result.tools[7].name, "signalflow_create_campaign");

  send(child, {
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: { name: "missing_tool", arguments: {} },
  });
  const unknownTool = await waitForLine(lines, (message) => message.id === 3);
  assert.equal(unknownTool.error.code, -32602);
  assert.match(unknownTool.error.message, /unknown tool/i);
});


test("ping remains responsive while a blocking campaign tool is awaiting generation", async (t) => {
  let releaseGeneration;
  const generationGate = new Promise((resolve) => { releaseGeneration = resolve; });
  const backend = createServer(async (request, response) => {
    if (request.url === "/api/launch_kit" && request.method === "POST") {
      for await (const _chunk of request) {
        // Consume request body before deliberately holding the response.
      }
      await generationGate;
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({
        ok: true,
        providerUsed: "gemini",
        generation_status: { linkedin: { status: "generated", qualityStatus: "complete" } },
        posts: { linkedin: "Generated draft" },
      }));
      return;
    }
    response.writeHead(404, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ ok: false, error: "not found" }));
  });
  await new Promise((resolve) => backend.listen(0, "127.0.0.1", resolve));
  t.after(() => backend.close());
  const address = backend.address();

  const child = spawn(process.execPath, [serverPath], {
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...process.env,
      SIGNALFLOW_BASE_URL: `http://127.0.0.1:${address.port}`,
      SIGNALFLOW_GEMINI_API_KEY: "test-provider-key",
    },
  });
  t.after(() => child.kill("SIGTERM"));

  const lines = [];
  const output = readline.createInterface({ input: child.stdout });
  output.on("line", (line) => lines.push(JSON.parse(line)));

  send(child, {
    jsonrpc: "2.0",
    id: 10,
    method: "initialize",
    params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "test", version: "1" } },
  });
  await waitForLine(lines, (message) => message.id === 10);
  send(child, { jsonrpc: "2.0", method: "notifications/initialized", params: {} });

  send(child, {
    jsonrpc: "2.0",
    id: 11,
    method: "tools/call",
    params: {
      name: "signalflow_create_campaign",
      arguments: {
        projectName: "SignalFlow",
        notes: "Evidence",
        provider: "gemini",
        channels: ["linkedin"],
      },
    },
  });

  await new Promise((resolve) => setTimeout(resolve, 50));
  send(child, { jsonrpc: "2.0", id: 12, method: "ping", params: {} });

  const ping = await waitForLine(lines, (message) => message.id === 12, 1000);
  assert.deepEqual(ping.result, {});
  assert.equal(lines.some((message) => message.id === 11), false);

  releaseGeneration();
  const generation = await waitForLine(lines, (message) => message.id === 11, 3000);
  assert.equal(generation.result.isError, false);
});


test("SIGTERM aborts blocking campaign HTTP work and exits cleanly", async (t) => {
  let markStarted;
  const requestStarted = new Promise((resolve) => { markStarted = resolve; });
  let markClosed;
  const requestClosed = new Promise((resolve) => { markClosed = resolve; });

  const backend = createServer(async (request, response) => {
    if (request.url === "/api/launch_kit" && request.method === "POST") {
      for await (const _chunk of request) {
        // Consume the body before holding the response open.
      }
      response.on("close", () => markClosed());
      markStarted();
      return;
    }
    response.writeHead(404, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ ok: false, error: "not found" }));
  });
  await new Promise((resolve) => backend.listen(0, "127.0.0.1", resolve));
  t.after(() => backend.close());
  const address = backend.address();

  const child = spawn(process.execPath, [serverPath], {
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...process.env,
      SIGNALFLOW_BASE_URL: `http://127.0.0.1:${address.port}`,
      SIGNALFLOW_GEMINI_API_KEY: "test-provider-key",
    },
  });
  t.after(() => {
    if (!child.killed) child.kill("SIGKILL");
  });

  const lines = [];
  const output = readline.createInterface({ input: child.stdout });
  output.on("line", (line) => lines.push(JSON.parse(line)));

  send(child, {
    jsonrpc: "2.0",
    id: 20,
    method: "initialize",
    params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "test", version: "1" } },
  });
  await waitForLine(lines, (message) => message.id === 20);
  send(child, { jsonrpc: "2.0", method: "notifications/initialized", params: {} });

  send(child, {
    jsonrpc: "2.0",
    id: 21,
    method: "tools/call",
    params: {
      name: "signalflow_create_campaign",
      arguments: {
        projectName: "SignalFlow shutdown",
        notes: "Evidence",
        provider: "gemini",
        channels: ["linkedin"],
      },
    },
  });

  await Promise.race([
    requestStarted,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Backend generation request did not start.")), 2000)),
  ]);
  assert.equal(lines.some((message) => message.id === 21), false);

  const exited = new Promise((resolve) => {
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });
  child.kill("SIGTERM");

  const exitResult = await Promise.race([
    exited,
    new Promise((_, reject) => setTimeout(() => reject(new Error("MCP server did not exit after SIGTERM.")), 3000)),
  ]);
  await Promise.race([
    requestClosed,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Blocking campaign HTTP request was not aborted on shutdown.")), 1000)),
  ]);

  assert.equal(exitResult.code, 0);
});
