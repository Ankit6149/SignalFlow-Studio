import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(testDir, "..");
const read = (relative) => fs.readFileSync(path.join(frontendRoot, relative), "utf8");

test("workspace shell represents the current product map without inventing routes for future stages", () => {
  const shell = read("components/WorkspaceShell.js");
  for (const label of ["Today", "Signals", "Plan", "Library", "Connections", "Voice", "Settings"]) {
    assert.match(shell, new RegExp(`label: "${label}"`));
  }
  for (const [id, href] of [["today", "/today"], ["signals", "/signals"], ["plan", "/plan"], ["voice", "/voice"]]) {
    assert.match(shell, new RegExp(`id: "${id}", label: "[^"]+", href: "${href.replace("/", "\\/")}", status: "available"`));
  }
  assert.match(shell, /id: "create", label: "Create", status: "next"/);
  assert.match(shell, /id: "calendar", label: "Publish", status: "planned"/);
  assert.doesNotMatch(shell, /id: "create"[^\n]+href:/);
  assert.doesNotMatch(shell, /id: "calendar"[^\n]+href:/);
});

test("the visible flow bar mirrors the canonical Capture Shape Create Review Publish sequence", () => {
  const shell = read("components/WorkspaceShell.js");
  for (const stage of ["Capture", "Shape", "Create", "Review", "Publish"]) {
    assert.match(shell, new RegExp(`label: "${stage}"`));
  }
  assert.match(shell, /step\.status === "available"/);
  assert.match(shell, /styles\.flowStepLocked/);
  assert.match(shell, /step\.status === "next" \? "next" : "later"/);
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

test("workspace shell uses the current restrained editorial tokens rather than the discarded light-indigo shell", () => {
  const shell = read("components/WorkspaceShell.module.css");
  assert.match(shell, /--canvas:\s*#f4f1ea/);
  assert.match(shell, /--paper:\s*#fcfbf8/);
  assert.match(shell, /--ink:\s*#181714/);
  assert.match(shell, /--champagne:\s*#c9ad6b/);
  assert.match(shell, /font-family:\s*"DM Sans"/);
  assert.doesNotMatch(shell, /#5267d9|#dfe4ec/i);
});

test("workspace shell has an intentional mobile drawer and accessibility states", () => {
  const shell = read("components/WorkspaceShell.js");
  const css = read("components/WorkspaceShell.module.css");
  assert.match(shell, /aria-expanded=\{open\}/);
  assert.match(shell, /event\.key === "Escape"/);
  assert.match(shell, /href="#workspace-content"/);
  assert.match(shell, /aria-label="Close navigation"/);
  assert.match(css, /@media \(max-width: 980px\)/);
  assert.match(css, /transform:\s*translateX\(-105%\)/);
  assert.match(css, /\.railOpen\s*\{\s*transform:\s*none;/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
