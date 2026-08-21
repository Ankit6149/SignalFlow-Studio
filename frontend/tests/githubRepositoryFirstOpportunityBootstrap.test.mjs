import test from "node:test";
import assert from "node:assert/strict";

import { createGithubRepositoryBootstrapApplication } from "../lib/application/githubRepositoryBootstrapApplication.mjs";
import {
  createProjectContextFingerprint,
  normalizeProjectContextSnapshot,
} from "../lib/domain/projectContexts.mjs";
import { createSourceConnection, SOURCE_CONNECTION_STATUSES } from "../lib/domain/sourceConnections.mjs";

const NOW = "2026-08-21T18:15:00.000Z";
const REVISION = "a".repeat(40);

function projectContext() {
  const repositoryRef = {
    provider: "github",
    owner: "owner",
    repository: "product",
    revision: REVISION,
    sourceConnectionId: "github-connection-1",
  };
  const projectId = "sf-project-github-9001";
  const sourceArtifactIds = ["artifact-readme", "artifact-package"];
  return normalizeProjectContextSnapshot({
    projectContextSnapshotId: "context-1",
    workspaceId: "owner-local",
    projectId,
    version: 1,
    supersedesId: null,
    fingerprint: createProjectContextFingerprint({
      projectId,
      repositoryRef,
      sourceArtifactIds,
      supplementalSourceArtifactIds: [],
      assetIds: [],
    }),
    repositoryRef,
    sourceArtifactIds,
    supplementalSourceArtifactIds: [],
    assetIds: [],
    privacyClass: "workspace_private",
    synthesis: {
      projectName: "Product",
      purpose: "Understand project work once and reuse it for future editorial judgment.",
      safeClaims: ["The repository is inspected from bounded evidence."],
    },
    synthesisProvenance: { mode: "deterministic" },
    createdAt: NOW,
  });
}

function connection() {
  return createSourceConnection({
    sourceConnectionId: "github-connection-1",
    workspaceId: "owner-local",
    provider: "github",
    providerAccountRef: "42",
    installationRef: "77",
    permissionScopes: ["contents:read", "metadata:read", "pull_requests:read"],
    capabilities: ["repository_contents", "repository_events", "repository_metadata"],
    resourceScopes: [{
      resourceRef: "9001",
      resourceType: "repository",
      projectId: "sf-project-github-9001",
      displayName: "owner/product",
      eventFamilies: ["pull_request_merged", "release_published"],
      enabled: true,
    }],
    status: SOURCE_CONNECTION_STATUSES.ACTIVE,
    verifiedAt: NOW,
    createdAt: NOW,
  });
}

function createHarness({ latest = null, failFirstOpportunity = false } = {}) {
  const ctx = projectContext();
  const calls = { files: 0, synthesize: 0, first: 0, artifacts: 0 };
  const app = createGithubRepositoryBootstrapApplication({
    workspaceId: "owner-local",
    sourceConnectionRepository: {
      async list() { return [connection()]; },
      async get(id) { return id === "github-connection-1" ? connection() : null; },
      async upsert(record) { return record; },
      async remove() { return false; },
      async findByProviderInstallation() { return connection(); },
    },
    sourceArtifactRepository: {
      async list() { return []; },
      async get() { return null; },
      async upsert(artifact) { calls.artifacts += 1; return artifact; },
      async remove() { return false; },
    },
    projectContextApplication: {
      async getLatestProjectContext() { return latest; },
      async synthesizeAndBootstrapProjectContext() {
        calls.synthesize += 1;
        return { context: ctx, reused: false, inferenceSkipped: false };
      },
    },
    githubRepositoryApi: {
      async getRepositorySnapshot() {
        return {
          repository: {
            id: "9001",
            fullName: "owner/product",
            name: "product",
            ownerLogin: "owner",
            private: true,
            visibility: "private",
            defaultBranch: "main",
            archived: false,
            disabled: false,
          },
          revision: REVISION,
          treeEntries: [
            { path: "README.md", type: "blob", sha: "b".repeat(40), size: 200 },
            { path: "package.json", type: "blob", sha: "c".repeat(40), size: 100 },
          ],
        };
      },
      async readTextFiles(_installation, _repositoryId, _revision, paths) {
        calls.files += 1;
        return paths.map((path) => ({
          path,
          sha: path === "README.md" ? "b".repeat(40) : "c".repeat(40),
          size: 80,
          content: path === "README.md"
            ? "# Product\nConnect once, preserve context, and surface worthwhile editorial decisions."
            : '{"name":"product"}',
        }));
      },
    },
    firstOpportunityApplication: {
      async ensureInitialOpportunity(input) {
        calls.first += 1;
        assert.equal(input.sourceConnectionId, "github-connection-1");
        assert.equal(input.repository.fullName, "owner/product");
        assert.equal(input.projectContext.projectContextSnapshotId, "context-1");
        if (failFirstOpportunity) {
          const error = new Error("model temporarily unavailable");
          error.code = "inference_route_unavailable";
          throw error;
        }
        return {
          opportunity: {
            opportunityId: "opportunity-first",
            recommendation: "post",
            score: 91,
            title: "Start with the project decision",
            summary: "A useful first editorial judgment.",
            recommendedAngleId: "angle-2",
            status: "proposed",
          },
        };
      },
    },
    clock: { now: () => NOW },
  });
  return { app, ctx, calls };
}

test("fresh repository bootstrap returns a bounded first Opportunity after ProjectContext is durable", async () => {
  const run = createHarness();
  const result = await run.app.bootstrapRepository({ sourceConnectionId: "github-connection-1", repositoryId: "9001" });

  assert.equal(run.calls.files, 1);
  assert.equal(run.calls.synthesize, 1);
  assert.equal(run.calls.first, 1);
  assert.equal(result.context.projectContextSnapshotId, "context-1");
  assert.equal(result.firstOpportunityStatus, "ready");
  assert.equal(result.firstOpportunity.opportunityId, "opportunity-first");
  assert.equal(result.firstOpportunity.recommendedAngleId, "angle-2");
  assert.doesNotMatch(JSON.stringify(result), /Connect once, preserve context/);
});

test("exact repository revision reuse skips evidence/model context work but still resolves the first Opportunity", async () => {
  const existing = projectContext();
  const run = createHarness({ latest: existing });
  const result = await run.app.bootstrapRepository({ sourceConnectionId: "github-connection-1", repositoryId: "9001" });

  assert.equal(result.reused, true);
  assert.equal(result.inferenceSkipped, true);
  assert.equal(result.firstOpportunityStatus, "ready");
  assert.equal(run.calls.files, 0);
  assert.equal(run.calls.synthesize, 0);
  assert.equal(run.calls.artifacts, 0);
  assert.equal(run.calls.first, 1);
});

test("first Opportunity failure never destroys successful ProjectContext and remains retryable without reconnecting GitHub", async () => {
  const existing = projectContext();
  const run = createHarness({ latest: existing, failFirstOpportunity: true });
  const result = await run.app.bootstrapRepository({ sourceConnectionId: "github-connection-1", repositoryId: "9001" });

  assert.equal(result.context.projectContextSnapshotId, existing.projectContextSnapshotId);
  assert.equal(result.firstOpportunity, null);
  assert.equal(result.firstOpportunityStatus, "retryable_error");
  assert.equal(result.firstOpportunityErrorCode, "inference_route_unavailable");
  assert.equal(run.calls.first, 1);
  assert.equal(run.calls.files, 0);
  assert.equal(run.calls.synthesize, 0);
});
