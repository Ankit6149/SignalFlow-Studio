import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("revision history is one reusable progressive-disclosure surface across Plan and Today", async () => {
  const history = await source("../components/RevisionHistoryPanel.js");
  const plan = await source("../components/PlatformReviewPanel.js");
  const today = await source("../components/TodayWorkspace.js");

  assert.match(plan, /import RevisionHistoryPanel from "\.\/RevisionHistoryPanel"/);
  assert.match(plan, /<RevisionHistoryPanel[\s\S]*context="plan"/);
  assert.match(today, /import RevisionHistoryPanel from "\.\/RevisionHistoryPanel"/);
  assert.match(today, /<RevisionHistoryPanel[\s\S]*context="today"/);
  assert.match(history, /<details className=\{styles\.history\}/);
  assert.match(history, />Revision history</);
});

test("history lets the owner inspect and compare immutable revisions without mutating the current pointer", async () => {
  const component = await source("../components/RevisionHistoryPanel.js");

  assert.match(component, /application\.getRevisionHistory\(variantId\)/);
  assert.match(component, /CURRENT · r\{current\.revision\.revisionNumber\}/);
  assert.match(component, /SELECTED · r\{selected\.revision\.revisionNumber\}/);
  assert.match(component, /selected\.revision\.parentRevisionId/);
  assert.match(component, /decisionLabel\(selected\)/);
  assert.match(component, /reviewFindings\(selected\?\.review\)/);
  assert.match(component, /History never silently changes the active draft/i);
});

test("historical judgment is exact, stale-client safe, and restore creates a new current revision", async () => {
  const component = await source("../components/RevisionHistoryPanel.js");

  assert.match(component, /application\.reviewRevision/);
  assert.match(component, /application\.approveRevision/);
  assert.match(component, /application\.rejectRevision/);
  assert.match(component, /application\.restoreRevision/);
  assert.match(component, /expectedCurrentRevisionId:\s*currentRevisionId/);
  assert.match(component, /stale_revision_context/);
  assert.match(component, /newer revision became current/i);
  assert.match(component, /Restore as new current/);
  assert.match(component, /restored as a new immutable current child/i);
});

test("older planning-contract revisions stay inspectable but cannot be newly judged under a newer story", async () => {
  const component = await source("../components/RevisionHistoryPanel.js");

  assert.match(component, /!selected\.planningCurrent/);
  assert.match(component, /older campaign-plan revision/i);
  assert.match(component, /remains inspectable/i);
  assert.match(component, /!selectedIsCurrent && selected\.planningCurrent/);
});

test("revision-history UI stays behind application boundaries and does not own provider or storage mutation logic", async () => {
  const component = await source("../components/RevisionHistoryPanel.js");

  assert.match(component, /createBrowserPlatformReviewApplication/);
  assert.doesNotMatch(component, /\/api\/|generateJSON|OPENAI_API_KEY|GEMINI_API_KEY|ANTHROPIC_API_KEY/);
  assert.doesNotMatch(component, /localStorage\.(setItem|removeItem|getItem)/);
});

test("revision-history styling remains compact, responsive and keyboard-focus visible", async () => {
  const css = await source("../components/RevisionHistoryPanel.module.css");

  assert.match(css, /\.rail\s*\{/);
  assert.match(css, /overflow-x:\s*auto/);
  assert.match(css, /\.compare\s*\{/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /:focus-visible/);
  assert.doesNotMatch(css, /box-shadow:\s*0\s+\d+px\s+\d+px/);
});
