import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageUrl = new URL("../app/page.js", import.meta.url);
const publishRouteUrl = new URL("../app/api/publish/route.js", import.meta.url);

test("review keeps live publishing secondary to save/copy/export handoff", async () => {
  const page = await readFile(pageUrl, "utf8");
  const reviewStart = page.indexOf('<div className="review-actions">');
  const reviewEnd = page.indexOf('{result?.warnings?.length > 0', reviewStart);
  const review = page.slice(reviewStart, reviewEnd);

  assert.ok(reviewStart > -1 && reviewEnd > reviewStart);
  assert.match(review, /className="button button--dark"[\s\S]*onClick=\{copyAndOpenCurrent\}/);
  assert.doesNotMatch(review, /className="button button--dark"[\s\S]*onClick=\{publishCurrentPost\}/);
  assert.match(review, /Copy draft/);
  assert.match(review, /Save changes|Save locally/);
  assert.match(review, /Copy & open/);
  assert.match(page, /Take the full campaign with you/);
});

test("direct publishing is a deliberate exact-revision action", async () => {
  const page = await readFile(pageUrl, "utf8");

  assert.match(page, /const directPublishAvailability = selectPublishAvailability\(\{[\s\S]*connectorReady: canPublishCurrent,[\s\S]*manualRoute: false/);
  assert.match(page, /<details className="route-note direct-publish-panel">/);
  assert.match(page, /Direct publishing to \\{activeMeta\\.label\\}/);
  assert.match(page, /Revision \{revision\} · exact approved draft currently shown/);
  assert.match(page, /className="button button--outline"[\s\S]*onClick=\{publishCurrentPost\}[\s\S]*Publish this revision/);
  assert.match(page, /Publish \$\{activeMeta\.label\} revision \$\{revision\} to \$\{currentConnectionLabel\}\? This sends the exact approved draft currently shown\./);
});

test("publish failures cannot be rendered as confirmed success", async () => {
  const [page, route] = await Promise.all([
    readFile(pageUrl, "utf8"),
    readFile(publishRouteUrl, "utf8"),
  ]);

  assert.match(page, /if \(!data\.ok\) throw new Error\(data\.error \|\| "The platform did not confirm publication\."\)/);
  assert.match(route, /A success response is returned only after the platform API confirms the post\./);
  assert.match(route, /Publishing could not be confirmed/);
});
