import test from "node:test";
import assert from "node:assert/strict";

import { createProjectContextApplication } from "../lib/application/projectContextApplication.mjs";
import { createProjectContextFingerprint, normalizeProjectContextSnapshot } from "../lib/domain/projectContexts.mjs";
import { createDeterministicIdService } from "../lib/domain/ports.mjs";

const NOW = "2026-08-20T00:20:00.000Z";

function authoritativeSnapshot(candidate, overrides = {}) {
  return normalizeProjectContextSnapshot({
    ...candidate,
    projectContextSnapshotId: overrides.projectContextSnapshotId || candidate.projectContextSnapshotId,
    version: overrides.version || candidate.version,
    supersedesId: overrides.supersedesId === undefined ? candidate.supersedesId : overrides.supersedesId,
  });
}

test("ProjectContext application accepts repository-authoritative lineage after a concurrent fingerprint winner", async () => {
  let upsertCandidate = null;
  const repository = {
    async list() { return []; },
    async get() { return null; },
    async remove() { return false; },
    async listByProject() { return []; },
    async findByFingerprint() { return null; },
    async getLatestByProject() { return null; },
    async upsert(candidate) {
      upsertCandidate = candidate;
      return authoritativeSnapshot(candidate, {
        projectContextSnapshotId: "project-context-other-request",
        version: 4,
        supersedesId: "project-context-3",
      });
    },
  };
  const app = createProjectContextApplication({
    workspaceId: "workspace-1",
    repository,
    clock: { now: () => NOW },
    idService: createDeterministicIdService("context-test"),
  });

  const result = await app.bootstrapProjectContext({
    projectId: "project-1",
    repositoryRef: { provider: "github", owner: "Ankit6149", repository: "SignalFlow-Studio", revision: "abc123" },
    sourceArtifactIds: ["artifact-readme"],
    synthesis: { projectName: "SignalFlow Studio" },
  });

  assert.equal(upsertCandidate.version, 1);
  assert.equal(result.reused, true);
  assert.equal(result.context.projectContextSnapshotId, "project-context-other-request");
  assert.equal(result.context.version, 4);
  assert.equal(result.context.supersedesId, "project-context-3");
  assert.equal(result.context.fingerprint, upsertCandidate.fingerprint);
});

test("ProjectContext application uses direct project/fingerprint repository queries when the adapter supports them", async () => {
  const fingerprint = createProjectContextFingerprint({
    projectId: "project-1",
    repositoryRef: { provider: "github", owner: "Ankit6149", repository: "SignalFlow-Studio", revision: "abc123" },
    sourceArtifactIds: ["artifact-readme"],
    supplementalSourceArtifactIds: [],
    assetIds: [],
  });
  const existing = normalizeProjectContextSnapshot({
    projectContextSnapshotId: "project-context-existing",
    workspaceId: "workspace-1",
    projectId: "project-1",
    version: 1,
    supersedesId: null,
    fingerprint,
    repositoryRef: { provider: "github", owner: "Ankit6149", repository: "SignalFlow-Studio", revision: "abc123" },
    sourceArtifactIds: ["artifact-readme"],
    supplementalSourceArtifactIds: [],
    assetIds: [],
    privacyClass: "workspace_private",
    synthesis: { projectName: "SignalFlow Studio" },
    synthesisProvenance: { mode: "deterministic" },
    createdAt: NOW,
  });
  let listCalls = 0;
  let fingerprintCalls = 0;
  const repository = {
    async list() { listCalls += 1; return []; },
    async get() { return null; },
    async upsert() { throw new Error("should not insert"); },
    async remove() { return false; },
    async listByProject() { throw new Error("should not list project after direct fingerprint hit"); },
    async getLatestByProject() { throw new Error("should not resolve latest after direct fingerprint hit"); },
    async findByFingerprint(projectId, value) {
      fingerprintCalls += 1;
      assert.equal(projectId, "project-1");
      assert.equal(value, fingerprint);
      return existing;
    },
  };
  const app = createProjectContextApplication({
    workspaceId: "workspace-1",
    repository,
    clock: { now: () => NOW },
    idService: createDeterministicIdService("context-test"),
  });

  const result = await app.bootstrapProjectContext({
    projectId: "project-1",
    repositoryRef: existing.repositoryRef,
    sourceArtifactIds: existing.sourceArtifactIds,
    synthesis: { projectName: "this should not replace existing synthesis" },
  });

  assert.equal(result.reused, true);
  assert.equal(result.context.projectContextSnapshotId, existing.projectContextSnapshotId);
  assert.equal(fingerprintCalls, 1);
  assert.equal(listCalls, 0);
});
