import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createProjectContextFingerprint,
  normalizeProjectContextSnapshot,
} from "../lib/domain/projectContexts.mjs";
import {
  createPostgresProjectContextRepository,
  projectContextFromRow,
} from "../lib/infrastructure/postgresProjectContextAdapter.mjs";

const NOW = "2026-08-20T00:10:00.000Z";

function snapshotInput(overrides = {}) {
  const projectId = overrides.projectId || "project-1";
  const repositoryRef = overrides.repositoryRef || {
    provider: "github",
    owner: "Ankit6149",
    repository: "SignalFlow-Studio",
    revision: "abc123",
    sourceConnectionId: "connection-1",
  };
  const sourceArtifactIds = overrides.sourceArtifactIds || ["artifact-readme"];
  const supplementalSourceArtifactIds = overrides.supplementalSourceArtifactIds || [];
  const assetIds = overrides.assetIds || [];
  const fingerprint = createProjectContextFingerprint({
    projectId,
    repositoryRef,
    sourceArtifactIds,
    supplementalSourceArtifactIds,
    assetIds,
  });
  return normalizeProjectContextSnapshot({
    projectContextSnapshotId: overrides.projectContextSnapshotId || "project-context-1",
    workspaceId: overrides.workspaceId || "workspace-1",
    projectId,
    version: overrides.version || 1,
    supersedesId: overrides.supersedesId || null,
    fingerprint,
    repositoryRef,
    sourceArtifactIds,
    supplementalSourceArtifactIds,
    assetIds,
    privacyClass: overrides.privacyClass || "workspace_private",
    synthesis: overrides.synthesis || {
      projectName: "SignalFlow Studio",
      purpose: "Turn meaningful work into evidence-backed content decisions.",
      safeClaims: ["Project context is versioned."],
      uncertainties: ["GitHub App authorization remains incomplete."],
    },
    synthesisProvenance: overrides.synthesisProvenance || { mode: "deterministic" },
    createdAt: overrides.createdAt || NOW,
  });
}

function rowFromSnapshot(snapshot, overrides = {}) {
  return {
    project_context_snapshot_id: overrides.project_context_snapshot_id || snapshot.projectContextSnapshotId,
    workspace_id: overrides.workspace_id || snapshot.workspaceId,
    project_id: overrides.project_id || snapshot.projectId,
    version: overrides.version || snapshot.version,
    supersedes_id: overrides.supersedes_id === undefined ? snapshot.supersedesId : overrides.supersedes_id,
    fingerprint: overrides.fingerprint || snapshot.fingerprint,
    repository_ref: overrides.repository_ref === undefined ? snapshot.repositoryRef : overrides.repository_ref,
    source_artifact_ids: overrides.source_artifact_ids || snapshot.sourceArtifactIds,
    supplemental_source_artifact_ids: overrides.supplemental_source_artifact_ids || snapshot.supplementalSourceArtifactIds,
    asset_ids: overrides.asset_ids || snapshot.assetIds,
    privacy_class: overrides.privacy_class || snapshot.privacyClass,
    synthesis: overrides.synthesis === undefined ? snapshot.synthesis : overrides.synthesis,
    synthesis_provenance: overrides.synthesis_provenance === undefined ? snapshot.synthesisProvenance : overrides.synthesis_provenance,
    schema_version: overrides.schema_version || snapshot.projectContextSchemaVersion,
    created_at: overrides.created_at || snapshot.createdAt,
  };
}

function fakeDatabase(results = []) {
  const calls = [];
  return {
    calls,
    async query(statement, params) {
      calls.push({ statement, params });
      return results.length ? results.shift() : [];
    },
  };
}

test("ProjectContext migration encodes immutable version/fingerprint history without raw repository payload columns", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const migration = fs.readFileSync(path.join(here, "../db/migrations/0002_project_context_snapshots.sql"), "utf8");

  assert.match(migration, /CREATE TABLE IF NOT EXISTS sf_project_context_snapshots/);
  assert.match(migration, /UNIQUE \(workspace_id, project_id, version\)/);
  assert.match(migration, /UNIQUE \(workspace_id, project_id, fingerprint\)/);
  assert.match(migration, /FOREIGN KEY \(workspace_id, project_id, supersedes_id\)/);
  assert.match(migration, /version DESC/);
  assert.doesNotMatch(migration, /repository_contents|raw_repository|source_artifact_text|access_token|refresh_token|private_key|database_url/i);
});

test("Postgres ProjectContext row mapping round-trips canonical immutable snapshot state", () => {
  const snapshot = snapshotInput();
  const mapped = projectContextFromRow(rowFromSnapshot(snapshot, {
    repository_ref: JSON.stringify(snapshot.repositoryRef),
    synthesis: JSON.stringify(snapshot.synthesis),
    synthesis_provenance: JSON.stringify(snapshot.synthesisProvenance),
  }));
  assert.deepEqual(mapped, snapshot);
});

test("workspace-scoped ProjectContext queries never fall back to unscoped access", async () => {
  const unscoped = createPostgresProjectContextRepository({ database: fakeDatabase() });
  await assert.rejects(() => unscoped.list(), (error) => error?.code === "postgres_workspace_scope_required");
  await assert.rejects(() => unscoped.get("project-context-1"), (error) => error?.code === "postgres_workspace_scope_required");

  const crossWorkspace = createPostgresProjectContextRepository({ database: fakeDatabase(), workspaceId: "workspace-1" });
  await assert.rejects(
    () => crossWorkspace.upsert(snapshotInput({ workspaceId: "workspace-2" })),
    (error) => error?.code === "postgres_workspace_scope_mismatch",
  );
});

test("hosted upsert serializes per-project writes, deduplicates exact evidence, and returns database-authoritative lineage", async () => {
  const candidate = snapshotInput();
  const persisted = snapshotInput({
    projectContextSnapshotId: "project-context-concurrent-winner",
    version: 3,
    supersedesId: "project-context-2",
  });
  const db = fakeDatabase([[rowFromSnapshot(persisted)]]);
  const repository = createPostgresProjectContextRepository({ database: db, workspaceId: "workspace-1" });

  const stored = await repository.upsert(candidate);
  assert.equal(stored.projectContextSnapshotId, "project-context-concurrent-winner");
  assert.equal(stored.version, 3);
  assert.equal(stored.supersedesId, "project-context-2");
  assert.equal(stored.fingerprint, candidate.fingerprint);
  assert.match(db.calls[0].statement, /pg_advisory_xact_lock/);
  assert.match(db.calls[0].statement, /fingerprint = \$4/);
  assert.match(db.calls[0].statement, /COALESCE\(latest\.version, 0\) \+ 1/);
  assert.match(db.calls[0].statement, /latest\.project_context_snapshot_id/);
  assert.match(db.calls[0].statement, /ON CONFLICT DO NOTHING/);
  assert.doesNotMatch(db.calls[0].statement, /DO UPDATE/);
});

test("project-scoped lookup methods use workspace + project + fingerprint boundaries", async () => {
  const snapshot = snapshotInput();
  const db = fakeDatabase([
    [rowFromSnapshot(snapshot)],
    [rowFromSnapshot(snapshot)],
    [rowFromSnapshot(snapshot)],
  ]);
  const repository = createPostgresProjectContextRepository({ database: db, workspaceId: "workspace-1" });

  const list = await repository.listByProject("project-1");
  const found = await repository.findByFingerprint("project-1", snapshot.fingerprint);
  const latest = await repository.getLatestByProject("project-1");
  assert.equal(list.length, 1);
  assert.equal(found.projectContextSnapshotId, snapshot.projectContextSnapshotId);
  assert.equal(latest.projectContextSnapshotId, snapshot.projectContextSnapshotId);
  assert.deepEqual(db.calls[0].params, ["workspace-1", "project-1"]);
  assert.deepEqual(db.calls[1].params, ["workspace-1", "project-1", snapshot.fingerprint]);
  assert.deepEqual(db.calls[2].params, ["workspace-1", "project-1"]);
});

test("generic hosted ProjectContext deletion fails closed because snapshots are provenance history", async () => {
  const repository = createPostgresProjectContextRepository({ database: fakeDatabase(), workspaceId: "workspace-1" });
  await assert.rejects(
    () => repository.remove("project-context-1"),
    (error) => error?.code === "project_context_immutable_delete_forbidden",
  );
});
