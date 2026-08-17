import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const page = fs.readFileSync(path.join(root, "components/LandingPage.js"), "utf8");

test("landing labels roadmap automation instead of presenting it as shipped", () => {
  assert.match(page, /BUILDING/);
  assert.match(page, /PRODUCT DIRECTION/);
  assert.match(page, /Target processing modes/);
  assert.doesNotMatch(page, /automatic posting is available|fully automatic|autopilot is live/i);
});
