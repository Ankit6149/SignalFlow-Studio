import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("landing presents manual ContentSignal capture as live without claiming automatic intelligence", () => {
  const page = read("components/LandingPage.js");
  assert.match(page, /The first Signal layer is live/);
  assert.match(page, /href="\/signals"/);
  assert.match(page, /manual ContentSignals/i);
  assert.match(page, /Automatic signal detection and opportunity intelligence are still being built/);
  assert.match(page, /Opportunity intelligence · building next/);
  assert.match(page, /No fake automatic detections/);
});

test("landing preserves current Studio as a real additive create path", () => {
  const page = read("components/LandingPage.js");
  assert.match(page, /Open current Studio/);
  assert.match(page, /real configured model routes/i);
  assert.match(page, /Current Studio remains additive/);
  assert.match(page, /onClick=\{onEnter\}/);
});

test("landing stays responsive and respects reduced motion", () => {
  const css = read("components/LandingPage.module.css");
  assert.match(css, /@media \(max-width: 900px\)/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /overflow-x: clip/);
});
