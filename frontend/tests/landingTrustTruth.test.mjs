import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const page = fs.readFileSync(path.join(root, "components/LandingPage.js"), "utf8");

test("processing-mode marketing stays capability scoped", () => {
  assert.match(page, /Private Hybrid/);
  assert.match(page, /Local Only/);
  assert.match(page, /Target processing modes/);
  assert.match(page, /Availability is determined by the implemented capability and privacy contract/);
  assert.doesNotMatch(page, /Private Hybrid is available now|Local Only is available now/);
});
