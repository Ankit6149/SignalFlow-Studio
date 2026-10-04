import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const layoutUrl = new URL("../app/layout.js", import.meta.url);
const workspaceUrl = new URL("../app/app-workspace.css", import.meta.url);
const workflowUrl = new URL("../app/studio-product.css", import.meta.url);
const responsiveUrl = new URL("../app/responsive-studio.css", import.meta.url);
const decisionFlowUrl = new URL("../app/studio-decision-flow.css", import.meta.url);

const APPROVED_STYLE_ORDER = [
  "globals.css",
  "app-workspace.css",
  "studio-product.css",
  "campaign-versioning.css",
  "responsive-studio.css",
  "studio-decision-flow.css",
];

const RETIRED_GLOBAL_LAYERS = [
  "living-ui.css",
  "living-ui-tuning.css",
  "professional-polish.css",
];

function stylesheetImports(source) {
  return [...source.matchAll(/^import\s+["']\.\.\/app\/([^"']+\.css)["'];$/gm)]
    .map((match) => match[1]);
}

function withoutCssComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "");
}

test("the root layout uses one explicit stylesheet cascade", async () => {
  const source = await readFile(layoutUrl, "utf8");
  assert.deepEqual(stylesheetImports(source), APPROVED_STYLE_ORDER);
  assert.doesNotMatch(source, /connector\.css/);
  assert.doesNotMatch(source, /ui-containment\.css/);
  assert.doesNotMatch(source, /public-surfaces\.css/);
  assert.doesNotMatch(source, /campaign-freshness\.css/);

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

test("authoritative Studio layers remain scoped and free of retired wizard patches", async () => {
  const [workspace, workflow, responsive, decisionFlow] = await Promise.all([
    readFile(workspaceUrl, "utf8"),
    readFile(workflowUrl, "utf8"),
    readFile(responsiveUrl, "utf8"),
    readFile(decisionFlowUrl, "utf8"),
  ]);

  assert.match(workspace, /\.app-shell\s*\{/);
  assert.match(workspace, /\.app-shell \.studio-page/);
  assert.match(workflow, /\.app-shell \.studio-page\[data-stage="source"\]/);
  assert.match(workflow, /\.app-shell \.studio-page\[data-stage="destinations"\]/);
  assert.match(responsive, /\.app-shell\s*\{/);
  assert.match(responsive, /\.app-shell \.studio-main/);
  assert.match(decisionFlow, /\.app-shell \.studio-page/);
  assert.match(decisionFlow, /\.app-shell \.studio-page\[data-stage="source"\]/);
  assert.match(decisionFlow, /\.app-shell \.studio-page\[data-stage="destinations"\]/);
  assert.match(decisionFlow, /\.app-shell \.studio-page\[data-stage="review"\]/);
  assert.equal(workspace.includes("Focused three-step wizard"), false);

  for (const source of [workspace, workflow, responsive, decisionFlow]) {
    assert.equal(/^body\s*\{/m.test(source), false);
    assert.equal(/^html\s*\{/m.test(source), false);
    assert.equal(/^:root\s*\{/m.test(source), false);
  }
});
