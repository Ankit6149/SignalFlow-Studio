import test from "node:test";
import assert from "node:assert/strict";

import { createGithubRepositoryBootstrapApplication } from "../lib/application/githubRepositoryBootstrapApplication.mjs";
import { createGithubSignalEvidenceRefreshApplication } from "../lib/application/githubSignalEvidenceRefreshApplication.mjs";
import { createProjectContextApplication } from "../lib/application/projectContextApplication.mjs";
import { createSignalOpportunityWorkerApplication } from "../lib/application/signalOpportunityWorkerApplication.mjs";
import {
  createConnectedContentSignal,
  createManualContentSignal,
  updateContentSignalMetadata,
} from "../lib/domain/contentSignals.mjs";
import { opportunityInputFingerprint } from "../lib/domain/contentOpportunities.mjs";
import { createDeterministicIdService } from "../lib/domain/ports.mjs";
import { createSourceConnection, SOURCE_CONNECTION_STATUSES } from "../lib/domain/sourceConnections.mjs";
import { createMemoryContentSignalRepository } from "../lib/infrastructure/contentSignalAdapters.mjs";
import { createMemoryProjectContextRepository } from "../lib/infrastructure/projectContextAdapters.mjs";
import { createMemorySourceConnectionRepository } from "../lib/infrastructure/sourceConnectionAdapters.mjs";
import { createMemorySourceArtifactRepository } from "../lib/infrastructure/transferAdapters.mjs";
import { normalizeGithubWorkEvent } from "../lib/integrations/github/githubEvents.mjs";

const NOW = "2026-09-01T16:30:00.000Z";
const WORKSPACE = "owner-local";
const PROJECT = "sf-project-github-9001";
const CONNECTION = "github-connection-gp2";
const REPOSITORY_ID = "9001";
const MERGE_SHA = "a".repeat(40);
const OTHER_SHA = "b".repeat(40);

function clock() {
  return { now: () => NOW };
}

function activeConnection() {
  return createSourceConnection({
    sourceConnectionId: CONNECTION,
    workspaceId: WORKSPACE,
    provider: "github",
    providerAccountRef: "42",
    installationRef: "77",
    permissionScopes: ["contents:read", "metadata:read", "pull_requests:read"],
    capabilities: ["repository_contents", "repository_events", "repository_metadata"],
    resourceScopes: [{
      resourceRef: REPOSITORY_ID,
      resourceType: "repository",
      projectId: PROJECT,
      displayName: "owner/product",
      eventFamilies: ["pull_request_merged", "release_published"],
      enabled: true,
    }],
    status: SOURCE_CONNECTION_STATUSES.ACTIVE,
    verifiedAt: NOW,
    createdAt: NOW,
  });
}

function githubSignal({ revision = MERGE_SHA } = {}) {
  return createConnectedContentSignal({
    signalId: "signal-gp2-revision",
    workspaceId: WORKSPACE,
    projectId: PROJECT,
    sourceType: "github",
    sourceConnectionId: CONNECTION,
    sourceRevision: revision,
    externalEventRef: {
      provider: "github",
      eventId: "delivery-gp2-revision",
      idempotencyKey: "github:delivery-gp2-revision",
    },
    headline: "feat: bind exact repository evidence",
    summary: "Merged pull request #254. Change footprint: 9 files, 700 additions, 10 deletions.",
    signalKind: "feature",
    importanceHints: ["event:merged_pull_request", "work:completed"],
    occurredAt: NOW,
    privacyClassification: "workspace_private",
    observedAt: NOW,
  });
}

test("merged PR merge_commit_sha becomes immutable canonical sourceRevision and changes Opportunity identity", () => {
  const event = normalizeGithubWorkEvent({
    eventName: "pull_request",
    deliveryId: "delivery-gp2-revision",
    payload: {
      action: "closed",
      installation: { id: 77 },
      repository: { id: 9001 },
      sender: { login: "owner" },
      number: 254,
      pull_request: {
        id: 1254,
        number: 254,
        title: "feat: bind exact repository evidence",
        merged: true,
        merge_commit_sha: MERGE_SHA.toUpperCase(),
        merged_at: NOW,
        changed_files: 9,
        additions: 700,
        deletions: 10,
        user: { login: "owner" },
        labels: [{ name: "feature" }],
      },
    },
  });

  assert.equal(event.sourceRevision, MERGE_SHA);
  const first = githubSignal({ revision: event.sourceRevision });
  const second = githubSignal({ revision: OTHER_SHA });
  assert.notEqual(opportunityInputFingerprint(first), opportunityInputFingerprint(second));
  assert.throws(
    () => updateContentSignalMetadata(first, { sourceRevision: OTHER_SHA }, NOW),
    /sourceRevision is immutable metadata/,
  );
});

test("GitHub evidence refresh is lazy, exact-revision scoped, and skipped for non-GitHub signals", async () => {
  const signal = githubSignal();
  const manual = createManualContentSignal({
    signalId: "signal-manual",
    workspaceId: WORKSPACE,
    headline: "Manual thought",
    summary: "No GitHub dependency should be introduced.",
    observedAt: NOW,
  });
  const signalRepository = createMemoryContentSignalRepository([signal, manual]);
  const connectionRepository = createMemorySourceConnectionRepository([activeConnection()]);
  const calls = [];
  let factoryCalls = 0;
  const refresh = createGithubSignalEvidenceRefreshApplication({
    workspaceId: WORKSPACE,
    contentSignalRepository: signalRepository,
    sourceConnectionRepository: connectionRepository,
    async createGithubRepositoryBootstrapApplication() {
      factoryCalls += 1;
      return {
        async bootstrapRepository(input) {
          calls.push(input);
          return {
            projectId: PROJECT,
            revision: MERGE_SHA,
            evidenceCount: 4,
            reused: false,
            context: { projectContextSnapshotId: "context-exact-merge" },
          };
        },
      };
    },
  });

  const manualResult = await refresh.refreshForSignal(manual.signalId);
  assert.equal(manualResult.status, "not_required");
  assert.equal(factoryCalls, 0, "manual/non-GitHub signals must not instantiate GitHub credentials or repository clients");

  const result = await refresh.refreshForSignal(signal.signalId);
  assert.equal(result.status, "refreshed");
  assert.equal(result.revision, MERGE_SHA);
  assert.equal(result.projectContextSnapshotId, "context-exact-merge");
  assert.equal(factoryCalls, 1);
  assert.deepEqual(calls, [{
    sourceConnectionId: CONNECTION,
    repositoryId: REPOSITORY_ID,
    revision: MERGE_SHA,
  }]);
});

test("repository bootstrap resolves the explicitly requested Git commit rather than default-branch head", async () => {
  const connectionRepository = createMemorySourceConnectionRepository([activeConnection()]);
  const artifactRepository = createMemorySourceArtifactRepository();
  const projectContextRepository = createMemoryProjectContextRepository();
  const projectContextApplication = createProjectContextApplication({
    workspaceId: WORKSPACE,
    repository: projectContextRepository,
    clock: clock(),
    idService: createDeterministicIdService("gp2-revision-context"),
  });
  const existing = (await projectContextApplication.bootstrapProjectContext({
    projectId: PROJECT,
    repositoryRef: {
      provider: "github",
      sourceConnectionId: CONNECTION,
      owner: "owner",
      repository: "product",
      revision: MERGE_SHA,
    },
    sourceArtifactIds: ["artifact-exact-merge"],
    privacyClass: "workspace_private",
    synthesis: {
      projectName: "Product",
      purpose: "Exact revision acceptance fixture.",
      safeClaims: ["The evidence snapshot is revision pinned."],
    },
    synthesisProvenance: { mode: "deterministic" },
  })).context;

  const snapshotCalls = [];
  let fileReads = 0;
  const bootstrap = createGithubRepositoryBootstrapApplication({
    workspaceId: WORKSPACE,
    sourceConnectionRepository: connectionRepository,
    sourceArtifactRepository: artifactRepository,
    projectContextApplication,
    githubRepositoryApi: {
      async getRepositorySnapshot(installationId, repositoryId, revision) {
        snapshotCalls.push({ installationId, repositoryId, revision });
        return {
          repository: {
            id: REPOSITORY_ID,
            fullName: "owner/product",
            name: "product",
            ownerLogin: "owner",
            private: true,
            visibility: "private",
            defaultBranch: "main",
            archived: false,
            disabled: false,
          },
          revision: MERGE_SHA,
          treeEntries: [],
        };
      },
      async readTextFiles() {
        fileReads += 1;
        return [];
      },
    },
    clock: clock(),
  });

  const result = await bootstrap.bootstrapRepository({
    sourceConnectionId: CONNECTION,
    repositoryId: REPOSITORY_ID,
    revision: MERGE_SHA,
  });
  assert.deepEqual(snapshotCalls, [{ installationId: "77", repositoryId: REPOSITORY_ID, revision: MERGE_SHA }]);
  assert.equal(result.revision, MERGE_SHA);
  assert.equal(result.context.projectContextSnapshotId, existing.projectContextSnapshotId);
  assert.equal(result.reused, true);
  assert.equal(fileReads, 0, "an existing exact revision snapshot is reused without rereading file bodies");
});

test("durable opportunity worker refreshes evidence before inference and retries without creating an Opportunity when refresh fails", async () => {
  const order = [];
  const completed = [];
  const failed = [];
  const job = {
    jobId: "signal-opportunity:signal-gp2-revision",
    workspaceId: WORKSPACE,
    signalId: "signal-gp2-revision",
    status: "processing",
  };
  let evidenceFails = false;
  let continuationCalls = 0;
  const jobs = {
    async claimNext() { return job; },
    async complete(jobId, input) {
      completed.push({ jobId, input });
      return { ...job, status: "completed", opportunityId: input.opportunityId };
    },
    async fail(jobId, input) {
      failed.push({ jobId, input });
      return { ...job, status: "pending", lastErrorCode: input.errorCode };
    },
  };
  const worker = createSignalOpportunityWorkerApplication({
    opportunityJobRepository: jobs,
    async createEvidenceRefreshApplication() {
      return {
        async refreshForSignal() {
          order.push("evidence");
          if (evidenceFails) {
            const error = new Error("exact revision unavailable");
            error.code = "github_evidence_revision_mismatch";
            throw error;
          }
          return { status: "refreshed", revision: MERGE_SHA };
        },
      };
    },
    async createContinuationApplication() {
      return {
        async continueToOpportunity() {
          continuationCalls += 1;
          order.push("opportunity");
          return {
            opportunity: {
              opportunityId: "opportunity-exact-merge",
              recommendation: "post",
            },
          };
        },
      };
    },
    clock: clock(),
  });

  const success = await worker.processNext();
  assert.equal(success.status, "completed");
  assert.deepEqual(order, ["evidence", "opportunity"]);
  assert.equal(completed.length, 1);

  evidenceFails = true;
  order.length = 0;
  const continuationCallsBeforeFailure = continuationCalls;
  const retry = await worker.processNext();
  assert.equal(retry.status, "retry_scheduled");
  assert.equal(retry.errorCode, "github_evidence_revision_mismatch");
  assert.deepEqual(order, ["evidence"]);
  assert.equal(continuationCalls, continuationCallsBeforeFailure, "opportunity inference must not run after exact evidence preparation fails");
  assert.equal(failed.at(-1).input.errorCode, "github_evidence_revision_mismatch");
});
