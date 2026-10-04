import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(testDir, "..");
const read = (relative) => fs.readFileSync(path.join(frontendRoot, relative), "utf8");

test("Connections styling has one application-shell authority", () => {
  const layout = read("app/layout.js");
  const workspace = read("app/app-workspace.css");
  const retired = path.join(frontendRoot, "app/connector.css");

  assert.equal(fs.existsSync(retired), false, "retired connector.css must not return");
  assert.doesNotMatch(layout, /connector\.css/);

  assert.match(workspace, /\.app-shell \.connection-card__actions \{/);
  assert.match(workspace, /flex-direction:\s*column/);
  assert.match(workspace, /\.app-shell \.connector-action \{[\s\S]*border:[\s\S]*background:[\s\S]*text-transform:\s*uppercase/);
  assert.match(workspace, /\.app-shell \.connector-action--quiet \{/);
  assert.match(workspace, /@media \(max-width: 47\.5rem\)[\s\S]*\.app-shell \.connection-card__actions \{[\s\S]*flex-direction:\s*row/);
});

test("global layout no longer grows a connector-specific stylesheet layer", () => {
  const layout = read("app/layout.js");
  const globalImports = [...layout.matchAll(/import "\.\.\/app\/[^"]+\.css";/g)].map((match) => match[0]);

  assert.equal(globalImports.length, 8);
  assert.ok(globalImports.some((entry) => entry.includes("app-workspace.css")));
  assert.ok(globalImports.every((entry) => !entry.includes("connector.css")));
  assert.ok(globalImports.every((entry) => !entry.includes("ui-containment.css")));
});

test("root containment is part of the actual global reset", () => {
  const globals = read("app/globals.css");
  const retired = path.join(frontendRoot, "app/ui-containment.css");

  assert.equal(fs.existsSync(retired), false, "retired ui-containment.css must not return");
  assert.match(globals, /--sf-page-max:\s*88rem/);
  assert.match(globals, /scrollbar-color:\s*rgba\(155, 130, 72, 0\.72\) transparent/);
  assert.match(globals, /@media \(max-width: 52rem\)[\s\S]*--sf-page-gutter:\s*clamp\(1rem, 5vw, 2rem\)/);
});
