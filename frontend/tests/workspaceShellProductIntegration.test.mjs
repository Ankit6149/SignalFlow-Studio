import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(testDir, "..");
const read = (relative) => fs.readFileSync(path.join(frontendRoot, relative), "utf8");

test("workspace shell represents the canonical product map without faking unavailable routes", () => {
  const shell = read("components/WorkspaceShell.js");
  for (const label of ["Today", "Signals", "Plan", "Calendar", "Create", "Assets", "Library", "Connections", "Voice", "Settings"]) {
    assert.match(shell, new RegExp(`label: "${label}"`));
  }
  assert.match(shell, /status: "available"/);
  assert.match(shell, /status: "next"/);
  assert.match(shell, /status: "planned"/);
  assert.match(shell, /aria-disabled="true"/);
  assert.match(shell, /not functional yet/);
});

test("real current surfaces share the canonical shell", () => {
  const page = read("app/page.js");
  const signals = read("components/SignalsWorkspace.js");
  assert.match(page, /import WorkspaceShell from "\.\.\/components\/WorkspaceShell"/);
  assert.match(page, /activeItem=\{section === "studio" \? "create" : section\}/);
  assert.match(page, /workspace === "create" \? "studio" : workspace/);
  assert.match(signals, /<WorkspaceShell activeItem="signals"/);
  assert.doesNotMatch(signals, /className=\{styles\.topbar\}/);
});

test("visual tokens align workspace with the landing while keeping light-surface contrast", () => {
  const landing = read("components/LandingPage.module.css");
  const shell = read("components/WorkspaceShell.module.css");
  const workspace = read("app/app-workspace.css");
  for (const token of ["#f5f0e5", "#fffdf8", "#171714", "#11120f", "#d3b874"]) {
    assert.match(`${landing}\n${shell}`, new RegExp(token.replace("#", "\\#"), "i"));
  }
  assert.match(workspace, /--app-bg: #f5f0e5/);
  assert.match(workspace, /--app-surface: #fffdf8/);
  assert.match(workspace, /--app-ink: #171714/);
  assert.match(workspace, /--app-radius: 0\.5rem/);
});

test("workspace shell has an intentional mobile drawer and accessibility states", () => {
  const shell = read("components/WorkspaceShell.js");
  const css = read("components/WorkspaceShell.module.css");
  assert.match(shell, /aria-expanded=\{open\}/);
  assert.match(shell, /aria-controls="signalflow-workspace-nav"/);
  assert.match(shell, /event\.key === "Escape"/);
  assert.match(shell, /href="#workspace-content"/);
  assert.match(css, /@media \(max-width: 980px\)/);
  assert.match(css, /transform: translateX\(-105%\)/);
  assert.match(css, /\.railOpen \{ transform: translateX\(0\); \}/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
