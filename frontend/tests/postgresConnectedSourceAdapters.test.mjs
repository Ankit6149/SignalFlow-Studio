import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createConnectedContentSignal } from "../lib/domain/contentSignals.mjs";
import { createSourceConnection, SOURCE_CONNECTION_STATUSES } from "../lib/domain/sourceConnections.mjs";
import {
  __testables,
  createPostgresContentSignalRepository,
  createPostgresSourceConnectionRepository,
} from "../lib/infrastructure/postgresConnectedSourceAdapters.mjs";

const NOW = "2026-08-18T18:30:00.000Z";

function sourceConnectionRow() {
  return {
    source_connection_id: "connection-1",
    workspace_id: "workspace-1",
    provider: "github",
    provider_account_ref: "account-1",
    installation_ref: "installation-1",
    credential_ref: "credential-ref-1",
    status: "active",
    permission_scopes: ["metadata:read"],
    capabilities: ["webhook_events"],
    resource_scopes: [{
      resourceRef: "repository-1",
      resourceType: "repository",
      projectId: "project-1",
      displayName: "repo",
      eventFamilies: ["pull_request_merged"],
      enabled: true,
    }],
    verified_at: NOW,
    last_event_at: null,
    last_error_code: null,
    schema_version: 1,
    created_at: NOW,
    updated_at: NOW,
  };
}

function contentSignalRow() {
  return {
    signal_id: "signal-1",
    workspace_id: "workspace-1",
    project_id: "project-1",
    source_type: "github",
    source_connection_id: "connection-1",
    source_artifact_ids: [],
    asset_ids: [],
    external_provider: "github",
    external_event_id: "delivery-1",
    external_idempotency_key: "github:delivery-1",
    occurred_at: NOW,
    observed_at: NOW,
    created_at: NOW,
    updated_at: NOW,
    headline: "Merged a meaningful change",
    summary: "Merged pull request #1.",
    signal_kind: "feature",
    importance_hints: ["work:completed"],
    privacy_classification: "workspace_private",
    boundary_note: "Event metadata is not full evidence.",
    status: "new",
    snoozed_until: null,
    status_changed_at: NOW,
    provenance: { source: "github", ingestionMethod: "provider_event", capturedAt: NOW, actorRef: "github-webhook" },
    schema_version: 1,
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

test("relational migration encodes workspace ownership and atomic external-event uniqueness", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const migration = fs.readFileSync(path.join(here, "../db/migrations/0001_connected_source_signals.sql"), "utf8");

  assert.match(migration, /CREATE TABLE IF NOT EXISTS sf_source_connections/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS sf_source_connection_resources/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS sf_content_signals/);
  assert.match(migration, /UNIQUE \(workspace_id, external_provider, external_event_id\)/);
  assert.match(migration, /UNIQUE INDEX IF NOT EXISTS sf_content_signals_external_idempotency_unique/);
  assert.match(migration, /FOREIGN KEY \(workspace_id, source_connection_id\)/);
  assert.match(migration, /provider, installation_ref/);
  assert.doesNotMatch(migration, /webhook_payload|raw_payload|pull_request_body|release_body|access_token|refresh_token/i);
});

test("Postgres row mapping round-trips canonical SourceConnection and ContentSignal records", () => {
  const connection = __testables.connectionFromRow(sourceConnectionRow());
  assert.equal(connection.kind, "SourceConnection");
  assert.equal(connection.workspaceId, "workspace-1");
  assert.equal(connection.resourceScopes[0].projectId, "project-1");

  const signal = __testables.signalFromRow(contentSignalRow());
  assert.equal(signal.kind, "ContentSignal");
  assert.equal(signal.workspaceId, "workspace-1");
  assert.deepEqual(signal.externalEventRef, {
    provider: "github",
    eventId: "delivery-1",
    idempotencyKey: "github:delivery-1",
  });
});

test("trusted source lookup is installation-scoped while ordinary repository access requires workspace scope", async () => {
  const db = fakeDatabase([[sourceConnectionRow()]]);
  const trusted = createPostgresSourceConnectionRepository({ database: db, trustedServerLookup: true });
  const matches = await trusted.findByProviderInstallation("GitHub", "installation-1");
  assert.equal(matches.length, 1);
  assert.equal(matches[0].workspaceId, "workspace-1");
  assert.match(db.calls[0].statement, /c\.provider = \$1 AND c\.installation_ref = \$2/);
  assert.deepEqual(db.calls[0].params, ["github", "installation-1"]);

  const untrusted = createPostgresSourceConnectionRepository({ database: fakeDatabase() });
  await assert.rejects(() => untrusted.list(), (error) => error?.code === "postgres_workspace_scope_required");
  await assert.rejects(
    () => untrusted.findByProviderInstallation("github", "installation-1"),
    (error) => error?.code === "source_connection_trusted_lookup_required",
  );
});

test("source upsert refuses cross-owner/provider collision and replaces resource scope atomically", async () => {
  const connection = createSourceConnection({
    sourceConnectionId: "connection-1",
    workspaceId: "workspace-1",
    provider: "github",
    installationRef: "installation-1",
    credentialRef: "credential-ref-1",
    status: SOURCE_CONNECTION_STATUSES.ACTIVE,
    verifiedAt: NOW,
    resourceScopes: [{
      resourceRef: "repository-1",
      projectId: "project-1",
      eventFamilies: ["pull_request_merged"],
    }],
    createdAt: NOW,
  });
  const db = fakeDatabase([
    [{ source_connection_id: "connection-1", workspace_id: "workspace-1" }],
    [sourceConnectionRow()],
  ]);
  const repository = createPostgresSourceConnectionRepository({
    database: db,
    workspaceId: "workspace-1",
  });
  const stored = await repository.upsert(connection);
  assert.equal(stored.sourceConnectionId, "connection-1");
  assert.match(db.calls[0].statement, /WITH upsert_connection AS/);
  assert.match(db.calls[0].statement, /delete_resources AS/);
  assert.match(db.calls[0].statement, /insert_resources AS/);
  assert.match(db.calls[0].statement, /sf_source_connections\.workspace_id = EXCLUDED\.workspace_id/);
  assert.equal(typeof db.calls[0].params[15], "string");
  assert.match(db.calls[0].params[15], /repository-1/);
});

test("external signal insert uses database conflict handling and returns the canonical existing row on duplicate", async () => {
  const signal = createConnectedContentSignal({
    signalId: "signal-attempt-2",
    workspaceId: "workspace-1",
    projectId: "project-1",
    sourceType: "github",
    sourceConnectionId: "connection-1",
    externalEventRef: { provider: "github", eventId: "delivery-1", idempotencyKey: "github:delivery-1" },
    headline: "Merged a meaningful change",
    summary: "Merged pull request #1.",
    signalKind: "feature",
    occurredAt: NOW,
    observedAt: NOW,
  });

  const insertedRow = { ...contentSignalRow(), signal_id: "signal-attempt-2" };
  const insertedDb = fakeDatabase([[insertedRow]]);
  const insertedRepo = createPostgresContentSignalRepository({ database: insertedDb });
  const inserted = await insertedRepo.insertExternalIfAbsent(signal);
  assert.equal(inserted.created, true);
  assert.equal(inserted.signal.signalId, "signal-attempt-2");
  assert.match(insertedDb.calls[0].statement, /ON CONFLICT \(workspace_id, external_provider, external_event_id\) DO NOTHING/);

  const duplicateDb = fakeDatabase([[], [contentSignalRow()]]);
  const duplicateRepo = createPostgresContentSignalRepository({ database: duplicateDb });
  const duplicate = await duplicateRepo.insertExternalIfAbsent(signal);
  assert.equal(duplicate.created, false);
  assert.equal(duplicate.signal.signalId, "signal-1");
  assert.equal(duplicateDb.calls.length, 2);
  assert.match(duplicateDb.calls[1].statement, /external_provider = \$2 AND external_event_id = \$3/);
});

test("workspace-scoped content repository rejects cross-workspace records before persistence", async () => {
  const signal = createConnectedContentSignal({
    signalId: "signal-2",
    workspaceId: "workspace-other",
    sourceType: "github",
    sourceConnectionId: "connection-other",
    externalEventRef: { provider: "github", eventId: "delivery-other" },
    headline: "Other workspace",
    observedAt: NOW,
  });
  const repository = createPostgresContentSignalRepository({
    database: fakeDatabase(),
    workspaceId: "workspace-1",
  });
  await assert.rejects(
    () => repository.insertExternalIfAbsent(signal),
    (error) => error?.code === "postgres_workspace_scope_mismatch",
  );
});
