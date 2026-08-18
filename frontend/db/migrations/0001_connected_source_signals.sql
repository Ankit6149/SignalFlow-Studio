BEGIN;

CREATE TABLE IF NOT EXISTS sf_source_connections (
  source_connection_id text PRIMARY KEY,
  workspace_id text NOT NULL,
  provider text NOT NULL,
  provider_account_ref text,
  installation_ref text,
  credential_ref text,
  status text NOT NULL CHECK (status IN ('pending', 'active', 'paused', 'error', 'revoked')),
  permission_scopes text[] NOT NULL DEFAULT '{}',
  capabilities text[] NOT NULL DEFAULT '{}',
  verified_at timestamptz,
  last_event_at timestamptz,
  last_error_code text,
  schema_version integer NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT sf_source_connections_workspace_identity UNIQUE (workspace_id, source_connection_id),
  CONSTRAINT sf_source_connections_active_verified CHECK (status <> 'active' OR verified_at IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS sf_source_connection_resources (
  workspace_id text NOT NULL,
  source_connection_id text NOT NULL,
  resource_ref text NOT NULL,
  resource_type text NOT NULL,
  project_id text,
  display_name text,
  event_families text[] NOT NULL DEFAULT '{}',
  enabled boolean NOT NULL DEFAULT true,
  PRIMARY KEY (source_connection_id, resource_ref),
  CONSTRAINT sf_source_connection_resources_owner_fk
    FOREIGN KEY (workspace_id, source_connection_id)
    REFERENCES sf_source_connections (workspace_id, source_connection_id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sf_content_signals (
  signal_id text PRIMARY KEY,
  workspace_id text NOT NULL,
  project_id text,
  source_type text NOT NULL,
  source_connection_id text,
  source_artifact_ids text[] NOT NULL DEFAULT '{}',
  asset_ids text[] NOT NULL DEFAULT '{}',
  external_provider text,
  external_event_id text,
  external_idempotency_key text,
  occurred_at timestamptz,
  observed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  headline text NOT NULL,
  summary text NOT NULL,
  signal_kind text NOT NULL,
  importance_hints text[] NOT NULL DEFAULT '{}',
  privacy_classification text NOT NULL,
  boundary_note text,
  status text NOT NULL,
  snoozed_until timestamptz,
  status_changed_at timestamptz NOT NULL,
  provenance jsonb NOT NULL,
  schema_version integer NOT NULL,
  CONSTRAINT sf_content_signals_external_event_shape CHECK (
    (external_provider IS NULL AND external_event_id IS NULL AND external_idempotency_key IS NULL)
    OR (external_provider IS NOT NULL AND external_event_id IS NOT NULL)
  ),
  CONSTRAINT sf_content_signals_external_connection_shape CHECK (
    external_provider IS NULL OR source_connection_id IS NOT NULL
  ),
  CONSTRAINT sf_content_signals_snooze_shape CHECK (
    (status = 'snoozed' AND snoozed_until IS NOT NULL)
    OR (status <> 'snoozed' AND snoozed_until IS NULL)
  ),
  CONSTRAINT sf_content_signals_external_event_unique UNIQUE (workspace_id, external_provider, external_event_id),
  CONSTRAINT sf_content_signals_source_connection_fk
    FOREIGN KEY (workspace_id, source_connection_id)
    REFERENCES sf_source_connections (workspace_id, source_connection_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS sf_content_signals_external_idempotency_unique
  ON sf_content_signals (workspace_id, external_idempotency_key)
  WHERE external_idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS sf_source_connections_provider_installation_idx
  ON sf_source_connections (provider, installation_ref)
  WHERE installation_ref IS NOT NULL;

CREATE INDEX IF NOT EXISTS sf_source_connection_resources_lookup_idx
  ON sf_source_connection_resources (source_connection_id, resource_ref)
  WHERE enabled = true;

CREATE INDEX IF NOT EXISTS sf_content_signals_workspace_status_observed_idx
  ON sf_content_signals (workspace_id, status, observed_at DESC);

CREATE INDEX IF NOT EXISTS sf_content_signals_workspace_project_status_idx
  ON sf_content_signals (workspace_id, project_id, status, observed_at DESC)
  WHERE project_id IS NOT NULL;

COMMIT;
