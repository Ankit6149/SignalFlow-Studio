import test from "node:test";
import assert from "node:assert/strict";
import {
  createContentOpportunity,
  normalizeContentOpportunity,
} from "../lib/domain/contentOpportunities.mjs";
import {
  approveNarrativeStrategy,
  createNarrativeStrategy,
  normalizeNarrativeStrategy,
  reviseNarrativeStrategy,
} from "../lib/domain/contentPlanning.mjs";
import {
  AUTOPILOT_OUTCOMES,
  AUTOPILOT_POLICY_VERSION,
  evaluateOpportunityForAutopilot,
  evaluateVoiceForAutopilot,
} from "../lib/application/autopilotPolicy.mjs";

const NOW = "2026-08-17T16:30:00.000Z";

function opportunity(overrides = {}) {
  const evaluation = {
    recommendation: "post",
    title: "Privacy is an execution boundary",
    summary: "Explain why privacy changed routing architecture rather than becoming another setting.",
    whyNow: "The decision is recent and useful to other builders.",
    score: 88,
    scoreBreakdown: {
      freshness: 90,
      importance: 88,
      novelty: 82,
      audienceValue: 86,
      narrativeFit: 90,
      evidenceStrength: 84,
    },
    confidence: 0.9,
    evidenceReadiness: { level: "strong", reason: "The architectural decision is directly known." },
    narrativeFit: { level: "strong", reason: "The signal contains a concrete constraint and trade-off." },
    repetitionRisk: { level: "unknown", reason: "NarrativeMemory is not implemented." },
    candidateAngles: [
      { title: "Architecture boundary", summary: "Explain the routing boundary.", approach: "Lead with the constraint and resulting architecture." },
      { title: "Privacy trade-off", summary: "Explain the trade-off.", approach: "Lead with what privacy prevented." },
      { title: "Engineering lesson", summary: "Explain the lesson.", approach: "Lead with what changed in the design process." },
      { title: "Local-first implication", summary: "Explain the local-first implication.", approach: "Lead with where processing is allowed." },
    ],
    recommendedAngleTitle: "Architecture boundary",
    candidateDestinations: [
      { destination: "linkedin", recommended: true, reason: "The reasoning benefits from context.", format: "single narrative post" },
      { destination: "x", recommended: true, reason: "The core observation can be concise.", format: "single post" },
    ],
    excludedDestinations: [],
    recommendedMediaTypes: ["text_only"],
    freshnessState: "fresh",
    productionEffortEstimate: "low",
    ...overrides,
  };
  return createContentOpportunity({
    opportunityId: "opportunity-autopilot",
    workspaceId: "local-personal",
    signalIds: ["signal-autopilot"],
    inputFingerprint: "fnv1a:12345678",
    evaluation,
    evaluationProvenance: {
      taskId: "task-opportunity",
      taskType: "opportunity_evaluation",
      provider: "test",
      model: "editorial-test",
      routeKind: "remote",
      evaluatedAt: NOW,
    },
    createdAt: NOW,
  });
}

function strategy(selectedAngle = {}) {
  return createNarrativeStrategy({
    narrativeStrategyId: "strategy-autopilot",
    workspaceId: "local-personal",
    opportunityId: "opportunity-autopilot",
    inputFingerprint: "strategy-input",
    selectedAngle: {
      angleId: "angle-1",
      title: "Architecture boundary",
      summary: "Explain the routing boundary.",
      approach: "Lead with the constraint and resulting architecture.",
      ...selectedAngle,
    },
    identityContextSnapshotId: "identity-context-autopilot",
    proposal: {
      title: "Privacy belongs in routing",
      coreIdea: "Privacy changes which inference route is permitted before a provider is selected.",
      audienceTakeaway: "Treat privacy as an execution boundary, not prompt guidance.",
      narrativeArc: ["A privacy constraint appeared.", "The architecture moved enforcement into routing."],
      hookDirection: "Lead with the architecture change.",
      evidencePlan: ["Use the known routing decision."],
      factualConstraints: ["Do not claim every route is local."],
      boundaryConstraints: ["Do not expose private repository content."],
      destinationPlan: [
        { destination: "linkedin", decision: "include", reason: "Context helps.", format: "single narrative post", adaptationNotes: [] },
        { destination: "x", decision: "include", reason: "The observation is compact.", format: "single post", adaptationNotes: [] },
      ],
      mediaRequirements: [],
      sequencingNotes: [],
    },
    taskId: "task-strategy",
    createdAt: NOW,
  });
}

test("opportunity evaluation resolves an explicit recommended angle by exact candidate title and survives round-trip", () => {
  const record = opportunity();
  assert.equal(record.recommendedAngleId, "angle-1");
  assert.equal(normalizeContentOpportunity(JSON.parse(JSON.stringify(record))).recommendedAngleId, "angle-1");
});

test("missing or mismatched machine angle recommendation escalates instead of assuming first array item", () => {
  const record = opportunity({ recommendedAngleTitle: "A title not present in candidateAngles" });
  assert.equal(record.recommendedAngleId, null);
  const decision = evaluateOpportunityForAutopilot(record);
  assert.equal(decision.outcome, AUTOPILOT_OUTCOMES.NEEDS_PLAN);
  assert.equal(decision.gate, "recommended_angle");
});

test("strong text-ready opportunity advances under explicit versioned policy", () => {
  const decision = evaluateOpportunityForAutopilot(opportunity());
  assert.equal(decision.outcome, AUTOPILOT_OUTCOMES.ADVANCE);
  assert.equal(decision.policyVersion, AUTOPILOT_POLICY_VERSION);
  assert.equal(decision.angle.angleId, "angle-1");
  assert.deepEqual(decision.destinations, ["linkedin", "x"]);
  assert.match(decision.notes[0], /NarrativeMemory is not implemented/);
});

test("policy escalates low score, weak evidence, unsupported media dependency, and skip recommendation", () => {
  assert.equal(evaluateOpportunityForAutopilot(opportunity({ score: 70 })).gate, "score");
  assert.equal(evaluateOpportunityForAutopilot(opportunity({ evidenceReadiness: { level: "weak", reason: "Only a vague statement exists." } })).gate, "evidence");
  assert.equal(evaluateOpportunityForAutopilot(opportunity({ recommendedMediaTypes: ["short_video"] })).gate, "media_requirement");
  assert.equal(evaluateOpportunityForAutopilot(opportunity({ recommendation: "skip", candidateAngles: [], recommendedAngleTitle: "" })).outcome, AUTOPILOT_OUTCOMES.NOT_WORTH_POSTING);
});

test("explicit Voice plus every included platform expression is required before autopilot may advance", () => {
  const core = { identity: { version: 1 }, voice: { version: 1 }, boundary: { version: 1 } };
  const missing = evaluateVoiceForAutopilot({ ...core, platformExpressions: { linkedin: { version: 1 } } }, ["linkedin", "x"]);
  assert.equal(missing.outcome, AUTOPILOT_OUTCOMES.NEEDS_VOICE);
  assert.deepEqual(missing.missingDestinations, ["x"]);

  const ready = evaluateVoiceForAutopilot({ ...core, platformExpressions: { linkedin: { version: 1 }, x: { version: 1 } } }, ["linkedin", "x"]);
  assert.equal(ready.outcome, AUTOPILOT_OUTCOMES.ADVANCE);
});

test("manual NarrativeStrategy decisions remain owner provenance by default", () => {
  const draft = strategy();
  assert.equal(draft.selectedAngle.selectionOrigin, "owner");
  assert.equal(draft.selectedAngle.selectionPolicyVersion, null);
  const approved = approveNarrativeStrategy(draft, NOW);
  assert.equal(approved.approvalOrigin, "owner");
  assert.equal(approved.approvalPolicyVersion, null);
});

test("autopilot strategy records machine angle and internal acceptance provenance without pretending owner choice", () => {
  const draft = strategy({
    selectionOrigin: "autopilot_policy",
    selectionPolicyVersion: AUTOPILOT_POLICY_VERSION,
    selectionReason: "Highest-confidence editorial direction returned by the opportunity evaluator and accepted by policy gates.",
  });
  assert.equal(draft.selectedAngle.selectionOrigin, "autopilot_policy");
  assert.equal(draft.selectedAngle.selectionPolicyVersion, AUTOPILOT_POLICY_VERSION);

  const approved = approveNarrativeStrategy(draft, NOW, {
    origin: "autopilot_policy",
    policyVersion: AUTOPILOT_POLICY_VERSION,
    reason: "Internal strategy accepted only for preparation; final content approval remains owner-only.",
  });
  assert.equal(approved.approvalOrigin, "autopilot_policy");
  assert.equal(approved.approvalPolicyVersion, AUTOPILOT_POLICY_VERSION);
  assert.match(approved.approvalReason, /final content approval remains owner-only/i);

  const revised = reviseNarrativeStrategy(approved, { hookDirection: "Use a clearer first sentence." }, "2026-08-17T16:35:00.000Z");
  assert.equal(revised.approvedAt, null);
  assert.equal(revised.approvalOrigin, null);
  assert.equal(revised.approvalPolicyVersion, null);
});

test("strategy normalization rejects unsupported decision provenance rather than accepting arbitrary actors", () => {
  assert.throws(() => normalizeNarrativeStrategy({
    ...strategy(),
    selectedAngle: { ...strategy().selectedAngle, selectionOrigin: "model_magic" },
  }), /selectionOrigin contains unsupported value/i);
});
