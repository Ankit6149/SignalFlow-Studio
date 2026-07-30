import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workspaceUrl = new URL("../app/app-workspace.css", import.meta.url);

test("the Studio shell shares the expanded workspace frame", async () => {
  const css = await readFile(workspaceUrl, "utf8");
  assert.match(css, /--app-shell-max:\s*88rem/);
  assert.match(css, /calc\(\(100vw - var\(--app-shell-max\)\) \/ 2\)/);
  assert.match(css, /grid-template-columns:\s*minmax\(11rem, 1fr\) minmax\(22rem, auto\) minmax\(11rem, 1fr\)/);
});

test("responsive header offsets follow the real two-row height", async () => {
  const css = await readFile(workspaceUrl, "utf8");
  assert.match(css, /--app-header-mobile:\s*7\.25rem/);
  assert.match(css, /@media \(max-width: 52rem\)[\s\S]*--app-header:\s*var\(--app-header-mobile\)/);
  assert.match(css, /\.app-shell \.toast \{[\s\S]*top:\s*calc\(var\(--app-header\) \+ 1rem\)/);
  assert.match(css, /scroll-margin-top:\s*calc\(var\(--app-header\) \+ 1\.5rem\)/);
});

test("narrow navigation remains contained and keyboard visible", async () => {
  const css = await readFile(workspaceUrl, "utf8");
  assert.match(css, /\.brand-button:focus-visible,[\s\S]*\.app-nav button:focus-visible/);
  assert.match(css, /@media \(max-width: 52rem\)[\s\S]*overflow-x:\s*auto/);
  assert.match(css, /scroll-snap-type:\s*inline proximity/);
  assert.match(css, /\.app-header__status > span:last-child[\s\S]*text-overflow:\s*ellipsis/);
});
