import test from "node:test";
import assert from "node:assert/strict";
import { createManualContentSignal } from "../lib/domain/contentSignals.mjs";
import { createContentOpportunity } from "../lib/domain/contentOpportunities.mjs";
import {
  approveNarrativeStrategy,
  createNarrativeStrategy,
  createPlannedPlatformVariant,
  createPrimaryContentPiece,
} from "../lib/domain/contentPlanning.mjs";
import {
  attachPlatformVariantRevision,
  createPlatformVariantRevision,
  createRequestedPlatformVariantRevision,
} from "../lib/domain/platformVariantRevisions.mjs";
import {
  createPlatformVariantApproval,
  createPlatformVariantReview,
} from "../lib/domain/platformVariantReviews.mjs";
import { createTodayDecisionApplication, projectOwnerDecisions } from "../lib/application/todayDecisionApplication.mjs";
import { createBrowserTodayDecisionApplication } from "../lib/application/browserTodayDecisionApplication.mjs";
import { createMemoryContentPlanningRepository } from "../lib/infrastructure/contentPlanningAdapters.mjs";
import { createMemoryContentReviewRepository } from "../lib/infrastructure/contentReviewAdapters.mjs";
import { createMemoryContentOpportunityRepository } from "../lib/infrastructure/contentOpportunityAdapters.mjs";
import { createMemoryContentSignalRepository } from "../lib/infrastructure/contentSignalAdapters.mjs";

const WORKSPACE = "local-personal";
const T1 = "2026-08-17T15:00:00.000Z";
const T2 = "2026-08-17T15:10:00.000Z";
const T3 = "2026-08-17T15:20:00.000Z";

function buildFixture({ reviewVerdict = "pass" } = {}) {
  const signal = createManualContentSignal({
    signalId: "signal-today",
    workspaceId: WORKSPACE,
    headline: "Privacy changed the architecture",
    summary: "A privacy constraint moved model choice behind a routing boundary.",
    observedAt: T1,
  });
  const opportunity = createContentOpportunity({
    opportunityId: "opportunity-today",
    workspaceId: WORKSPACE,
    signalIds: [signal.signalId],
    inputFingerprint: "today-opportunity",
    evaluation: {
      recommendation: "post",
      title: "Privacy is a routing decision",
      summary: "Explain the engineering trade-off.",
      whyNow: "The architecture decision is recent and useful to explain.",
      score: 88,
      scoreBreakdown: { freshness: 90, importance: 88, novelty: 82, audienceValue: 86, narrativeFit: 92, evidenceStrength: 80 },
      confidence: 0.92,
      evidenceReadiness: { level: "strong", reason: "The architecture decision is known." },
      narrativeFit: { level: "strong", reason: "It contains a concrete trade-off." },
      repetitionRisk: { level: "unknown", reason: "NarrativeMemory is not implemented." },
      candidateAngles: [
        { title: "Boundary", summary: "Explain the constraint.", approach: "Lead with the boundary." },
        { title: "Trade-off", summary: "Explain the trade-off.", approach: "Lead with the decision." },
        { title: "Lesson", summary: "Explain the lesson.", approach: "Lead with what changed." },
      ],
      candidateDestinations: [{ destination: "linkedin", recommended: true, reason: "The reasoning benefits from context.", format: "single narrative post" }],
      excludedDestinations: [],
      recommendedMediaTypes: ["text_only"],
      freshnessState: "fresh",
      productionEffortEstimate: "low",
    },
    evaluationProvenance: { taskId: "task-opportunity", taskType: "opportunity_evaluation", provider: "test", model: "test", routeKind: "remote", evaluatedAt: T1 },
    createdAt: T1,
  });
  const strategy = approveNarrativeStrategy(createNarrativeStrategy({
    narrativeStrategyId: "strategy-today",
    workspaceId: WORKSPACE,
    opportunityId: opportunity.opportunityId,
    inputFingerprint: "today-strategy",
    selectedAngle: { angleId: "angle-1", title: "Boundary", summary: "Explain the constraint.", approach: "Lead with the boundary." },
    identityContextSnapshotId: "identity-snapshot-today",
    proposal: {
      title: "Privacy belongs in routing",
      coreIdea: "Privacy must constrain routing before a model is selected.",
      audienceTakeaway: "Treat privacy as an execution boundary, not prompt guidance.",
      narrativeArc: ["A privacy constraint appeared", "The routing layer became the enforcement point"],
      hookDirection: "Lead with what changed in the architecture.",
      evidencePlan: ["Use the current architecture decision."],
      factualConstraints: ["Do not claim every route is local."],
      boundaryConstraints: ["Do not expose private repository content."],
      destinationPlan: [{ destination: "linkedin", decision: "include", reason: "Context helps.", format: "single narrative post", adaptationNotes: [] }],
      mediaRequirements: [],
      sequencingNotes: [],
    },
    taskId: "task-strategy",
    createdAt: T1,
  }), T1);
  const piece = createPrimaryContentPiece({ contentPieceId: "piece-today", strategy, opportunityId: opportunity.opportunityId, createdAt: T1 });
  const planned = createPlannedPlatformVariant({
    platformVariantId: "variant-today",
    contentPiece: piece,
    strategy,
    destination: "linkedin",
    identityContextSnapshotId: "identity-snapshot-today",
    createdAt: T1,
  });
  const revision = createPlatformVariantRevision({
    platformVariantRevisionId: "revision-today-1",
    workspaceId: WORKSPACE,
    platformVariantId: planned.platformVariantId,
    contentPieceId: piece.contentPieceId,
    narrativeStrategyId: strategy.narrativeStrategyId,
    destination: "linkedin",
    revisionNumber: 1,
    strategyRevision: strategy.strategyRevision,
    output: { format: "single_post", content: "Privacy stopped being a settings concern when the routing layer had to enforce it.", segments: [] },
    inputFingerprint: "today-revision-1",
    identityContextSnapshotId: "identity-snapshot-today",
    generationProvenance: { taskId: "task-write", provider: "test", model: "writer", routeKind: "remote", promptVersion: "platform_variant_v1", generatedAt: T1 },
    createdAt: T1,
  });
  const variant = attachPlatformVariantRevision(planned, revision, T1);
  const findings = reviewVerdict === "block"
    ? [{ code: "unsupported_claim", severity: "block", message: "One claim is not supported by the supplied evidence.", suggestion: "Remove or qualify it." }]
    : reviewVerdict === "warn"
      ? [{ code: "precision", severity: "warning", message: "One sentence could be more precise." }]
      : [];
  const review = createPlatformVariantReview({
    platformVariantReviewId: "review-today-1",
    workspaceId: WORKSPACE,
    platformVariantId: variant.platformVariantId,
    platformVariantRevisionId: revision.platformVariantRevisionId,
    contentPieceId: piece.contentPieceId,
    narrativeStrategyId: strategy.narrativeStrategyId,
    sourceSignalId: signal.signalId,
    identityContextSnapshotId: revision.identityContextSnapshotId,
    destination: "linkedin",
    strategyRevision: strategy.strategyRevision,
    boundaryPrecheck: { blocked: [], warnings: [] },
    evidence: { verdict: reviewVerdict, summary: reviewVerdict === "block" ? "A claim needs correction." : "Evidence is usable.", findings },
    authenticity: { verdict: "pass", summary: "The revision matches the saved Voice.", findings: [] },
    evidenceProvenance: { taskId: "task-evidence", provider: "test", model: "critic", routeKind: "remote", promptVersion: "evidence_critic_v1", reviewedAt: T2 },
    authenticityProvenance: { taskId: "task-auth", provider: "test", model: "critic", routeKind: "remote", promptVersion: "authenticity_critic_v1", reviewedAt: T2 },
    createdAt: T2,
  });
  return { signal, opportunity, strategy, piece, variant, revision, review };
}

function records(fixture) {
  return {
    planningRecords: [fixture.strategy, fixture.piece, fixture.variant, fixture.revision],
    reviewRecords: [fixture.review],
    signalRecords: [fixture.signal],
    opportunityRecords: [fixture.opportunity],
    workspaceId: WORKSPACE,
  };
}

test("Today projects one exact reviewed current revision and recommends the remaining human decision", () => {
  const fixture = buildFixture();
  const projected = projectOwnerDecisions(records(fixture));
  assert.equal(projected.length, 1);
  assert.equal(projected[0].decisionId, "platform-review:variant-today:revision-today-1");
  assert.equal(projected[0].platformVariantRevisionId, "revision-today-1");
  assert.equal(projected[0].recommendedAction, "approve");
  assert.equal(projected[0].sourceSignal.headline, "Privacy changed the architecture");
  assert.equal(projected[0].strategy.selectedAngle.title, "Boundary");
  assert.equal(projected[0].evidenceVerdict, "pass");
});

test("blocking exact review remains in Today but recommends change instead of approval", () => {
  const fixture = buildFixture({ reviewVerdict: "block" });
  const [item] = projectOwnerDecisions(records(fixture));
  assert.equal(item.reviewVerdict, "block");
  assert.equal(item.recommendedAction, "request_change");
  assert.equal(item.blockers, 1);
  assert.match(item.why, /blocking issue/i);
});

test("exact approval or rejection removes the current revision from Today", () => {
  const fixture = buildFixture();
  const approval = createPlatformVariantApproval({
    platformVariantApprovalId: "approval-today-1",
    workspaceId: WORKSPACE,
    platformVariantId: fixture.variant.platformVariantId,
    platformVariantRevisionId: fixture.revision.platformVariantRevisionId,
    platformVariantReviewId: fixture.review.platformVariantReviewId,
    destination: "linkedin",
    decision: "approved",
    note: "Ship this exact revision.",
    decidedBy: "owner",
    decidedAt: T3,
  });
  assert.equal(projectOwnerDecisions({ ...records(fixture), reviewRecords: [fixture.review, approval] }).length, 0);

  const rejection = createPlatformVariantApproval({
    ...approval,
    platformVariantApprovalId: "rejection-today-1",
    platformVariantReviewId: null,
    decision: "rejected",
    note: "Not this story.",
  });
  assert.equal(projectOwnerDecisions({ ...records(fixture), reviewRecords: [fixture.review, rejection] }).length, 0);
});

test("a newer review invalidates an older exact approval and returns the same revision to Today once", () => {
  const fixture = buildFixture();
  const approval = createPlatformVariantApproval({
    platformVariantApprovalId: "approval-today-old-review",
    workspaceId: WORKSPACE,
    platformVariantId: fixture.variant.platformVariantId,
    platformVariantRevisionId: fixture.revision.platformVariantRevisionId,
    platformVariantReviewId: fixture.review.platformVariantReviewId,
    destination: "linkedin",
    decision: "approved",
    decidedBy: "owner",
    decidedAt: T2,
  });
  const newerReview = createPlatformVariantReview({
    ...fixture.review,
    platformVariantReviewId: "review-today-2",
    evidence: { verdict: "warn", summary: "A newer precision check has one warning.", findings: [{ code: "precision", severity: "warning", message: "Qualify one sentence." }] },
    evidenceProvenance: { ...fixture.review.evidenceProvenance, taskId: "task-evidence-2", reviewedAt: T3 },
    authenticityProvenance: { ...fixture.review.authenticityProvenance, taskId: "task-auth-2", reviewedAt: T3 },
    createdAt: T3,
  });
  const projected = projectOwnerDecisions({ ...records(fixture), reviewRecords: [fixture.review, approval, newerReview] });
  assert.equal(projected.length, 1);
  assert.equal(projected[0].platformVariantReviewId, "review-today-2");
  assert.equal(projected[0].warnings, 1);
});

test("a new current revision stays out of Today until its exact critics have completed, then re-enters", () => {
  const fixture = buildFixture();
  const revised = createRequestedPlatformVariantRevision({
    platformVariantRevisionId: "revision-today-2",
    parentRevision: fixture.revision,
    revisionNumber: 2,
    output: { format: "single_post", content: "Privacy became an execution rule when routing started enforcing the boundary.", segments: [] },
    changeRequest: "Make the opening more direct.",
    generationProvenance: { taskId: "task-revise", provider: "test", model: "writer", routeKind: "remote", promptVersion: "platform_variant_revision_v1", generatedAt: T3 },
    createdAt: T3,
  });
  const currentVariant = attachPlatformVariantRevision(fixture.variant, revised, T3);
  const planningRecords = [fixture.strategy, fixture.piece, currentVariant, fixture.revision, revised];
  assert.equal(projectOwnerDecisions({ ...records(fixture), planningRecords }).length, 0);

  const revisedReview = createPlatformVariantReview({
    ...fixture.review,
    platformVariantReviewId: "review-today-revised",
    platformVariantRevisionId: revised.platformVariantRevisionId,
    evidenceProvenance: { ...fixture.review.evidenceProvenance, taskId: "task-evidence-revised", reviewedAt: T3 },
    authenticityProvenance: { ...fixture.review.authenticityProvenance, taskId: "task-auth-revised", reviewedAt: T3 },
    createdAt: T3,
  });
  const projected = projectOwnerDecisions({ ...records(fixture), planningRecords, reviewRecords: [fixture.review, revisedReview] });
  assert.equal(projected.length, 1);
  assert.equal(projected[0].platformVariantRevisionId, revised.platformVariantRevisionId);
  assert.equal(projected[0].revisionOrigin, "ai_revised");
});

test("application derives decisions through repository ports rather than persisting a Today store", async () => {
  const fixture = buildFixture();
  const application = createTodayDecisionApplication({
    contentPlanningRepository: createMemoryContentPlanningRepository(records(fixture).planningRecords),
    contentReviewRepository: createMemoryContentReviewRepository(records(fixture).reviewRecords),
    contentSignalRepository: createMemoryContentSignalRepository(records(fixture).signalRecords),
    contentOpportunityRepository: createMemoryContentOpportunityRepository(records(fixture).opportunityRecords),
    workspaceId: WORKSPACE,
  });
  const decisions = await application.listDecisions();
  assert.equal(decisions.length, 1);
  assert.equal(decisions[0].type, "platform_review");
});

test("browser reopen reconstructs the same Today queue from canonical local repositories", async () => {
  const fixture = buildFixture();
  const data = new Map([
    ["signalflow_content_planning_v1", JSON.stringify(records(fixture).planningRecords)],
    ["signalflow_content_reviews_v1", JSON.stringify(records(fixture).reviewRecords)],
    ["signalflow_content_signals_v1", JSON.stringify(records(fixture).signalRecords)],
    ["signalflow_content_opportunities_v1", JSON.stringify(records(fixture).opportunityRecords)],
  ]);
  const storage = {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, value); },
    removeItem(key) { data.delete(key); },
  };
  const first = createBrowserTodayDecisionApplication({ getStorage: () => storage, workspaceId: WORKSPACE });
  const second = createBrowserTodayDecisionApplication({ getStorage: () => storage, workspaceId: WORKSPACE });
  assert.deepEqual(await second.listDecisions(), await first.listDecisions());
  assert.equal((await second.listDecisions()).length, 1);
});
