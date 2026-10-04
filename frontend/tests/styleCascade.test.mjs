import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const layoutUrl = new URL("../app/layout.js", import.meta.url);
const publicSurfacesUrl = new URL("../app/public-surfaces.css", import.meta.url);
const workspaceUrl = new URL("../app/app-workspace.css", import.meta.url);
const workflowUrl = new URL("../app/studio-product.css", import.meta.url);
const responsiveUrl = new URL("../app/responsive-studio.css", import.meta.url);
const decisionFlowUrl = new URL("../app/studio-decision-flow.css", import.meta.url);

const APPROVED_STYLE_ORDER = [
  "globals.css",
  "public-surfaces.css",
  "app-workspace.css",
  "studio-product.css",
  "campaign-freshness.css",
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

  for (const retiredLayer of RETIRED_GLOBAL_LAYERS) {
    assert.equal(
      source.includes(retiredLayer),
      false,
      `${retiredLayer} is retired and must not return to the production cascade`,
    );
  }
});

test("public surfaces cannot patch Studio components", async () => {
  const publicSurfaces = withoutCssComments(await readFile(publicSurfacesUrl, "utf8"));
  assert.equal(publicSurfaces.includes(".app-shell"), false);
  assert.equal(publicSurfaces.includes(".studio-actionbar"), false);
  assert.equal(publicSurfaces.includes(".studio-grid"), false);
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
