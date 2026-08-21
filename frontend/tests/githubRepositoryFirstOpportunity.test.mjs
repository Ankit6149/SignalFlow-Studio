import test from "node:test";
import assert from "node:assert/strict";

import { createGithubRepositoryFirstOpportunityApplication } from "../lib/application/githubRepositoryFirstOpportunityApplication.mjs";
import {
  createProjectContextFingerprint,
  normalizeProjectContextSnapshot,
} from "../lib/domain/projectContexts.mjs";
import { createDeterministicIdService } from "../lib/domain/ports.mjs";
import { normalizeContentSignal } from "../lib/domain/contentSignals.mjs";

const NOW = "2026-08-21T18:00:00.000Z";
const REVISION = "a".repeat(40);

function context(overrides = {}) {
  const repositoryRef = {
    provider: "github",
    owner: "owner",
    repository: "product",
    revision: REVISION,
    sourceConnectionId: "github-connection-1",
    ...(overrides.repositoryRef || {}),
  };
  const projectId = overrides.projectId || "sf-project-github-9001";
  const sourceArtifactIds = overrides.sourceArtifactIds || ["artifact-1", "artifact-2"];
  const fingerprint = createProjectContextFingerprint({
    projectId,
    repositoryRef,
    sourceArtifactIds,
    supplementalSourceArtifactIds: [],
    assetIds: [],
  });
  return normalizeProjectContextSnapshot({
    projectContextSnapshotId: overrides.projectContextSnapshotId || "context-1",
    workspaceId: overrides.workspaceId || "owner-local",
    projectId,
    version: 1,
    supersedesId: null,
    fingerprint,
    repositoryRef,
    sourceArtifactIds,
    supplementalSourceArtifactIds: [],
    assetIds: [],
    privacyClass: "workspace_private",
    synthesis: {
      projectName: "Product",
      purpose: "Surface worthwhile stories from project work.",
      problem: "Owners should not reconstruct project context manually.",
      capabilities: ["Persistent project understanding"],
      maturityStage: "active development",
      safeClaims: ["Context is evidence-backed."],
    },
    synthesisProvenance: { mode: "deterministic" },
    createdAt: NOW,
  });
}

function signalRepository() {
  const byId = new Map();
  const byEvent = new Map();
  let inserts = 0;
  return {
    get insertCount() { return inserts; },
    async findByExternalEvent({ provider, eventId }) {
      return byEvent.get(`${provider}:${eventId}`) || null;
    },
    async insertExternalIfAbsent(input) {
      const signal = normalizeContentSignal(input);
      const key = `${signal.externalEventRef.provider}:${signal.externalEventRef.eventId}`;
      const existing = byEvent.get(key);
      if (existing) return { signal: existing, created: false };
      byEvent.set(key, signal);
      byId.set(signal.signalId, signal);
      inserts += 1;
      return { signal, created: true };
    },
    async get(signalId) { return byId.get(signalId) || null; },
  };
}

function harness({ projectContext = context() } = {}) {
  const repository = signalRepository();
  const continuationCalls = [];
  const continuationApplication = {
    async continueToOpportunity(signalId, options) {
      continuationCalls.push({ signalId, options });
      const signal = await repository.get(signalId);
      return {
        signal,
        projectContext,
        opportunity: {
          opportunityId: "opportunity-first",
          recommendation: "post",
          score: 91,
          title: "Start with the architectural decision",
          summary: "The connected repository contains a useful first story.",
          recommendedAngleId: "angle-2",
          status: "proposed",
        },
      };
    },
  };
  const app = createGithubRepositoryFirstOpportunityApplication({
    workspaceId: "owner-local",
    contentSignalRepository: repository,
    continuationApplication,
    clock: { now: () => NOW },
    idService: createDeterministicIdService("first-opportunity-test"),
  });
  return { app, repository, continuationCalls, projectContext };
}

test("repository ProjectContext creates one connected snapshot Signal and continues through the canonical Opportunity path", async () => {
  const run = harness();
  const result = await run.app.ensureInitialOpportunity({
    sourceConnectionId: "github-connection-1",
    repository: { id: "9001", fullName: "owner/product" },
    projectContext: run.projectContext,
  });

  assert.equal(result.createdSignal, true);
  assert.equal(run.repository.insertCount, 1);
  assert.equal(result.signal.sourceType, "github");
  assert.equal(result.signal.projectId, "sf-project-github-9001");
  assert.equal(result.signal.sourceConnectionId, "github-connection-1");
  assert.equal(result.signal.privacyClassification, "workspace_private");
  assert.deepEqual(result.signal.sourceArtifactIds, ["artifact-1", "artifact-2"]);
  assert.equal(result.signal.provenance.ingestionMethod, "repository_bootstrap");
  assert.equal(result.signal.provenance.actorRef, "repository-bootstrap");
  assert.match(result.signal.externalEventRef.eventId, /^repository-context:9001:sf-project-context-v1-/);
  assert.equal(result.opportunity.opportunityId, "opportunity-first");
  assert.deepEqual(run.continuationCalls, [{ signalId: result.signal.signalId, options: { refresh: false } }]);
});

test("retrying the exact ProjectContext reuses its repository snapshot Signal but retries Opportunity continuation", async () => {
  const run = harness();
  const first = await run.app.ensureInitialOpportunity({
    sourceConnectionId: "github-connection-1",
    repository: { id: "9001", fullName: "owner/product" },
    projectContext: run.projectContext,
  });
  const second = await run.app.ensureInitialOpportunity({
    sourceConnectionId: "github-connection-1",
    repository: { id: "9001", fullName: "owner/product" },
    projectContext: run.projectContext,
  });

  assert.equal(run.repository.insertCount, 1);
  assert.equal(first.signal.signalId, second.signal.signalId);
  assert.equal(second.createdSignal, false);
  assert.equal(run.continuationCalls.length, 2, "a preserved ProjectContext can retry the Opportunity stage without reconnecting or duplicating its Signal");
});

test("repository/context identity mismatch fails before Signal persistence or Opportunity continuation", async () => {
  const run = harness();
  await assert.rejects(
    () => run.app.ensureInitialOpportunity({
      sourceConnectionId: "github-connection-1",
      repository: { id: "9001", fullName: "other/product" },
      projectContext: run.projectContext,
    }),
    (error) => error?.code === "github_repository_context_mismatch",
  );
  assert.equal(run.repository.insertCount, 0);
  assert.equal(run.continuationCalls.length, 0);
});
