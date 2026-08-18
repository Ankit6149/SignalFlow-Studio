import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { createStyleMemoryApplication } from "../lib/application/styleMemoryApplication.mjs";
import { createMemoryStyleMemoryRepository } from "../lib/infrastructure/styleMemoryAdapters.mjs";
import { createDeterministicIdService } from "../lib/domain/ports.mjs";
import {
  createEditedPlatformVariantRevision,
  createPlatformVariantRevision,
  createRequestedPlatformVariantRevision,
} from "../lib/domain/platformVariantRevisions.mjs";
import {
  buildPlatformVariantPrompt,
  normalizePlatformVariantTaskInput,
} from "../lib/ai/platformVariantWriting.mjs";
import {
  buildPlatformRevisionRequestPrompt,
  normalizePlatformRevisionRequestInput,
} from "../lib/ai/platformVariantRevisionRequest.mjs";

const NOW = "2026-08-18T15:00:00.000Z";

function styleApplication() {
  return createStyleMemoryApplication({
    styleMemoryRepository: createMemoryStyleMemoryRepository(),
    workspaceId: "local-personal",
    userId: "owner",
    clock: { now: () => NOW },
    idService: createDeterministicIdService("style-completion"),
  });
}

function revision(styleMemoryRefs = []) {
  return createPlatformVariantRevision({
    platformVariantRevisionId: "revision-1",
    workspaceId: "local-personal",
    platformVariantId: "variant-1",
    contentPieceId: "piece-1",
    narrativeStrategyId: "strategy-1",
    destination: "linkedin",
    revisionNumber: 1,
    strategyRevision: 1,
    output: { format: "single_post", content: "A concrete explanation of the routing trade-off.", segments: [] },
    inputFingerprint: "fingerprint-1",
    identityContextSnapshotId: "snapshot-1",
    styleMemoryRefs,
    generationProvenance: {
      taskId: "task-1",
      provider: "test",
      model: "test",
      routeKind: "remote",
      promptVersion: "platform_variant_v1",
      generatedAt: NOW,
    },
    createdAt: NOW,
  });
}

function identityContext() {
  return {
    identityContextSnapshotId: "snapshot-1",
    workspaceId: "local-personal",
    userId: "owner",
    platform: "linkedin",
    projectId: null,
    profileRefs: {},
    identity: { primaryTopics: ["software systems"] },
    perception: { qualitiesToSignal: ["precise"] },
    voice: { writingPrinciples: ["specific over impressive"] },
    boundaries: { blockedPhrases: [], customRules: [] },
    platformExpression: { expressionRules: ["Use enough context for the reasoning."] },
    projectGuidance: null,
    campaignInstructions: ["Preserve the approved core idea."],
    effectiveRules: [],
  };
}

function styleMemoryItems(count = 10) {
  return Array.from({ length: count }, (_, index) => ({
    styleMemoryId: `style-${index + 1}`,
    hypothesis: `Preference ${index + 1}: prefer concrete language.`,
    category: "tone",
    scope: { type: "global", platform: null, projectId: null },
    confidence: 0.7,
    evidenceCount: 3,
    status: "active",
    updatedAt: NOW,
  }));
}

function platformInput(styleMemory = styleMemoryItems()) {
  return {
    strategy: {
      kind: "NarrativeStrategy",
      narrativeStrategyId: "strategy-1",
      workspaceId: "local-personal",
      status: "approved",
      strategyRevision: 1,
      coreIdea: "Privacy belongs in routing logic.",
      audienceTakeaway: "Choose allowed data movement before model strength.",
      narrativeArc: ["constraint", "decision"],
      hookDirection: "Lead with the constraint.",
      factualConstraints: [],
      boundaryConstraints: [],
    },
    contentPiece: {
      kind: "ContentPiece",
      contentPieceId: "piece-1",
      workspaceId: "local-personal",
      narrativeStrategyId: "strategy-1",
      canonicalIntent: "Explain the routing decision.",
      purpose: "explain",
      claims: [],
      evidenceRefs: [],
    },
    variant: {
      kind: "PlatformVariant",
      platformVariantId: "variant-1",
      workspaceId: "local-personal",
      contentPieceId: "piece-1",
      narrativeStrategyId: "strategy-1",
      destination: "linkedin",
      status: "planned",
      adaptationIntent: "Use enough context for the trade-off.",
    },
    sourceSignal: {
      signalId: "signal-1",
      workspaceId: "local-personal",
      headline: "Privacy changed model routing",
      summary: "Private repository evidence should not silently leave the device.",
      signalKind: "manual_topic",
      boundaryNote: null,
      privacyClassification: "workspace_private",
    },
    identityContext: identityContext(),
    styleMemory,
    dataClassification: "workspace_private",
  };
}

test("owner can confirm, edit, weaken and forget a learned preference without deleting feedback history", async () => {
  const app = styleApplication();
  await app.recordExplicitPreference({ reason: "Use less promotional language", platform: "linkedin" });
  const [created] = await app.listHypotheses();
  assert.equal(created.status, "user_confirmed");

  const edited = await app.editHypothesis(created.styleMemoryId, "Prefer restrained, concrete wording over promotional language.");
  assert.equal(edited.status, "user_confirmed");
  assert.equal(edited.confidence, 1);
  assert.match(edited.hypothesis, /restrained, concrete/i);

  const weakened = await app.weakenHypothesis(created.styleMemoryId);
  assert.equal(weakened.status, "candidate");
  assert.ok(weakened.confidence <= 0.35);
  assert.equal((await app.relevantMemory({ platform: "linkedin" })).length, 0);

  await app.confirmHypothesis(created.styleMemoryId);
  const [memory] = await app.relevantMemory({ platform: "linkedin" });
  assert.equal(memory.styleMemoryId, created.styleMemoryId);
  assert.equal(memory.updatedAt, NOW);

  assert.equal((await app.listFeedbackEvents()).length, 1);
  assert.equal(await app.forgetHypothesis(created.styleMemoryId), true);
  assert.equal((await app.listHypotheses()).length, 0);
  assert.equal((await app.listFeedbackEvents()).length, 1);
});

test("exact revisions persist only safe StyleMemory IDs and timestamps and preserve them through owner edits", () => {
  const refs = [{ styleMemoryId: "style-1", updatedAt: NOW }];
  const generated = revision(refs);
  assert.deepEqual(generated.styleMemoryRefs, refs);

  const edited = createEditedPlatformVariantRevision({
    platformVariantRevisionId: "revision-2",
    parentRevision: generated,
    revisionNumber: 2,
    content: "I chose this routing boundary because private evidence should stay local by default.",
    editedBy: "owner",
    createdAt: NOW,
  });
  assert.deepEqual(edited.styleMemoryRefs, refs);

  const revised = createRequestedPlatformVariantRevision({
    platformVariantRevisionId: "revision-3",
    parentRevision: edited,
    revisionNumber: 3,
    output: { format: "single_post", content: "I chose this routing boundary because private evidence should stay local unless policy permits otherwise.", segments: [] },
    changeRequest: "Make the privacy boundary more precise.",
    styleMemoryRefs: [{ styleMemoryId: "style-2", updatedAt: NOW }],
    generationProvenance: {
      taskId: "task-3",
      provider: "test",
      model: "test",
      routeKind: "remote",
      promptVersion: "platform_variant_revision_v1",
      generatedAt: NOW,
    },
    createdAt: NOW,
  });
  assert.deepEqual(revised.styleMemoryRefs, [{ styleMemoryId: "style-2", updatedAt: NOW }]);
  assert.equal(JSON.stringify(revised).includes("Preference 2"), false);
});

test("platform writing accepts only a bounded learned-memory snapshot and states explicit precedence", () => {
  const normalized = normalizePlatformVariantTaskInput(platformInput(styleMemoryItems(12)));
  assert.equal(normalized.styleMemory.length, 8);
  const prompt = buildPlatformVariantPrompt(platformInput(styleMemoryItems(12)));
  assert.match(prompt, /LOWER PRECEDENCE THAN EXPLICIT VOICE \/ BOUNDARIES/i);
  assert.match(prompt, /Campaign instructions and explicit platform\/global Voice preferences outrank learned preferences/i);
  assert.equal(prompt.includes("Preference 9"), false);
});

test("bounded change requests consume learned memory without allowing it to outrank exact identity or the user request", () => {
  const parentRevision = revision([{ styleMemoryId: "style-old", updatedAt: NOW }]);
  const input = {
    parentRevision,
    variant: {
      platformVariantId: "variant-1",
      workspaceId: "local-personal",
      currentRevisionId: parentRevision.platformVariantRevisionId,
    },
    strategy: {
      narrativeStrategyId: "strategy-1",
      workspaceId: "local-personal",
      strategyRevision: 1,
      coreIdea: "Privacy belongs in routing logic.",
      audienceTakeaway: "Choose allowed data movement first.",
      narrativeArc: [],
      factualConstraints: [],
      boundaryConstraints: [],
    },
    contentPiece: {
      contentPieceId: "piece-1",
      workspaceId: "local-personal",
      canonicalIntent: "Explain the privacy routing decision.",
      claims: [],
      evidenceRefs: [],
    },
    sourceSignal: {
      signalId: "signal-1",
      workspaceId: "local-personal",
      headline: "Privacy changed routing",
      summary: "Raw private context stays local by default.",
      boundaryNote: null,
      privacyClassification: "workspace_private",
    },
    identityContext: identityContext(),
    styleMemory: styleMemoryItems(12),
    review: null,
    changeRequest: "Make the first sentence more direct.",
    dataClassification: "workspace_private",
  };
  assert.equal(normalizePlatformRevisionRequestInput(input).styleMemory.length, 8);
  const prompt = buildPlatformRevisionRequestPrompt(input);
  assert.match(prompt, /Explicit campaign instructions and platform\/global Voice rules outrank learned preferences/i);
  assert.match(prompt, /USER CHANGE REQUEST/i);
  assert.equal(prompt.includes("Preference 9"), false);
});

test("browser generation/change-request composition and Voice UI keep StyleMemory behind application boundaries", async () => {
  const generation = await readFile(new URL("../lib/application/browserPlatformGenerationApplication.mjs", import.meta.url), "utf8");
  const generationApp = await readFile(new URL("../lib/application/platformGenerationApplication.mjs", import.meta.url), "utf8");
  const changeRequest = await readFile(new URL("../lib/application/platformChangeRequestApplication.mjs", import.meta.url), "utf8");
  const voice = await readFile(new URL("../components/VoiceWorkspace.js", import.meta.url), "utf8");

  assert.match(generation, /styleMemoryApplication/);
  assert.match(generationApp, /relevantMemory\(\{ platform: variant\.destination/);
  assert.match(generationApp, /styleMemoryRefs: memoryRefs/);
  assert.match(changeRequest, /bounded_style_memory/);
  assert.match(changeRequest, /styleMemoryRefs: memoryRefs/);

  assert.match(voice, /LEARNED PREFERENCES/);
  assert.match(voice, /Why SignalFlow learned this/);
  assert.match(voice, /supportingFeedbackEventIds/);
  assert.match(voice, /exampleApprovedRevisionIds/);
  assert.match(voice, /Raw before\/after draft text is not copied into StyleMemory/);
  assert.match(voice, /Confirm/);
  assert.match(voice, /Not always/);
  assert.match(voice, /Forget/);
  assert.match(voice, /editHypothesis/);
  assert.match(voice, /resetHypotheses/);
  assert.doesNotMatch(voice, /localStorage\.getItem/);
});
