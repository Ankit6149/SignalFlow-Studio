import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const page = fs.readFileSync(path.join(root, "components/LandingPage.js"), "utf8");

test("landing labels future automation instead of presenting it as shipped", () => {
  assert.match(page, /WHAT COMES AFTER THE CORE LOOP/);
  assert.match(page, /remain product direction/);
  assert.match(page, /Target processing modes/);
  assert.match(page, /direction—not claims about what is already shipped/);
  assert.doesNotMatch(page, /automatic posting is available|fully automatic|autopilot is live/i);
});
