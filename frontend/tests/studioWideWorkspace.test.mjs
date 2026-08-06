import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const page = await readFile(path.join(root, "app", "page.js"), "utf8");
const responsiveCss = await readFile(path.join(root, "app", "responsive-studio.css"), "utf8");

test("all three Studio stages use one wide desktop workspace instead of a split hidden grid", () => {
  assert.match(
    responsiveCss,
    /\.app-shell \.studio-page,\s*\.app-shell \.studio-page\[data-stage="source"\],\s*\.app-shell \.studio-page\[data-stage="destinations"\],\s*\.app-shell \.studio-page\[data-stage="review"\][\s\S]*?width:\s*min\(112rem,/,
  );
  assert.match(
    responsiveCss,
    /\.app-shell \.studio-grid:not\(\.studio-grid--review\)\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\);/,
  );
});

test("destination selection and review receive intentional wide-screen columns", () => {
  assert.match(
    responsiveCss,
    /data-stage="destinations"\] \.output-panel[\s\S]*?grid-template-columns:\s*minmax\(0, 1\.75fr\) minmax\(22rem, 0\.72fr\)/,
  );
  assert.match(
    responsiveCss,
    /data-stage="destinations"\] \.channel-picker\s*\{\s*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\);/,
  );
  assert.match(
    responsiveCss,
    /data-stage="review"\] \.review-workspace[\s\S]*?grid-template-columns:\s*11rem minmax\(0, 1\.6fr\) minmax\(19rem, 0\.75fr\)[\s\S]*?"tabs editor inspector"/,
  );
});

test("Source supports clipboard images and drag-drop without intercepting ordinary text paste", () => {
  assert.match(page, /extractClipboardImageFiles/);
  assert.match(page, /function handleSourcePaste\(event\)/);
  assert.match(page, /if \(!images\.length\) return;\s*event\.preventDefault\(\);/);
  assert.match(page, /onPaste=\{stage === "source" \? handleSourcePaste : undefined\}/);
  assert.match(page, /onDrop=\{handleSourceDrop\}/);
  assert.match(page, /Drop, browse, or paste source files/);
  assert.match(page, /Paste screenshots with Ctrl\+V or ⌘V/);
});
