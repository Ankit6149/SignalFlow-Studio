import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const page = fs.readFileSync(path.join(root, "components/LandingPage.js"), "utf8");

test("footer identifies SignalFlow as the Personal Alpha content operating system", () => {
  assert.match(page, /Content operating system · Personal Alpha/);
  assert.doesNotMatch(page, /Content operations around your work—not another job beside it/);
});
