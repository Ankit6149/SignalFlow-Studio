import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), "utf8");

test("Connections exposes the owner-only read-only GP2 revision trace after readiness", () => {
  const shell = read("components", "WorkspaceShell.js");
  assert.match(shell, /import Gp2TracePanel from "\.\/Gp2TracePanel"/);
  assert.match(shell, /<GithubSourceConnectionPanel \/><Gp2ReadinessPanel \/><Gp2TracePanel \/>/);
  assert.ok(shell.indexOf("<Gp2ReadinessPanel />") < shell.indexOf("<Gp2TracePanel />"));
});

test("GP2 trace panel accepts only exact commit SHAs and calls the protected read-only inspector", () => {
  const panel = read("components", "Gp2TracePanel.js");
  assert.match(panel, /\^\[a-f0-9\]\{40,64\}\$/i);
  assert.match(panel, /\/api\/gp2\/inspect\?source_revision=/);
  assert.match(panel, /credentials: "same-origin"/);
  assert.match(panel, /cache: "no-store"/);
  assert.match(panel, /Trace one exact GitHub event/);
  assert.match(panel, /read-only/);
  assert.doesNotMatch(panel, /method:\s*"POST"|method:\s*"PATCH"|method:\s*"DELETE"/);
  assert.doesNotMatch(panel, /sourceArtifact|repositoryRef|raw|payload|token|secret/i);
});

test("GP2 trace panel renders only the safe acceptance-stage vocabulary", () => {
  const panel = read("components", "Gp2TracePanel.js");
  for (const stage of ["signal", "opportunity_job", "opportunity", "exact_context", "planning", "media", "review", "approval"]) {
    assert.match(panel, new RegExp(stage));
  }
  assert.match(panel, /stoppedAt/);
  assert.match(panel, /statusLabel/);
});
