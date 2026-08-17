import test from "node:test";
import assert from "node:assert/strict";

import { createGoldenPathAutopilotApplication } from "../lib/application/goldenPathAutopilotApplication.mjs";
import { createContentOpportunity } from "../lib/domain/contentOpportunities.mjs";

const NOW = "2026-08-17T16:45:00.000Z";

function highConfidenceOpportunity() {
  return createContentOpportunity({
    opportunityId: "opportunity-partial",
    workspaceId: "local-personal",
    signalIds: ["signal-partial"],
    inputFingerprint: "fnv1a:partial",
    evaluation: {
      recommendation: "post",
      title: "Privacy is an execution boundary",
      summary: "Explain the routing consequence of a privacy classification.",
      whyNow: "The decision is concrete and recent.",
      score: 92,
      confidence: 0.94,
      scoreBreakdown: {
        freshness: 92,
        importance: 90,
        novelty: 84,
        audienceValue: 88,
        evidenceStrength: 90,
        narrativeFit: 90,
      },
      evidenceReadiness: { level: "strong", reason: "Direct evidence exists." },
      narrativeFit: { level: "strong", reason: "Clear story fit." },
      repetitionRisk: { level: "unknown", reason: "NarrativeMemory is not implemented." },
      freshnessState: "fresh",
      candidateAngles: [
        { title: "Architecture boundary", summary: "Explain the boundary.", approach: "Lead with the constraint." },
        { title: "Fail closed", summary: "Explain fail-closed behavior.", approach: "Lead with the refusal to downgrade." },
        { title: "Product promise", summary: "Explain privacy as behavior.", approach: "Lead with the promise." },
      ],
      recommendedAngleId: "angle-1",
      candidateDestinations: [
        { destination: "linkedin", recommended: true, reason: "The reasoning benefits from context.", format: "single narrative post" },
        { destination: "x", recommended: true, reason: "The lesson can be concise.", format: "single post" },
      ],
      recommendedMediaTypes: ["text_only"],
      productionEffortEstimate: "low",
    },
    evaluationProvenance: {
      taskId: "task-partial-opportunity",
      taskType: "opportunity_evaluation",
      provider: "test",
      model: "test-model",
      routeKind: "remote",
      evaluatedAt: NOW,
    },
    createdAt: NOW,
  });
}

function voiceProfile() {
  return {
    identity: { identityProfileId: "identity-1" },
    voice: { voiceProfileId: "voice-1" },
    boundary: { boundaryProfileId: "boundary-1" },
    platformExpressions: {
      linkedin: { platformExpressionProfileId: "linkedin-1" },
      x: { platformExpressionProfileId: "x-1" },
    },
  };
}

test("autopilot preserves a reviewed destination and reports partial_failure when the other destination fails", async () => {
  const opportunity = highConfidenceOpportunity();
  const strategy = {
    narrativeStrategyId: "strategy-partial",
    identityContextSnapshotId: "snapshot-1",
    title: "Privacy is an execution boundary",
    coreIdea: "Protected context changes inference routing.",
    audienceTakeaway: "Privacy must change execution behavior.",
    hookDirection: "Lead with the routing consequence.",
    narrativeArc: ["Constraint", "Routing", "Fail closed"],
    factualConstraints: [],
    boundaryConstraints: [],
    destinationPlan: [
      { destination: "linkedin", decision: "include" },
      { destination: "x", decision: "include" },
    ],
    mediaRequirements: [{ type: "text_only", required: false }],
  };
  const linkedin = { platformVariantId: "variant-linkedin", destination: "linkedin", status: "review" };
  const x = { platformVariantId: "variant-x", destination: "x", status: "failed" };

  let internalStrategyAcceptanceCalls = 0;
  const app = createGoldenPathAutopilotApplication({
    opportunityApplication: {
      async evaluateSignal() { return opportunity; },
    },
    identityApplication: {
      async getMinimalProfile() { return voiceProfile(); },
      async evaluateBoundaries() { return { allowed: true, blocked: [], warnings: [] }; },
    },
    planningApplication: {
      async buildStrategy() { return strategy; },
      async approveStrategy() {
        internalStrategyAcceptanceCalls += 1;
        return {
          strategy: { ...strategy, status: "approved", approvalOrigin: "autopilot_policy" },
          contentPiece: { contentPieceId: "piece-partial" },
          variants: [linkedin, x],
        };
      },
    },
    generationApplication: {
      async generateReadyVariants() {
        return {
          generated: [{ platformVariantRevisionId: "revision-linkedin" }],
          failed: [{
            platformVariantId: "variant-x",
            destination: "x",
            code: "platform_variant_generation_failed",
            message: "X generation failed.",
          }],
          bundle: {
            variants: [
              { variant: linkedin, currentRevision: { platformVariantRevisionId: "revision-linkedin" } },
              { variant: x, currentRevision: null },
            ],
          },
        };
      },
    },
    reviewApplication: {
      async reviewCurrentVariant(platformVariantId) {
        assert.equal(platformVariantId, "variant-linkedin", "only the successfully generated destination should be reviewed");
        return {
          platformVariantReviewId: "review-linkedin",
          platformVariantId,
          platformVariantRevisionId: "revision-linkedin",
        };
      },
    },
  });

  const result = await app.prepareSignal("signal-partial");
  assert.equal(result.status, "partial_failure");
  assert.equal(result.nextRoute, "/today");
  assert.equal(result.stage, "review");
  assert.equal(result.reviewedCount, 1);
  assert.equal(result.records.platformVariantReviewIds.length, 1);
  assert.equal(result.records.platformVariantReviewIds[0], "review-linkedin");
  assert.equal(result.records.platformVariantRevisionIds[0], "revision-linkedin");
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].platformVariantId, "variant-x");
  assert.equal(internalStrategyAcceptanceCalls, 1, "autopilot may accept an internal strategy policy decision, but it never performs final PlatformVariant approval");
});
