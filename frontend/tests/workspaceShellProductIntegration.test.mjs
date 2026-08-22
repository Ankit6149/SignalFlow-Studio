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

  for (const [id, href] of [["today", "/today"], ["signals", "/signals"], ["plan", "/plan"]]) {
    assert.match(shell, new RegExp(`id: "${id}", label: "[^"]+", href: "${href.replace("/", "\\/")}", status: "available"`));
  }

  assert.match(shell, /id: "create", label: "Create", status: "next"/);
  assert.match(shell, /legacy campaign Studio is compatibility-only/i);
  assert.match(shell, /id: "assets", label: "Assets", status: "planned"/);
  assert.match(shell, /id: "calendar", label: "Calendar", status: "planned"/);
  assert.match(shell, /aria-disabled="true"/);
  assert.match(shell, /not functional yet/);
  assert.doesNotMatch(shell, /id: "create"[^\n]+href: "\/\?workspace=create"/);
});

test("real current surfaces share the canonical shell", () => {
  const today = read("components/TodayWorkspace.js");
  const signals = read("components/SignalsWorkspace.js");
  const plan = read("components/PlanWorkspace.js");
  assert.match(today, /<WorkspaceShell activeItem="today"/);
  assert.match(signals, /<WorkspaceShell activeItem="signals"/);
  assert.match(plan, /<WorkspaceShell activeItem="plan"/);
  assert.doesNotMatch(today, /className=\{styles\.topbar\}/);
  assert.doesNotMatch(signals, /className=\{styles\.topbar\}/);
});

test("visual tokens align workspace with the landing using a calm light signal system", () => {
  const landing = read("components/LandingPage.module.css");
  const shell = read("components/WorkspaceShell.module.css");
  for (const token of ["#f7f8fb", "#ffffff", "#171b24", "#5267d9", "#dfe4ec"]) {
    assert.match(`${landing}\n${shell}`, new RegExp(token.replace("#", "\\#"), "i"));
  }
  assert.doesNotMatch(shell, /#d3b874|#ead9a8/i);
  assert.match(shell, /background:\s*rgba\(255,255,255,\.92\)/);
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
