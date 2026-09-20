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
  const primaryStart = review.indexOf('className="button button--dark"');
  const primaryEnd = review.indexOf("</button>", primaryStart);
  const primaryAction = review.slice(primaryStart, primaryEnd);

  assert.ok(reviewStart > -1 && reviewEnd > reviewStart);
  assert.ok(primaryStart > -1 && primaryEnd > primaryStart);
  assert.match(primaryAction, /onClick=\{copyAndOpenCurrent\}/);
  assert.doesNotMatch(primaryAction, /publishCurrentPost/);
  assert.match(review, /Copy draft/);
  assert.match(review, /Save changes|Save locally/);
  assert.match(review, /Copy & open/);
  assert.match(page, /Take the full campaign with you/);
});

test("direct publishing is a deliberate exact-revision action", async () => {
  const page = await readFile(pageUrl, "utf8");
  const panelStart = page.indexOf('<details className="route-note direct-publish-panel">');
  const panelEnd = page.indexOf("</details>", panelStart);
  const panel = page.slice(panelStart, panelEnd);

  assert.match(page, /const directPublishAvailability = selectPublishAvailability\(\{[\s\S]*connectorReady: canPublishCurrent,[\s\S]*manualRoute: false/);
  assert.ok(panelStart > -1 && panelEnd > panelStart);
  assert.match(panel, /Direct publishing to \{activeMeta\.label\}/);
  assert.match(panel, /Revision \{revision\} · exact approved draft currently shown/);
  assert.match(panel, /onClick=\{publishCurrentPost\}/);
  assert.match(panel, /Publish this revision/);
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
