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
const layout = read("app/layout.js");
const openGraphImage = read("app/opengraph-image.js");
const manifest = read("public/manifest.webmanifest");
const structuredDataText = read("public/schema.jsonld");
const structuredData = JSON.parse(structuredDataText);

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

test("the landing page separates current product truth from the judgment-first product direction", () => {
  for (const anchor of ["main-content", "works-now", "how-it-flows", "trust", "final-title"]) {
    assert.ok(landing.includes(anchor), `missing landing anchor: ${anchor}`);
  }

  assert.match(landing, /Stay in the work/);
  assert.match(landing, /Let the story find you/);
  assert.match(landing, /The first Signal layer is live/);
  assert.match(landing, /Two honest ways to use SignalFlow today/);
  assert.match(landing, /THE PERMANENT PRODUCT SHAPE/);
  assert.match(landing, /Opportunity intelligence · building next/);
  assert.match(landing, /SignalFlow&apos;s job is everything between the work and your judgment/);

  assert.doesNotMatch(landing, /Turn one product story into a campaign built for every channel/);
  assert.doesNotMatch(landing, /Create your posting package/);
  assert.doesNotMatch(landing, /creator-working\.png|offline templates|100% Client-Side Keys/);
});

test("the landing page keeps current and future claims intentionally distinct", () => {
  assert.match(landing, /Real today:/);
  assert.match(landing, /manual ContentSignals/);
  assert.match(landing, /browser-local recovery/);
  assert.match(landing, /real configured AI generation/);
  assert.match(landing, /editable destination drafts/);
  assert.match(landing, /export/);

  assert.match(landing, /Automatic signal detection and opportunity intelligence are still being built/);
  assert.match(landing, /MEDIA INTELLIGENCE · PRODUCT DIRECTION/);
  assert.match(landing, /BUILDING/);
  assert.match(landing, /Target processing modes/);
  assert.match(landing, /Private Hybrid/);
  assert.match(landing, /Local Only/);
});

test("public discovery metadata matches the content operating system positioning", () => {
  const manifestData = JSON.parse(manifest);
  const serializedSchema = JSON.stringify(structuredData);
  const retiredPositioning = /One Brief, Every Channel|ONE BRIEF · EVERY CHANNEL|twelve editable destinations|complete review-ready campaign/i;

  assert.match(layout, /SignalFlow Studio — Content Operating System/);
  assert.match(layout, /approval-first content operating system in progress/i);
  assert.match(layout, /broader content operating system direction/i);
  assert.match(openGraphImage, /CONTENT OS · IN PROGRESS/);
  assert.match(openGraphImage, /Your work should not become a second content job/);
  assert.match(manifestData.description, /approval-first content operating system in progress/i);
  assert.match(serializedSchema, /content operating system in progress/i);
  assert.match(serializedSchema, /real model provider route/i);
  assert.match(serializedSchema, /versioned campaign records/i);
  assert.match(serializedSchema, /as those capabilities are implemented/i);

  for (const surface of [layout, openGraphImage, manifest, structuredDataText]) {
    assert.doesNotMatch(surface, retiredPositioning);
  }
});

test("structured metadata lists shipped foundation separately from future direction", () => {
  const software = structuredData["@graph"].find((entry) => Array.isArray(entry["@type"]) && entry["@type"].includes("SoftwareApplication"));
  assert.ok(software, "SoftwareApplication structured data is required");
  assert.match(software.description, /The current SignalFlow Studio/);
  assert.match(software.description, /broader content operating system direction/i);
  assert.ok(software.featureList.every((feature) => !/automatic signal|opportunity ranking|automatic media|narrative memory/i.test(feature)));
  assert.ok(software.featureList.some((feature) => /manual source context/i.test(feature)));
  assert.ok(software.featureList.some((feature) => /approval and confirmed success/i.test(feature)));
});

test("the landing design is scoped and removes the retired global cascade", () => {
  assert.doesNotMatch(globals, /\.landing-shell|\.landing-hero|\.landing-nav|\.landing-editorial/);
  assert.doesNotMatch(publicSurfaces, /\.landing-shell|\.landing-hero|\.landing-nav|\.channel-showcase|\.landing-faq/);
  assert.doesNotMatch(containment, /\.landing-shell|\.landing-hero|\.channel-showcase|\.landing-faq/);
  assert.doesNotMatch(styles, /\.app-shell|\.studio-page|\.secondary-page/);
  assert.match(styles, /\.hero\s*\{/);
  assert.match(styles, /\.currentSection\s*[,\{]/);
  assert.match(styles, /\.flowSection\s*\{/);
  assert.match(styles, /\.mediaSection\s*[,\{]/);
  assert.match(styles, /\.trustSection\s*\{/);
});

test("the landing page protects responsive, zoom-safe, focus, and reduced-motion behavior", () => {
  assert.match(styles, /@media \(max-width: 1100px\)/);
  assert.match(styles, /@media \(max-width: 900px\)/);
  assert.match(styles, /@media \(max-width: 640px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /overflow-x:\s*clip/);
  assert.match(styles, /grid-template-columns:\s*1fr/);
});
