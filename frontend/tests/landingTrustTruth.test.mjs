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
  assert.match(page, /Availability is always determined by the active deployment/);
});
