import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const page = fs.readFileSync(path.join(root, "components/LandingPage.js"), "utf8");

test("adaptive media canvas remains explicitly product direction", () => {
  assert.match(page, /MEDIA INTELLIGENCE · PRODUCT DIRECTION/);
  assert.match(page, /image, carousel, demo or reel/);
  assert.match(page, /uploaded ≠ publishable/);
});
