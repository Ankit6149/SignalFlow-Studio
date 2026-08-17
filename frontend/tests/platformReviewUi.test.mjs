import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("exact revision review UI uses application services and exposes the intended owner decisions", async () => {
  const component = await source("../components/PlatformReviewPanel.js");
  assert.match(component, /createBrowserPlatformReviewApplication/);
  assert.match(component, /createBrowserPlatformGenerationApplication/);
  assert.match(component, /QUALITY GATE/);
  assert.match(component, /EXACT REVISION REVIEW/);
  assert.match(component, /Run checks/);
  assert.match(component, /Save as new revision/);
  assert.match(component, /Approve exact revision/);
  assert.match(component, /Reject exact revision/);
  assert.match(component, /reviewCurrentVariant/);
  assert.match(component, /editCurrentVariant/);
  assert.match(component, /approveCurrentVariant/);
  assert.match(component, /rejectCurrentVariant/);
  assert.match(component, /regenerateVariant/);
  assert.doesNotMatch(component, /\/api\/launch_kit|generateJSON|OPENAI_API_KEY|GEMINI_API_KEY|ANTHROPIC_API_KEY/);
});

test("blocking review prevents approval while an unreviewed revision cannot be approved from the UI", async () => {
  const component = await source("../components/PlatformReviewPanel.js");
  assert.match(component, /const blocked = review\?\.overallVerdict === "block"/);
  assert.match(component, /disabled=\{Boolean\(busy\) \|\| !review \|\| blocked\}/);
  assert.match(component, /blocked \? "Resolve blockers first" : "Approve exact revision"/);
});

test("approved revision may still be edited or regenerated so a newer revision can invalidate approval", async () => {
  const component = await source("../components/PlatformReviewPanel.js");
  assert.match(component, /onClick=\{\(\) => setEditing\(true\)\} disabled=\{Boolean\(busy\)\}>Edit/);
  assert.match(component, /onClick=\{regenerate\} disabled=\{Boolean\(busy\)\}/);
  assert.doesNotMatch(component, /disabled=\{Boolean\(busy\) \|\| approved\}/);
  assert.match(component, /previous review\/approval is historical/i);
});

test("review styling stays compact, responsive, focus-visible, and consistent with the shared visual system", async () => {
  const css = await source("../components/PlatformReviewPanel.module.css");
  assert.match(css, /\.criticGrid\s*\{/);
  assert.match(css, /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 720px\)/);
  assert.match(css, /\.criticGrid\s*\{\s*grid-template-columns:\s*1fr/);
  assert.match(css, /:focus-visible/);
  assert.doesNotMatch(css, /box-shadow:\s*0\s+\d+px\s+\d+px/);
});
