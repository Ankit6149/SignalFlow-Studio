import test from "node:test";
import assert from "node:assert/strict";

import { createDeterministicIdService } from "../lib/domain/ports.mjs";
import {
  createProjectContextFingerprint,
  normalizeProjectContextSnapshot,
} from "../lib/domain/projectContexts.mjs";
import { createProjectContextApplication } from "../lib/application/projectContextApplication.mjs";
import { createBrowserProjectContextApplication } from "../lib/application/browserProjectContextApplication.mjs";
import {
  createBrowserProjectContextRepository,
  createMemoryProjectContextRepository,
  createStoreBackedProjectContextRepository,
} from "../lib/infrastructure/projectContextAdapters.mjs";

function fixedClock(value = "2026-08-19T00:00:00.000Z") {
  return { now: () => value };
}

function createStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    dump() { return Object.fromEntries(values); },
  };
}

function createStore() {
  const values = new Map();
  return {
    async list(prefix = "") { return [...values.keys()].filter((key) => key.startsWith(prefix)).sort(); },
    async get(key) { return values.has(key) ? structuredClone(values.get(key)) : null; },
    async set(key, value) { values.set(key, structuredClone(value)); return true; },
    async remove(key) { return values.delete(key); },
  };
}

const repositoryRef = {
  provider: "github",
  owner: "example",
  repository: "signalflow-demo",
  revision: "abc123def456",
  sourceConnectionId: "connection-1",
};

const synthesis = {
  projectName: "SignalFlow Demo",
  purpose: "Reduce the work between meaningful product changes and content judgment.",
  problem: "Product work happens continuously but communicating it consistently takes separate effort.",
  capabilities: ["Detect meaningful work", "Prepare reviewable content opportunities"],
  audiences: ["Product builders"],
  terminology: ["ContentSignal", "ContentOpportunity"],
  maturityStage: "private alpha",
  architectureNotes: ["Source ingestion is separate from destination planning."],
  constraints: ["Do not automatically publish."],
  safeClaims: ["Owner judgment remains required."],
  uncertainties: ["Destination cadence is not configured yet."],
};

test("ProjectContextSnapshot is versioned, source-neutral, provenance-backed portable state", () => {
  const fingerprint = createProjectContextFingerprint({
    projectId: "project-1",
    repositoryRef,
    sourceArtifactIds: ["source-readme", "source-package"],
    supplementalSourceArtifactIds: ["source-owner-note"],
    assetIds: [],
    synthesis,
  });
  const context = normalizeProjectContextSnapshot({
    projectContextSnapshotId: "context-1",
    workspaceId: "workspace-1",
    projectId: "project-1",
    version: 1,
    fingerprint,
    repositoryRef,
    sourceArtifactIds: ["source-readme", "source-package"],
    supplementalSourceArtifactIds: ["source-owner-note"],
    privacyClass: "workspace_private",
    synthesis,
    synthesisProvenance: { mode: "model", taskId: "task-1", provider: "test", model: "context-model", routeKind: "remote", promptVersion: "project_context_v1", generatedAt: "2026-08-19T00:00:00.000Z" },
    createdAt: "2026-08-19T00:00:00.000Z",
  });

  assert.equal(context.kind, "ProjectContextSnapshot");
  assert.equal(context.projectId, "project-1");
  assert.equal(context.repositoryRef.provider, "github");
  assert.deepEqual(context.sourceArtifactIds, ["source-readme", "source-package"]);
  assert.equal(context.synthesis.safeClaims[0], "Owner judgment remains required.");
  assert.equal("destination" in context, false);
  assert.equal("platform" in context, false);
  assert.equal("linkedin" in JSON.stringify(context).toLowerCase(), false);
  assert.equal("x" in Object.keys(context), false);
});

test("bootstrap reuses unchanged evidence and creates an immutable successor when project evidence changes", async () => {
  const repository = createMemoryProjectContextRepository();
  const application = createProjectContextApplication({
    workspaceId: "workspace-1",
    repository,
    clock: fixedClock(),
    idService: createDeterministicIdService("test"),
  });

  const first = await application.bootstrapProjectContext({
    projectId: "project-1",
    repositoryRef,
    sourceArtifactIds: ["source-readme", "source-package"],
    supplementalSourceArtifactIds: ["source-owner-note"],
    synthesis,
    synthesisProvenance: { mode: "model", taskId: "task-1" },
  });
  const repeated = await application.bootstrapProjectContext({
    projectId: "project-1",
    repositoryRef,
    sourceArtifactIds: ["source-package", "source-readme"],
    supplementalSourceArtifactIds: ["source-owner-note"],
    synthesis,
    synthesisProvenance: { mode: "model", taskId: "task-2" },
  });
  const changed = await application.bootstrapProjectContext({
    projectId: "project-1",
    repositoryRef: { ...repositoryRef, revision: "def456abc789" },
    sourceArtifactIds: ["source-readme", "source-package", "source-architecture"],
    supplementalSourceArtifactIds: ["source-owner-note"],
    synthesis: { ...synthesis, capabilities: [...synthesis.capabilities, "Persistent project context"] },
    synthesisProvenance: { mode: "model", taskId: "task-3" },
  });

  assert.equal(first.reused, false);
  assert.equal(repeated.reused, true);
  assert.equal(repeated.context.projectContextSnapshotId, first.context.projectContextSnapshotId);
  assert.equal(changed.reused, false);
  assert.equal(changed.context.version, 2);
  assert.equal(changed.context.supersedesId, first.context.projectContextSnapshotId);
  assert.notEqual(changed.context.fingerprint, first.context.fingerprint);
  assert.equal((await application.listProjectContexts({ projectId: "project-1" })).length, 2);
});

test("Not now requires no context mutation and a later Signal automatically resolves the retained project context", async () => {
  const repository = createMemoryProjectContextRepository();
  const application = createProjectContextApplication({
    workspaceId: "workspace-1",
    repository,
    clock: fixedClock(),
    idService: createDeterministicIdService("test"),
  });
  const created = await application.bootstrapProjectContext({
    projectId: "project-1",
    repositoryRef,
    sourceArtifactIds: ["source-readme"],
    synthesis,
  });

  // Choosing “Not now” belongs to opportunity/onboarding judgment, not ProjectContext.
  // No context write is needed or allowed merely because the owner deferred posting.
  const beforeLaterSignal = await application.listProjectContexts({ projectId: "project-1" });
  const resolved = await application.resolveLatestForSignal({
    workspaceId: "workspace-1",
    projectId: "project-1",
    signalId: "signal-later-1",
  });
  const afterLaterSignal = await application.listProjectContexts({ projectId: "project-1" });

  assert.equal(beforeLaterSignal.length, 1);
  assert.equal(afterLaterSignal.length, 1);
  assert.equal(resolved.projectContextSnapshotId, created.context.projectContextSnapshotId);
  assert.equal(resolved.fingerprint, created.context.fingerprint);
});

test("browser reconstruction keeps project understanding available for later automatic signals", async () => {
  const storage = createStorage();
  const first = createBrowserProjectContextApplication({
    workspaceId: "workspace-1",
    getStorage: () => storage,
    clock: fixedClock(),
    idService: createDeterministicIdService("browser"),
  });
  const created = await first.bootstrapProjectContext({
    projectId: "project-1",
    repositoryRef,
    sourceArtifactIds: ["source-readme"],
    synthesis,
  });

  const reopened = createBrowserProjectContextApplication({
    workspaceId: "workspace-1",
    getStorage: () => storage,
    clock: fixedClock("2026-08-19T01:00:00.000Z"),
    idService: createDeterministicIdService("reopened"),
  });
  const latest = await reopened.resolveLatestForSignal({ workspaceId: "workspace-1", projectId: "project-1", signalId: "signal-2" });

  assert.equal(latest.projectContextSnapshotId, created.context.projectContextSnapshotId);
  assert.equal(latest.synthesis.projectName, "SignalFlow Demo");
  assert.match(JSON.stringify(storage.dump()), /signalflow_project_contexts_v1/);
});

test("memory, browser and store-backed repositories enforce the same portable project-context contract", async () => {
  const storage = createStorage();
  const store = createStore();
  const repositories = [
    createMemoryProjectContextRepository(),
    createBrowserProjectContextRepository({ getStorage: () => storage }),
    createStoreBackedProjectContextRepository({ store }),
  ];
  const fingerprint = createProjectContextFingerprint({ projectId: "project-1", repositoryRef, synthesis });

  for (let index = 0; index < repositories.length; index += 1) {
    const repository = repositories[index];
    const record = normalizeProjectContextSnapshot({
      projectContextSnapshotId: `context-${index + 1}`,
      workspaceId: "workspace-1",
      projectId: "project-1",
      version: 1,
      fingerprint,
      repositoryRef,
      privacyClass: "workspace_private",
      synthesis,
      synthesisProvenance: { mode: "deterministic" },
      createdAt: "2026-08-19T00:00:00.000Z",
    });
    await repository.upsert(record);
    assert.deepEqual(await repository.get(record.projectContextSnapshotId), record);
    assert.equal((await repository.list()).length, 1);
  }
});

test("project context rejects credential-shaped fields, local paths, unsafe repository refs and cross-workspace signal reuse", async () => {
  assert.throws(
    () => createProjectContextFingerprint({ projectId: "project-1", repositoryRef: { ...repositoryRef, owner: "https://github.com/example" }, synthesis }),
    /safe repository token/i,
  );
  assert.throws(
    () => normalizeProjectContextSnapshot({
      projectContextSnapshotId: "context-1",
      workspaceId: "workspace-1",
      projectId: "project-1",
      version: 1,
      fingerprint: createProjectContextFingerprint({ projectId: "project-1", repositoryRef, synthesis }),
      repositoryRef,
      privacyClass: "workspace_private",
      synthesis: { ...synthesis, apiKey: "secret" },
      synthesisProvenance: { mode: "deterministic" },
      createdAt: "2026-08-19T00:00:00.000Z",
    }),
    /forbidden/i,
  );

  const application = createProjectContextApplication({
    workspaceId: "workspace-1",
    repository: createMemoryProjectContextRepository(),
    clock: fixedClock(),
    idService: createDeterministicIdService("test"),
  });
  await assert.rejects(
    () => application.resolveLatestForSignal({ workspaceId: "workspace-2", projectId: "project-1", signalId: "signal-foreign" }),
    /another workspace/i,
  );
});
