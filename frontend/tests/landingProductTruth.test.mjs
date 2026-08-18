import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("landing presents the real manual owner path without claiming connected-source automation", () => {
  const page = read("components/LandingPage.js");
  assert.match(page, /Owner Golden Path is live through exact approval/);
  assert.match(page, /href="\/signals"/);
  assert.match(page, /manual ContentSignals/i);
  assert.match(page, /persisted opportunities and angles/i);
  assert.match(page, /evidence\/authenticity checks/i);
  assert.match(page, /browser-local NarrativeMemory \+ explainable StyleMemory/);
  assert.match(page, /Automatic connected-source detection, durable publishing, cross-device memory sync and media production remain product direction/);
  assert.doesNotMatch(page, /automatic posting is available|fully automatic|autopilot is live/i);
});

test("landing preserves current Studio as an additive create path", () => {
  const page = read("components/LandingPage.js");
  assert.match(page, /Open current Studio/);
  assert.match(page, /real configured AI generation/i);
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
