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

test("the landing page separates current product truth from the content operating system direction", () => {
  for (const anchor of ["main-content", "now", "direction", "trust", "final-cta-title"]) {
    assert.ok(landing.includes(anchor), `missing landing anchor: ${anchor}`);
  }

  assert.match(landing, /Your work should not become a second content job/);
  assert.match(landing, /Open the current Studio/);
  assert.match(landing, /AVAILABLE TODAY/);
  assert.match(landing, /CURRENT FOUNDATION/);
  assert.match(landing, /PRODUCT DIRECTION/);
  assert.match(landing, /Future workspace/);
  assert.match(landing, /Not presented as live functionality/);
  assert.match(landing, /Review before anything leaves/);
  assert.match(landing, /The user&apos;s job is judgment/);

  assert.doesNotMatch(landing, /Turn one product story into a campaign built for every channel/);
  assert.doesNotMatch(landing, /Create your posting package/);
  assert.doesNotMatch(landing, /creator-working\.png|offline templates|100% Client-Side Keys/);
});

test("the landing page keeps current and future claims intentionally distinct", () => {
  assert.match(landing, /Usable now:/);
  assert.match(landing, /real configured AI routes/);
  assert.match(landing, /local campaign recovery/);
  assert.match(landing, /save the campaign locally/);
  assert.match(landing, /export/);

  assert.match(landing, /PRODUCT DIRECTION · IN DEVELOPMENT/);
  assert.match(landing, /Future capability/);
  assert.match(landing, /Architecture direction; availability depends on implementation/);
  assert.match(landing, /Private Hybrid/);
  assert.match(landing, /Local Only/);
});

test("the landing design is scoped and removes the retired global cascade", () => {
  assert.doesNotMatch(globals, /\.landing-shell|\.landing-hero|\.landing-nav|\.landing-editorial/);
  assert.doesNotMatch(publicSurfaces, /\.landing-shell|\.landing-hero|\.landing-nav|\.channel-showcase|\.landing-faq/);
  assert.doesNotMatch(containment, /\.landing-shell|\.landing-hero|\.channel-showcase|\.landing-faq/);
  assert.doesNotMatch(styles, /\.app-shell|\.studio-page|\.secondary-page/);
  assert.match(styles, /\.hero\s*\{/);
  assert.match(styles, /\.directionSection\s*\{/);
  assert.match(styles, /\.mediaSection\s*\{/);
  assert.match(styles, /\.trustSection\s*\{/);
});

test("the landing page protects responsive, zoom-safe, focus, and reduced-motion behavior", () => {
  assert.match(styles, /@media \(max-width: 1120px\)/);
  assert.match(styles, /@media \(max-width: 860px\)/);
  assert.match(styles, /@media \(max-width: 560px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /overflow-x:\s*clip/);
  assert.match(styles, /grid-template-columns:\s*1fr/);
});
