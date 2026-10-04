import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relativePath) =>
  readFile(new URL(relativePath, import.meta.url), "utf8");

test("Root layout keeps Studio responsiveness in the product owner before decision flow", async () => {
  const layout = await read("../app/layout.js");

  const studioImport = layout.indexOf('import "../app/studio-product.css";');
  const decisionImport = layout.indexOf('import "../app/studio-decision-flow.css";');

  assert.doesNotMatch(layout, /responsive-studio\.css/);
  assert.ok(studioImport >= 0, "Studio stylesheet import must remain present");
  assert.ok(
    decisionImport > studioImport,
    "Decision-flow authority must remain later than Studio product styles",
  );
});

test("Responsive rules remain scoped to the application and preserve the logo", async () => {
  const [css, workspace] = await Promise.all([
    read("../app/studio-product.css"),
    read("../app/app-workspace.css"),
  ]);

  assert.match(workspace, /Shared workspace containment authority/);
  assert.match(workspace, /\.app-shell \{/);
  assert.match(workspace, /overflow-x: clip;/);
  assert.match(workspace, /\.app-shell \.studio-main/);
  assert.match(workspace, /\.app-shell \.source-truth-grid/);
  assert.match(workspace, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
  assert.match(workspace, /Shared horizontal-overflow and action-resilience authority/);
  assert.doesNotMatch(css, /\.app-shell \.studio-main/);
  assert.match(css, /Responsive Studio composition authority/);
  assert.match(css, /@media \(max-width: 52rem\)/);
  assert.match(css, /@media \(max-width: 37rem\)/);
  assert.match(workspace, /@media \(prefers-reduced-motion: reduce\)/);

  assert.doesNotMatch(css, /\.brand-mark__glyph\s*span\s*\{/);
  assert.doesNotMatch(css, /\.brand-mark__copy\s*strong\s*\{/);
  assert.doesNotMatch(css, /background-image\s*:/);
  assert.doesNotMatch(css, /\.app-shell \.app-header\s*\{/);
  assert.doesNotMatch(css, /\.app-shell \.app-nav\s*\{/);
  assert.match(workspace, /\/\* Responsive application chrome authority\./);
  assert.match(workspace, /@media \(max-width: 72rem\)[\s\S]*\.app-shell \.app-header/);
  assert.match(workspace, /@media \(max-width: 52rem\)[\s\S]*\.app-shell \.app-nav/);
  assert.match(workspace, /@media \(max-width: 37rem\)[\s\S]*\.app-shell \.brand-mark__copy small/);
});

test("Compact layouts collapse grids and keep actions reachable", async () => {
  const css = await read("../app/studio-product.css");

  assert.match(
    css,
    /\.app-shell \.source-grid,[\s\S]*?\.app-shell \.source-truth-grid,[\s\S]*?grid-template-columns: minmax\(0, 1fr\);/,
  );
  assert.match(
    css,
    /\.app-shell \.review-actions,[\s\S]*?display: grid;[\s\S]*?grid-template-columns: minmax\(0, 1fr\);/,
  );
  const workspace = await read("../app/app-workspace.css");
  assert.match(workspace, /\.app-shell \.app-nav[\s\S]*?overflow-x: auto;/);
  assert.match(workspace, /Responsive secondary-workspace authority/);
  assert.match(workspace, /@media \(max-width: 72rem\)[\s\S]*\.app-shell \.library-grid/);
  assert.match(workspace, /@media \(max-width: 52rem\)[\s\S]*\.app-shell \.settings-form/);
  assert.match(workspace, /Responsive secondary page-frame authority/);
  assert.doesNotMatch(css, /\.app-shell \.secondary-page/);
  assert.doesNotMatch(css, /\.app-shell \.secondary-heading/);
  assert.match(css, /max-width: calc\(100vw - 1rem\);/);
});
