import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import path from "node:path";

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

test("stdio server initializes and lists SignalFlow tools", async (t) => {
  const child = spawn(process.execPath, [serverPath], {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, SIGNALFLOW_BASE_URL: "http://localhost:3000" },
  });
  t.after(() => child.kill("SIGTERM"));

  const lines = [];
  const output = readline.createInterface({ input: child.stdout });
  output.on("line", (line) => lines.push(JSON.parse(line)));

  child.stdin.write(`${JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "test", version: "1" } },
  })}\n`);

  const initialized = await waitForLine(lines, (message) => message.id === 1);
  assert.equal(initialized.result.serverInfo.name, "signalflow-studio");
  assert.equal(initialized.result.capabilities.tools.listChanged, false);

  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} })}\n`);
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} })}\n`);

  const toolList = await waitForLine(lines, (message) => message.id === 2);
  assert.equal(toolList.result.tools.length, 3);
  assert.equal(toolList.result.tools[2].name, "signalflow_create_campaign");
});
