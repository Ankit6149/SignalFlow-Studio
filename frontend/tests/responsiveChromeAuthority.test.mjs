import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(testDir, "..");
const read = (relative) => fs.readFileSync(path.join(frontendRoot, relative), "utf8");

test("responsive application chrome has one owner", () => {
  const workspace = read("app/app-workspace.css");
  const studio = read("app/studio-product.css");

  assert.match(workspace, /Responsive application chrome authority/);
  assert.match(workspace, /\.app-shell \.app-header \{[\s\S]*isolation:\s*isolate/);
  assert.match(workspace, /\.app-shell \.app-nav \{[\s\S]*scrollbar-width:\s*thin/);
  assert.match(workspace, /@media \(max-width: 52rem\)[\s\S]*\.app-shell \.toast \{[\s\S]*top:\s*7\.5rem/);

  assert.doesNotMatch(studio, /\.app-shell \.app-header\s*\{/);
  assert.doesNotMatch(studio, /\.app-shell \.app-header__status\s*\{/);
  assert.doesNotMatch(studio, /\.app-shell \.brand-button\s*\{/);
  assert.doesNotMatch(studio, /\.app-shell \.app-nav\s*\{/);
  assert.doesNotMatch(studio, /\.app-shell \.toast\s*\{/);
});
