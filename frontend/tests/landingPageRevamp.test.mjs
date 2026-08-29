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

test("the landing route has one component owner and uses the shared BrandMark", () => {
  assert.match(page, /import LandingPage from "\.\.\/components\/LandingPage";/);
  assert.match(page, /<LandingPage onEnter=\{enterStudio\}/);
  assert.match(landing, /import BrandMark from "\.\/BrandMark"/);
  assert.match(landing, /export default function LandingPage\(\)/);
  assert.match(landing, /<BrandMark tone="dark"/);
  assert.doesNotMatch(landing, /function SignalFlowLogo|logoMark|logoCopy|brand-mark__glyph/);
});

test("the landing explains the canonical work to judgment loop instead of a generic post generator", () => {
  assert.match(landing, /You do the work/);
  assert.match(landing, /SignalFlow finds what’s worth saying/);
  assert.match(landing, /Content should be a consequence of the work/);
  assert.match(landing, /NOT A POST GENERATOR/);
  assert.match(landing, /Automation everywhere except the judgment/);
  for (const stage of ["Capture", "Shape", "Create", "Review", "Publish"]) {
    assert.ok(landing.includes(`\"${stage}\"`), `missing canonical flow stage: ${stage}`);
  }
  assert.match(landing, /Exact revision/);
  assert.match(landing, /Approve/);
  assert.match(landing, /Request change/);
});

test("landing entry points lead to the canonical SignalFlow workspaces", () => {
  assert.match(landing, /href="\/signals"/);
  assert.match(landing, /href="\/today"/);
  assert.match(landing, /href="\/plan"/);
  assert.doesNotMatch(landing, /Create your posting package|Turn one product story into a campaign built for every channel/);
});

test("landing product theatre preserves source evidence voice and exact-review truth", () => {
  assert.match(landing, /REAL WORK/);
  assert.match(landing, /STORY OPPORTUNITY/);
  assert.match(landing, /YOUR JUDGMENT/);
  assert.match(landing, /source evidence/);
  assert.match(landing, /voice applied/);
  assert.match(landing, /Changes require approval again/);
  assert.match(landing, /Silence remains a valid outcome/);
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

test("the landing design remains component-scoped and keeps its current narrative sections", () => {
  assert.doesNotMatch(globals, /\.landing-shell|\.landing-hero|\.landing-nav|\.landing-editorial/);
  assert.doesNotMatch(publicSurfaces, /\.landing-shell|\.landing-hero|\.landing-nav|\.channel-showcase|\.landing-faq/);
  assert.doesNotMatch(containment, /\.landing-shell|\.landing-hero|\.channel-showcase|\.landing-faq/);
  assert.doesNotMatch(styles, /\.app-shell|\.studio-page|\.secondary-page/);
  for (const selector of ["hero", "theatre", "statementSection", "flowSection", "systemSection", "controlSection", "finalSection"]) {
    assert.match(styles, new RegExp(`\\.${selector}\\s*[,\\{]`));
  }
});

test("the landing protects responsive focus and reduced-motion behavior", () => {
  assert.match(styles, /@media\s*\(max-width:\s*1100px\)/);
  assert.match(styles, /@media\s*\(max-width:\s*900px\)/);
  assert.match(styles, /@media\s*\(max-width:\s*640px\)/);
  assert.match(styles, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /overflow-x:\s*clip/);
});
