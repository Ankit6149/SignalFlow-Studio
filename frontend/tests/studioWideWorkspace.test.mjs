import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const workspaceComponent = await readFile(
  path.join(root, "components", "WorkspaceAccessibility.js"),
  "utf8",
);

test("all three Studio stages use one wide desktop workspace instead of a split hidden grid", () => {
  assert.match(
    workspaceComponent,
    /\.app-shell \.studio-page,\s*\.app-shell \.studio-page\[data-stage="source"\],\s*\.app-shell \.studio-page\[data-stage="destinations"\],\s*\.app-shell \.studio-page\[data-stage="review"\][\s\S]*?width:\s*min\(112rem,/,
  );
  assert.match(
    workspaceComponent,
    /\.app-shell \.studio-grid:not\(\.studio-grid--review\)\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\);/,
  );
});

test("source, destination selection, and review receive intentional wide-screen columns", () => {
  assert.match(
    workspaceComponent,
    /data-stage="source"\] \.composer-panel[\s\S]*?grid-template-columns:\s*minmax\(0, 1\.7fr\) minmax\(22rem, 0\.8fr\)/,
  );
  assert.match(
    workspaceComponent,
    /data-stage="destinations"\] \.output-panel[\s\S]*?grid-template-columns:\s*minmax\(0, 1\.75fr\) minmax\(22rem, 0\.72fr\)/,
  );
  assert.match(
    workspaceComponent,
    /data-stage="destinations"\] \.channel-picker\s*\{\s*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\);/,
  );
  assert.match(
    workspaceComponent,
    /data-stage="review"\] \.review-workspace[\s\S]*?grid-template-columns:\s*11rem minmax\(0, 1\.6fr\) minmax\(19rem, 0\.75fr\)[\s\S]*?"tabs editor inspector"/,
  );
});

test("Source bridges pasted images and dropped files into the existing hidden file input", () => {
  assert.match(workspaceComponent, /extractClipboardImageFiles/);
  assert.match(workspaceComponent, /function dispatchFilesToUpload\(input, files\)/);
  assert.match(workspaceComponent, /const transfer = new DataTransfer\(\)/);
  assert.match(workspaceComponent, /input\.files = transfer\.files/);
  assert.match(workspaceComponent, /input\.dispatchEvent\(new Event\("change", \{ bubbles: true \}\)\)/);
  assert.match(workspaceComponent, /function handleDocumentPaste\(event\)/);
  assert.match(
    workspaceComponent,
    /const images = extractClipboardImageFiles\(event\.clipboardData\);\s*if \(!images\.length\) return;[\s\S]*?if \(!dispatchFilesToUpload\(input, images\)\) return;\s*event\.preventDefault\(\);/,
  );
  assert.match(workspaceComponent, /upload\.addEventListener\("dragover", handlers\.dragover\)/);
  assert.match(workspaceComponent, /upload\.addEventListener\("drop", handlers\.drop\)/);
});

test("upload guidance makes browse, drop, and clipboard image support explicit", () => {
  assert.match(workspaceComponent, /Drop, browse, or paste source files/);
  assert.match(workspaceComponent, /Paste screenshots with Ctrl\+V or ⌘V/);
  assert.match(workspaceComponent, /Browse files/);
  assert.match(
    workspaceComponent,
    /Add source files by browsing, dropping files, or pasting screenshots from the clipboard/,
  );
});
