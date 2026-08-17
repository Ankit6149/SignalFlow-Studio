import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const page = fs.readFileSync(path.join(root, "components/LandingPage.js"), "utf8");
const css = fs.readFileSync(path.join(root, "components/LandingPage.module.css"), "utf8");

test("landing is organized around the real owner path rather than card or faux-dashboard overload", () => {
  assert.match(page, /HeroFlowScene/);
  assert.match(page, /ProductPath/);
  assert.match(page, /OWNER PATH · LIVE NOW/);
  assert.match(page, /Start with the work/);
  assert.match(page, /Trust is system behavior/);
  assert.doesNotMatch(page, /HeroProductScene|MediaCanvas|CURRENT_FOUNDATION|PRODUCT_DIRECTION =|TRUST_POINTS/);
});

test("landing has quiet depth without ornamental floating motion", () => {
  assert.match(css, /radial-gradient/);
  assert.match(css, /backdrop-filter:\s*blur/);
  assert.match(css, /prefers-reduced-motion/);
  assert.doesNotMatch(css, /perspective\(|@keyframes floatLabel|@keyframes orbitDrift|#d9f36a|#a9a1ff/i);
});
