BEGIN;

CREATE TABLE IF NOT EXISTS sf_secret_records (
  secret_record_id text PRIMARY KEY,
  workspace_id text NOT NULL,
  secret_kind text NOT NULL CHECK (secret_kind IN ('github_app_credentials')),
  envelope jsonb NOT NULL,
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version > 0),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT sf_secret_records_envelope_object CHECK (jsonb_typeof(envelope) = 'object'),
  CONSTRAINT sf_secret_records_workspace_identity UNIQUE (workspace_id, secret_record_id)
);

CREATE INDEX IF NOT EXISTS sf_secret_records_workspace_kind_idx
  ON sf_secret_records (workspace_id, secret_kind, updated_at DESC);

COMMIT;
