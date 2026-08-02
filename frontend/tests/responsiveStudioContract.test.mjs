import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relativePath) =>
  readFile(new URL(relativePath, import.meta.url), "utf8");

test("Root layout loads the scoped responsive Studio contract last", async () => {
  const layout = await read("../app/layout.js");

  assert.match(layout, /import "\.\.\/app\/responsive-studio\.css";/);

  const studioImport = layout.indexOf('import "../app/studio-product.css";');
  const responsiveImport = layout.indexOf('import "../app/responsive-studio.css";');

  assert.ok(studioImport >= 0, "Studio stylesheet import must remain present");
  assert.ok(
    responsiveImport > studioImport,
    "Responsive contract must load after the primary Studio stylesheet",
  );
});

test("Responsive rules remain scoped to the application and preserve the logo", async () => {
  const css = await read("../app/responsive-studio.css");

  assert.match(css, /\.app-shell \{/);
  assert.match(css, /overflow-x: clip;/);
  assert.match(css, /\.app-shell \.studio-main/);
  assert.match(css, /\.app-shell \.source-truth-grid/);
  assert.match(css, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
  assert.match(css, /@media \(max-width: 52rem\)/);
  assert.match(css, /@media \(max-width: 37rem\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);

  assert.doesNotMatch(css, /\.brand-mark__glyph\s*span\s*\{/);
  assert.doesNotMatch(css, /\.brand-mark__copy\s*strong\s*\{/);
  assert.doesNotMatch(css, /background-image\s*:/);
});

test("Compact layouts collapse grids and keep actions reachable", async () => {
  const css = await read("../app/responsive-studio.css");

  assert.match(
    css,
    /\.app-shell \.source-grid,[\s\S]*?\.app-shell \.source-truth-grid,[\s\S]*?grid-template-columns: minmax\(0, 1fr\);/,
  );
  assert.match(
    css,
    /\.app-shell \.review-actions,[\s\S]*?display: grid;[\s\S]*?grid-template-columns: minmax\(0, 1fr\);/,
  );
  assert.match(css, /\.app-shell \.app-nav[\s\S]*?overflow-x: auto;/);
  assert.match(css, /max-width: calc\(100vw - 1rem\);/);
});
