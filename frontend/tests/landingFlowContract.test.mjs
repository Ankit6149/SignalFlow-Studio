import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const page = fs.readFileSync(path.join(root, "components/LandingPage.js"), "utf8");

test("landing communicates the canonical flow without pretending every stage is live", () => {
  for (const label of ["Signal", "Opportunity", "Story", "Produce", "Judge", "Publish"]) {
    assert.match(page, new RegExp(`label: \\\"${label.replace("+", "\\+")}\\\"`));
  }
  assert.match(page, /state: "live"/);
  assert.match(page, /state: "next"/);
  assert.match(page, /state: "principle"/);
});
