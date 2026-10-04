import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(testDir, "..");
const read = (relative) => fs.readFileSync(path.join(frontendRoot, relative), "utf8");

test("secondary workspace responsive layout has one owner", () => {
  const workspace = read("app/app-workspace.css");
  const responsive = read("app/responsive-studio.css");

  assert.match(workspace, /Responsive secondary-workspace authority/);
  assert.match(workspace, /@media \(max-width: 72rem\)[\s\S]*\.app-shell \.library-grid/);
  assert.match(workspace, /@media \(max-width: 52rem\)[\s\S]*\.app-shell \.connection-card \{/);
  assert.match(workspace, /@media \(max-width: 52rem\)[\s\S]*\.app-shell \.settings-form \{/);
  assert.match(workspace, /@media \(max-width: 52rem\)[\s\S]*\.app-shell \.truth-panel \{/);

  assert.doesNotMatch(responsive, /@media \(max-width: 72rem\)[\s\S]*\.app-shell \.library-grid \{/);
  assert.doesNotMatch(responsive, /\.app-shell \.settings-card--wide \{/);
  assert.doesNotMatch(responsive, /\.app-shell \.connection-card \.status-tag \{/);
  assert.doesNotMatch(responsive, /\.app-shell \.settings-form \{/);
});
