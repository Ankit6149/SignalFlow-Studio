import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildReviewTabSemantics,
  getAnnouncementSemantics,
  getReviewTabTargetIndex,
  getWorkspaceHeadingId,
} from "../lib/accessibility/workspaceAccessibility.mjs";

const controllerUrl = new URL("../components/WorkspaceAccessibility.js", import.meta.url);
const runtimeUrl = new URL("../app/layout.js", import.meta.url);
const pageUrl = new URL("../app/page.js", import.meta.url);

test("errors announce assertively while other feedback remains polite and atomic", () => {
  assert.deepEqual(getAnnouncementSemantics("error"), {
    role: "alert",
    live: "assertive",
    atomic: "true",
  });
  assert.deepEqual(getAnnouncementSemantics("warning"), {
    role: "status",
    live: "polite",
    atomic: "true",
  });
  assert.deepEqual(getAnnouncementSemantics("success"), {
    role: "status",
    live: "polite",
    atomic: "true",
  });
});

test("workspace heading IDs are deterministic across Studio and secondary routes", () => {
  assert.equal(getWorkspaceHeadingId({ kind: "studio", heading: "Shape every draft" }), "studio-workspace-title");
  assert.equal(getWorkspaceHeadingId({ kind: "settings", heading: "Product settings" }), "settings-workspace-title");
  assert.equal(getWorkspaceHeadingId({ kind: "secondary", heading: "Your saved campaigns." }), "your-saved-campaigns-workspace-title");
});

test("Review tab keyboard navigation wraps and supports Home and End", () => {
  assert.equal(getReviewTabTargetIndex({ key: "ArrowRight", currentIndex: 2, count: 3 }), 0);
  assert.equal(getReviewTabTargetIndex({ key: "ArrowLeft", currentIndex: 0, count: 3 }), 2);
  assert.equal(getReviewTabTargetIndex({ key: "Home", currentIndex: 2, count: 3 }), 0);
  assert.equal(getReviewTabTargetIndex({ key: "End", currentIndex: 0, count: 3 }), 2);
  assert.equal(getReviewTabTargetIndex({ key: "Enter", currentIndex: 0, count: 3 }), null);
  assert.equal(getReviewTabTargetIndex({ key: "ArrowRight", currentIndex: 0, count: 0 }), null);
});

test("Review tabs expose one roving tab stop and stable panel relationships", () => {
  const semantics = buildReviewTabSemantics({
    labels: ["LinkedIn", "X", "Release notes"],
    activeIndex: 1,
  });
  assert.deepEqual(semantics.map(({ selected, tabIndex }) => ({ selected, tabIndex })), [
    { selected: false, tabIndex: -1 },
    { selected: true, tabIndex: 0 },
    { selected: false, tabIndex: -1 },
  ]);
  assert.equal(semantics[1].id, "review-tab-2-x");
  assert.ok(semantics.every((item) => item.controls === "review-draft-panel"));
});

test("the mounted controller owns focus, live feedback, upload description, and Review semantics", async () => {
  const [controller, runtime, page] = await Promise.all([
    readFile(controllerUrl, "utf8"),
    readFile(runtimeUrl, "utf8"),
    readFile(pageUrl, "utf8"),
  ]);

  assert.match(runtime, /import WorkspaceAccessibility from "\.\.\/components\/WorkspaceAccessibility"/);
  assert.match(runtime, /<WorkspaceAccessibility \/>/);
  assert.doesNotMatch(runtime, /SessionBridge/);
  assert.match(controller, /new MutationObserver\(scheduleScan\)/);
  assert.match(controller, /main\.focus\(\{ preventScroll: true \}\)/);
  assert.match(controller, /main\.tabIndex = -1/);
  assert.match(controller, /"aria-labelledby", heading\.id/);
  assert.match(controller, /"role", "tablist"/);
  assert.match(controller, /"role", "tab"/);
  assert.match(controller, /"aria-selected", tabSemantics\.selected/);
  assert.match(controller, /"aria-controls", tabSemantics\.controls/);
  assert.match(controller, /"role", "tabpanel"/);
  assert.match(controller, /"aria-labelledby", selectedTab\.id/);
  assert.match(controller, /"aria-describedby", description\.id/);
  assert.match(controller, /"aria-atomic", semantics\.atomic/);

  assert.match(page, /className="upload-zone"[\s\S]*role="button"[\s\S]*event\.key === "Enter" \|\| event\.key === " "/);
  assert.match(page, /className="review-tabs"/);
  assert.match(page, /onClick=\{\(\) => setActiveChannel\(channelId\)\}/);
  assert.match(page, /className={`native-preview native-preview--\$\{activeChannel\}`}/);
});
