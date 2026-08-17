import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const page = fs.readFileSync(path.join(root, "components/LandingPage.js"), "utf8");

test("hero leads with the work-first promise and current product proof", () => {
  assert.match(page, /Stay in the work/);
  assert.match(page, /Let the story find you/);
  assert.match(page, /keeps what your work creates/i);
  assert.match(page, /Owner Golden Path is live through exact approval/);
});
