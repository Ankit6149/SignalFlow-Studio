import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const doc = fs.readFileSync(path.join(repositoryRoot, "docs/LANDING_PAGE_PRODUCT_TRUTH.md"), "utf8");

test("landing truth contract separates available-now and product-direction capabilities", () => {
  assert.match(doc, /Available now and safe to present as real/);
  assert.match(doc, /Product direction that must remain visually\/textually marked as future\/building/);
  assert.match(doc, /Manual browser-local `ContentSignal` capture/);
  assert.match(doc, /automatic event\/signal detection/);
});
