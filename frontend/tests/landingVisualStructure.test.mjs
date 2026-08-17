import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const page = fs.readFileSync(path.join(root, "components/LandingPage.js"), "utf8");
const css = fs.readFileSync(path.join(root, "components/LandingPage.module.css"), "utf8");

test("landing is organized around product scenes instead of architecture-card overload", () => {
  assert.match(page, /HeroProductScene/);
  assert.match(page, /MediaCanvas/);
  assert.match(page, /Stay in the work/);
  assert.match(page, /Two honest ways to use SignalFlow today/);
  assert.match(page, /Trust is not a settings page/);
  assert.doesNotMatch(page, /CURRENT_FOUNDATION|PRODUCT_DIRECTION =|TRUST_POINTS/);
});

test("landing has cinematic depth without relying on unbounded motion", () => {
  assert.match(css, /radial-gradient/);
  assert.match(css, /perspective\(80rem\)/);
  assert.match(css, /@keyframes floatLabel/);
  assert.match(css, /@keyframes orbitDrift/);
  assert.match(css, /prefers-reduced-motion/);
});
