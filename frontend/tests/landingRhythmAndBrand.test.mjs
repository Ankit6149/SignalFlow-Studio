import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(testDir, "..");
const read = (relative) => fs.readFileSync(path.join(frontendRoot, relative), "utf8");

test("landing polish leaves the approved hero outside the rhythm override layer", () => {
  const landing = read("components/LandingPage.js");
  const rhythm = read("components/LandingRhythm.module.css");

  assert.match(landing, /<section className=\{styles\.hero\} aria-labelledby="landing-title">/);
  assert.doesNotMatch(landing, /className=\{`\$\{styles\.hero\} \$\{rhythm\./);
  assert.doesNotMatch(rhythm, /\.hero(?:\b|[.:#\[])/);
  assert.doesNotMatch(rhythm, /\.heroScene(?:\b|[.:#\[])/);
  assert.doesNotMatch(rhythm, /\.heroCopy(?:\b|[.:#\[])/);
});

test("landing header and footer use the same shared SignalFlow brand component as WorkspaceShell", () => {
  const landing = read("components/LandingPage.js");
  const shell = read("components/WorkspaceShell.js");

  assert.match(landing, /import BrandMark from "\.\/BrandMark"/);
  assert.match(landing, /<BrandMark tone="light" \/>/);
  assert.match(landing, /<BrandMark tone="dark" \/>/);
  assert.match(shell, /import BrandMark from "\.\/BrandMark"/);
  assert.doesNotMatch(landing, /\{brand\}/);
});

test("post-hero sections share a wider editorial rhythm without chunky full-width cards", () => {
  const landing = read("components/LandingPage.js");
  const rhythm = read("components/LandingRhythm.module.css");

  for (const className of ["current", "flow", "direction", "trust", "final"]) {
    assert.match(landing, new RegExp(`rhythm\\.${className}`));
  }
  assert.match(rhythm, /calc\(\(100% - 86rem\) \/ 2\)/);
  assert.match(rhythm, /padding-block:\s*clamp\(6\.5rem, 10vw, 9\.5rem\)/);
  assert.match(rhythm, /\.liveProof\.liveProof[\s\S]*background:\s*rgba\(255, 253, 248, 0\.42\)/);
  assert.match(rhythm, /\.futureList\.futureList[\s\S]*background:\s*rgba\(255, 253, 248, 0\.5\)/);
});

test("landing rhythm collapses intentionally for tablet and mobile", () => {
  const rhythm = read("components/LandingRhythm.module.css");
  assert.match(rhythm, /@media \(max-width: 980px\)/);
  assert.match(rhythm, /@media \(max-width: 640px\)/);
  assert.match(rhythm, /@media \(max-width: 980px\)[\s\S]*\.currentComposition\.currentComposition[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(rhythm, /@media \(max-width: 640px\)[\s\S]*\.liveProof\.liveProof[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(rhythm, /@media \(max-width: 640px\)[\s\S]*\.trustRows\.trustRows article p[\s\S]*grid-column:\s*2/);
});
