#!/usr/bin/env node

import readline from "node:readline";
import { executeTool, TOOL_DEFINITIONS } from "./lib/tools.mjs";

const SERVER_INFO = { name: "signalflow-studio", version: "0.1.0" };
const SUPPORTED_PROTOCOLS = new Set([
  "2025-11-25",
  "2025-06-18",
  "2025-03-26",
  "2024-11-05",
]);
const LATEST_PROTOCOL = "2025-11-25";
const TOOL_NAMES = new Set(TOOL_DEFINITIONS.map((tool) => tool.name));

let initializeCompleted = false;
let initialized = false;

function writeMessage(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function result(id, payload) {
  writeMessage({ jsonrpc: "2.0", id, result: payload });
}

function error(id, code, message, data) {
  writeMessage({
    jsonrpc: "2.0",
    id: id ?? null,
    error: { code, message, ...(data === undefined ? {} : { data }) },
  });
}

async function handleRequest(message) {
  if (!message || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    error(message?.id, -32600, "Invalid JSON-RPC request.");
    return;
  }

  const { id, method, params = {} } = message;
  const notification = id === undefined;

  if (notification) {
    if (method === "notifications/initialized" && initializeCompleted) initialized = true;
    return;
  }

  if (method === "initialize") {
    const requested = String(params.protocolVersion || "");
    const protocolVersion = SUPPORTED_PROTOCOLS.has(requested) ? requested : LATEST_PROTOCOL;
    initializeCompleted = true;
    initialized = false;
    result(id, {
      protocolVersion,
      capabilities: { tools: { listChanged: false } },
      serverInfo: SERVER_INFO,
      instructions:
        "Use SignalFlow to create evidence-grounded, destination-specific campaigns. Configure provider secrets in the MCP process environment; never place API keys in model prompts.",
    });
    return;
  }

  if (!initialized) {
    error(id, -32002, "SignalFlow MCP is not initialized. Send initialize and notifications/initialized first.");
    return;
  }

  if (method === "ping") {
    result(id, {});
    return;
  }

  if (method === "tools/list") {
    result(id, { tools: TOOL_DEFINITIONS });
    return;
  }

  if (method === "tools/call") {
    if (!TOOL_NAMES.has(params.name)) {
      error(id, -32602, `Unknown tool: ${String(params.name || "missing tool name")}`);
      return;
    }
    try {
      const toolResult = await executeTool(params.name, params.arguments || {});
      result(id, toolResult);
    } catch (toolError) {
      result(id, {
        content: [{ type: "text", text: toolError.message || "SignalFlow MCP tool failed." }],
        isError: true,
      });
    }
    return;
  }

  error(id, -32601, `Method not found: ${method}`);
}

const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
let chain = Promise.resolve();

input.on("line", (line) => {
  if (!line.trim()) return;
  chain = chain.then(async () => {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      error(null, -32700, "Parse error.");
      return;
    }
    await handleRequest(message);
  }).catch((unexpectedError) => {
    console.error("SignalFlow MCP request failure:", unexpectedError);
  });
});

input.on("close", () => {
  void chain.finally(() => process.exit(0));
});

process.on("SIGINT", () => input.close());
process.on("SIGTERM", () => input.close());
console.error("SignalFlow MCP server listening on stdio");
