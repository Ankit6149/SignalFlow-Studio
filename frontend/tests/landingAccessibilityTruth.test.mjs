import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const page = fs.readFileSync(path.join(root, "components/LandingPage.js"), "utf8");

test("landing exposes keyboard and semantic navigation landmarks", () => {
  assert.match(page, /Skip to main content/);
  assert.match(page, /<header/);
  assert.match(page, /<main id="main-content"/);
  assert.match(page, /aria-labelledby="landing-title"/);
  assert.match(page, /aria-label="Public navigation"/);
  assert.match(page, /aria-label="Footer navigation"/);
});

test("signal capture is a direct navigation action instead of hidden Studio state", () => {
  const matches = page.match(/href="\/signals"/g) || [];
  assert.ok(matches.length >= 3, "expected repeated direct /signals entry points");
});
