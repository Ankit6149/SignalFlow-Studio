import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(testDir, "..");
const read = (relative) => fs.readFileSync(path.join(frontendRoot, relative), "utf8");

test("desktop workspace keeps scrolling inside the workspace canvas", () => {
  const css = read("components/WorkspaceShell.module.css");
  assert.match(css, /\.shell\s*\{[\s\S]*height:\s*100dvh;[\s\S]*overflow:\s*hidden;/);
  assert.match(css, /\.mainColumn\s*\{[^}]*height:\s*100dvh;/);
  assert.match(css, /\.workspaceCanvas\s*\{[\s\S]*overflow:\s*auto;/);
  assert.match(css, /\.rail\s*\{[\s\S]*height:\s*100dvh;[\s\S]*overflow:\s*hidden;/);
});

test("mobile releases the desktop scroll lock and turns the rail into an off-canvas drawer", () => {
  const css = read("components/WorkspaceShell.module.css");
  assert.match(css, /@media \(max-width: 980px\)[\s\S]*\.shell\s*\{[^}]*height:\s*auto;[^}]*overflow:\s*visible;/);
  assert.match(css, /@media \(max-width: 980px\)[\s\S]*\.workspaceCanvas\s*\{\s*overflow:\s*visible;/);
  assert.match(css, /@media \(max-width: 980px\)[\s\S]*\.rail\s*\{[\s\S]*position:\s*fixed;[\s\S]*transform:\s*translateX\(-105%\)/);
  assert.match(css, /\.railOpen\s*\{\s*transform:\s*none;/);
});

test("workspace branding uses the shared SignalFlow brand component", () => {
  const shell = read("components/WorkspaceShell.js");
  const brand = read("components/BrandMark.js");
  const brandCss = read("components/BrandMark.module.css");

  assert.match(shell, /import BrandMark from "\.\/BrandMark"/);
  assert.match(shell, /<BrandMark tone="dark" \/>/);
  assert.doesNotMatch(shell, /function Brand\s*\(/);
  assert.match(brand, /src="\/icon\.svg"/);
  assert.match(brand, /<strong>SignalFlow<\/strong>/);
  assert.match(brand, /<small>STUDIO<\/small>/);
  assert.match(brandCss, /\.glyph\{[^}]*width:2\.15rem;[^}]*height:2\.15rem;/);
  assert.match(brandCss, /\.copy strong\{[^}]*font-family:"Manrope"/);
});

test("workspace shell preserves the shared content-flow and focus primitives", () => {
  const shell = read("components/WorkspaceShell.js");
  const css = read("components/WorkspaceShell.module.css");
  assert.match(shell, /aria-label="SignalFlow content flow"/);
  assert.match(shell, /href="#workspace-content"/);
  assert.match(css, /\.flowSteps\s*\{[^}]*grid-template-columns:\s*repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(css, /\.shell button:focus-visible, \.shell a:focus-visible/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
