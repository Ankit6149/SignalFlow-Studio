import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const page = fs.readFileSync(path.join(root, "components/LandingPage.js"), "utf8");

// The primary product composition is CSS/component driven so it does not break on a remote hero image.
test("landing does not depend on a remote hero image", () => {
  assert.doesNotMatch(page, /<img|next\/image|https?:\/\/.*\.(png|jpe?g|webp)/i);
});
