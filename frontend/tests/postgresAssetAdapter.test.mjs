import test from "node:test";
import assert from "node:assert/strict";

import { normalizeAsset } from "../lib/domain/sourceArtifacts.mjs";
import { createPostgresAssetRepository } from "../lib/infrastructure/postgresAssetAdapter.mjs";

const NOW = "2026-08-31T03:30:00.000Z";
const HASH_A = `sha256:${"a".repeat(64)}`;
const HASH_B = `sha256:${"b".repeat(64)}`;

function asset(overrides = {}) {
  return normalizeAsset({
    kind: "Asset",
    schemaVersion: 1,
    assetId: "asset-proof-1",
    assetVersionId: "asset-version-proof-1",
    workspaceId: "workspace-1",
    projectId: "project-1",
    originalName: "proof.png",
    mimeType: "image/png",
    byteSize: 4,
    contentHash: HASH_A,
    lifecycle: "original",
    storageRef: {
      provider: "test-private",
      blobId: "blob-proof-1",
      objectKey: `workspaces/workspace-1/assets/sha256/${"a".repeat(64)}`,
      region: "test",
    },
    privacy: { classification: "workspace_private" },
    provenance: [{
      eventType: "captured",
      method: "api",
      actorType: "worker",
      occurredAt: NOW,
    }],
    uploadState: "complete",
    availability: "available",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }, {
    workspaceId: overrides.workspaceId || "workspace-1",
    projectId: overrides.projectId || "project-1",
    now: overrides.updatedAt || NOW,
  });
}

function row(record) {
  return {
    record_id: record.assetId,
    workspace_id: record.workspaceId,
    record_kind: "Asset",
    scope_type: null,
    scope_id: null,
    content_piece_id: null,
    asset_id: record.assetId,
    destination: null,
    status: record.availability,
    revision: 1,
    schema_version: record.schemaVersion,
    record,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

function database(responses = []) {
  const calls = [];
  return {
    calls,
    async query(statement, params) {
      calls.push({ statement, params });
      const next = responses.shift();
      if (typeof next === "function") return next(statement, params);
      return { rows: next || [] };
    },
  };
}

test("Postgres Asset reads are scoped by workspace and record kind", async () => {
  const stored = asset();
  const db = database([[row(stored)]]);
  const repository = createPostgresAssetRepository({ database: db, workspaceId: "workspace-1" });

  const resolved = await repository.get(stored.assetId);

  assert.equal(resolved.assetId, stored.assetId);
  assert.equal(resolved.assetVersionId, stored.assetVersionId);
  assert.match(db.calls[0].statement, /workspace_id = \$1 AND record_kind = \$2 AND record_id = \$3/);
  assert.deepEqual(db.calls[0].params, ["workspace-1", "Asset", stored.assetId]);
});

test("Postgres Asset upsert persists a canonical Asset in existing media storage", async () => {
  const stored = asset();
  const db = database([
    [],
    [row(stored)],
  ]);
  const repository = createPostgresAssetRepository({ database: db, workspaceId: "workspace-1" });

  const resolved = await repository.upsert(stored);

  assert.equal(resolved.assetVersionId, stored.assetVersionId);
  assert.equal(db.calls.length, 2);
  assert.match(db.calls[1].statement, /INSERT INTO sf_media_records/);
  assert.equal(db.calls[1].params[0], stored.assetId);
  assert.equal(db.calls[1].params[1], "workspace-1");
  assert.equal(db.calls[1].params[2], "Asset");
});

test("Postgres Asset persistence fails closed for cross-workspace input", async () => {
  const db = database();
  const repository = createPostgresAssetRepository({ database: db, workspaceId: "workspace-1" });
  const foreign = asset({ workspaceId: "workspace-2" });

  await assert.rejects(
    () => repository.upsert(foreign),
    (error) => error.code === "postgres_workspace_scope_mismatch",
  );
  assert.equal(db.calls.length, 0);
});

test("an existing AssetVersion cannot be silently rewritten", async () => {
  const stored = asset();
  const rewritten = asset({ availability: "metadata_only" });
  const db = database([[row(stored)]]);
  const repository = createPostgresAssetRepository({ database: db, workspaceId: "workspace-1" });

  await assert.rejects(
    () => repository.upsert(rewritten),
    (error) => error.code === "asset_version_immutable_conflict",
  );
  assert.equal(db.calls.length, 1);
});

test("immutable blob identity cannot change under an existing Asset id", async () => {
  const stored = asset();
  const conflicting = asset({
    assetVersionId: "asset-version-proof-2",
    contentHash: HASH_B,
    storageRef: {
      provider: "test-private",
      blobId: "blob-proof-2",
      objectKey: `workspaces/workspace-1/assets/sha256/${"b".repeat(64)}`,
      region: "test",
    },
    updatedAt: "2026-08-31T03:31:00.000Z",
  });
  const db = database([[row(stored)]]);
  const repository = createPostgresAssetRepository({ database: db, workspaceId: "workspace-1" });

  await assert.rejects(
    () => repository.upsert(conflicting),
    (error) => error.code === "asset_immutable_conflict",
  );
  assert.equal(db.calls.length, 1);
});

test("generic remove is forbidden so blob deletion cannot be bypassed", async () => {
  const repository = createPostgresAssetRepository({ database: database(), workspaceId: "workspace-1" });
  await assert.rejects(
    () => repository.remove("asset-proof-1"),
    (error) => error.code === "asset_delete_requires_storage_workflow",
  );
});
