import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(testDir, "..");
const read = (relative) => fs.readFileSync(path.join(frontendRoot, relative), "utf8");

test("Connections styling has one application-shell authority", () => {
  const layout = read("app/layout.js");
  const workspace = read("app/app-workspace.css");
  const retired = path.join(frontendRoot, "app/connector.css");

  assert.equal(fs.existsSync(retired), false, "retired connector.css must not return");
  assert.doesNotMatch(layout, /connector\.css/);

  assert.match(workspace, /\.app-shell \.connection-card__actions \{/);
  assert.match(workspace, /flex-direction:\s*column/);
  assert.match(workspace, /\.app-shell \.connector-action \{[\s\S]*border:[\s\S]*background:[\s\S]*text-transform:\s*uppercase/);
  assert.match(workspace, /\.app-shell \.connector-action--quiet \{/);
  assert.match(workspace, /@media \(max-width: 47\.5rem\)[\s\S]*\.app-shell \.connection-card__actions \{[\s\S]*flex-direction:\s*row/);
});

test("global layout no longer grows a connector-specific stylesheet layer", () => {
  const layout = read("app/layout.js");
  const globalImports = [...layout.matchAll(/import "\.\.\/app\/[^"]+\.css";/g)].map((match) => match[0]);

  assert.equal(globalImports.length, 3);
  assert.ok(globalImports.some((entry) => entry.includes("app-workspace.css")));
  assert.ok(globalImports.every((entry) => !entry.includes("connector.css")));
  assert.ok(globalImports.every((entry) => !entry.includes("ui-containment.css")));
  assert.ok(globalImports.every((entry) => !entry.includes("public-surfaces.css")));
  assert.ok(globalImports.every((entry) => !entry.includes("campaign-freshness.css")));
  assert.ok(globalImports.every((entry) => !entry.includes("campaign-versioning.css")));
  assert.ok(globalImports.every((entry) => !entry.includes("responsive-studio.css")));
  assert.ok(globalImports.every((entry) => !entry.includes("studio-decision-flow.css")));
});

test("root containment is part of the actual global reset", () => {
  const globals = read("app/globals.css");
  const retired = path.join(frontendRoot, "app/ui-containment.css");

  assert.equal(fs.existsSync(retired), false, "retired ui-containment.css must not return");
  assert.match(globals, /--sf-page-max:\s*88rem/);
  assert.match(globals, /scrollbar-color:\s*rgba\(155, 130, 72, 0\.72\) transparent/);
  assert.match(globals, /@media \(max-width: 52rem\)[\s\S]*--sf-page-gutter:\s*clamp\(1rem, 5vw, 2rem\)/);
});


test("legal surfaces use one shared scoped module instead of a root global layer", () => {
  const terms = read("app/terms/page.js");
  const privacy = read("app/privacy/page.js");
  const legal = read("app/legal.module.css");
  const retired = path.join(frontendRoot, "app/public-surfaces.css");

  assert.equal(fs.existsSync(retired), false, "retired public-surfaces.css must not return");
  for (const page of [terms, privacy]) {
    assert.match(page, /import styles from "\.\.\/legal\.module\.css"/);
    assert.match(page, /className=\{styles\.shell\}/);
    assert.match(page, /className=\{styles\.nav\}/);
    assert.match(page, /className=\{styles\.content\}/);
    assert.doesNotMatch(page, /legal-shell|legal-nav|legal-content/);
  }

  assert.match(legal, /\.shell \{/);
  assert.match(legal, /\.nav \{/);
  assert.match(legal, /\.content \{/);
  assert.doesNotMatch(legal, /\.app-shell|\.studio-grid|\.studio-actionbar/);
});


test("Review owns freshness styling without a root feature stylesheet", () => {
  const review = read("components/ReviewStage.js");
  const reviewStyles = read("components/ReviewStage.module.css");
  const retired = path.join(frontendRoot, "app/campaign-freshness.css");

  assert.equal(fs.existsSync(retired), false, "retired campaign-freshness.css must not return");
  assert.match(review, /import styles from "\.\/ReviewStage\.module\.css"/);
  assert.match(review, /styles\.staleBanner/);
  assert.match(review, /campaign-stale-banner/);
  assert.match(reviewStyles, /\.staleBanner \{/);
  assert.match(reviewStyles, /\.root :global\(\.review-actions\) button:disabled/);
  assert.doesNotMatch(reviewStyles, /connection-badge--stale/);
});


test("Source canonical-state styling belongs to SourceStage rather than a root versioning layer", () => {
  const source = read("components/SourceStage.js");
  const sourceStyles = read("components/SourceStage.module.css");

  assert.match(source, /import styles from "\.\/SourceStage\.module\.css"/);
  assert.match(source, /styles\.root/);
  assert.match(sourceStyles, /\.root :global\(\.file-chip--canonical\)/);
  assert.match(sourceStyles, /\.root :global\(\.source-state-badge\.is-usable_evidence\)/);
  assert.match(sourceStyles, /\.root :global\(\.source-contract-summary\)/);
});


test("Review status/versioning and regeneration dialog each own scoped styles", () => {
  const reviewStyles = read("components/ReviewStage.module.css");
  const dialog = read("components/RegenerationDialog.js");
  const dialogStyles = read("components/RegenerationDialog.module.css");
  const retired = path.join(frontendRoot, "app/campaign-versioning.css");

  assert.equal(fs.existsSync(retired), false, "retired campaign-versioning.css must not return");
  assert.match(reviewStyles, /\.root :global\(\.campaign-status-strip\)/);
  assert.match(reviewStyles, /\.root :global\(\.draft-state-badge/);
  assert.match(reviewStyles, /\.root :global\(\.version-history\)/);
  assert.match(reviewStyles, /\.root :global\(\.review-action-reason\)/);

  assert.match(dialog, /import styles from "\.\/RegenerationDialog\.module\.css"/);
  assert.match(dialogStyles, /\.backdrop \{/);
  assert.match(dialogStyles, /\.dialog \{/);
  assert.doesNotMatch(dialogStyles, /campaign-status-strip|draft-state-badge|version-history|review-action-reason|save-action-group/);
});
