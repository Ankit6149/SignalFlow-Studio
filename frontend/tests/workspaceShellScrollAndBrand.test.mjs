import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(testDir, "..");
const read = (relative) => fs.readFileSync(path.join(frontendRoot, relative), "utf8");

test("desktop workspace has one intentional content scroll surface", () => {
  const css = read("components/WorkspaceShell.module.css");
  assert.match(css, /\.shell\s*\{[\s\S]*height:\s*100dvh;[\s\S]*overflow:\s*hidden;/);
  assert.match(css, /\.workspaceCanvas\s*\{[\s\S]*height:\s*100dvh;[\s\S]*overflow-y:\s*auto;/);
  assert.match(css, /\.navigation\s*\{[\s\S]*overflow:\s*visible;/);
  assert.doesNotMatch(css, /\.navigation\s*\{[^}]*overflow-y:\s*auto;/);
});

test("rail scroll is reserved for short-height desktop and the mobile drawer", () => {
  const css = read("components/WorkspaceShell.module.css");
  assert.match(css, /@media \(max-height: 680px\) and \(min-width: 981px\)[\s\S]*\.rail\s*\{[\s\S]*overflow-y:\s*auto;/);
  assert.match(css, /@media \(max-width: 980px\)[\s\S]*\.rail\s*\{[\s\S]*overflow-y:\s*auto;/);
});

test("workspace branding uses the shared SignalFlow brand component", () => {
  const shell = read("components/WorkspaceShell.js");
  const brand = read("components/BrandMark.js");
  const brandCss = read("components/BrandMark.module.css");

  assert.match(shell, /import BrandMark from "\.\/BrandMark"/);
  assert.match(shell, /<BrandMark tone="light" \/>/);
  assert.doesNotMatch(shell, /function Brand\s*\(/);
  assert.match(brand, /<strong>SignalFlow<\/strong>/);
  assert.match(brand, /<small>STUDIO<\/small>/);
  assert.match(brandCss, /\.glyph\s*\{[\s\S]*width:\s*2rem;[\s\S]*height:\s*2rem;/);
  assert.match(brandCss, /\.glyph span:nth-child\(1\)\s*\{\s*width:\s*1\.75rem;/);
  assert.match(brandCss, /\.copy strong\s*\{[\s\S]*font-family:\s*"Manrope"/);
});

test("workspace shell exposes shared spacing primitives for later Studio and landing alignment", () => {
  const css = read("components/WorkspaceShell.module.css");
  for (const token of ["--sf-page-gutter", "--sf-page-gutter-wide", "--sf-section-gap", "--sf-content-max", "--sf-reading-max"]) {
    assert.match(css, new RegExp(token.replace(/[-]/g, "\\-")));
  }
});
