import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const layoutUrl = new URL("../app/layout.js", import.meta.url);
const workspaceUrl = new URL("../app/app-workspace.css", import.meta.url);
const workflowUrl = new URL("../app/studio-product.css", import.meta.url);

const APPROVED_STYLE_ORDER = [
  "globals.css",
  "app-workspace.css",
  "studio-product.css",
];

const RETIRED_GLOBAL_LAYERS = [
  "living-ui.css",
  "living-ui-tuning.css",
  "professional-polish.css",
  "responsive-studio.css",
  "studio-decision-flow.css",
];

function stylesheetImports(source) {
  return [...source.matchAll(/^import\s+["']\.\.\/app\/([^"']+\.css)["'];$/gm)]
    .map((match) => match[1]);
}

function withoutCssComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "");
}

function exactCssSelectors(source) {
  const selectors = new Set();
  const clean = withoutCssComments(source);
  const rulePattern = /([^{}]+)\{/g;
  let match;

  while ((match = rulePattern.exec(clean))) {
    const heading = match[1].trim();
    if (heading.startsWith("@")) continue;
    for (const rawSelector of heading.split(",")) {
      const selector = rawSelector.trim().replace(/\s+/g, " ");
      if (selector) selectors.add(selector);
    }
  }

  return selectors;
}

test("the root layout uses one explicit stylesheet cascade", async () => {
  const source = await readFile(layoutUrl, "utf8");
  assert.deepEqual(stylesheetImports(source), APPROVED_STYLE_ORDER);
  assert.doesNotMatch(source, /connector\.css/);
  assert.doesNotMatch(source, /ui-containment\.css/);
  assert.doesNotMatch(source, /public-surfaces\.css/);
  assert.doesNotMatch(source, /campaign-freshness\.css/);
  assert.doesNotMatch(source, /campaign-versioning\.css/);

  for (const retiredLayer of RETIRED_GLOBAL_LAYERS) {
    assert.equal(
      source.includes(retiredLayer),
      false,
      `${retiredLayer} is retired and must not return to the production cascade`,
    );
  }
});

test("Review freshness styles are component-scoped rather than a root override layer", async () => {
  const freshness = withoutCssComments(await readFile(new URL("../components/ReviewStage.module.css", import.meta.url), "utf8"));
  assert.match(freshness, /\.staleBanner/);
  assert.match(freshness, /\.root :global\(\.export-row\)/);
  assert.equal(freshness.includes(".app-shell"), false);
});

test("Regeneration dialog viewport containment is component-scoped", async () => {
  const regenerationDialog = await readFile(new URL("../components/RegenerationDialog.module.css", import.meta.url), "utf8");

  assert.match(regenerationDialog, /:global\(\.app-shell\) \.dialog\s*\{[\s\S]*max-width:\s*min\(42rem, calc\(100vw - 2rem\)\)[\s\S]*max-height:\s*calc\(100dvh - 2rem\)/);
  assert.match(regenerationDialog, /@media \(max-width:\s*37rem\)[\s\S]*max-width:\s*calc\(100vw - 1rem\)[\s\S]*max-height:\s*calc\(100dvh - 1rem\)/);
});

test("legal styles are route-scoped and cannot patch Studio components", async () => {
  const legal = withoutCssComments(await readFile(new URL("../app/legal.module.css", import.meta.url), "utf8"));
  assert.equal(legal.includes(".app-shell"), false);
  assert.equal(legal.includes(".studio-actionbar"), false);
  assert.equal(legal.includes(".studio-grid"), false);
  assert.equal(legal.includes(".legal-shell"), false);
  assert.equal(legal.includes(".legal-nav"), false);
  assert.equal(legal.includes(".legal-content"), false);
});

test("root containment belongs to globals rather than a standalone override layer", async () => {
  const [layout, globals] = await Promise.all([
    readFile(layoutUrl, "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(layout, /ui-containment\.css/);
  assert.match(globals, /--sf-page-max:\s*88rem/);
  assert.match(globals, /--sf-page-gutter:\s*max\(/);
  assert.match(globals, /html\s*\{[\s\S]*overflow-x:\s*hidden[\s\S]*scrollbar-width:\s*thin/);
  assert.match(globals, /body\s*\{[\s\S]*overflow-x:\s*hidden/);
  assert.match(globals, /html::\-webkit-scrollbar-thumb/);
});

test("workspace and Studio product layers do not share exact selectors", async () => {
  const [workspace, workflow] = await Promise.all([
    readFile(workspaceUrl, "utf8"),
    readFile(workflowUrl, "utf8"),
  ]);

  const workspaceSelectors = exactCssSelectors(workspace);
  const productSelectors = exactCssSelectors(workflow);
  const duplicates = [...workspaceSelectors].filter((selector) => productSelectors.has(selector)).sort();

  assert.deepEqual(duplicates, []);
});

test("authoritative Studio layers remain scoped and free of retired wizard patches", async () => {
  const [workspace, workflow] = await Promise.all([
    readFile(workspaceUrl, "utf8"),
    readFile(workflowUrl, "utf8"),
  ]);

  assert.match(workspace, /\.app-shell\s*\{/);
  assert.match(workspace, /\.app-shell \.studio-page/);
  assert.match(workflow, /\.app-shell \.studio-page\[data-stage="source"\]/);
  assert.match(workflow, /\.app-shell \.studio-page\[data-stage="destinations"\]/);
  assert.match(workspace, /Shared workspace containment authority/);
  assert.match(workspace, /\.app-shell \.studio-main/);
  assert.match(workflow, /Responsive Studio composition authority/);
  assert.match(workflow, /@media \(max-width: 52rem\)/);
  assert.match(workspace, /Reduced-motion accessibility authority/);
  assert.match(workspace, /Responsive application chrome authority/);
  assert.match(workspace, /Responsive secondary-workspace authority/);
  assert.match(workspace, /Responsive secondary page-frame authority/);
  assert.match(workspace, /Shared horizontal-overflow and action-resilience authority/);
  assert.doesNotMatch(workflow, /\.app-shell \.secondary-page/);
  assert.doesNotMatch(workflow, /\.app-shell \.secondary-heading/);
  assert.match(workflow, /Final Studio stage composition authority/);
  assert.doesNotMatch(workflow, /^\.app-shell \.studio-heading\s*\{/m);
  assert.doesNotMatch(workflow, /^\.app-shell \.studio-flow\s*\{/m);
  assert.doesNotMatch(workflow, /^\.app-shell \.studio-page\s*,/m);
  assert.match(workflow, /\.app-shell main\.studio-page\[data-stage="source"\]/);
  assert.match(workflow, /\.app-shell \.studio-page/);
  assert.match(workflow, /\.app-shell \.studio-page\[data-stage="source"\]/);
  assert.match(workflow, /\.app-shell \.studio-page\[data-stage="destinations"\]/);
  assert.match(workflow, /\.app-shell \.studio-page\[data-stage="review"\]/);
  assert.equal(workspace.includes("Focused three-step wizard"), false);

  for (const source of [workspace, workflow]) {
    assert.equal(/^body\s*\{/m.test(source), false);
    assert.equal(/^html\s*\{/m.test(source), false);
    assert.equal(/^:root\s*\{/m.test(source), false);
  }
});
