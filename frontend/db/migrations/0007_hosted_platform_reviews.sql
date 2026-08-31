BEGIN;

CREATE TABLE IF NOT EXISTS sf_content_review_records (
  record_id text PRIMARY KEY,
  workspace_id text NOT NULL,
  record_kind text NOT NULL CHECK (record_kind IN (
    'PlatformVariantReview',
    'PlatformVariantApproval'
  )),
  platform_variant_id text NOT NULL,
  platform_variant_revision_id text NOT NULL,
  platform_variant_review_id text,
  destination text NOT NULL CHECK (destination IN ('linkedin', 'x')),
  status text NOT NULL,
  record jsonb NOT NULL,
  schema_version integer NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT sf_content_review_records_record_object CHECK (jsonb_typeof(record) = 'object'),
  CONSTRAINT sf_content_review_records_workspace_identity UNIQUE (workspace_id, record_id),
  CONSTRAINT sf_content_review_records_variant_fk
    FOREIGN KEY (workspace_id, platform_variant_id)
    REFERENCES sf_content_planning_records (workspace_id, record_id)
    ON DELETE RESTRICT,
  CONSTRAINT sf_content_review_records_revision_fk
    FOREIGN KEY (workspace_id, platform_variant_revision_id)
    REFERENCES sf_content_planning_records (workspace_id, record_id)
    ON DELETE RESTRICT,
  CONSTRAINT sf_content_review_records_review_fk
    FOREIGN KEY (workspace_id, platform_variant_review_id)
    REFERENCES sf_content_review_records (workspace_id, record_id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS sf_content_review_records_revision_idx
  ON sf_content_review_records (workspace_id, platform_variant_revision_id, record_kind, updated_at DESC);

CREATE INDEX IF NOT EXISTS sf_content_review_records_variant_idx
  ON sf_content_review_records (workspace_id, platform_variant_id, record_kind, updated_at DESC);

CREATE INDEX IF NOT EXISTS sf_content_review_records_status_idx
  ON sf_content_review_records (workspace_id, destination, status, updated_at DESC);

COMMIT;
