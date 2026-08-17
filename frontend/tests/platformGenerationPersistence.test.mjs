import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  approveNarrativeStrategy,
  createNarrativeStrategy,
  createPlannedPlatformVariant,
  createPrimaryContentPiece,
} from "../lib/domain/contentPlanning.mjs";
import {
  attachPlatformVariantRevision,
  createPlatformVariantRevision,
} from "../lib/domain/platformVariantRevisions.mjs";
import { createBrowserContentPlanningRepository } from "../lib/infrastructure/contentPlanningAdapters.mjs";

const NOW = "2026-08-17T13:30:00.000Z";

function records() {
  const strategy = approveNarrativeStrategy(createNarrativeStrategy({
    narrativeStrategyId: "strategy-browser",
    workspaceId: "local-personal",
    opportunityId: "opportunity-browser",
    inputFingerprint: "strategy-input",
    selectedAngle: { angleId: "angle-1", title: "Boundary", summary: "Explain the boundary.", approach: "Lead with the constraint." },
    identityContextSnapshotId: "snapshot-plan",
    proposal: {
      coreIdea: "Privacy must be enforced by routing.",
      audienceTakeaway: "Data movement policy comes before model choice.",
      narrativeArc: ["Constraint", "Decision"],
      hookDirection: "Lead with the constraint.",
      destinationPlan: [{ destination: "linkedin", decision: "include", reason: "Context helps.", format: "single narrative post", adaptationNotes: [] }],
      evidencePlan: [], factualConstraints: [], boundaryConstraints: [], mediaRequirements: [], sequencingNotes: [],
    },
    taskId: "task-strategy",
    createdAt: NOW,
  }), NOW);
  const piece = createPrimaryContentPiece({ contentPieceId: "piece-browser", strategy, opportunityId: "opportunity-browser", createdAt: NOW });
  const variant = createPlannedPlatformVariant({ platformVariantId: "variant-browser", contentPiece: piece, strategy, destination: "linkedin", createdAt: NOW });
  const revision = createPlatformVariantRevision({
    platformVariantRevisionId: "revision-browser",
    workspaceId: "local-personal",
    platformVariantId: variant.platformVariantId,
    contentPieceId: piece.contentPieceId,
    narrativeStrategyId: strategy.narrativeStrategyId,
    destination: "linkedin",
    revisionNumber: 1,
    strategyRevision: strategy.strategyRevision,
    output: { format: "single_post", content: "Privacy becomes real when routing code enforces the boundary.", segments: [] },
    inputFingerprint: "sf-cache-v1-test",
    identityContextSnapshotId: "snapshot-linkedin",
    generationProvenance: { taskId: "task-write", provider: "test", model: "test", routeKind: "remote", promptVersion: "platform_variant_v1", generatedAt: NOW },
    createdAt: NOW,
  });
  return { strategy, piece, variant: attachPlatformVariantRevision(variant, revision, NOW), revision };
}

test("browser-local platform draft revision survives repository reopen with current pointer intact", async () => {
  const backing = new Map();
  const storage = {
    getItem(key) { return backing.has(key) ? backing.get(key) : null; },
    setItem(key, value) { backing.set(key, value); },
  };
  const first = createBrowserContentPlanningRepository({ getStorage: () => storage });
  const fixture = records();
  await first.upsert(fixture.strategy);
  await first.upsert(fixture.piece);
  await first.upsert(fixture.variant);
  await first.upsert(fixture.revision);

  const reopened = createBrowserContentPlanningRepository({ getStorage: () => storage });
  const variant = await reopened.get("variant-browser");
  const revision = await reopened.get("revision-browser");
  assert.equal(variant.currentRevisionId, "revision-browser");
  assert.equal(variant.status, "review");
  assert.equal(revision.content, "Privacy becomes real when routing code enforces the boundary.");
  assert.equal(revision.strategyRevision, 1);
});

test("new Golden Path platform writing route is stage-specific and does not call the legacy launch-kit endpoint", async () => {
  const browserAdapter = await readFile(new URL("../lib/infrastructure/browserInferenceAdapter.mjs", import.meta.url), "utf8");
  const generationApp = await readFile(new URL("../lib/application/platformGenerationApplication.mjs", import.meta.url), "utf8");
  const serverRoute = await readFile(new URL("../app/api/intelligence/platform-variant/route.js", import.meta.url), "utf8");
  assert.match(browserAdapter, /\/api\/intelligence\/platform-variant/);
  assert.match(serverRoute, /PLATFORM_VARIANT/);
  assert.doesNotMatch(browserAdapter, /launch_kit/);
  assert.doesNotMatch(generationApp, /launch_kit/);
  assert.doesNotMatch(serverRoute, /launch_kit/);
});
