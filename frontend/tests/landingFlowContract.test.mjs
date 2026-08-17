import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const page = fs.readFileSync(path.join(root, "components/LandingPage.js"), "utf8");

test("landing communicates the implemented owner flow and keeps future automation separate", () => {
  for (const label of ["Signal", "Opportunity", "Voice + Plan", "LinkedIn / X", "Review", "Approve"]) {
    assert.ok(page.includes(`\"${label}\"`), `missing live owner-flow stage: ${label}`);
  }
  assert.match(page, /HUMAN GATE/);
  assert.match(page, /WHAT COMES AFTER THE CORE LOOP/);
  assert.match(page, /Connected-source detection/);
  assert.match(page, /Editorial calendar \+ durable publishing/);
});
