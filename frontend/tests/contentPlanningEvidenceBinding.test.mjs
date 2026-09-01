import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createContentPlanningApplication } from "../lib/application/contentPlanningApplication.mjs";
import { createIdentityApplication } from "../lib/application/identityApplication.mjs";
import { createProjectContextApplication } from "../lib/application/projectContextApplication.mjs";
import { createContentOpportunity, selectOpportunityAngle } from "../lib/domain/contentOpportunities.mjs";
import { createManualContentSignal } from "../lib/domain/contentSignals.mjs";
import { createDeterministicIdService } from "../lib/domain/ports.mjs";
import { createMemoryContentOpportunityRepository } from "../lib/infrastructure/contentOpportunityAdapters.mjs";
import { createMemoryContentPlanningRepository } from "../lib/infrastructure/contentPlanningAdapters.mjs";
import { createMemoryContentSignalRepository } from "../lib/infrastructure/contentSignalAdapters.mjs";
import { createMemoryIdentityRepository } from "../lib/infrastructure/identityAdapters.mjs";
import { createMemoryProjectContextRepository } from "../lib/infrastructure/projectContextAdapters.mjs";

const NOW = "2026-09-01T16:00:00.000Z";
const WORKSPACE = "local-personal";
const PROJECT = "project-gp2";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function strategyProposal() {
  return {
    title: "The evidence path became exact",
    coreIdea: "The content pipeline now keeps the exact repository evidence snapshot attached to editorial planning.",
    audienceTakeaway: "Evidence-backed content needs immutable evidence identity, not only good prose.",
    narrativeArc: ["A work event becomes a candidate story", "The exact evidence snapshot remains pinned through planning"],
    hookDirection: "Lead with the system change.",
    evidencePlan: ["Use the pinned repository revision and bounded SourceArtifacts."],
    factualConstraints: ["Do not claim automatic publishing."],
    boundaryConstraints: ["Do not expose raw private repository content."],
    destinationPlan: [
      { destination: "linkedin", decision: "include", reason: "The engineering decision benefits from context.", format: "single narrative post", adaptationNotes: [] },
      { destination: "x", decision: "include", reason: "The exactness principle can be stated concisely.", format: "single post", adaptationNotes: [] },
    ],
    mediaRequirements: [{ type: "screenshot", reason: "Visible product proof supports the story.", required: true }],
    sequencingNotes: [],
  };
}

async function identityApplication() {
  const app = createIdentityApplication({
    identityRepository: createMemoryIdentityRepository(),
    workspaceId: WORKSPACE,
    userId: "owner",
    clock: { now: () => NOW },
    idService: createDeterministicIdService("identity-evidence"),
  });
  await app.saveMinimalProfile({
    primaryTopics: "software systems",
    desiredAudienceImpressions: "precise builder",
    qualitiesToSignal: "specific\ncalm",
    qualitiesToAvoid: "hype",
    writingPrinciples: "evidence before claims",
    dislikes: "generic launch copy",
    customBoundaryRules: "never expose private repository contents",
    linkedinRules: "Explain the decision.",
    xRules: "Keep the proof concise.",
  });
  return app;
}

async function fixture() {
  const signal = createManualContentSignal({
    signalId: "signal-gp2-evidence",
    workspaceId: WORKSPACE,
    projectId: PROJECT,
    headline: "Hosted GP2 now binds screenshot proof to immutable review revisions",
    summary: "The implementation completed exact hosted screenshot production and review binding.",
    observedAt: NOW,
    privacyClassification: "workspace_private",
  });
  const projectContextRepository = createMemoryProjectContextRepository();
  const projectContextApplication = createProjectContextApplication({
    workspaceId: WORKSPACE,
    repository: projectContextRepository,
    clock: { now: () => NOW },
    idService: createDeterministicIdService("context-evidence"),
  });
  const projectContext = (await projectContextApplication.bootstrapProjectContext({
    projectId: PROJECT,
    repositoryRef: {
      provider: "github",
      sourceConnectionId: "connection-gp2",
      owner: "Ankit6149",
      repository: "SignalFlow-Studio",
      revision: "abc123exactrevision",
    },
    sourceArtifactIds: ["artifact-readme", "artifact-architecture"],
    privacyClass: "device_private",
    synthesis: {
      projectName: "SignalFlow Studio",
      purpose: "Turn meaningful work into evidence-backed content decisions.",
      problem: "Content should emerge from real work without losing provenance.",
      capabilities: ["connected signals", "exact review", "private screenshot production"],
      safeClaims: ["Hosted screenshot production is revision-scoped and fail-closed."],
      uncertainties: ["Automatic publication remains outside GP2."],
    },
    synthesisProvenance: { mode: "deterministic" },
  })).context;

  const rawOpportunity = createContentOpportunity({
    opportunityId: "opportunity-gp2-evidence",
    workspaceId: WORKSPACE,
    projectId: PROJECT,
    projectContextSnapshotId: projectContext.projectContextSnapshotId,
    signalIds: [signal.signalId],
    inputFingerprint: "opportunity-fingerprint-pinned-context",
    evaluation: {
      recommendation: "post",
      title: "Exact evidence now survives into content planning",
      summary: "Explain why exact evidence identity matters to the content system.",
      whyNow: "The GP2 screenshot production slice just reached production.",
      score: 91,
      scoreBreakdown: { freshness: 95, importance: 91, novelty: 82, audienceValue: 88, narrativeFit: 92, evidenceStrength: 94 },
      confidence: 0.94,
      evidenceReadiness: { level: "strong", reason: "A pinned repository context exists." },
      narrativeFit: { level: "strong", reason: "The system change is directly relevant." },
      repetitionRisk: { level: "low", reason: "This is a new implementation slice." },
      candidateAngles: [
        { title: "Evidence continuity", summary: "Show how evidence identity survives planning.", approach: "Lead with provenance." },
        { title: "Architecture", summary: "Explain the boundary between signals and evidence.", approach: "Lead with architecture." },
        { title: "Trust", summary: "Explain why exact evidence makes review trustworthy.", approach: "Lead with trust." },
      ],
      candidateDestinations: [{ destination: "linkedin", recommended: true, reason: "Strong context fit.", format: "narrative post" }],
      excludedDestinations: [],
      recommendedMediaTypes: ["screenshot"],
      freshnessState: "fresh",
      productionEffortEstimate: "low",
    },
    evaluationProvenance: { taskId: "task-opportunity-evidence", taskType: "opportunity_evaluation", provider: "test", model: "test", routeKind: "remote", evaluatedAt: NOW },
    createdAt: NOW,
  });
  const opportunity = selectOpportunityAngle(rawOpportunity, "angle-1", NOW);

  return { signal, projectContext, projectContextRepository, opportunity };
}

test("NarrativeStrategy inference consumes the exact ProjectContextSnapshot pinned by the Opportunity", async () => {
  const data = await fixture();
  const calls = [];
  const planning = createContentPlanningApplication({
    contentPlanningRepository: createMemoryContentPlanningRepository(),
    contentOpportunityRepository: createMemoryContentOpportunityRepository([data.opportunity]),
    contentSignalRepository: createMemoryContentSignalRepository([data.signal]),
    projectContextRepository: data.projectContextRepository,
    identityApplication: await identityApplication(),
    inferenceAdapter: {
      async execute({ task, input }) {
        calls.push({ task, input });
        return {
          output: strategyProposal(),
          provenance: { taskId: task.taskId, provider: "test", model: "test", routeKind: "remote", evaluatedAt: NOW },
        };
      },
    },
    workspaceId: WORKSPACE,
    clock: { now: () => NOW },
    idService: createDeterministicIdService("planning-evidence"),
  });

  const strategy = await planning.buildStrategy(data.opportunity.opportunityId);
  assert.equal(calls.length, 1);
  const call = calls[0];
  assert.equal(call.input.projectContext.projectContextSnapshotId, data.projectContext.projectContextSnapshotId);
  assert.equal(call.input.projectContext.fingerprint, data.projectContext.fingerprint);
  assert.equal(call.input.projectContext.repositoryRef.revision, "abc123exactrevision");
  assert.deepEqual(call.input.projectContext.sourceArtifactIds, ["artifact-architecture", "artifact-readme"]);
  assert.ok(call.task.inputRefs.includes(data.projectContext.projectContextSnapshotId));
  assert.ok(call.task.inputRefs.includes("artifact-readme"));
  assert.ok(call.task.requirements.includes("exact_evidence_snapshot"));
  assert.equal(call.task.dataClassification, "device_private", "more restrictive pinned evidence privacy controls strategy inference");
  assert.ok(strategy.inputFingerprint.includes(data.projectContext.projectContextSnapshotId));
  assert.ok(strategy.inputFingerprint.includes(data.projectContext.fingerprint));
});

test("planning fails closed when a connected-source Opportunity's pinned evidence snapshot is unavailable", async () => {
  const data = await fixture();
  const planning = createContentPlanningApplication({
    contentPlanningRepository: createMemoryContentPlanningRepository(),
    contentOpportunityRepository: createMemoryContentOpportunityRepository([data.opportunity]),
    contentSignalRepository: createMemoryContentSignalRepository([data.signal]),
    projectContextRepository: createMemoryProjectContextRepository(),
    identityApplication: await identityApplication(),
    inferenceAdapter: { async execute() { throw new Error("inference must not run without exact evidence"); } },
    workspaceId: WORKSPACE,
    clock: { now: () => NOW },
    idService: createDeterministicIdService("planning-evidence-missing"),
  });

  await assert.rejects(
    () => planning.buildStrategy(data.opportunity.opportunityId),
    (error) => error.code === "planning_project_context_missing",
  );
});

test("hosted planning composition wires the durable ProjectContext repository into strategy production", () => {
  const source = fs.readFileSync(path.join(ROOT, "lib", "server", "hostedPlanningDependencies.mjs"), "utf8");
  assert.match(source, /projectContextRepository: opportunityCore\.projectContextRepository/);
});
