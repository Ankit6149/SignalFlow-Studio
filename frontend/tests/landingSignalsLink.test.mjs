import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const page = fs.readFileSync(path.join(root, "components/LandingPage.js"), "utf8");

test("landing keeps signal capture prominent in hero and close", () => {
  assert.match(page, /Capture your first signal/);
  assert.match(page, /Capture a signal/);
  const signalLinks = page.match(/href="\/signals"/g) ?? [];
  assert.ok(signalLinks.length >= 3, "signal capture should remain available in header, hero, and close");
  assert.match(page, /Keep the thought\.<br \/><em>Decide later\.<\/em>/);
});
