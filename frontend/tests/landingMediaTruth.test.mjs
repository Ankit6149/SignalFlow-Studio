import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const page = fs.readFileSync(path.join(root, "components/LandingPage.js"), "utf8");

test("media remains a future extension rather than the landing-page product center", () => {
  assert.match(page, /Media intelligence \+ production/);
  assert.match(page, /direction—not claims about what is already shipped/);
  assert.match(page, /Automatic connected-source detection, publishing, memory and media production remain product direction/);
  assert.doesNotMatch(page, /MediaCanvas|adaptive media canvas|automatic media production is live/i);
});
