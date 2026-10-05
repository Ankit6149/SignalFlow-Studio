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

  assert.match(
    workspaceCss,
    /\.app-shell \.secondary-page \{[\s\S]*?width: min\(76rem, calc\(100% - 3rem\)\);[\s\S]*?max-width: calc\(100% - 3rem\);/,
  );
  assert.doesNotMatch(
    workspaceCss,
    /\.app-shell \.secondary-page \{[\s\S]*?max-width: calc\(100vw - 2rem\);/,
  );
});
