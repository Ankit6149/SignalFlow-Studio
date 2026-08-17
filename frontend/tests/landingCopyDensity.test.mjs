import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const page = fs.readFileSync(path.join(root, "components/LandingPage.js"), "utf8");

test("landing keeps the primary public story compact", () => {
  const sectionCount = (page.match(/<section/g) || []).length;
  assert.ok(sectionCount <= 6, `expected no more than 6 major sections, got ${sectionCount}`);
  assert.match(page, /Stay in the work/);
  assert.match(page, /Let the story find you/);
});
