import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  filterTodayActionableOpportunities,
  isTodayActionableOpportunity,
} from "../lib/application/todayOpportunityPresentation.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(here, "..");
const read = (relative) => fs.readFileSync(path.join(frontendRoot, relative), "utf8");

function entry(overrides = {}) {
  return {
    key: "hosted:opp-1",
    origin: "hosted",
    opportunity: {
      opportunityId: "opp-1",
      recommendation: "post",
      status: "proposed",
      selectedAngleId: null,
      ...overrides,
    },
  };
}

test("Today opportunity eligibility fails closed to unjudged post-worthy proposed or shortlisted items", () => {
  assert.equal(isTodayActionableOpportunity(entry()), true);
  assert.equal(isTodayActionableOpportunity(entry({ status: "shortlisted" })), true);
  assert.equal(isTodayActionableOpportunity(entry({ recommendation: "hold" })), false);
  assert.equal(isTodayActionableOpportunity(entry({ recommendation: "skip" })), false);
  assert.equal(isTodayActionableOpportunity(entry({ status: "selected" })), false);
  assert.equal(isTodayActionableOpportunity(entry({ status: "snoozed" })), false);
  assert.equal(isTodayActionableOpportunity(entry({ status: "rejected" })), false);
  assert.equal(isTodayActionableOpportunity(entry({ status: "converted_to_campaign" })), false);
  assert.equal(isTodayActionableOpportunity(entry({ status: "future_status" })), false);
  assert.equal(isTodayActionableOpportunity(entry({ selectedAngleId: "angle-1" })), false);
  assert.equal(isTodayActionableOpportunity(null), false);
});

test("Today opportunity filtering preserves ranked order while removing non-actionable entries", () => {
  const visible = entry({ opportunityId: "opp-visible" });
  visible.key = "hosted:opp-visible";
  const selected = entry({ opportunityId: "opp-selected", selectedAngleId: "angle-2" });
  const second = entry({ opportunityId: "opp-second", status: "shortlisted" });
  second.key = "local:opp-second";
  second.origin = "local";

  const result = filterTodayActionableOpportunities([visible, selected, second]);
  assert.deepEqual(result.map((item) => item.key), ["hosted:opp-visible", "local:opp-second"]);
  assert.deepEqual(filterTodayActionableOpportunities(null), []);
});

test("Today renders the ranked opportunity queue without changing exact review behavior", () => {
  const today = read("components/TodayWorkspace.js");
  assert.match(today, /import TodayOpportunityQueue from "\.\/TodayOpportunityQueue"/);
  assert.match(today, /const \[opportunityCount, setOpportunityCount\] = useState\(null\)/);
  assert.match(today, /<TodayOpportunityQueue onStatus=\{setMessage\} onCountChange=\{setOpportunityCount\} \/>/);
  assert.match(today, /const inboxLoading = loading \|\| opportunityCount === null/);
  assert.match(today, /const allClear = !inboxLoading && decisions\.length === 0 && opportunityCount === 0/);
  assert.match(today, /decisions\.length > 0 \?/);
  assert.match(today, /reviewApplication\.approveRevision/);
  assert.match(today, /reviewApplication\.rejectRevision/);
  assert.match(today, /changeApplication\.requestChange/);
});

test("Today opportunity queue reuses Plan persistence and keeps angle selection in Plan", () => {
  const queue = read("components/TodayOpportunityQueue.js");
  assert.match(queue, /createBrowserPlanOpportunityApplication/);
  assert.match(queue, /application\.listRankedOpportunities\(\)/);
  assert.match(queue, /filterTodayActionableOpportunities\(result\.entries\)/);
  assert.match(queue, /application\.notNow\(entry\)/);
  assert.match(queue, /application\.rejectOpportunity\(entry\)/);
  assert.match(queue, /href=\{`\/plan\?opportunity=\$\{encodeURIComponent\(opportunity\.opportunityId\)\}`\}/);
  assert.match(queue, />See ideas<\/Link>/);
  assert.match(queue, />Later<\/button>/);
  assert.match(queue, />Ignore<\/button>/);
  assert.doesNotMatch(queue, /application\.selectAngle\(/);
  assert.doesNotMatch(queue, /application\.startHere\(/);
});

test("Today opportunity cards expose canonical why-now, evidence, repetition, destination and media guidance", () => {
  const queue = read("components/TodayOpportunityQueue.js");
  assert.match(queue, /opportunity\.whyNow/);
  assert.match(queue, /opportunity\.evidenceReadiness\?\.level/);
  assert.match(queue, /opportunity\.evidenceReadiness\?\.reason/);
  assert.match(queue, /opportunity\.repetitionRisk\?\.level/);
  assert.match(queue, /opportunity\.repetitionRisk\?\.reason/);
  assert.match(queue, /opportunity\.recommendedAngleId/);
  assert.match(queue, /opportunity\.candidateDestinations/);
  assert.match(queue, /opportunity\.recommendedMediaTypes/);
  assert.match(queue, /originLabel\(entry\.origin\)/);
});

test("Today queue reports loading/count truth and never claims all-clear when connected opportunities are unknown", () => {
  const queue = read("components/TodayOpportunityQueue.js");
  assert.match(queue, /onCountChange\(actionable\.length \|\| \(result\.hostedState\.status === "ready" \? 0 : -1\)\)/);
  assert.match(queue, /onCountChange\(-1\)/);
  assert.match(queue, /hostedState\.status !== "ready"/);
  assert.match(queue, /any visible direct-create opportunities remain actionable/i);
  assert.match(queue, /Checking for work worth your attention/);

  const today = read("components/TodayWorkspace.js");
  assert.match(today, /opportunityCount === 0/);
  assert.doesNotMatch(today, /opportunityCount <= 0/);
});

test("Today opportunity queue remains responsive", () => {
  const css = read("components/TodayOpportunityQueue.module.css");
  assert.match(css, /@media\(max-width:800px\)/);
  assert.match(css, /\.whyNow,\.assessments,\.recommendation\{grid-template-columns:1fr\}/);
  assert.match(css, /\.actions a,\.actions button\{flex:1 1 7rem\}/);
});
