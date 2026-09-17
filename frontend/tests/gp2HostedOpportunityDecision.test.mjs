import test from "node:test";
import assert from "node:assert/strict";

import { createBrowserPlanOpportunityApplication } from "../lib/application/browserPlanOpportunityApplication.mjs";
import { createContentOpportunityApplication } from "../lib/application/contentOpportunityApplication.mjs";
import { createContentOpportunity } from "../lib/domain/contentOpportunities.mjs";
import { createMemoryContentOpportunityRepository } from "../lib/infrastructure/contentOpportunityAdapters.mjs";
import { createMemoryContentSignalRepository } from "../lib/infrastructure/contentSignalAdapters.mjs";

const NOW = "2026-09-18T00:00:00.000Z";
const WORKSPACE = "owner-local";

function opportunity() {
  return createContentOpportunity({
    opportunityId: "opportunity-hosted-gp2",
    workspaceId: WORKSPACE,
    projectId: "sf-project-github-9001",
    projectContextSnapshotId: "context-hosted-gp2",
    signalIds: ["signal-hosted-gp2"],
    inputFingerprint: "fnv1a:hosted01",
    evaluation: {
      recommendation: "post",
      title: "A meaningful connected-source story",
      summary: "Choose the exact narrative direction before planning.",
      whyNow: "Verified work changed.",
      score: 91,
      confidence: 0.93,
      candidateAngles: [
        { title: "Architecture", summary: "Explain the architecture decision.", approach: "Lead with the boundary." },
        { title: "Trade-off", summary: "Explain the trade-off behind the change.", approach: "Lead with the constraint." },
        { title: "Lesson", summary: "Teach the engineering lesson.", approach: "Lead with what changed in understanding." },
      ],
      recommendedAngleTitle: "Trade-off",
    },
    evaluationProvenance: {
      taskId: "task-hosted-gp2",
      taskType: "opportunity_evaluation",
      provider: "fixture",
      model: "fixture",
      routeKind: "remote",
      evaluatedAt: NOW,
    },
    createdAt: NOW,
  });
}

test("hosted canonical opportunity persists an offered angle and Something else as exact selected decisions", async () => {
  const repository = createMemoryContentOpportunityRepository([opportunity()]);
  const application = createContentOpportunityApplication({
    contentOpportunityRepository: repository,
    contentSignalRepository: createMemoryContentSignalRepository(),
    inferenceAdapter: { async execute() { throw new Error("inference is not part of owner angle selection"); } },
    workspaceId: WORKSPACE,
    clock: { now: () => NOW },
    idService: { create: (kind) => `${kind}-unused` },
  });

  const selected = await application.selectAngle("opportunity-hosted-gp2", "angle-1");
  assert.equal(selected.status, "selected");
  assert.equal(selected.selectedAngleId, "angle-1");
  assert.equal(selected.customAngle, null);

  const custom = await application.setCustomAngle("opportunity-hosted-gp2", {
    title: "Something else",
    summary: "Explain how the product stays truthful when automation fails.",
    approach: "Lead with the failure boundary and the owner-visible consequence.",
  });
  assert.equal(custom.status, "selected");
  assert.equal(custom.selectedAngleId, "custom");
  assert.equal(custom.customAngle.title, "Something else");
  assert.match(custom.customAngle.summary, /stays truthful/);

  const stored = await repository.get("opportunity-hosted-gp2");
  assert.equal(stored.selectedAngleId, "custom", "the owner decision must survive beyond the request that made it");
});

test("Plan routes offered and custom decisions to hosted persistence rather than the browser-local application", async () => {
  const calls = [];
  const record = opportunity();
  const local = {
    async listRankedOpportunities() { return []; },
    async selectAngle() { throw new Error("hosted choice must not mutate local opportunity state"); },
    async setCustomAngle() { throw new Error("hosted custom choice must not mutate local opportunity state"); },
  };
  const hosted = {
    async listRankedOpportunities() { return { workspaceId: WORKSPACE, opportunities: [record] }; },
    async selectAngle(id, angleId) { calls.push(["select_angle", id, angleId]); return { opportunity: record }; },
    async setCustomAngle(id, customAngle) { calls.push(["custom_angle", id, customAngle]); return { opportunity: record }; },
  };
  const plan = createBrowserPlanOpportunityApplication({
    localApplication: local,
    hostedClient: hosted,
    now: () => Date.parse(NOW),
  });
  const entry = { key: `hosted:${record.opportunityId}`, origin: "hosted", opportunity: record };

  await plan.selectAngle(entry, "angle-3");
  await plan.setCustomAngle(entry, { summary: "Use a different owner-authored direction." });

  assert.deepEqual(calls, [
    ["select_angle", "opportunity-hosted-gp2", "angle-3"],
    ["custom_angle", "opportunity-hosted-gp2", { summary: "Use a different owner-authored direction." }],
  ]);
});
