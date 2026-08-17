import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const accessibilityComponent = await readFile(
  path.join(root, "components", "WorkspaceAccessibility.js"),
  "utf8",
);
const decisionLayout = await readFile(
  path.join(root, "app", "studio-decision-flow.css"),
  "utf8",
);
const layout = await readFile(
  path.join(root, "app", "layout.js"),
  "utf8",
);

test("Studio stage composition is static CSS, not runtime accessibility injection", () => {
  assert.match(layout, /import "\.\.\/app\/studio-decision-flow\.css"/);
  assert.match(decisionLayout, /Final Studio stage layout authority/);
  assert.doesNotMatch(accessibilityComponent, /WIDE_STUDIO_STYLES/);
  assert.doesNotMatch(accessibilityComponent, /return <style>/);
  assert.match(accessibilityComponent, /return null;/);
});

test("all three Studio stages share shell spacing primitives and avoid forced hidden split grids", () => {
  assert.match(
    decisionLayout,
    /\.app-shell \.studio-page,[\s\S]*width:\s*min\(var\(--sf-content-max, 88rem\),/,
  );
  assert.match(
    decisionLayout,
    /\.app-shell \.studio-grid,[\s\S]*\.studio-grid:not\(\.studio-grid--review\)[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\)/,
  );
});

test("Source only adopts a second column when the viewport genuinely has room", () => {
  assert.match(
    decisionLayout,
    /data-stage="source"\] \.composer-panel[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\);[\s\S]*grid-template-areas:[\s\S]*"header"[\s\S]*"identity"[\s\S]*"brief"[\s\S]*"evidence"/,
  );
  assert.match(
    decisionLayout,
    /@media \(min-width: 84rem\)[\s\S]*data-stage="source"\] \.composer-panel[\s\S]*grid-template-columns:\s*minmax\(0, 1\.58fr\) minmax\(21rem, 0\.72fr\)/,
  );
});

test("Destinations owns the canvas and model routing no longer permanently squeezes channels", () => {
  assert.match(
    decisionLayout,
    /data-stage="destinations"\] \.output-panel[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\)/,
  );
  assert.match(
    decisionLayout,
    /data-stage="destinations"\] \.model-route-panel[\s\S]*position:\s*static[\s\S]*width:\s*min\(100%, 58rem\)/,
  );
  assert.match(
    decisionLayout,
    /@media \(min-width: 82rem\)[\s\S]*data-stage="destinations"\] \.channel-picker[\s\S]*repeat\(3, minmax\(0, 1fr\)\)/,
  );
});

test("Review prioritizes horizontal destination choice and the exact draft over a three-column cockpit", () => {
  assert.match(
    decisionLayout,
    /data-stage="review"\] \.review-workspace[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\)[\s\S]*"tabs"[\s\S]*"editor"[\s\S]*"inspector"[\s\S]*"actions"/,
  );
  assert.match(
    decisionLayout,
    /data-stage="review"\] \.review-tabs[\s\S]*position:\s*static[\s\S]*display:\s*flex[\s\S]*overflow-x:\s*auto/,
  );
  assert.match(
    decisionLayout,
    /@media \(min-width: 86rem\)[\s\S]*grid-template-columns:\s*minmax\(0, 1\.65fr\) minmax\(19rem, 0\.62fr\)/,
  );
  assert.doesNotMatch(decisionLayout, /grid-template-columns:\s*11rem minmax\(0, 1\.6fr\) minmax\(19rem, 0\.75fr\)/);
});

test("Source bridges pasted images and dropped files into the existing hidden file input", () => {
  assert.match(accessibilityComponent, /extractClipboardImageFiles/);
  assert.match(accessibilityComponent, /function dispatchFilesToUpload\(input, files\)/);
  assert.match(accessibilityComponent, /const transfer = new DataTransfer\(\)/);
  assert.match(accessibilityComponent, /input\.files = transfer\.files/);
  assert.match(accessibilityComponent, /input\.dispatchEvent\(new Event\("change", \{ bubbles: true \}\)\)/);
  assert.match(accessibilityComponent, /function handleDocumentPaste\(event\)/);
  assert.match(
    accessibilityComponent,
    /const images = extractClipboardImageFiles\(event\.clipboardData\);\s*if \(!images\.length\) return;[\s\S]*?if \(!dispatchFilesToUpload\(input, images\)\) return;\s*event\.preventDefault\(\);/,
  );
  assert.match(accessibilityComponent, /upload\.addEventListener\("dragover", handlers\.dragover\)/);
  assert.match(accessibilityComponent, /upload\.addEventListener\("drop", handlers\.drop\)/);
});

test("upload guidance makes browse, drop, and clipboard image support explicit", () => {
  assert.match(accessibilityComponent, /Drop, browse, or paste source files/);
  assert.match(accessibilityComponent, /Paste screenshots with Ctrl\+V or ⌘V/);
  assert.match(accessibilityComponent, /Browse files/);
  assert.match(
    accessibilityComponent,
    /Add source files by browsing, dropping files, or pasting screenshots from the clipboard/,
  );
});
