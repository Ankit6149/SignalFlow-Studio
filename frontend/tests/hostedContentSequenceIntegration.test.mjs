import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  approveNarrativeStrategy,
  createNarrativeStrategy,
  createPlannedPlatformVariant,
  createPrimaryContentPiece,
  createSequencedContentPiece,
} from "../lib/domain/contentPlanning.mjs";
import { createBrowserHostedPlanningClient } from "../lib/infrastructure/browserHostedPlanningClient.mjs";

const NOW = "2026-11-17T00:00:00.000Z";

function approvedStrategy() {
  return approveNarrativeStrategy(createNarrativeStrategy({
    narrativeStrategyId: "strategy-hosted-sequence",
    workspaceId: "workspace-1",
    opportunityId: "opportunity-1",
    inputFingerprint: "fingerprint-1",
    selectedAngle: {
      angleId: "angle-1",
      title: "Architecture",
      summary: "Explain the decision.",
      approach: "Lead with the constraint.",
      selectionOrigin: "owner",
    },
    identityContextSnapshotId: "identity-1",
    proposal: {
      title: "Architecture story",
      coreIdea: "A privacy boundary changed the implementation.",
      audienceTakeaway: "Architecture should encode product promises.",
      narrativeArc: ["Constraint", "Decision", "Consequence"],
      hookDirection: "Start with the constraint.",
      evidencePlan: [],
      factualConstraints: [],
      boundaryConstraints: [],
      destinationPlan: [
        { destination: "linkedin", decision: "include", reason: "Context matters.", format: "single_post" },
        { destination: "x", decision: "optional", reason: "Compact follow-up.", format: "single_post" },
      ],
      mediaRequirements: [],
      sequencingNotes: [],
    },
    taskId: "task-1",
    createdAt: NOW,
  }), NOW);
}

function hostedPlan() {
  const strategy = approvedStrategy();
  const primary = createPrimaryContentPiece({
    contentPieceId: "piece-primary",
    strategy,
    opportunityId: strategy.opportunityId,
    createdAt: NOW,
  });
  const followUp = createSequencedContentPiece({
    contentPieceId: "piece-follow-up",
    strategy,
    opportunityId: strategy.opportunityId,
    purpose: "Explain the implementation consequence.",
    sequenceRole: "follow_up",
    sequenceOrder: 2,
    timingIntent: "After the primary story.",
    canonicalIntent: "Show the implementation consequence without repeating the first story.",
    createdAt: NOW,
  });
  const primaryVariant = createPlannedPlatformVariant({
    platformVariantId: "variant-primary-linkedin",
    contentPiece: primary,
    strategy,
    destination: "linkedin",
    createdAt: NOW,
  });
  const followVariant = createPlannedPlatformVariant({
    platformVariantId: "variant-follow-linkedin",
    contentPiece: followUp,
    strategy,
    destination: "linkedin",
    createdAt: NOW,
  });
  return {
    strategy,
    contentPiece: primary,
    contentPieces: [primary, followUp],
    variants: [primaryVariant],
    pieceBundles: [
      { contentPiece: primary, variants: [primaryVariant] },
      { contentPiece: followUp, variants: [followVariant] },
    ],
  };
}

test("hosted planning client preserves ordered contentPieces and independent piece bundles", async () => {
  const client = createBrowserHostedPlanningClient({
    fetchImpl: async () => new Response(JSON.stringify({
      ok: true,
      workspaceId: "workspace-1",
      opportunityId: "opportunity-1",
      plan: hostedPlan(),
    }), { status: 200, headers: { "content-type": "application/json" } }),
  });
  const plan = await client.getPlanBundle("opportunity-1");
  assert.equal(plan.contentPiece.contentPieceId, "piece-primary");
  assert.deepEqual(plan.contentPieces.map((piece) => piece.sequenceOrder), [1, 2]);
  assert.equal(plan.pieceBundles.length, 2);
  assert.equal(plan.pieceBundles[1].contentPiece.contentPieceId, "piece-follow-up");
  assert.equal(plan.pieceBundles[1].variants[0].contentPieceId, "piece-follow-up");
});

test("hosted addContentPiece pins the exact visible strategy revision and sends only bounded piece input", async () => {
  const calls = [];
  const plan = hostedPlan();
  const client = createBrowserHostedPlanningClient({
    fetchImpl: async (_url, options) => {
      calls.push(JSON.parse(options.body));
      return new Response(JSON.stringify({ ok: true, plan }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  await client.addContentPiece("opportunity-1", plan.strategy, {
    purpose: "Follow up",
    canonicalIntent: "Explain the consequence.",
    timingIntent: "Later",
    destinations: ["linkedin"],
  });
  assert.equal(calls[0].action, "add_content_piece");
  assert.equal(calls[0].strategyId, plan.strategy.narrativeStrategyId);
  assert.equal(calls[0].expectedStrategyRevision, plan.strategy.strategyRevision);
  assert.deepEqual(calls[0].contentPiece.destinations, ["linkedin"]);
  assert.equal("sequenceOrder" in calls[0].contentPiece, false);
  assert.equal("scheduledAt" in calls[0].contentPiece, false);
});

test("hosted planning route bounds follow-up input and prepares only the persisted new piece", async () => {
  const route = await readFile(new URL("../app/api/planning/route.js", import.meta.url), "utf8");
  assert.match(route, /"add_content_piece"/);
  assert.match(route, /boundedContentPieceInput\(body\.contentPiece\)/);
  assert.match(route, /destinations\.length > 2/);
  assert.match(route, /\["linkedin", "x"\]\.includes/);
  assert.match(route, /requireExpectedRevision\(body, current\.strategy\)/);
  assert.match(route, /planningApplication\.addContentPiece\(strategyId, input\)/);
  assert.match(route, /prepareContentPiece\(result\.contentPiece\.contentPieceId\)/);
  assert.match(route, /failSoftPreparation/);
  assert.doesNotMatch(route, /scheduledAt|exactPublishAt|publishAt/);
});

test("browser Plan application exposes hosted follow-up creation without crossing into local planning", async () => {
  const application = await readFile(new URL("../lib/application/browserPlanOpportunityApplication.mjs", import.meta.url), "utf8");
  assert.match(application, /async function addHostedContentPiece/);
  assert.match(application, /requireHostedEntry\(entryInput\)/);
  assert.match(application, /hostedPlanning\.addContentPiece/);
  assert.match(application, /addHostedContentPiece,/);
});
