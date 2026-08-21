BEGIN;

CREATE TABLE IF NOT EXISTS sf_content_opportunities (
  opportunity_id text PRIMARY KEY,
  workspace_id text NOT NULL,
  project_id text,
  project_context_snapshot_id text,
  signal_ids text[] NOT NULL DEFAULT '{}',
  input_fingerprint text NOT NULL,
  status text NOT NULL,
  recommendation text NOT NULL,
  score integer NOT NULL CHECK (score >= 0 AND score <= 100),
  record jsonb NOT NULL,
  schema_version integer NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT sf_content_opportunities_record_object CHECK (jsonb_typeof(record) = 'object'),
  CONSTRAINT sf_content_opportunities_workspace_identity UNIQUE (workspace_id, opportunity_id),
  CONSTRAINT sf_content_opportunities_workspace_fingerprint UNIQUE (workspace_id, input_fingerprint)
);

CREATE TABLE IF NOT EXISTS sf_signal_opportunity_jobs (
  job_id text PRIMARY KEY,
  workspace_id text NOT NULL,
  signal_id text NOT NULL,
  job_type text NOT NULL CHECK (job_type = 'opportunity_evaluation'),
  status text NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'dead')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  available_at timestamptz NOT NULL,
  lease_until timestamptz,
  opportunity_id text,
  last_error_code text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  completed_at timestamptz,
  CONSTRAINT sf_signal_opportunity_jobs_signal_unique UNIQUE (workspace_id, signal_id, job_type),
  CONSTRAINT sf_signal_opportunity_jobs_signal_fk
    FOREIGN KEY (signal_id)
    REFERENCES sf_content_signals (signal_id)
    ON DELETE CASCADE,
  CONSTRAINT sf_signal_opportunity_jobs_opportunity_fk
    FOREIGN KEY (opportunity_id)
    REFERENCES sf_content_opportunities (opportunity_id),
  CONSTRAINT sf_signal_opportunity_jobs_lease_shape CHECK (
    (status = 'processing' AND lease_until IS NOT NULL)
    OR (status <> 'processing' AND lease_until IS NULL)
  ),
  CONSTRAINT sf_signal_opportunity_jobs_completion_shape CHECK (
    (status = 'completed' AND opportunity_id IS NOT NULL AND completed_at IS NOT NULL)
    OR (status <> 'completed' AND completed_at IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS sf_content_opportunities_workspace_status_score_idx
  ON sf_content_opportunities (workspace_id, status, score DESC, updated_at DESC);

CREATE INDEX IF NOT EXISTS sf_content_opportunities_workspace_project_idx
  ON sf_content_opportunities (workspace_id, project_id, updated_at DESC)
  WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS sf_signal_opportunity_jobs_due_idx
  ON sf_signal_opportunity_jobs (status, available_at, created_at)
  WHERE status IN ('pending', 'processing');

COMMIT;
