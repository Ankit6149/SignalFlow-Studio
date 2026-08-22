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
  assert.match(landing, /<BrandMark tone="dark" \/>/);
  assert.doesNotMatch(landing, /Open current Studio|Open Studio/);
  assert.doesNotMatch(landing, /function SignalFlowLogo|logoMark|logoCopy|brand-mark__glyph/);
});

test("the landing leads with the canonical owner path instead of the legacy campaign builder", () => {
  for (const anchor of ["main-content", "works-now", "how-it-flows", "trust", "final-title"]) {
    assert.ok(landing.includes(anchor), `missing landing anchor: ${anchor}`);
  }
  assert.match(landing, /Stay in the work/);
  assert.match(landing, /Let the story find you/);
  assert.match(landing, /Owner Golden Path is live through exact approval/);
  assert.match(landing, /Connected GitHub context/);
  assert.match(landing, /Durable planning/);
  assert.match(landing, /SignalFlow&apos;s job is everything between the work and your judgment/);
  assert.match(landing, /legacy campaign builder remains compatibility code/i);
  assert.doesNotMatch(landing, /Turn one product story into a campaign built for every channel|Create your posting package/);
});

test("current and next claims remain intentionally distinct", () => {
  assert.match(landing, /WHAT THE PRODUCT CAN DO TODAY/);
  assert.match(landing, /verified repository can become bounded ProjectContext/);
  assert.match(landing, /hosted Voice, NarrativeStrategy, exact approval, and ContentPiece state/);
  assert.match(landing, /LinkedIn and X use immutable revisions/);
  assert.match(landing, /THE NEXT CONNECTED LAYERS/);
  assert.match(landing, /Automatic evidence \+ media/);
  assert.match(landing, /Durable publication/);
  assert.match(landing, /Private Hybrid/);
  assert.match(landing, /Local Only/);
});

test("landing and workspace use the same calm signal design tokens", () => {
  for (const token of ["#f7f8fb", "#ffffff", "#171b24", "#5267d9", "#dfe4ec"]) {
    assert.ok(styles.toLowerCase().includes(token), `landing missing shared token ${token}`);
    assert.ok(shellStyles.toLowerCase().includes(token), `workspace shell missing shared token ${token}`);
  }
  assert.doesNotMatch(styles, /#d3b874|#ead9a8|#d9f36a|#a9a1ff/i);
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
  assert.match(styles, /\.nextSection\s*[,\{]/);
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
