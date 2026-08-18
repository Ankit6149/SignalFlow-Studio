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
const shellStyles = read("components/WorkspaceShell.module.css");
const globals = read("app/globals.css");
const publicSurfaces = read("app/public-surfaces.css");
const containment = read("app/ui-containment.css");
const layout = read("app/layout.js");
const openGraphImage = read("app/opengraph-image.js");
const manifest = read("public/manifest.webmanifest");
const structuredDataText = read("public/schema.jsonld");
const structuredData = JSON.parse(structuredDataText);

test("the landing route has one component owner and uses the shared BrandMark", () => {
  assert.match(page, /import LandingPage from "\.\.\/components\/LandingPage";/);
  assert.doesNotMatch(page, /function LandingPage\(\{ onEnter \}\)/);
  assert.match(page, /<LandingPage onEnter=\{enterStudio\}/);
  assert.match(landing, /import BrandMark from "\.\/BrandMark"/);
  assert.match(landing, /export default function LandingPage\(\{ onEnter \}\)/);
  assert.match(landing, /<BrandMark tone="light" \/>/);
  assert.match(landing, /<BrandMark tone="dark" \/>/);
  assert.doesNotMatch(landing, /function SignalFlowLogo|logoMark|logoCopy|brand-mark__glyph/);
  assert.doesNotMatch(styles, /logoMark|logoCopy|brand-mark/);
});

test("the landing leads with the real owner Golden Path rather than future automation", () => {
  for (const anchor of ["main-content", "works-now", "how-it-flows", "trust", "final-title"]) {
    assert.ok(landing.includes(anchor), `missing landing anchor: ${anchor}`);
  }
  assert.match(landing, /Stay in the work/);
  assert.match(landing, /Let the story find you/);
  assert.match(landing, /Owner Golden Path is live through exact approval/);
  assert.match(landing, /manual ContentSignals → persisted opportunities and angles/);
  assert.match(landing, /evidence\/authenticity checks → exact revision approve\/reject/);
  assert.match(landing, /SignalFlow&apos;s job is everything between the work and your judgment/);
  assert.doesNotMatch(landing, /Turn one product story into a campaign built for every channel|Create your posting package/);
});

test("current and future claims remain intentionally distinct", () => {
  assert.match(landing, /Working now:/);
  assert.match(landing, /browser-local recovery/i);
  assert.match(landing, /real configured AI generation/i);
  assert.match(landing, /Editable destination-specific drafts \+ export/i);
  assert.match(landing, /browser-local NarrativeMemory \+ explainable StyleMemory/);
  assert.match(landing, /Automatic connected-source detection, durable publishing, cross-device memory sync and media production remain product direction/);
  assert.match(landing, /WHAT COMES AFTER THE CORE LOOP/);
  assert.match(landing, /direction—not claims about what is already shipped/);
  assert.match(landing, /Cross-device memory \+ confirmed-public history/);
  assert.match(landing, /Private Hybrid/);
  assert.match(landing, /Local Only/);
});

test("landing and workspace use the same paper night and gold design tokens", () => {
  for (const token of ["#f5f0e5", "#11120f", "#d3b874", "#ead9a8"]) {
    assert.ok(styles.includes(token), `landing missing shared token ${token}`);
    assert.ok(shellStyles.includes(token), `workspace shell missing shared token ${token}`);
  }
  assert.doesNotMatch(styles, /#d9f36a|#a9a1ff/i);
});

test("public discovery metadata matches the content operating system positioning", () => {
  const manifestData = JSON.parse(manifest);
  const serializedSchema = JSON.stringify(structuredData);
  const retiredPositioning = /One Brief, Every Channel|ONE BRIEF · EVERY CHANNEL|twelve editable destinations|complete review-ready campaign/i;
  assert.match(layout, /SignalFlow Studio — Content Operating System/);
  assert.match(layout, /approval-first content operating system in progress/i);
  assert.match(openGraphImage, /CONTENT OS · IN PROGRESS/);
  assert.match(manifestData.description, /approval-first content operating system in progress/i);
  assert.match(serializedSchema, /content operating system in progress/i);
  for (const surface of [layout, openGraphImage, manifest, structuredDataText]) assert.doesNotMatch(surface, retiredPositioning);
});

test("the landing design is scoped and avoids the retired global cascade", () => {
  assert.doesNotMatch(globals, /\.landing-shell|\.landing-hero|\.landing-nav|\.landing-editorial/);
  assert.doesNotMatch(publicSurfaces, /\.landing-shell|\.landing-hero|\.landing-nav|\.channel-showcase|\.landing-faq/);
  assert.doesNotMatch(containment, /\.landing-shell|\.landing-hero|\.channel-showcase|\.landing-faq/);
  assert.doesNotMatch(styles, /\.app-shell|\.studio-page|\.secondary-page/);
  assert.match(styles, /\.hero\s*\{/);
  assert.match(styles, /\.currentSection\s*[,\{]/);
  assert.match(styles, /\.flowSection\s*[,\{]/);
  assert.match(styles, /\.directionSection\s*[,\{]/);
  assert.match(styles, /\.trustSection\s*[,\{]/);
});

test("the landing protects responsive zoom-safe focus and reduced-motion behavior", () => {
  assert.match(styles, /@media \(max-width: 1100px\)/);
  assert.match(styles, /@media \(max-width: 900px\)/);
  assert.match(styles, /@media \(max-width: 640px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /overflow-x:\s*clip/);
  assert.match(styles, /grid-template-columns:\s*1fr/);
});
