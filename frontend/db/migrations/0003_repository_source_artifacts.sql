BEGIN;

CREATE TABLE IF NOT EXISTS sf_source_artifacts (
  source_artifact_id text PRIMARY KEY,
  workspace_id text NOT NULL,
  source_kind text NOT NULL,
  content_hash text,
  source_reference jsonb NOT NULL,
  record jsonb NOT NULL,
  schema_version integer NOT NULL,
  created_at timestamptz NOT NULL,
  CONSTRAINT sf_source_artifacts_workspace_identity UNIQUE (workspace_id, source_artifact_id),
  CONSTRAINT sf_source_artifacts_record_object CHECK (jsonb_typeof(record) = 'object'),
  CONSTRAINT sf_source_artifacts_reference_object CHECK (jsonb_typeof(source_reference) = 'object')
);

CREATE INDEX IF NOT EXISTS sf_source_artifacts_workspace_created_idx
  ON sf_source_artifacts (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS sf_source_artifacts_workspace_kind_idx
  ON sf_source_artifacts (workspace_id, source_kind, created_at DESC);

COMMIT;
