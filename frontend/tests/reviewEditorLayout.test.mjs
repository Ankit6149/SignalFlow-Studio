import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workspaceUrl = new URL("../app/app-workspace.css", import.meta.url);
const freshnessUrl = new URL("../app/campaign-freshness.css", import.meta.url);
const versioningUrl = new URL("../app/campaign-versioning.css", import.meta.url);

test("Review uses explicit editor-first desktop and narrow areas", async () => {
  const css = await readFile(workspaceUrl, "utf8");
  assert.match(css, /grid-template-areas:[\s\S]*"status status"[\s\S]*"tabs editor"[\s\S]*"tabs inspector"[\s\S]*"tabs actions"/);
  assert.match(css, /@media \(min-width: 96rem\)[\s\S]*"tabs editor inspector"[\s\S]*"tabs actions inspector"/);
  assert.match(css, /@media \(max-width: 68rem\)[\s\S]*grid-template-areas:[\s\S]*"tabs"[\s\S]*"editor"[\s\S]*"inspector"[\s\S]*"actions"/);
  assert.match(css, /grid-template-columns:\s*10\.75rem minmax\(0, 1fr\) minmax\(17rem, 18\.5rem\)/);
});

test("Review keeps long-form editing and mobile channel navigation usable", async () => {
  const css = await readFile(workspaceUrl, "utf8");
  assert.match(css, /\.native-preview textarea \{[\s\S]*min-height:\s*clamp\(32rem, 56vh, 48rem\)/);
  assert.match(css, /@media \(max-width: 68rem\)[\s\S]*\.review-tabs \{[\s\S]*overflow-x:\s*auto[\s\S]*scroll-snap-type:\s*inline proximity/);
  assert.match(css, /\.review-tabs button:focus-visible/);
  assert.match(css, /\.review-inspector dd \{[\s\S]*overflow-wrap:\s*anywhere/);
  assert.match(css, /@media \(max-width: 36rem\)[\s\S]*\.native-preview textarea \{[\s\S]*min-height:\s*24rem/);
});

test("Review actions remain in normal flow and wrap deliberately", async () => {
  const css = await readFile(workspaceUrl, "utf8");
  assert.match(css, /\.review-actions \{[\s\S]*grid-template-columns:\s*auto minmax\(0, 1fr\) minmax\(12rem, auto\)/);
  assert.match(css, /\.review-action-reason \{[\s\S]*grid-column:\s*1 \/ -1[\s\S]*overflow-wrap:\s*anywhere/);
  assert.match(css, /@media \(max-width: 36rem\)[\s\S]*\.review-actions,[\s\S]*\.export-row \{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\)/);
});

test("state extensions no longer mutate shared Review placement", async () => {
  const [workspace, freshness, versioning] = await Promise.all([
    readFile(workspaceUrl, "utf8"),
    readFile(freshnessUrl, "utf8"),
    readFile(versioningUrl, "utf8"),
  ]);
  assert.doesNotMatch(freshness, /review-tabs[^{]*\{[^}]*grid-(row|column):/s);
  assert.doesNotMatch(versioning, /review-tabs[^{]*\{[^}]*grid-(row|column):/s);
  assert.doesNotMatch(versioning, /campaign-status-strip[^{]*\{[^}]*grid-(row|column):/s);
  assert.doesNotMatch(workspace, /\.review-(tabs|inspector|actions)[^{]*\{[^}]*position:\s*fixed/s);
  assert.doesNotMatch(workspace, /\.publishing-route-link[^{]*\{[^}]*position:\s*fixed/s);
});
