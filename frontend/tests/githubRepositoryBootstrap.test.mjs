import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";

import { createGithubRepositoryBootstrapApplication } from "../lib/application/githubRepositoryBootstrapApplication.mjs";
import { createProjectContextApplication } from "../lib/application/projectContextApplication.mjs";
import { createSourceConnection, SOURCE_CONNECTION_STATUSES } from "../lib/domain/sourceConnections.mjs";
import { createDeterministicIdService } from "../lib/domain/ports.mjs";
import { createMemoryProjectContextRepository } from "../lib/infrastructure/projectContextAdapters.mjs";
import { createMemorySourceConnectionRepository } from "../lib/infrastructure/sourceConnectionAdapters.mjs";
import { createMemorySourceArtifactRepository } from "../lib/infrastructure/transferAdapters.mjs";
import { createGithubRepositoryApiClient } from "../lib/integrations/github/githubRepositoryApi.mjs";
import {
  createGithubRepositoryEvidenceBundle,
  GITHUB_BOOTSTRAP_LIMITS,
  planGithubRepositoryEvidence,
} from "../lib/integrations/github/githubRepositoryEvidence.mjs";

const NOW = "2026-08-21T16:00:00.000Z";
const SHA_A = "a".repeat(40);
const SHA_B = "b".repeat(40);
const SHA_C = "c".repeat(40);

function clock() {
  return { now: () => NOW };
}

function repository(overrides = {}) {
  return {
    id: "9001",
    fullName: "owner/product",
    name: "product",
    ownerLogin: "owner",
    private: true,
    visibility: "private",
    defaultBranch: "main",
    archived: false,
    disabled: false,
    ...overrides,
  };
}

function treeFor(revision = SHA_A) {
  return [
    { path: "README.md", type: "blob", sha: revision, size: 800 },
    { path: "docs/ARCHITECTURE.md", type: "blob", sha: SHA_B, size: 1200 },
    { path: "docs/product-overview.md", type: "blob", sha: SHA_C, size: 900 },
    { path: "package.json", type: "blob", sha: "d".repeat(40), size: 600 },
    { path: "frontend/app/page.js", type: "blob", sha: "e".repeat(40), size: 1000 },
    { path: ".env", type: "blob", sha: "f".repeat(40), size: 200 },
    { path: "private-key.pem", type: "blob", sha: "1".repeat(40), size: 200 },
    { path: "package-lock.json", type: "blob", sha: "2".repeat(40), size: 3000 },
    { path: "dist/app.min.js", type: "blob", sha: "3".repeat(40), size: 3000 },
  ];
}

function contentFor(path, revision = SHA_A) {
  const values = {
    "README.md": `# Product\nSignalFlow learns a repository and surfaces worthwhile content opportunities. Revision ${revision}.`,
    "docs/ARCHITECTURE.md": "# Architecture\nCanonical state is persisted separately from external delivery mechanisms.",
    "docs/product-overview.md": "# Product\nConnect a repository once, then review meaningful stories instead of configuring triggers.",
    "package.json": "{\"name\":\"product\",\"scripts\":{\"test\":\"node --test\"}}",
    "frontend/app/page.js": "export default function Page(){ return 'SignalFlow'; }",
  };
  return values[path] || "representative source";
}

function activeConnection(overrides = {}) {
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
    ...overrides,
  });
}

function inferenceAdapter(counter) {
  return {
    async execute({ task, input }) {
      counter.count += 1;
      counter.inputs.push(input);
      return {
        output: {
          projectName: "Product",
          purpose: "Understand repository work and surface worthwhile communication opportunities.",
          problem: "People should not manually reconstruct project context every time work changes.",
          capabilities: ["Persistent repository understanding", "Bounded evidence synthesis"],
          audiences: ["Project owner"],
          terminology: ["ProjectContext"],
          maturityStage: "active development",
          architectureNotes: ["Canonical context is versioned and persisted."],
          constraints: ["Repository evidence stays bounded."],
          safeClaims: ["Repository evidence is selected deterministically before synthesis."],
          uncertainties: [],
        },
        provenance: {
          taskId: task.taskId,
          provider: "test-provider",
          model: "test-model",
          routeKind: "remote",
          promptVersion: "project_context_v1",
          generatedAt: NOW,
        },
      };
    },
  };
}

function harness({ connection = activeConnection(), privateRepo = true } = {}) {
  const sourceConnectionRepository = createMemorySourceConnectionRepository([connection]);
  const sourceArtifactRepository = createMemorySourceArtifactRepository();
  const projectContextRepository = createMemoryProjectContextRepository();
  const inference = { count: 0, inputs: [] };
  const contextApp = createProjectContextApplication({
    workspaceId: "owner-local",
    repository: projectContextRepository,
    inferenceAdapter: inferenceAdapter(inference),
    clock: clock(),
    idService: createDeterministicIdService("context-test"),
  });
  const githubCalls = { snapshot: 0, files: 0 };
  let revision = SHA_A;
  const githubRepositoryApi = {
    async getRepositorySnapshot() {
      githubCalls.snapshot += 1;
      return { repository: repository({ private: privateRepo, visibility: privateRepo ? "private" : "public" }), revision, treeEntries: treeFor(revision) };
    },
    async readTextFiles(_installationId, _repositoryId, exactRevision, paths) {
      githubCalls.files += 1;
      return paths.map((path) => ({
        path,
        sha: treeFor(exactRevision).find((item) => item.path === path)?.sha || exactRevision,
        size: Buffer.byteLength(contentFor(path, exactRevision)),
        content: contentFor(path, exactRevision),
      }));
    },
  };
  const app = createGithubRepositoryBootstrapApplication({
    workspaceId: "owner-local",
    sourceConnectionRepository,
    sourceArtifactRepository,
    projectContextApplication: contextApp,
    githubRepositoryApi,
    clock: clock(),
  });
  return {
    app,
    sourceConnectionRepository,
    sourceArtifactRepository,
    projectContextRepository,
    inference,
    githubCalls,
    setRevision(value) { revision = value; },
  };
}

test("repository evidence planner is deterministic, bounded, diverse and excludes obvious secret/build noise", () => {
  const manyDocs = Array.from({ length: 30 }, (_, index) => ({
    path: `docs/note-${String(index).padStart(2, "0")}.md`,
    type: "blob",
    sha: String(index).padStart(40, "0"),
    size: 100 + index,
  }));
  const plan = planGithubRepositoryEvidence({
    repository: repository(),
    revision: SHA_A,
    treeEntries: [...treeFor(), ...manyDocs],
  });
  assert.ok(plan.paths.length <= GITHUB_BOOTSTRAP_LIMITS.maxSelectedFiles);
  assert.ok(plan.paths.includes("README.md"));
  assert.ok(plan.paths.includes("docs/ARCHITECTURE.md"));
  assert.ok(plan.paths.includes("package.json"));
  assert.equal(plan.paths.includes(".env"), false);
  assert.equal(plan.paths.includes("private-key.pem"), false);
  assert.equal(plan.paths.includes("package-lock.json"), false);
  assert.equal(plan.paths.includes("dist/app.min.js"), false);
  assert.deepEqual(
    planGithubRepositoryEvidence({ repository: repository(), revision: SHA_A, treeEntries: [...treeFor(), ...manyDocs] }).paths,
    plan.paths,
    "same repository tree must yield the same bounded evidence plan",
  );
});

test("evidence bundle keeps file bodies ephemeral while persisting verifiable SourceArtifact metadata", () => {
  const plan = planGithubRepositoryEvidence({ repository: repository(), revision: SHA_A, treeEntries: treeFor() });
  const files = plan.paths.map((path) => ({ path, sha: SHA_B, content: contentFor(path) }));
  const bundle = createGithubRepositoryEvidenceBundle({
    workspaceId: "owner-local",
    sourceConnectionId: "github-connection-1",
    repository: repository(),
    revision: SHA_A,
    treeEntries: treeFor(),
    files,
    plan,
    now: NOW,
  });
  assert.ok(bundle.evidence.length >= 2);
  assert.equal(bundle.privacyClass, "workspace_private");
  const serializedArtifacts = JSON.stringify(bundle.sourceArtifacts);
  assert.doesNotMatch(serializedArtifacts, /SignalFlow learns a repository/);
  assert.match(serializedArtifacts, /sha256:/);
  assert.ok(bundle.sourceArtifacts.every((artifact) => artifact.sourceReference.revision === SHA_A));
  assert.ok(bundle.evidence.some((item) => item.excerpt.includes("SignalFlow learns a repository")));
});

test("bootstrap requires the exact active authorized repository scope", async () => {
  const paused = activeConnection({ status: SOURCE_CONNECTION_STATUSES.PAUSED });
  const pausedHarness = harness({ connection: paused });
  await assert.rejects(
    () => pausedHarness.app.bootstrapRepository({ sourceConnectionId: paused.sourceConnectionId, repositoryId: "9001" }),
    (error) => error?.code === "github_connection_not_active",
  );

  const activeHarness = harness();
  await assert.rejects(
    () => activeHarness.app.bootstrapRepository({ sourceConnectionId: "github-connection-1", repositoryId: "9999" }),
    (error) => error?.code === "github_repository_scope_mismatch",
  );
  assert.equal(activeHarness.githubCalls.snapshot, 0, "unauthorized repository IDs never reach GitHub repository reads");
});

test("selected repository automatically builds immutable private ProjectContext and reuses exact revision without rereading file bodies", async () => {
  const run = harness();
  const first = await run.app.bootstrapRepository({ sourceConnectionId: "github-connection-1", repositoryId: "9001" });
  assert.equal(first.projectId, "sf-project-github-9001");
  assert.equal(first.context.version, 1);
  assert.equal(first.context.privacyClass, "workspace_private");
  assert.equal(first.reused, false);
  assert.equal(run.inference.count, 1);
  assert.equal(run.githubCalls.files, 1);
  const artifacts = await run.sourceArtifactRepository.list();
  assert.equal(artifacts.length, first.evidenceCount);
  assert.ok(artifacts.every((artifact) => artifact.workspaceId === "owner-local"));
  assert.doesNotMatch(JSON.stringify(first), /Persistent repository understanding|SignalFlow learns a repository/);

  const second = await run.app.bootstrapRepository({ sourceConnectionId: "github-connection-1", repositoryId: "9001" });
  assert.equal(second.context.projectContextSnapshotId, first.context.projectContextSnapshotId);
  assert.equal(second.reused, true);
  assert.equal(second.inferenceSkipped, true);
  assert.equal(run.inference.count, 1, "same exact Git revision does not rerun synthesis");
  assert.equal(run.githubCalls.files, 1, "same exact Git revision does not reread file bodies");
  assert.equal(run.githubCalls.snapshot, 2, "bootstrap still resolves current repository revision before reuse");
});

test("new repository revision produces a new ProjectContext version that supersedes prior understanding", async () => {
  const run = harness();
  const first = await run.app.bootstrapRepository({ sourceConnectionId: "github-connection-1", repositoryId: "9001" });
  run.setRevision(SHA_C);
  const second = await run.app.bootstrapRepository({ sourceConnectionId: "github-connection-1", repositoryId: "9001" });
  assert.equal(second.context.version, 2);
  assert.notEqual(second.context.projectContextSnapshotId, first.context.projectContextSnapshotId);
  const contexts = await run.projectContextRepository.listByProject("sf-project-github-9001");
  assert.equal(contexts.length, 2);
  assert.equal(contexts[0].supersedesId, contexts[1].projectContextSnapshotId);
  assert.equal(run.inference.count, 2);
  assert.equal(run.githubCalls.files, 2);
});

test("GitHub repository API uses ephemeral installation tokens, exact commit revision and fails closed on truncated trees", async () => {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" });
  const requests = [];
  let truncated = false;
  const fetchImpl = async (url, options = {}) => {
    const parsed = new URL(url);
    requests.push({ path: `${parsed.pathname}${parsed.search}`, authorization: options.headers?.Authorization || "" });
    if (parsed.pathname === "/app/installations/77/access_tokens") return Response.json({ token: "ephemeral-installation-token" });
    if (parsed.pathname === "/repositories/9001") {
      assert.equal(options.headers.Authorization, "Bearer ephemeral-installation-token");
      return Response.json({
        id: 9001,
        full_name: "owner/product",
        name: "product",
        owner: { login: "owner" },
        private: true,
        visibility: "private",
        default_branch: "main",
        archived: false,
        disabled: false,
      });
    }
    if (parsed.pathname === "/repos/owner/product/commits/main") return Response.json({ sha: SHA_A, commit: { tree: { sha: SHA_B } } });
    if (parsed.pathname === `/repos/owner/product/git/trees/${SHA_B}`) {
      return Response.json({ truncated, tree: [{ path: "README.md", type: "blob", sha: SHA_C, size: 100 }] });
    }
    if (parsed.pathname === "/repos/owner/product/contents/README.md") {
      assert.equal(parsed.searchParams.get("ref"), SHA_A);
      return Response.json({ type: "file", sha: SHA_C, size: 14, encoding: "base64", content: Buffer.from("# Hello world\n").toString("base64") });
    }
    throw new Error(`Unexpected GitHub test request ${parsed.pathname}${parsed.search}`);
  };
  const client = createGithubRepositoryApiClient({ appId: "123", privateKey: pem, fetchImpl, now: () => Date.parse(NOW) });
  const snapshot = await client.getRepositorySnapshot("77", "9001");
  assert.equal(snapshot.revision, SHA_A);
  assert.equal(snapshot.treeEntries[0].path, "README.md");
  const files = await client.readTextFiles("77", "9001", SHA_A, ["README.md"]);
  assert.equal(files[0].content, "# Hello world\n");
  assert.doesNotMatch(JSON.stringify({ snapshot, files }), /ephemeral-installation-token/);
  assert.ok(requests.some((item) => item.path === `/repos/owner/product/git/trees/${SHA_B}?recursive=1`));

  truncated = true;
  await assert.rejects(
    () => client.getRepositorySnapshot("77", "9001"),
    (error) => error?.code === "github_repository_tree_truncated",
  );
});
