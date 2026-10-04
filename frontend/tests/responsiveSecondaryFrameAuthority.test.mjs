import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(testDir, "..");
const read = (relative) => fs.readFileSync(path.join(frontendRoot, relative), "utf8");

test("secondary page-frame responsive behavior has one owner", () => {
  const workspace = read("app/app-workspace.css");
  const responsive = read("app/responsive-studio.css");

  assert.match(workspace, /Responsive secondary page-frame authority/);
  assert.match(workspace, /\.app-shell \.secondary-page \{[\s\S]*max-width:\s*calc\(100vw - 2rem\)/);
  assert.match(workspace, /@media \(max-width: 72rem\)[\s\S]*\.app-shell \.secondary-heading \{/);
  assert.match(workspace, /@media \(max-width: 52rem\)[\s\S]*\.app-shell \.secondary-heading h1 \{/);
  assert.match(workspace, /@media \(max-width: 37rem\)[\s\S]*\.app-shell \.secondary-heading p:last-child \{/);

  assert.doesNotMatch(responsive, /\.app-shell \.secondary-page/);
  assert.doesNotMatch(responsive, /\.app-shell \.secondary-heading/);
});
