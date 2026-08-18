import { assertPort } from "../domain/ports.mjs";
import { portableClone } from "../domain/contracts.mjs";
import { normalizeContentSignal } from "../domain/contentSignals.mjs";
import { normalizeSourceConnection } from "../domain/sourceConnections.mjs";

function requireDatabase(database) {
  if (!database || typeof database.query !== "function") {
    throw new TypeError("Postgres repository requires a database query executor.");
  }
  return database;
}

function resultRows(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.rows)) return result.rows;
  return [];
}

function jsonValue(value, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "string") return JSON.parse(value);
  return value;
}

function timestamp(value) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : value;
}

function connectionFromRow(row) {
  return normalizeSourceConnection({
    sourceConnectionSchemaVersion: Number(row.schema_version || 1),
    sourceConnectionId: row.source_connection_id,
    workspaceId: row.workspace_id,
    provider: row.provider,
    providerAccountRef: row.provider_account_ref,
    installationRef: row.installation_ref,
    credentialRef: row.credential_ref,
    status: row.status,
    permissionScopes: row.permission_scopes || [],
    capabilities: row.capabilities || [],
    resourceScopes: jsonValue(row.resource_scopes, []),
    verifiedAt: timestamp(row.verified_at),
    lastEventAt: timestamp(row.last_event_at),
    lastErrorCode: row.last_error_code,
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at),
  });
}

function signalFromRow(row) {
  const externalEventRef = row.external_provider && row.external_event_id
    ? {
        provider: row.external_provider,
        eventId: row.external_event_id,
        idempotencyKey: row.external_idempotency_key || null,
      }
    : null;
  return normalizeContentSignal({
    signalSchemaVersion: Number(row.schema_version || 1),
    signalId: row.signal_id,
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    sourceType: row.source_type,
    sourceConnectionId: row.source_connection_id,
    sourceArtifactIds: row.source_artifact_ids || [],
    assetIds: row.asset_ids || [],
    externalEventRef,
    occurredAt: timestamp(row.occurred_at),
    observedAt: timestamp(row.observed_at),
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at),
    headline: row.headline,
    summary: row.summary,
    signalKind: row.signal_kind,
    importanceHints: row.importance_hints || [],
    privacyClassification: row.privacy_classification,
    boundaryNote: row.boundary_note,
    status: row.status,
    snoozedUntil: timestamp(row.snoozed_until),
    statusChangedAt: timestamp(row.status_changed_at),
    provenance: jsonValue(row.provenance, {}),
  });
}

const CONNECTION_SELECT = `
SELECT
  c.*,
  COALESCE(resources.resource_scopes, '[]'::jsonb) AS resource_scopes
FROM sf_source_connections c
LEFT JOIN LATERAL (
  SELECT jsonb_agg(
    jsonb_build_object(
      'resourceRef', r.resource_ref,
      'resourceType', r.resource_type,
      'projectId', r.project_id,
      'displayName', r.display_name,
      'eventFamilies', r.event_families,
      'enabled', r.enabled
    ) ORDER BY r.resource_ref
  ) AS resource_scopes
  FROM sf_source_connection_resources r
  WHERE r.source_connection_id = c.source_connection_id
    AND r.workspace_id = c.workspace_id
) resources ON true`;

function scopedWorkspace(workspaceId) {
  const normalized = String(workspaceId || "").trim();
  return normalized || null;
}

function assertWorkspaceScope(scope, workspaceId) {
  if (!scope) {
    const error = new Error("A workspace-scoped Postgres repository operation requires workspace context.");
    error.code = "postgres_workspace_scope_required";
    throw error;
  }
  if (workspaceId && String(workspaceId) !== scope) {
    const error = new Error("Cross-workspace repository access is forbidden.");
    error.code = "postgres_workspace_scope_mismatch";
    throw error;
  }
  return scope;
}

export function createPostgresSourceConnectionRepository({
  database,
  workspaceId = null,
  trustedServerLookup = false,
} = {}) {
  const db = requireDatabase(database);
  const scope = scopedWorkspace(workspaceId);

  async function list() {
    const owner = assertWorkspaceScope(scope);
    return resultRows(await db.query(
      `${CONNECTION_SELECT} WHERE c.workspace_id = $1 ORDER BY c.updated_at DESC, c.source_connection_id`,
      [owner],
    )).map(connectionFromRow);
  }

  async function get(sourceConnectionId) {
    const normalizedId = String(sourceConnectionId || "").trim();
    if (!normalizedId) return null;
    const params = scope ? [normalizedId, scope] : [normalizedId];
    if (!scope && !trustedServerLookup) assertWorkspaceScope(scope);
    const where = scope
      ? "WHERE c.source_connection_id = $1 AND c.workspace_id = $2"
      : "WHERE c.source_connection_id = $1";
    const rows = resultRows(await db.query(`${CONNECTION_SELECT} ${where} LIMIT 1`, params));
    return rows[0] ? connectionFromRow(rows[0]) : null;
  }

  async function upsert(input) {
    const connection = normalizeSourceConnection(input);
    if (scope) assertWorkspaceScope(scope, connection.workspaceId);
    else if (!trustedServerLookup) assertWorkspaceScope(scope);
    const resourcesJson = JSON.stringify(connection.resourceScopes);
    const result = await db.query(`
WITH upsert_connection AS (
  INSERT INTO sf_source_connections (
    source_connection_id, workspace_id, provider, provider_account_ref, installation_ref,
    credential_ref, status, permission_scopes, capabilities, verified_at, last_event_at,
    last_error_code, schema_version, created_at, updated_at
  ) VALUES (
    $1, $2, $3, $4, $5,
    $6, $7, $8::text[], $9::text[], $10::timestamptz, $11::timestamptz,
    $12, $13, $14::timestamptz, $15::timestamptz
  )
  ON CONFLICT (source_connection_id) DO UPDATE SET
    provider_account_ref = EXCLUDED.provider_account_ref,
    installation_ref = EXCLUDED.installation_ref,
    credential_ref = EXCLUDED.credential_ref,
    status = EXCLUDED.status,
    permission_scopes = EXCLUDED.permission_scopes,
    capabilities = EXCLUDED.capabilities,
    verified_at = EXCLUDED.verified_at,
    last_event_at = CASE
      WHEN EXCLUDED.last_event_at IS NULL THEN sf_source_connections.last_event_at
      WHEN sf_source_connections.last_event_at IS NULL THEN EXCLUDED.last_event_at
      ELSE GREATEST(sf_source_connections.last_event_at, EXCLUDED.last_event_at)
    END,
    last_error_code = EXCLUDED.last_error_code,
    schema_version = EXCLUDED.schema_version,
    updated_at = EXCLUDED.updated_at
  WHERE sf_source_connections.workspace_id = EXCLUDED.workspace_id
    AND sf_source_connections.provider = EXCLUDED.provider
  RETURNING source_connection_id, workspace_id
), delete_resources AS (
  DELETE FROM sf_source_connection_resources r
  USING upsert_connection c
  WHERE r.source_connection_id = c.source_connection_id
    AND r.workspace_id = c.workspace_id
), insert_resources AS (
  INSERT INTO sf_source_connection_resources (
    workspace_id, source_connection_id, resource_ref, resource_type,
    project_id, display_name, event_families, enabled
  )
  SELECT
    c.workspace_id,
    c.source_connection_id,
    item->>'resourceRef',
    COALESCE(NULLIF(item->>'resourceType', ''), 'repository'),
    NULLIF(item->>'projectId', ''),
    NULLIF(item->>'displayName', ''),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(item->'eventFamilies', '[]'::jsonb))),
    COALESCE((item->>'enabled')::boolean, true)
  FROM upsert_connection c
  CROSS JOIN LATERAL jsonb_array_elements($16::jsonb) item
)
SELECT source_connection_id, workspace_id FROM upsert_connection`, [
      connection.sourceConnectionId,
      connection.workspaceId,
      connection.provider,
      connection.providerAccountRef,
      connection.installationRef,
      connection.credentialRef,
      connection.status,
      connection.permissionScopes,
      connection.capabilities,
      connection.verifiedAt,
      connection.lastEventAt,
      connection.lastErrorCode,
      connection.sourceConnectionSchemaVersion,
      connection.createdAt,
      connection.updatedAt,
      resourcesJson,
    ]);
    if (resultRows(result).length !== 1) {
      const error = new Error(`SourceConnection ${connection.sourceConnectionId} conflicts with an existing owner or provider.`);
      error.code = "source_connection_owner_conflict";
      throw error;
    }
    return get(connection.sourceConnectionId);
  }

  async function remove(sourceConnectionId) {
    const owner = assertWorkspaceScope(scope);
    const rows = resultRows(await db.query(
      "DELETE FROM sf_source_connections WHERE source_connection_id = $1 AND workspace_id = $2 RETURNING source_connection_id",
      [sourceConnectionId, owner],
    ));
    return rows.length === 1;
  }

  async function findByProviderInstallation(provider, installationRef) {
    if (!trustedServerLookup) {
      const error = new Error("Provider installation lookup is reserved for trusted server ingestion.");
      error.code = "source_connection_trusted_lookup_required";
      throw error;
    }
    const normalizedProvider = String(provider || "").trim().toLowerCase();
    const normalizedInstallation = String(installationRef || "").trim();
    if (!normalizedProvider || !normalizedInstallation) return [];
    return resultRows(await db.query(
      `${CONNECTION_SELECT}
       WHERE c.provider = $1 AND c.installation_ref = $2
       ORDER BY c.updated_at DESC, c.source_connection_id`,
      [normalizedProvider, normalizedInstallation],
    )).map(connectionFromRow);
  }

  return assertPort("sourceConnectionRepository", {
    list,
    get,
    upsert,
    remove,
    findByProviderInstallation,
  });
}

const SIGNAL_COLUMNS = `
  signal_id, workspace_id, project_id, source_type, source_connection_id,
  source_artifact_ids, asset_ids, external_provider, external_event_id,
  external_idempotency_key, occurred_at, observed_at, created_at, updated_at,
  headline, summary, signal_kind, importance_hints, privacy_classification,
  boundary_note, status, snoozed_until, status_changed_at, provenance, schema_version`;

function signalParams(signal) {
  return [
    signal.signalId,
    signal.workspaceId,
    signal.projectId,
    signal.sourceType,
    signal.sourceConnectionId,
    signal.sourceArtifactIds,
    signal.assetIds,
    signal.externalEventRef?.provider || null,
    signal.externalEventRef?.eventId || null,
    signal.externalEventRef?.idempotencyKey || null,
    signal.occurredAt,
    signal.observedAt,
    signal.createdAt,
    signal.updatedAt,
    signal.headline,
    signal.summary,
    signal.signalKind,
    signal.importanceHints,
    signal.privacyClassification,
    signal.boundaryNote,
    signal.status,
    signal.snoozedUntil,
    signal.statusChangedAt,
    JSON.stringify(signal.provenance),
    signal.signalSchemaVersion,
  ];
}

const SIGNAL_VALUES = `
  $1, $2, $3, $4, $5,
  $6::text[], $7::text[], $8, $9,
  $10, $11::timestamptz, $12::timestamptz, $13::timestamptz, $14::timestamptz,
  $15, $16, $17, $18::text[], $19,
  $20, $21, $22::timestamptz, $23::timestamptz, $24::jsonb, $25`;

export function createPostgresContentSignalRepository({ database, workspaceId = null } = {}) {
  const db = requireDatabase(database);
  const scope = scopedWorkspace(workspaceId);

  function assertSignalScope(signal) {
    if (scope) assertWorkspaceScope(scope, signal.workspaceId);
    return signal.workspaceId;
  }

  async function list() {
    const owner = assertWorkspaceScope(scope);
    return resultRows(await db.query(
      `SELECT ${SIGNAL_COLUMNS} FROM sf_content_signals WHERE workspace_id = $1 ORDER BY updated_at DESC, signal_id`,
      [owner],
    )).map(signalFromRow);
  }

  async function get(signalId) {
    const owner = assertWorkspaceScope(scope);
    const rows = resultRows(await db.query(
      `SELECT ${SIGNAL_COLUMNS} FROM sf_content_signals WHERE signal_id = $1 AND workspace_id = $2 LIMIT 1`,
      [signalId, owner],
    ));
    return rows[0] ? signalFromRow(rows[0]) : null;
  }

  async function upsert(input) {
    const signal = normalizeContentSignal(input);
    assertSignalScope(signal);
    if (!scope) assertWorkspaceScope(scope);
    const rows = resultRows(await db.query(`
INSERT INTO sf_content_signals (${SIGNAL_COLUMNS})
VALUES (${SIGNAL_VALUES})
ON CONFLICT (signal_id) DO UPDATE SET
  project_id = EXCLUDED.project_id,
  source_connection_id = EXCLUDED.source_connection_id,
  source_artifact_ids = EXCLUDED.source_artifact_ids,
  asset_ids = EXCLUDED.asset_ids,
  updated_at = EXCLUDED.updated_at,
  headline = EXCLUDED.headline,
  summary = EXCLUDED.summary,
  signal_kind = EXCLUDED.signal_kind,
  importance_hints = EXCLUDED.importance_hints,
  privacy_classification = EXCLUDED.privacy_classification,
  boundary_note = EXCLUDED.boundary_note,
  status = EXCLUDED.status,
  snoozed_until = EXCLUDED.snoozed_until,
  status_changed_at = EXCLUDED.status_changed_at,
  schema_version = EXCLUDED.schema_version
WHERE sf_content_signals.workspace_id = EXCLUDED.workspace_id
  AND sf_content_signals.source_type = EXCLUDED.source_type
RETURNING ${SIGNAL_COLUMNS}`, signalParams(signal)));
    if (rows.length !== 1) {
      const error = new Error(`ContentSignal ${signal.signalId} conflicts with an existing owner or source type.`);
      error.code = "content_signal_owner_conflict";
      throw error;
    }
    return signalFromRow(rows[0]);
  }

  async function remove(signalId) {
    const owner = assertWorkspaceScope(scope);
    const rows = resultRows(await db.query(
      "DELETE FROM sf_content_signals WHERE signal_id = $1 AND workspace_id = $2 RETURNING signal_id",
      [signalId, owner],
    ));
    return rows.length === 1;
  }

  async function findByExternalEvent({ workspaceId: queryWorkspaceId, provider, eventId } = {}) {
    const owner = assertWorkspaceScope(scope, queryWorkspaceId);
    const normalizedProvider = String(provider || "").trim().toLowerCase();
    const normalizedEventId = String(eventId || "").trim();
    if (!normalizedProvider || !normalizedEventId) return null;
    const rows = resultRows(await db.query(
      `SELECT ${SIGNAL_COLUMNS}
       FROM sf_content_signals
       WHERE workspace_id = $1 AND external_provider = $2 AND external_event_id = $3
       LIMIT 1`,
      [owner, normalizedProvider, normalizedEventId],
    ));
    return rows[0] ? signalFromRow(rows[0]) : null;
  }

  async function insertExternalIfAbsent(input) {
    const signal = normalizeContentSignal(input);
    const owner = assertSignalScope(signal);
    if (!signal.externalEventRef) {
      throw new TypeError("insertExternalIfAbsent requires a connected ContentSignal externalEventRef.");
    }
    const rows = resultRows(await db.query(`
INSERT INTO sf_content_signals (${SIGNAL_COLUMNS})
VALUES (${SIGNAL_VALUES})
ON CONFLICT (workspace_id, external_provider, external_event_id) DO NOTHING
RETURNING ${SIGNAL_COLUMNS}`, signalParams(signal)));
    if (rows[0]) return { signal: signalFromRow(rows[0]), created: true };

    const existingRows = resultRows(await db.query(
      `SELECT ${SIGNAL_COLUMNS}
       FROM sf_content_signals
       WHERE workspace_id = $1 AND external_provider = $2 AND external_event_id = $3
       LIMIT 1`,
      [owner, signal.externalEventRef.provider, signal.externalEventRef.eventId],
    ));
    if (!existingRows[0]) {
      const error = new Error("External ContentSignal insert conflicted without a readable canonical event record.");
      error.code = "external_signal_idempotency_conflict";
      throw error;
    }
    return { signal: signalFromRow(existingRows[0]), created: false };
  }

  return assertPort("contentSignalRepository", {
    list,
    get,
    upsert,
    remove,
    findByExternalEvent,
    insertExternalIfAbsent,
  });
}

export const __testables = Object.freeze({ connectionFromRow, signalFromRow });
