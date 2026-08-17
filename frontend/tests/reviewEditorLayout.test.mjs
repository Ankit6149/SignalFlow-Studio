import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workspaceUrl = new URL("../app/app-workspace.css", import.meta.url);
const decisionUrl = new URL("../app/studio-decision-flow.css", import.meta.url);
const freshnessUrl = new URL("../app/campaign-freshness.css", import.meta.url);
const versioningUrl = new URL("../app/campaign-versioning.css", import.meta.url);

test("Review keeps the exact draft primary and moves destination choice to a horizontal row", async () => {
  const css = await readFile(decisionUrl, "utf8");
  assert.match(css, /data-stage="review"\] \.review-workspace[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\)[\s\S]*"tabs"[\s\S]*"editor"[\s\S]*"inspector"[\s\S]*"actions"/);
  assert.match(css, /data-stage="review"\] \.review-tabs[\s\S]*display:\s*flex[\s\S]*overflow-x:\s*auto[\s\S]*scroll-snap-type:\s*inline proximity/);
  assert.match(css, /@media \(min-width: 86rem\)[\s\S]*"editor inspector"[\s\S]*"actions inspector"/);
  assert.match(css, /grid-template-columns:\s*minmax\(0, 1\.65fr\) minmax\(19rem, 0\.62fr\)/);
  assert.doesNotMatch(css, /grid-template-columns:\s*11rem minmax\(0, 1\.6fr\) minmax\(19rem, 0\.75fr\)/);
});

test("Review keeps long-form editing and mobile channel navigation usable", async () => {
  const [workspace, decision] = await Promise.all([
    readFile(workspaceUrl, "utf8"),
    readFile(decisionUrl, "utf8"),
  ]);
  assert.match(decision, /\.native-preview textarea \{[\s\S]*min-height:\s*clamp\(28rem, 52vh, 42rem\)/);
  assert.match(decision, /\.review-tabs \{[\s\S]*overflow-x:\s*auto[\s\S]*scroll-snap-type:\s*inline proximity/);
  assert.match(workspace, /\.review-tabs button:focus-visible/);
  assert.match(workspace, /\.review-inspector dd \{[\s\S]*overflow-wrap:\s*anywhere/);
  assert.match(decision, /@media \(max-width: 36rem\)[\s\S]*\.native-preview textarea \{[\s\S]*min-height:\s*24rem/);
});

test("Review actions remain in normal flow and wrap deliberately", async () => {
  const css = await readFile(workspaceUrl, "utf8");
  assert.match(css, /\.review-actions \{[\s\S]*grid-template-columns:\s*auto minmax\(0, 1fr\) minmax\(12rem, auto\)/);
  assert.match(css, /\.review-action-reason \{[\s\S]*grid-column:\s*1 \/ -1[\s\S]*overflow-wrap:\s*anywhere/);
  assert.match(css, /@media \(max-width: 36rem\)[\s\S]*\.review-actions,[\s\S]*\.export-row \{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\)/);
});

test("state extensions do not mutate final Review placement", async () => {
  const [decision, freshness, versioning] = await Promise.all([
    readFile(decisionUrl, "utf8"),
    readFile(freshnessUrl, "utf8"),
    readFile(versioningUrl, "utf8"),
  ]);
  assert.doesNotMatch(freshness, /review-tabs[^{]*\{[^}]*grid-(row|column):/s);
  assert.doesNotMatch(versioning, /review-tabs[^{]*\{[^}]*grid-(row|column):/s);
  assert.doesNotMatch(versioning, /campaign-status-strip[^{]*\{[^}]*grid-(row|column):/s);
  assert.doesNotMatch(decision, /\.review-(tabs|inspector|actions)[^{]*\{[^}]*position:\s*fixed/s);
  assert.doesNotMatch(decision, /\.publishing-route-link[^{]*\{[^}]*position:\s*fixed/s);
});
