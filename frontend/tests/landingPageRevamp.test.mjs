import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const frontend = path.resolve(here, "..");
const read = (relativePath) => fs.readFileSync(path.join(frontend, relativePath), "utf8");

const page = read("app/page.js");
const landing = read("components/LandingPage.js");
const styles = read("components/LandingPage.module.css");
const globals = read("app/globals.css");
const publicSurfaces = read("app/public-surfaces.css");
const containment = read("app/ui-containment.css");

test("the landing route has one component owner and preserves the existing BrandMark", () => {
  assert.match(page, /import LandingPage from "\.\.\/components\/LandingPage";/);
  assert.doesNotMatch(page, /function LandingPage\(\{ onEnter \}\)/);
  assert.match(page, /<LandingPage onEnter=\{enterStudio\} brand=\{<BrandMark \/>\} \/>/);
  assert.match(page, /function BrandMark\(\{ compact = false, dark = false \}\)/);
  assert.match(page, /className=\{`brand-mark/);
  assert.match(globals, /\.brand-mark__glyph/);
  assert.match(globals, /\.brand-mark__copy/);
  assert.match(landing, /export default function LandingPage\(\{ onEnter, brand \}\)/);
  assert.match(landing, /\{brand\}/);
  assert.doesNotMatch(landing, /function SignalFlowLogo|logoMark|logoCopy|brand-mark__glyph/);
  assert.doesNotMatch(styles, /logoMark|logoCopy|brand-mark/);
});

test("the landing page exposes the complete public product narrative", () => {
  for (const anchor of ["main-content", "workflow", "destinations", "trust", "final-cta-title"]) {
    assert.ok(landing.includes(anchor), `missing landing anchor: ${anchor}`);
  }
  assert.match(landing, /Turn one product story into a campaign built for every channel/);
  assert.match(landing, /Review before anything leaves/);
  assert.match(landing, /Temporary provider keys are excluded from campaign persistence/);
  assert.match(landing, /Publish only after confirmation/);
  assert.equal((landing.match(/type: "/g) || []).length, 12);
  assert.doesNotMatch(landing, /creator-working\.png|offline templates|100% Client-Side Keys/);
});

test("the landing design is scoped and removes the retired global cascade", () => {
  assert.doesNotMatch(globals, /\.landing-shell|\.landing-hero|\.landing-nav|\.landing-editorial/);
  assert.doesNotMatch(publicSurfaces, /\.landing-shell|\.landing-hero|\.landing-nav|\.channel-showcase|\.landing-faq/);
  assert.doesNotMatch(containment, /\.landing-shell|\.landing-hero|\.channel-showcase|\.landing-faq/);
  assert.doesNotMatch(styles, /\.app-shell|\.studio-page|\.secondary-page/);
  assert.match(styles, /\.hero\s*\{/);
  assert.doesNotMatch(styles, /\.hero\s*\{[^}]*min-height:\s*(100vh|100dvh)/s);
});

test("the landing page protects responsive, zoom-safe, focus, and reduced-motion behavior", () => {
  assert.match(styles, /@media \(max-width: 72rem\)/);
  assert.match(styles, /@media \(max-width: 52rem\)/);
  assert.match(styles, /@media \(max-width: 37rem\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /overflow:\s*hidden/);
  assert.match(styles, /grid-template-columns:\s*minmax\(0, 1fr\)/);
});
