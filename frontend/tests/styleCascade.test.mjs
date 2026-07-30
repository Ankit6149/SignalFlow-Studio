import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const layoutUrl = new URL("../app/layout.js", import.meta.url);
const containmentUrl = new URL("../app/ui-containment.css", import.meta.url);
const workspaceUrl = new URL("../app/app-workspace.css", import.meta.url);
const workflowUrl = new URL("../app/studio-product.css", import.meta.url);

const APPROVED_STYLE_ORDER = [
  "globals.css",
  "connector.css",
  "ui-containment.css",
  "app-workspace.css",
  "studio-product.css",
  "campaign-freshness.css",
  "campaign-versioning.css",
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

test("the root layout uses one explicit stylesheet cascade", async () => {
  const source = await readFile(layoutUrl, "utf8");
  assert.deepEqual(stylesheetImports(source), APPROVED_STYLE_ORDER);

  for (const retiredLayer of RETIRED_GLOBAL_LAYERS) {
    assert.equal(
      source.includes(retiredLayer),
      false,
      `${retiredLayer} is retired and must not return to the production cascade`,
    );
  }
});

test("containment cannot patch Studio component selectors", async () => {
  const source = await readFile(containmentUrl, "utf8");
  assert.equal(source.includes(".app-shell"), false);
  assert.equal(source.includes(".studio-actionbar"), false);
  assert.equal(source.includes(".studio-grid"), false);
});

test("authoritative Studio layers remain scoped to the application shell", async () => {
  const [workspace, workflow] = await Promise.all([
    readFile(workspaceUrl, "utf8"),
    readFile(workflowUrl, "utf8"),
  ]);

  assert.match(workspace, /\.app-shell\s*\{/);
  assert.match(workspace, /\.app-shell \.studio-page/);
  assert.match(workflow, /\.app-shell \.studio-page\[data-stage="source"\]/);
  assert.match(workflow, /\.app-shell \.studio-page\[data-stage="destinations"\]/);

  for (const source of [workspace, workflow]) {
    assert.equal(/^body\s*\{/m.test(source), false);
    assert.equal(/^html\s*\{/m.test(source), false);
    assert.equal(/^:root\s*\{/m.test(source), false);
  }
});
