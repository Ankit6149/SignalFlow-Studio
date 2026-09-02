import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { mergeTodayDecisions, hostedTodayIsResolved } from "../lib/application/todayDecisionSources.mjs";
import {
  createBrowserHostedTodayDecisionClient,
  normalizeHostedTodayDecision,
} from "../lib/infrastructure/browserHostedTodayDecisionClient.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(here, "..");
const read = (relative) => fs.readFileSync(path.join(frontendRoot, relative), "utf8");

function decision(overrides = {}) {
  return {
    decisionId: "platform-review:variant-1:revision-1",
    platformVariantId: "variant-1",
    platformVariantRevisionId: "revision-1",
    platformVariantReviewId: "review-1",
    destination: "linkedin",
    revisionNumber: 1,
    reviewedAt: "2026-09-02T10:00:00.000Z",
    mediaBindings: [],
    findings: [],
    ...overrides,
  };
}

test("hosted Today browser contract marks canonical server decisions as hosted", () => {
  const normalized = normalizeHostedTodayDecision(decision());
  assert.equal(normalized.origin, "hosted");
  assert.equal(normalized.destination, "linkedin");
  assert.equal(normalized.platformVariantRevisionId, "revision-1");
  assert.throws(
    () => normalizeHostedTodayDecision(decision({ destination: "instagram" })),
    (error) => error?.code === "hosted_today_contract_invalid",
  );
});

test("hosted Today browser client is owner-session aware and non-cacheable", async () => {
  const calls = [];
  const client = createBrowserHostedTodayDecisionClient({
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response(JSON.stringify({
        ok: true,
        workspaceId: "owner-workspace",
        decisions: [decision()],
      }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  const result = await client.listDecisions();
  assert.equal(result.decisions.length, 1);
  assert.equal(result.decisions[0].origin, "hosted");
  assert.equal(calls[0].url, "/api/today/decisions");
  assert.equal(calls[0].options.credentials, "same-origin");
  assert.equal(calls[0].options.cache, "no-store");
});

test("Today decision merging preserves both sources and prefers hosted canonical state on identical decision identity", () => {
  const localOnly = decision({ decisionId: "local-only", reviewedAt: "2026-09-02T09:00:00.000Z" });
  const mirroredLocal = decision({ decisionId: "mirrored", content: "browser copy" });
  const hosted = decision({ decisionId: "mirrored", content: "canonical hosted copy", reviewedAt: "2026-09-02T11:00:00.000Z" });

  const merged = mergeTodayDecisions({ local: [localOnly, mirroredLocal], hosted: [hosted] });
  assert.deepEqual(merged.map((item) => item.decisionId), ["mirrored", "local-only"]);
  assert.equal(merged[0].origin, "hosted");
  assert.equal(merged[0].content, "canonical hosted copy");
  assert.equal(merged[1].origin, "local");
  assert.equal(hostedTodayIsResolved("ready"), true);
  assert.equal(hostedTodayIsResolved("error"), false);
});

test("hosted review dependencies compose Today and bounded change requests over the same Postgres repositories", () => {
  const dependencies = read("lib/server/hostedPlatformReviewDependencies.mjs");
  assert.match(dependencies, /createPlatformChangeRequestApplication/);
  assert.match(dependencies, /createTodayDecisionApplication/);
  assert.match(dependencies, /const changeApplication = createPlatformChangeRequestApplication/);
  assert.match(dependencies, /const todayApplication = createTodayDecisionApplication/);
  assert.match(dependencies, /contentPlanningRepository,/);
  assert.match(dependencies, /contentReviewRepository,/);
  assert.match(dependencies, /contentSignalRepository: opportunityCore\.contentSignalRepository/);
  assert.match(dependencies, /contentOpportunityRepository: opportunityCore\.contentOpportunityRepository/);
});

test("hosted Today route stays owner-only, no-store, and derives decisions instead of creating a second state store", () => {
  const route = read("app/api/today/decisions/route.js");
  assert.match(route, /requireOwnerAccess\(request\)/);
  assert.match(route, /cache-control": "private, no-store, max-age=0"/);
  assert.match(route, /apps\.todayApplication\.listDecisions\(\)/);
  assert.doesNotMatch(route, /INSERT|UPDATE|DELETE/);
});

test("hosted change requests reject stale exact revision context before inference", () => {
  const route = read("app/api/platform-review/change-request/route.js");
  const staleCheck = route.indexOf("visible.revision.platformVariantRevisionId !== expectedCurrentRevisionId");
  const requestChange = route.indexOf("apps.changeApplication.requestChange");
  assert.ok(staleCheck >= 0);
  assert.ok(requestChange > staleCheck);
  assert.match(route, /requireOwnerAccess\(request\)/);
  assert.match(route, /MAX_CHANGE_REQUEST_LENGTH = 2000/);
  assert.match(route, /cache-control": "private, no-store, max-age=0"/);
});

test("Today dispatches hosted judgments to hosted persistence and exact-media adapters without weakening local review", () => {
  const today = read("components/TodayWorkspace.js");
  assert.match(today, /createBrowserHostedTodayDecisionClient/);
  assert.match(today, /createBrowserHostedPlatformReviewClient/);
  assert.match(today, /createBrowserHostedChangeRequestClient/);
  assert.match(today, /createBrowserHostedExactMediaPreviewAdapter/);
  assert.match(today, /Promise\.allSettled/);
  assert.match(today, /mergeTodayDecisions\(\{ local, hosted \}\)/);
  assert.match(today, /item\.origin === "hosted"/);
  assert.match(today, /hostedReviewClient\.approveRevision/);
  assert.match(today, /visibleMedia: mediaState\?\.visibleMedia \|\| \[\]/);
  assert.match(today, /hostedReviewClient\.rejectRevision/);
  assert.match(today, /hostedChangeClient\.requestChange/);
  assert.match(today, /expectedCurrentRevisionId: item\.platformVariantRevisionId/);
  assert.match(today, /hostedReviewClient\.reviewRevision/);
  assert.match(today, /previewAdapter=\{item\.origin === "hosted" \? hostedPreviewAdapter : null\}/);
  assert.match(today, /item\.origin !== "hosted" &&/);
  assert.match(today, /localDecisionStatus === "ready"/);
  assert.match(today, /hostedDecisionStatus === "ready"/);
  assert.match(today, /Today will not claim all clear/i);
});
