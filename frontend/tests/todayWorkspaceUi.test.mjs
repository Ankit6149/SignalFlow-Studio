import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("Today is a real shared-shell route and not a roadmap placeholder", async () => {
  const shell = await source("../components/WorkspaceShell.js");
  const page = await source("../app/today/page.js");
  assert.match(shell, /id: "today", label: "Today", href: "\/today", status: "available"/);
  assert.doesNotMatch(shell, /id: "today", label: "Today", status: "next"/);
  assert.match(page, /TodayWorkspace/);
  assert.match(page, /Review only the exact content decisions that need your judgment/);
});

test("Today keeps the primary owner interaction to judgment rather than workflow administration", async () => {
  const component = await source("../components/TodayWorkspace.js");
  assert.match(component, /Only the decisions that need you/);
  assert.match(component, /Nothing needs your judgment/);
  assert.match(component, /blocked \? "Resolve blockers first" : mediaApprovalBlocked \? "Resolve exact media preview" : busy \? "Saving…" : item\.mediaBindings\?\.length \? "Approve text \+ media" : "Approve"/);
  assert.match(component, />Request change<\/button>/);
  assert.match(component, />Reject<\/button>/);
  assert.match(component, /<summary>Details<\/summary>/);
  assert.doesNotMatch(component, /Run checks|Choose this direction|Build campaign plan|Generate drafts|Select a narrative direction/);
});

test("Today delegates to application services and binds judgment to the exact visible revision", async () => {
  const component = await source("../components/TodayWorkspace.js");
  assert.match(component, /createBrowserTodayDecisionApplication/);
  assert.match(component, /createBrowserPlatformReviewApplication/);
  assert.match(component, /createBrowserPlatformChangeRequestApplication/);
  assert.match(component, /todayApplication\.listDecisions\(\)/);
  assert.match(component, /reviewApplication\.approveRevision\(item\.platformVariantId, item\.platformVariantRevisionId/);
  assert.match(component, /reviewApplication\.rejectRevision\(item\.platformVariantId, item\.platformVariantRevisionId/);
  assert.match(component, /expectedCurrentRevisionId:\s*item\.platformVariantRevisionId/);
  assert.match(component, /changeApplication\.requestChange/);
  assert.doesNotMatch(component, /\/api\/|generateJSON|localStorage\.(setItem|removeItem)/);
});

test("Today fails safe when its visible decision became stale", async () => {
  const component = await source("../components/TodayWorkspace.js");
  assert.match(component, /error\?\.code === "stale_revision_context"/);
  assert.match(component, /newer revision became current/i);
  assert.match(component, /unseen content/i);
  assert.match(component, /visible\.revision\?\.platformVariantRevisionId !== item\.platformVariantRevisionId/);
});

test("Today composes requested revision plus exact critics so the owner returns directly to judgment", async () => {
  const component = await source("../components/TodayWorkspace.js");
  const requestIndex = component.indexOf("await changeApplication.requestChange");
  const reviewIndex = component.indexOf("await reviewApplication.reviewCurrentVariant", requestIndex);
  assert.ok(requestIndex >= 0, "Today should request a bounded exact revision through the application service");
  assert.ok(reviewIndex > requestIndex, "Today should re-run critics after the requested revision is persisted");
  assert.match(component, /revisionCreated = true/);
  assert.match(component, /new revision was saved, but its checks did not finish/i);
  assert.match(component, /It will not appear as approval-ready until checks complete/i);
});

test("blocked review or unresolved exact media prevents approval in the primary decision row", async () => {
  const component = await source("../components/TodayWorkspace.js");
  assert.match(component, /const blocked = item\.reviewVerdict === "block"/);
  assert.match(component, /const mediaApprovalBlocked = Boolean\(item\.mediaBindings\?\.length && !mediaPreviewStates\[item\.decisionId\]\?\.ready\)/);
  assert.match(component, /disabled=\{busy \|\| blocked \|\| mediaApprovalBlocked\}/);
  assert.match(component, /blocked \? "Resolve blockers first"/);
  assert.match(component, /mediaApprovalBlocked \? "Resolve exact media preview"/);
  assert.match(component, /blocked \? styles\.primaryAction : styles\.secondaryAction/);
});

test("Today visual system stays restrained, responsive and focus-safe", async () => {
  const css = await source("../components/TodayWorkspace.module.css");
  assert.match(css, /background:transparent/);
  assert.match(css, /color:#181714/);
  assert.match(css, /#8b713d/);
  assert.match(css, /#fcfbf8/);
  assert.match(css, /@media\s*\(\s*max-width:\s*800px\s*\)/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /box-shadow:0 9px 24px rgba\(24,23,20,\.025\)/);
  assert.doesNotMatch(css, /border-radius:\s*(1rem|2rem|3rem)/);
});
