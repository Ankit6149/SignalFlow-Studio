import test from "node:test";
import assert from "node:assert/strict";
import {
  approveNarrativeStrategy,
  createNarrativeStrategy,
  createPlannedPlatformVariant,
  createPrimaryContentPiece,
  reviseNarrativeStrategy,
} from "../lib/domain/contentPlanning.mjs";
import { createManualContentSignal } from "../lib/domain/contentSignals.mjs";
import { createContentOpportunity, selectOpportunityAngle } from "../lib/domain/contentOpportunities.mjs";
import { createContentPlanningApplication } from "../lib/application/contentPlanningApplication.mjs";
import { createIdentityApplication } from "../lib/application/identityApplication.mjs";
import { createMemoryContentPlanningRepository } from "../lib/infrastructure/contentPlanningAdapters.mjs";
import { createMemoryContentOpportunityRepository } from "../lib/infrastructure/contentOpportunityAdapters.mjs";
import { createMemoryContentSignalRepository } from "../lib/infrastructure/contentSignalAdapters.mjs";
import { createMemoryIdentityRepository } from "../lib/infrastructure/identityAdapters.mjs";
import { createDeterministicIdService } from "../lib/domain/ports.mjs";

const NOW = "2026-08-17T12:00:00.000Z";

function proposal(overrides = {}) {
  return {
    title: "Privacy is a product boundary",
    coreIdea: "Treating privacy as an enforceable routing constraint changed the architecture, not just the policy text.",
    audienceTakeaway: "Good AI product architecture decides what data may move before choosing the strongest model.",
    narrativeArc: [
      "The original convenience-first assumption",
      "The confidentiality constraint that broke it",
      "The Private Hybrid design decision",
    ],
    hookDirection: "Open with the architectural constraint rather than a launch announcement.",
    evidencePlan: ["Explain which raw repository context stays local.", "Use only implemented privacy-routing facts."],
    factualConstraints: ["Do not claim full local-only inference is shipped."],
    boundaryConstraints: ["Do not expose private repository contents."],
    destinationPlan: [
      { destination: "linkedin", decision: "include", reason: "The decision benefits from context.", format: "single narrative post", adaptationNotes: ["Keep the trade-off clear."] },
      { destination: "x", decision: "exclude", reason: "The nuance would be compressed too far for this story.", format: "single post", adaptationNotes: [] },
    ],
    mediaRequirements: [{ type: "diagram", reason: "A simple boundary flow may clarify the architecture.", required: false }],
    sequencingNotes: [],
    ...overrides,
  };
}

function baseStrategy(overrides = {}) {
  return createNarrativeStrategy({
    narrativeStrategyId: "strategy-1",
    workspaceId: "local-personal",
    opportunityId: "opportunity-1",
    inputFingerprint: "fingerprint-1",
    selectedAngle: { angleId: "angle-1", title: "The boundary", summary: "Explain the privacy boundary.", approach: "Lead with the constraint." },
    identityContextSnapshotId: "snapshot-1",
    proposal: proposal(),
    taskId: "task-strategy-1",
    createdAt: NOW,
    ...overrides,
  });
}

function manualSignal(overrides = {}) {
  return createManualContentSignal({
    signalId: "signal-1",
    workspaceId: "local-personal",
    headline: "We changed the privacy architecture",
    summary: "Raw private repository context should not leave the trusted device by default.",
    observedAt: NOW,
    privacyClassification: "workspace_private",
    ...overrides,
  });
}

function opportunity({ selected = true } = {}) {
  const created = createContentOpportunity({
    opportunityId: "opportunity-1",
    workspaceId: "local-personal",
    signalIds: ["signal-1"],
    inputFingerprint: "signal-fingerprint",
    evaluation: {
      recommendation: "post",
      title: "The privacy boundary changed the product architecture",
      summary: "Explain the decision instead of announcing a feature.",
      whyNow: "The architecture decision is recent and meaningful.",
      score: 84,
      scoreBreakdown: { freshness: 90, importance: 85, novelty: 75, audienceValue: 86, narrativeFit: 82, evidenceStrength: 70 },
      confidence: 0.86,
      evidenceReadiness: { level: "medium", reason: "The decision is clear." },
      narrativeFit: { level: "strong", reason: "It supports a useful engineering story." },
      repetitionRisk: { level: "unknown", reason: "Narrative memory is not supplied." },
      candidateAngles: [
        { title: "The boundary", summary: "Explain what must stay local.", approach: "Lead with constraint." },
        { title: "The trade-off", summary: "Explain quality versus confidentiality.", approach: "Lead with trade-off." },
        { title: "The lesson", summary: "Privacy belongs in routing code.", approach: "Lead with lesson." },
        { title: "The flow", summary: "Explain the minimized evidence flow.", approach: "Lead with architecture." },
      ],
      candidateDestinations: [
        { destination: "linkedin", recommended: true, reason: "Good context fit.", format: "narrative post" },
        { destination: "x", recommended: true, reason: "Could work concisely.", format: "short thread" },
      ],
      excludedDestinations: [],
      recommendedMediaTypes: ["diagram"],
      freshnessState: "fresh",
      productionEffortEstimate: "low",
    },
    evaluationProvenance: { taskId: "task-opportunity", taskType: "opportunity_evaluation", provider: "test", model: "test", routeKind: "remote", evaluatedAt: NOW },
    createdAt: NOW,
  });
  return selected ? selectOpportunityAngle(created, "angle-1", NOW) : created;
}

async function configuredIdentityApplication(idService = createDeterministicIdService("identity")) {
  const application = createIdentityApplication({
    identityRepository: createMemoryIdentityRepository(),
    workspaceId: "local-personal",
    userId: "owner",
    clock: { now: () => NOW },
    idService,
  });
  await application.saveMinimalProfile({
    primaryTopics: "software systems\nAI products",
    desiredAudienceImpressions: "thoughtful builder",
    qualitiesToSignal: "precise\ncalm",
    qualitiesToAvoid: "hype-driven persona",
    writingPrinciples: "specific over impressive\nexplain trade-offs",
    dislikes: "generic launch language",
    customBoundaryRules: "never expose private repository contents",
    linkedinRules: "Use enough context for reasoning.",
    xRules: "Get to the observation quickly.",
  });
  return application;
}

test("NarrativeStrategy is provider-free editorial state and ContentPiece requires explicit approval", () => {
  const strategy = baseStrategy();
  assert.equal(strategy.kind, "NarrativeStrategy");
  assert.equal(strategy.status, "draft");
  assert.equal(strategy.inputFingerprint, "fingerprint-1");
  assert.equal(strategy.origin.taskId, "task-strategy-1");
  assert.equal("provider" in strategy.origin, false);
  assert.equal("model" in strategy.origin, false);
  assert.throws(() => createPrimaryContentPiece({ contentPieceId: "piece-1", strategy, opportunityId: "opportunity-1", createdAt: NOW }), /approved NarrativeStrategy/);

  const approved = approveNarrativeStrategy(strategy, NOW);
  const piece = createPrimaryContentPiece({ contentPieceId: "piece-1", strategy: approved, opportunityId: "opportunity-1", createdAt: NOW });
  assert.equal(piece.kind, "ContentPiece");
  assert.equal(piece.canonicalIntent, approved.coreIdea);
});

test("editing an approved strategy creates a new draft revision and invalidates approval", () => {
  const approved = approveNarrativeStrategy(baseStrategy(), NOW);
  const revised = reviseNarrativeStrategy(approved, { coreIdea: "A narrower revised idea." }, "2026-08-17T12:05:00.000Z");
  assert.equal(revised.strategyRevision, 2);
  assert.equal(revised.status, "draft");
  assert.equal(revised.approvedAt, null);
  assert.equal(revised.coreIdea, "A narrower revised idea.");
});

test("excluded destination becomes an explicit omitted PlatformVariant", () => {
  const approved = approveNarrativeStrategy(baseStrategy(), NOW);
  const piece = createPrimaryContentPiece({ contentPieceId: "piece-1", strategy: approved, opportunityId: "opportunity-1", createdAt: NOW });
  const linkedin = createPlannedPlatformVariant({ platformVariantId: "variant-li", contentPiece: piece, strategy: approved, destination: "linkedin", createdAt: NOW });
  const x = createPlannedPlatformVariant({ platformVariantId: "variant-x", contentPiece: piece, strategy: approved, destination: "x", createdAt: NOW });
  assert.equal(linkedin.status, "planned");
  assert.equal(x.status, "omitted");
  assert.match(x.omittedReason, /nuance/i);
});

test("application refuses to plan before angle selection and before Voice setup", async () => {
  const signalRepository = createMemoryContentSignalRepository([manualSignal()]);
  const noAngleRepo = createMemoryContentOpportunityRepository([opportunity({ selected: false })]);
  const planRepo = createMemoryContentPlanningRepository();
  const emptyIdentity = createIdentityApplication({
    identityRepository: createMemoryIdentityRepository(),
    workspaceId: "local-personal",
    userId: "owner",
    clock: { now: () => NOW },
    idService: createDeterministicIdService("identity-empty"),
  });
  const inferenceAdapter = { async execute() { throw new Error("should not run"); } };
  const appNoAngle = createContentPlanningApplication({
    contentPlanningRepository: planRepo,
    contentOpportunityRepository: noAngleRepo,
    contentSignalRepository: signalRepository,
    identityApplication: emptyIdentity,
    inferenceAdapter,
    workspaceId: "local-personal",
    clock: { now: () => NOW },
    idService: createDeterministicIdService("planning"),
  });
  await assert.rejects(() => appNoAngle.buildStrategy("opportunity-1"), /Choose a narrative direction/);

  const selectedRepo = createMemoryContentOpportunityRepository([opportunity({ selected: true })]);
  const appNoVoice = createContentPlanningApplication({
    contentPlanningRepository: createMemoryContentPlanningRepository(),
    contentOpportunityRepository: selectedRepo,
    contentSignalRepository: signalRepository,
    identityApplication: emptyIdentity,
    inferenceAdapter,
    workspaceId: "local-personal",
    clock: { now: () => NOW },
    idService: createDeterministicIdService("planning-voice"),
  });
  await assert.rejects(() => appNoVoice.buildStrategy("opportunity-1"), (error) => error.code === "voice_profile_required");
});

test("application persists strategy, reuses unchanged profile versions, and approval creates only LinkedIn/X variant records", async () => {
  const ids = createDeterministicIdService("golden");
  const identityApplication = await configuredIdentityApplication(ids);
  const planningRepository = createMemoryContentPlanningRepository();
  let inferenceCalls = 0;
  const application = createContentPlanningApplication({
    contentPlanningRepository: planningRepository,
    contentOpportunityRepository: createMemoryContentOpportunityRepository([opportunity({ selected: true })]),
    contentSignalRepository: createMemoryContentSignalRepository([manualSignal()]),
    identityApplication,
    inferenceAdapter: {
      async execute({ task, input }) {
        inferenceCalls += 1;
        assert.equal(task.taskType, "narrative_strategy");
        assert.equal(input.dataClassification, "workspace_private");
        assert.ok(input.identityContext.profileRefs.identity.version >= 1);
        return { output: proposal(), provenance: { taskId: task.taskId, provider: "test", model: "test", routeKind: "remote", evaluatedAt: NOW } };
      },
    },
    workspaceId: "local-personal",
    clock: { now: () => NOW },
    idService: ids,
  });

  const first = await application.buildStrategy("opportunity-1");
  const second = await application.buildStrategy("opportunity-1");
  assert.equal(first.narrativeStrategyId, second.narrativeStrategyId);
  assert.equal(inferenceCalls, 1);
  assert.ok(first.identityContextSnapshotId);
  assert.ok(first.inputFingerprint.includes("identityProfileRefs"));

  const bundle = await application.approveStrategy(first.narrativeStrategyId);
  assert.equal(bundle.strategy.status, "approved");
  assert.equal(bundle.contentPiece.kind, "ContentPiece");
  assert.deepEqual(bundle.variants.map((item) => item.destination).sort(), ["linkedin", "x"]);
  assert.equal(bundle.variants.find((item) => item.destination === "x").status, "omitted");
  assert.equal((await planningRepository.list()).filter((item) => item.kind === "PlatformVariant").length, 2);
});
