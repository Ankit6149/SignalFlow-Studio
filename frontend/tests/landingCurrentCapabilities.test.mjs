import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const page = fs.readFileSync(path.join(root, "components/LandingPage.js"), "utf8");

test("landing names the real current capabilities needed for owner use", () => {
  assert.match(page, /browser-local recovery/i);
  assert.match(page, /destination-specific drafts/i);
  assert.match(page, /real configured AI generation/i);
  assert.match(page, /persisted opportunities and angles/i);
  assert.match(page, /explicit Voice/i);
  assert.match(page, /exact revision approve\/reject/i);
  assert.match(page, /export/i);
});
