BEGIN;

CREATE TABLE IF NOT EXISTS sf_media_records (
  record_id text PRIMARY KEY,
  workspace_id text NOT NULL,
  record_kind text NOT NULL,
  scope_type text,
  scope_id text,
  content_piece_id text,
  asset_id text,
  destination text,
  status text NOT NULL,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version > 0),
  record jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS sf_media_records_workspace_scope_idx
  ON sf_media_records (workspace_id, scope_type, scope_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS sf_media_records_content_piece_idx
  ON sf_media_records (workspace_id, content_piece_id, record_kind, updated_at DESC);
CREATE INDEX IF NOT EXISTS sf_media_records_asset_idx
  ON sf_media_records (workspace_id, asset_id, record_kind, updated_at DESC);

CREATE TABLE IF NOT EXISTS sf_durable_jobs (
  job_id text PRIMARY KEY,
  workspace_id text NOT NULL,
  job_type text NOT NULL,
  resource_type text NOT NULL,
  resource_id text NOT NULL,
  input_version integer NOT NULL DEFAULT 1 CHECK (input_version > 0),
  idempotency_key text NOT NULL,
  priority integer NOT NULL DEFAULT 50 CHECK (priority >= 0 AND priority <= 100),
  status text NOT NULL,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  scheduled_at timestamptz,
  next_attempt_at timestamptz,
  lease_owner text,
  lease_expires_at timestamptz,
  heartbeat_at timestamptz,
  cancellation_requested_at timestamptz,
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version > 0),
  record jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  completed_at timestamptz,
  UNIQUE (workspace_id, job_type, idempotency_key)
);

CREATE INDEX IF NOT EXISTS sf_durable_jobs_runnable_idx
  ON sf_durable_jobs (status, next_attempt_at, scheduled_at, priority DESC, created_at)
  WHERE status IN ('queued', 'scheduled', 'retrying');
CREATE INDEX IF NOT EXISTS sf_durable_jobs_workspace_resource_idx
  ON sf_durable_jobs (workspace_id, resource_type, resource_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS sf_durable_jobs_lease_idx
  ON sf_durable_jobs (lease_expires_at)
  WHERE status IN ('running', 'cancel_requested');

CREATE TABLE IF NOT EXISTS sf_capture_recipes (
  capture_recipe_id text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  workspace_id text NOT NULL,
  project_id text NOT NULL,
  target_origin text NOT NULL,
  allowed_environment text NOT NULL,
  status text NOT NULL,
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version > 0),
  record jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (capture_recipe_id, version)
);

CREATE INDEX IF NOT EXISTS sf_capture_recipes_workspace_project_idx
  ON sf_capture_recipes (workspace_id, project_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS sf_capture_recipes_active_idx
  ON sf_capture_recipes (workspace_id, capture_recipe_id, version DESC)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS sf_capture_jobs (
  capture_job_id text PRIMARY KEY,
  workspace_id text NOT NULL,
  project_id text,
  capture_recipe_id text NOT NULL,
  capture_recipe_version integer NOT NULL CHECK (capture_recipe_version > 0),
  durable_job_id text NOT NULL,
  capture_kind text NOT NULL,
  status text NOT NULL,
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version > 0),
  record jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  completed_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS sf_capture_jobs_durable_job_idx
  ON sf_capture_jobs (durable_job_id);
CREATE INDEX IF NOT EXISTS sf_capture_jobs_recipe_idx
  ON sf_capture_jobs (workspace_id, capture_recipe_id, capture_recipe_version, created_at DESC);

COMMIT;
