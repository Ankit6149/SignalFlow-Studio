import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageUrl = new URL("../app/page.js", import.meta.url);
const workflowUrl = new URL("../app/studio-product.css", import.meta.url);
const workspaceUrl = new URL("../app/app-workspace.css", import.meta.url);

test("inactive Studio panels are removed from layout and interaction", async () => {
  const [page, workflow] = await Promise.all([
    readFile(pageUrl, "utf8"),
    readFile(workflowUrl, "utf8"),
  ]);

  assert.match(
    page,
    /composer-panel \$\{stage !== "source" \? "is-step-hidden" : ""\}/,
    "the source panel must be marked hidden outside Step 1",
  );
  assert.match(
    page,
    /output-panel \$\{stage === "source" \? "is-step-hidden" : ""\}/,
    "the destinations/review panel must be marked hidden during Step 1",
  );
  assert.match(
    workflow,
    /\.app-shell \.studio-grid > \.is-step-hidden\s*\{\s*display:\s*none;\s*\}/,
    "the authoritative workflow stylesheet must remove inactive panels from the rendered flow",
  );
});

test("Review exposes only review controls", async () => {
  const [workflow, workspace] = await Promise.all([
    readFile(workflowUrl, "utf8"),
    readFile(workspaceUrl, "utf8"),
  ]);

  assert.match(
    workspace,
    /\.app-shell \.studio-grid--review \.channel-groups,[\s\S]*?\.app-shell \.studio-grid--review > \.output-panel > \.panel-kicker\s*\{\s*display:\s*none;\s*\}/,
    "Review must keep destination selectors and the Step 2 heading out of view",
  );
  assert.match(
    workflow,
    /\.app-shell \.studio-grid--review \.model-route-panel\s*\{\s*display:\s*none;\s*\}/,
    "Review must not leak the Step 2 model-route setup panel",
  );
});
