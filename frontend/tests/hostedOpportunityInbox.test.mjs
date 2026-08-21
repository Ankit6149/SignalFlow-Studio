import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createBrowserPlanOpportunityApplication } from "../lib/application/browserPlanOpportunityApplication.mjs";
import { createContentOpportunity } from "../lib/domain/contentOpportunities.mjs";
import { createBrowserHostedContentOpportunityClient } from "../lib/infrastructure/browserHostedContentOpportunityClient.mjs";

const NOW = "2026-08-21T17:00:00.000Z";

function opportunity({ id = "opportunity-1", workspaceId = "owner-local", score = 80, recommendedAngleTitle = "Explain the trade-off", status = "proposed", snoozedUntil = null } = {}) {
  const created = createContentOpportunity({
    opportunityId: id,
    workspaceId,
    projectId: "project-1",
    projectContextSnapshotId: "context-1",
    signalIds: [`signal-${id}`],
    inputFingerprint: `fnv1a:${id.padEnd(8, "0").slice(0, 8)}`,
    evaluation: {
      recommendation: "post",
      title: `Opportunity ${id}`,
      summary: "A useful project story.",
      whyNow: "Verified work changed.",
      score,
      confidence: 0.8,
      candidateAngles: [
        { title: "Ship update", summary: "A shipping update." },
        { title: "Explain the trade-off", summary: "Explain the decision and trade-off." },
        { title: "Teach the lesson", summary: "Teach what changed." },
      ],
      recommendedAngleTitle,
    },
    evaluationProvenance: {
      taskId: `task-${id}`,
      taskType: "opportunity_evaluation",
      provider: "fixture",
      model: "fixture",
      routeKind: "local",
      evaluatedAt: NOW,
    },
    createdAt: NOW,
  });
  return status === "snoozed"
    ? { ...created, status, snoozedUntil, updatedAt: NOW }
    : created;
}

function localStub(items = []) {
  return {
    async listRankedOpportunities() { return items; },
    async selectAngle(id, angleId) { return { id, angleId }; },
    async setCustomAngle(id, customAngle) { return { id, customAngle }; },
    async rejectOpportunity(id) { return { id }; },
    async snoozeOpportunity(id, snoozedUntil) { return { id, snoozedUntil }; },
    async evaluateSignal(signalId) { return { signalId }; },
  };
}

function hostedStub(items = []) {
  const calls = [];
  return {
    calls,
    async listRankedOpportunities() { return { workspaceId: "owner-local", opportunities: items }; },
    async selectAngle(id, angleId) { calls.push(["selectAngle", id, angleId]); return { id, angleId }; },
    async selectRecommended(id) { calls.push(["selectRecommended", id]); return { id }; },
    async setCustomAngle(id, customAngle) { calls.push(["custom", id, customAngle]); return { id }; },
    async rejectOpportunity(id) { calls.push(["reject", id]); return { id }; },
    async snoozeOpportunity(id, until) { calls.push(["snooze", id, until]); return { id }; },
    async refreshSignal(id) { calls.push(["refresh", id]); return { id }; },
  };
}

test("Plan combines hosted automatic and browser-local opportunities without copying either canonical record", async () => {
  const hostedOpportunity = opportunity({ id: "hosted-1", score: 92 });
  const localOpportunity = opportunity({ id: "local-1", workspaceId: "local-personal", score: 65 });
  const app = createBrowserPlanOpportunityApplication({
    localApplication: localStub([localOpportunity]),
    hostedClient: hostedStub([hostedOpportunity]),
    now: () => Date.parse(NOW),
  });
  const result = await app.listRankedOpportunities();
  assert.deepEqual(result.entries.map((entry) => [entry.origin, entry.opportunity.opportunityId]), [
    ["hosted", "hosted-1"],
    ["local", "local-1"],
  ]);
  assert.equal(result.entries[0].opportunity, hostedOpportunity);
  assert.equal(result.entries[1].opportunity, localOpportunity);
});

test("Start here follows the explicit recommended angle and never assumes the first candidate", async () => {
  const hosted = hostedStub([]);
  const record = opportunity({ id: "hosted-2" });
  assert.equal(record.recommendedAngleId, "angle-2");
  const app = createBrowserPlanOpportunityApplication({
    localApplication: localStub([]),
    hostedClient: hosted,
    now: () => Date.parse(NOW),
  });
  await app.startHere({ key: "hosted:hosted-2", origin: "hosted", opportunity: record });
  assert.deepEqual(hosted.calls, [["selectRecommended", "hosted-2"]]);
});

test("Start here fails closed when no exact recommended angle exists", async () => {
  const record = opportunity({ id: "hosted-3", recommendedAngleTitle: "Missing angle" });
  const app = createBrowserPlanOpportunityApplication({
    localApplication: localStub([]),
    hostedClient: hostedStub([]),
    now: () => Date.parse(NOW),
  });
  await assert.rejects(
    () => app.startHere({ key: "hosted:hosted-3", origin: "hosted", opportunity: record }),
    (error) => error?.code === "opportunity_recommended_angle_required",
  );
});

test("Not now snoozes only the Opportunity for seven days and does not mutate ProjectContext", async () => {
  const hosted = hostedStub([]);
  const record = opportunity({ id: "hosted-4" });
  const app = createBrowserPlanOpportunityApplication({
    localApplication: localStub([]),
    hostedClient: hosted,
    now: () => Date.parse(NOW),
  });
  await app.notNow({ key: "hosted:hosted-4", origin: "hosted", opportunity: record });
  assert.equal(hosted.calls[0][0], "snooze");
  assert.equal(hosted.calls[0][1], "hosted-4");
  assert.equal(hosted.calls[0][2], "2026-08-28T17:00:00.000Z");
  assert.equal(hosted.calls.some(([method]) => /context/i.test(method)), false);
});

test("active snoozes disappear from the normal Plan inbox and return only when requested or expired", async () => {
  const future = opportunity({ id: "future", status: "snoozed", snoozedUntil: "2026-08-28T17:00:00.000Z" });
  const expired = opportunity({ id: "expired-snooze", status: "snoozed", snoozedUntil: "2026-08-20T17:00:00.000Z" });
  const app = createBrowserPlanOpportunityApplication({
    localApplication: localStub([]),
    hostedClient: hostedStub([future, expired]),
    now: () => Date.parse(NOW),
  });
  const normal = await app.listRankedOpportunities();
  assert.deepEqual(normal.entries.map((entry) => entry.opportunity.opportunityId), ["expired-snooze"]);
});

test("hosted client uses owner API and keeps canonical Opportunity validation at the browser boundary", async () => {
  const record = opportunity({ id: "hosted-5" });
  const calls = [];
  const client = createBrowserHostedContentOpportunityClient({
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response(JSON.stringify({ ok: true, workspaceId: "owner-local", opportunities: [record] }), { status: 200 });
    },
  });
  const result = await client.listRankedOpportunities({ includeRejected: true });
  assert.equal(calls[0].url, "/api/opportunities?includeRejected=1");
  assert.equal(calls[0].options.method, "GET");
  assert.equal(result.opportunities[0].opportunityId, "hosted-5");
});

test("hosted opportunity route remains owner-only and exposes bounded editorial actions", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const route = fs.readFileSync(path.join(here, "../app/api/opportunities/route.js"), "utf8");
  assert.match(route, /requireOwnerAccess/);
  assert.match(route, /MAX_BODY_BYTES/);
  assert.match(route, /requireJsonContentType/);
  assert.match(route, /opportunity_action_content_type_required/);
  assert.match(route, /select_recommended/);
  assert.match(route, /snooze/);
  assert.match(route, /continueToOpportunity/);
  assert.doesNotMatch(route, /localStorage|GITHUB_PRIVATE_KEY|raw_payload/);
});
