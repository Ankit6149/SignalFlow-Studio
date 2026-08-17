import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("Plan exposes generation and exact review through application services, not direct provider or legacy campaign calls", async () => {
  const component = await source("../components/CampaignPlanPanel.js");
  assert.match(component, /createBrowserPlatformGenerationApplication/);
  assert.match(component, /generateReadyVariants/);
  assert.match(component, /PlatformReviewPanel/);
  assert.match(component, /DRAFT REVIEW · EXACT REVISIONS/);
  assert.doesNotMatch(component, /\/api\/launch_kit/);
  assert.doesNotMatch(component, /generateJSON|OPENAI_API_KEY|GEMINI_API_KEY|ANTHROPIC_API_KEY/);
});

test("draft presentation stays restrained and responsive rather than adding a chunky dashboard layer", async () => {
  const css = await source("../components/CampaignPlanPanel.module.css");
  assert.match(css, /\.draftRow\s*\{/);
  assert.match(css, /grid-template-columns:\s*8\.5rem minmax\(0, 1fr\)/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /\.draftRow\s*\{[\s\S]*grid-template-columns:\s*1fr/);
  assert.doesNotMatch(css, /box-shadow:\s*0\s+\d+px\s+\d+px/);
});
