import test from "node:test";
import assert from "node:assert/strict";

import { createStyleMemoryApplication } from "../lib/application/styleMemoryApplication.mjs";
import { createBrowserStyleMemoryApplication } from "../lib/application/browserStyleMemoryApplication.mjs";
import {
  withStyleLearningChangeRequests,
  withStyleLearningGeneration,
  withStyleLearningReview,
} from "../lib/application/styleLearningDecorators.mjs";
import { createMemoryStyleMemoryRepository } from "../lib/infrastructure/styleMemoryAdapters.mjs";
import {
  createEditedPlatformVariantRevision,
  createPlatformVariantRevision,
  createRequestedPlatformVariantRevision,
} from "../lib/domain/platformVariantRevisions.mjs";
import { createDeterministicIdService } from "../lib/domain/ports.mjs";

const NOW = "2026-08-18T00:25:00.000Z";

function parentRevision({ id = "revision-parent", content = "I am super excited to announce this revolutionary game-changing update that unlocks an amazing future for everyone." } = {}) {
  return createPlatformVariantRevision({
    platformVariantRevisionId: id,
    workspaceId: "local-personal",
    platformVariantId: "variant-1",
    contentPieceId: "piece-1",
    narrativeStrategyId: "strategy-1",
    destination: "linkedin",
    revisionNumber: 1,
    strategyRevision: 1,
    output: { format: "single_post", content, segments: [] },
    inputFingerprint: "input-parent",
    identityContextSnapshotId: "snapshot-1",
    generationProvenance: {
      taskId: "task-parent",
      provider: "test",
      model: "writer",
      routeKind: "remote",
      promptVersion: "platform_variant_v1",
      generatedAt: NOW,
    },
    createdAt: NOW,
  });
}

function styleFixture(repository = createMemoryStyleMemoryRepository()) {
  return {
    repository,
    application: createStyleMemoryApplication({
      styleMemoryRepository: repository,
      workspaceId: "local-personal",
      userId: "owner",
      clock: { now: () => NOW },
      idService: createDeterministicIdService("style-int"),
    }),
  };
}

test("successful exact approval after owner edit creates feedback and a candidate style hypothesis", async () => {
  const parent = parentRevision();
  const edited = createEditedPlatformVariantRevision({
    platformVariantRevisionId: "revision-edited",
    parentRevision: parent,
    revisionNumber: 2,
    content: "I changed this because the routing constraint made private processing impossible to guarantee.",
    editedBy: "owner",
    createdAt: "2026-08-18T00:26:00.000Z",
  });
  const { application: styleMemory } = styleFixture();
  const planning = { async get(id) { return id === parent.platformVariantRevisionId ? parent : null; } };
  const approval = {
    platformVariantApprovalId: "approval-1",
    decision: "approved",
    note: "",
    decidedAt: "2026-08-18T00:27:00.000Z",
  };
  const base = {
    async getReviewBundle() { return { revision: edited }; },
    async approveCurrentVariant() { return approval; },
    async rejectCurrentVariant() { throw new Error("not used"); },
    async reviewCurrentVariant() {},
    async editCurrentVariant() {},
  };
  const learned = withStyleLearningReview({ reviewApplication: base, contentPlanningRepository: planning, styleMemoryApplication: styleMemory, clock: { now: () => NOW } });

  assert.equal(await learned.approveCurrentVariant("variant-1"), approval);
  const events = await styleMemory.listFeedbackEvents();
  assert.equal(events.length, 1);
  assert.equal(events[0].feedbackKind, "approved_after_edit");
  assert.equal(events[0].beforeRevisionId, parent.platformVariantRevisionId);
  assert.equal(events[0].afterRevisionId, edited.platformVariantRevisionId);
  const hypotheses = await styleMemory.listHypotheses();
  assert.ok(hypotheses.some((item) => item.status === "candidate"));
  assert.ok(hypotheses.some((item) => item.hypothesisKey === "tone.restrained_over_promotional"));
});

test("successful rejection with an explicit style reason creates negative review evidence", async () => {
  const revision = parentRevision({ id: "revision-reject", content: "A formal corporate update about our seamless transformation." });
  const { application: styleMemory } = styleFixture();
  const decision = {
    platformVariantApprovalId: "approval-reject",
    decision: "rejected",
    note: "Too corporate. Make it less formal.",
    decidedAt: NOW,
  };
  const base = {
    async getReviewBundle() { return { revision }; },
    async approveCurrentVariant() { throw new Error("not used"); },
    async rejectCurrentVariant() { return decision; },
    async reviewCurrentVariant() {},
    async editCurrentVariant() {},
  };
  const learned = withStyleLearningReview({ reviewApplication: base, contentPlanningRepository: { async get() { return null; } }, styleMemoryApplication: styleMemory });
  assert.equal(await learned.rejectCurrentVariant("variant-1", decision.note), decision);
  const events = await styleMemory.listFeedbackEvents();
  assert.equal(events[0].feedbackKind, "rejected");
  assert.ok((await styleMemory.listHypotheses()).some((item) => item.hypothesisKey === "tone.less_corporate"));
});

test("StyleMemory storage failure never changes a successful exact approval result and remains diagnosable", async () => {
  const revision = parentRevision({ id: "revision-stable" });
  const approval = { platformVariantApprovalId: "approval-stable", decision: "approved", decidedAt: NOW };
  const base = {
    async getReviewBundle() { return { revision }; },
    async approveCurrentVariant() { return approval; },
    async rejectCurrentVariant() { throw new Error("not used"); },
    async reviewCurrentVariant() {},
    async editCurrentVariant() {},
  };
  const failingStyle = {
    async recordApprovedRevision() { throw new Error("storage quota unavailable"); },
    async recordRejection() {},
  };
  const learned = withStyleLearningReview({ reviewApplication: base, contentPlanningRepository: { async get() { return null; } }, styleMemoryApplication: failingStyle, clock: { now: () => NOW } });
  assert.equal(await learned.approveCurrentVariant("variant-1"), approval);
  assert.equal(learned.getLearningDiagnostics().length, 1);
  assert.equal(learned.getLearningDiagnostics()[0].action, "approved_revision");
  assert.match(learned.getLearningDiagnostics()[0].message, /storage quota unavailable/i);
});

test("successful natural-language change request records the parent revision and explainable style request", async () => {
  const parent = parentRevision({ id: "revision-change" });
  const child = createRequestedPlatformVariantRevision({
    platformVariantRevisionId: "revision-change-child",
    parentRevision: parent,
    revisionNumber: 2,
    output: { format: "single_post", content: "A restrained revision with concrete detail.", segments: [] },
    changeRequest: "Use less promotional language and make it shorter.",
    generationProvenance: {
      taskId: "task-change",
      provider: "test",
      model: "writer",
      routeKind: "remote",
      promptVersion: "platform_variant_revision_v1",
      generatedAt: NOW,
    },
    createdAt: NOW,
  });
  const { application: styleMemory } = styleFixture();
  const learned = withStyleLearningChangeRequests({
    changeRequestApplication: { async requestChange() { return child; } },
    contentPlanningRepository: { async get(id) { return id === parent.platformVariantRevisionId ? parent : null; } },
    styleMemoryApplication: styleMemory,
    clock: { now: () => NOW },
  });
  const result = await learned.requestChange("variant-1", "Use less promotional language and make it shorter.");
  assert.equal(result.platformVariantRevisionId, child.platformVariantRevisionId);
  const events = await styleMemory.listFeedbackEvents();
  assert.equal(events.length, 1);
  assert.equal(events[0].feedbackKind, "changes_requested");
  assert.equal(events[0].beforeRevisionId, parent.platformVariantRevisionId);
  const keys = (await styleMemory.listHypotheses()).map((item) => item.hypothesisKey);
  assert.ok(keys.includes("tone.restrained_over_promotional"));
  assert.ok(keys.includes("brevity.tighter_drafts"));
});

test("explicit regeneration records feedback but does not invent a learned style rule", async () => {
  const prior = parentRevision({ id: "revision-regenerate" });
  const next = parentRevision({ id: "revision-regenerated-result", content: "A new generated draft." });
  const { application: styleMemory } = styleFixture();
  const learned = withStyleLearningGeneration({
    generationApplication: {
      async regenerateVariant() { return next; },
      async generateVariant() { return next; },
      async generateReadyVariants() { return { generated: [next], failed: [] }; },
      async getGenerationBundle() { return {}; },
    },
    contentPlanningRepository: {
      async get(id) {
        if (id === "variant-1") return { currentRevisionId: prior.platformVariantRevisionId };
        if (id === prior.platformVariantRevisionId) return prior;
        return null;
      },
    },
    styleMemoryApplication: styleMemory,
    clock: { now: () => NOW },
  });
  assert.equal((await learned.regenerateVariant("variant-1")).platformVariantRevisionId, next.platformVariantRevisionId);
  const events = await styleMemory.listFeedbackEvents();
  assert.equal(events[0].feedbackKind, "regenerated");
  assert.equal(events[0].learningEligibility, "excluded_one_off");
  assert.equal((await styleMemory.listHypotheses()).length, 0);
});

test("browser StyleMemory survives application reconstruction using the same local storage key", async () => {
  const data = new Map();
  const storage = {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, value); },
  };
  const options = {
    getStorage: () => storage,
    key: "style-memory-test",
    workspaceId: "local-personal",
    userId: "owner",
    clock: { now: () => NOW },
    idService: createDeterministicIdService("browser-style"),
  };
  const first = createBrowserStyleMemoryApplication(options);
  await first.recordExplicitPreference({ reason: "Use less promotional language", platform: "linkedin" });

  const reopened = createBrowserStyleMemoryApplication({ ...options, idService: createDeterministicIdService("browser-style-reopen") });
  const hypotheses = await reopened.listHypotheses();
  assert.equal(hypotheses.length, 1);
  assert.equal(hypotheses[0].status, "user_confirmed");
  assert.equal((await reopened.listFeedbackEvents()).length, 1);
  assert.equal((await reopened.relevantMemory({ platform: "linkedin" }))[0].styleMemoryId, hypotheses[0].styleMemoryId);
});
