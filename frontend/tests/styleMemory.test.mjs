import test from "node:test";
import assert from "node:assert/strict";

import {
  FEEDBACK_KINDS,
  LEARNING_ELIGIBILITY,
  STYLE_MEMORY_CATEGORIES,
  STYLE_MEMORY_SCOPES,
  STYLE_MEMORY_STATUSES,
  STYLE_OBSERVATION_DIRECTIONS,
  analyzeRevisionStyleDelta,
  createFeedbackEvent,
} from "../lib/domain/styleMemory.mjs";
import { createStyleMemoryApplication } from "../lib/application/styleMemoryApplication.mjs";
import { createMemoryStyleMemoryRepository } from "../lib/infrastructure/styleMemoryAdapters.mjs";
import { createDeterministicIdService } from "../lib/domain/ports.mjs";

const TIMES = [
  "2026-08-18T00:10:00.000Z",
  "2026-08-18T00:11:00.000Z",
  "2026-08-18T00:12:00.000Z",
  "2026-08-18T00:13:00.000Z",
  "2026-08-18T00:14:00.000Z",
  "2026-08-18T00:15:00.000Z",
  "2026-08-18T00:16:00.000Z",
  "2026-08-18T00:17:00.000Z",
];

function fixture() {
  let index = 0;
  const repository = createMemoryStyleMemoryRepository();
  const application = createStyleMemoryApplication({
    styleMemoryRepository: repository,
    workspaceId: "local-personal",
    userId: "owner",
    idService: createDeterministicIdService("style"),
    clock: { now: () => TIMES[Math.min(index++, TIMES.length - 1)] },
  });
  return { repository, application };
}

const restraintObservation = (direction = STYLE_OBSERVATION_DIRECTIONS.SUPPORT) => ({
  hypothesisKey: "tone.restrained_over_promotional",
  hypothesis: "Prefer restrained, concrete language over promotional hype.",
  category: STYLE_MEMORY_CATEGORIES.PROMOTION,
  direction,
  weight: 0.8,
  reason: "Owner removed or objected to promotional framing.",
});

async function feedback(application, { id, observation = restraintObservation(), eligibility = LEARNING_ELIGIBILITY.ELIGIBLE, platform = "linkedin" } = {}) {
  return application.recordFeedback({
    feedbackEventId: id,
    targetType: "platform_variant_revision",
    targetId: `revision-${id}`,
    platform,
    feedbackKind: FEEDBACK_KINDS.CHANGES_REQUESTED,
    structuredReason: { code: "test", observations: [observation] },
    learningEligibility: eligibility,
    createdAt: "2026-08-18T00:00:00.000Z",
  });
}

test("one isolated correction stays a candidate rather than becoming a permanent style rule", async () => {
  const { application } = fixture();
  const result = await feedback(application, { id: "feedback-1" });
  assert.equal(result.hypotheses.length, 1);
  assert.equal(result.hypotheses[0].status, STYLE_MEMORY_STATUSES.CANDIDATE);
  assert.equal(result.hypotheses[0].evidenceCount, 1);
  assert.ok(result.hypotheses[0].confidence < 0.65);
});

test("repeated supporting evidence activates the same platform-scoped hypothesis deterministically", async () => {
  const { application } = fixture();
  await feedback(application, { id: "feedback-1" });
  await feedback(application, { id: "feedback-2" });
  const hypotheses = await application.listHypotheses();
  assert.equal(hypotheses.length, 1);
  assert.equal(hypotheses[0].status, STYLE_MEMORY_STATUSES.ACTIVE);
  assert.equal(hypotheses[0].scope.type, STYLE_MEMORY_SCOPES.PLATFORM);
  assert.equal(hypotheses[0].scope.platform, "linkedin");
  assert.equal(hypotheses[0].supportingFeedbackEventIds.length, 2);
  assert.equal(hypotheses[0].evidenceCount, 2);
});

test("contradictory evidence weakens an active hypothesis instead of silently preserving it", async () => {
  const { application } = fixture();
  await feedback(application, { id: "feedback-1" });
  await feedback(application, { id: "feedback-2" });
  const active = (await application.listHypotheses())[0];
  const activeConfidence = active.confidence;
  await feedback(application, { id: "feedback-3", observation: restraintObservation(STYLE_OBSERVATION_DIRECTIONS.CONTRADICT) });
  const weakened = (await application.listHypotheses())[0];
  assert.equal(weakened.contradictingFeedbackEventIds.length, 1);
  assert.ok(weakened.confidence < activeConfidence);
  assert.equal(weakened.status, STYLE_MEMORY_STATUSES.CANDIDATE);
});

test("factual/compliance/one-off feedback stays in the evidence log but cannot create learned hypotheses", async () => {
  for (const eligibility of [
    LEARNING_ELIGIBILITY.EXCLUDED_FACTUAL,
    LEARNING_ELIGIBILITY.EXCLUDED_COMPLIANCE,
    LEARNING_ELIGIBILITY.EXCLUDED_ONE_OFF,
  ]) {
    const { application } = fixture();
    const result = await feedback(application, { id: `feedback-${eligibility}`, eligibility });
    assert.equal(result.hypotheses.length, 0);
    assert.equal((await application.listFeedbackEvents()).length, 1);
    assert.equal((await application.listHypotheses()).length, 0);
  }
});

test("explicit owner preference can be user-confirmed immediately and remains scoped", async () => {
  const { application } = fixture();
  const result = await application.recordExplicitPreference({ reason: "Use less promotional language", platform: "linkedin" });
  assert.equal(result.hypotheses.length, 1);
  assert.equal(result.hypotheses[0].status, STYLE_MEMORY_STATUSES.USER_CONFIRMED);
  assert.equal(result.hypotheses[0].confidence, 1);
  assert.equal(result.hypotheses[0].scope.type, STYLE_MEMORY_SCOPES.PLATFORM);
  assert.equal(result.hypotheses[0].scope.platform, "linkedin");
});

test("bounded relevant memory excludes another platform and returns compact snapshots with safe version provenance", async () => {
  const { application } = fixture();
  await application.recordExplicitPreference({ reason: "Use less promotional language", platform: "linkedin" });
  await application.recordExplicitPreference({ reason: "Make it shorter", platform: "x" });

  const linkedin = await application.relevantMemory({ platform: "linkedin", limit: 1 });
  assert.equal(linkedin.length, 1);
  assert.equal(linkedin[0].scope.platform, "linkedin");
  assert.equal(Object.hasOwn(linkedin[0], "supportingFeedbackEventIds"), false);
  assert.equal(Object.hasOwn(linkedin[0], "exampleApprovedRevisionIds"), false);
  assert.equal(Object.hasOwn(linkedin[0], "updatedAt"), true);
  assert.match(linkedin[0].updatedAt, /^2026-08-18T/);

  const x = await application.relevantMemory({ platform: "x", limit: 1 });
  assert.equal(x.length, 1);
  assert.equal(x[0].scope.platform, "x");
});

test("reset removes learned hypotheses without deleting immutable feedback history", async () => {
  const { application } = fixture();
  await application.recordExplicitPreference({ reason: "Use less promotional language", platform: "linkedin" });
  assert.equal((await application.listHypotheses()).length, 1);
  assert.equal((await application.listFeedbackEvents()).length, 1);
  assert.equal(await application.resetHypotheses(), 1);
  assert.equal((await application.listHypotheses()).length, 0);
  assert.equal((await application.listFeedbackEvents()).length, 1);
});

test("structured approved-edit delta contains safe observations but never copies either raw draft", () => {
  const before = "I am super excited to announce this revolutionary game-changing update that unlocks an amazing future for everyone.";
  const after = "I changed this because the original routing constraint made private processing impossible to guarantee.";
  const observations = analyzeRevisionStyleDelta(before, after);
  assert.ok(observations.some((item) => item.hypothesisKey === "opening.problem_reason_over_announcement"));
  assert.ok(observations.some((item) => item.hypothesisKey === "tone.restrained_over_promotional"));
  const serialized = JSON.stringify(observations);
  assert.equal(serialized.includes(before), false);
  assert.equal(serialized.includes(after), false);
});

test("FeedbackEvent serialization contains revision refs and structured observations, not raw before/after content", () => {
  const event = createFeedbackEvent({
    feedbackEventId: "feedback-safe",
    workspaceId: "local-personal",
    userId: "owner",
    targetType: "platform_variant_revision",
    targetId: "revision-after",
    platform: "linkedin",
    feedbackKind: FEEDBACK_KINDS.APPROVED_AFTER_EDIT,
    structuredReason: { code: "approved_after_owner_edit", observations: [restraintObservation()] },
    beforeRevisionId: "revision-before",
    afterRevisionId: "revision-after",
    learningEligibility: LEARNING_ELIGIBILITY.ELIGIBLE,
    createdAt: "2026-08-18T00:00:00.000Z",
  });
  assert.equal(event.beforeRevisionId, "revision-before");
  assert.equal(event.afterRevisionId, "revision-after");
  assert.equal(Object.hasOwn(event, "beforeContent"), false);
  assert.equal(Object.hasOwn(event, "afterContent"), false);
});
