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
  const studio = read("app/studio-product.css");

  assert.match(workspace, /Responsive secondary page-frame authority/);
  assert.match(workspace, /\.app-shell \.secondary-page \{[\s\S]*max-width:\s*calc\(100vw - 2rem\)/);
  assert.match(workspace, /@media \(max-width: 72rem\)[\s\S]*\.app-shell \.secondary-heading \{/);
  assert.match(workspace, /@media \(max-width: 52rem\)[\s\S]*\.app-shell \.secondary-heading h1 \{/);
  assert.match(workspace, /@media \(max-width: 37rem\)[\s\S]*\.app-shell \.secondary-heading p:last-child \{/);

  assert.doesNotMatch(studio, /\.app-shell \.secondary-page/);
  assert.doesNotMatch(studio, /\.app-shell \.secondary-heading/);
});


test("desktop secondary pages size against the workspace container rather than the viewport", () => {
  const workspaceCss = read("app/app-workspace.css");
  const authority = workspaceCss.match(
    /\/\* Responsive secondary page-frame authority[\s\S]*?\.app-shell \.secondary-page \{([\s\S]*?)\n\}/,
  );

  assert.ok(authority, "secondary page-frame authority block must exist");
  assert.match(authority[1], /width: min\(76rem, calc\(100% - 3rem\)\);/);
  assert.match(authority[1], /max-width: calc\(100% - 3rem\);/);
  assert.doesNotMatch(authority[1], /100vw/);
});
