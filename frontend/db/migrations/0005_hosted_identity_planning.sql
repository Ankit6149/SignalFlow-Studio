BEGIN;

CREATE TABLE IF NOT EXISTS sf_identity_records (
  record_id text PRIMARY KEY,
  workspace_id text NOT NULL,
  user_id text NOT NULL,
  record_kind text NOT NULL CHECK (record_kind IN (
    'IdentityProfile',
    'PerceptionProfile',
    'VoiceProfile',
    'BoundaryProfile',
    'PlatformExpressionProfile',
    'ProjectGuidanceProfile',
    'IdentityContextSnapshot'
  )),
  scope_key text NOT NULL,
  record_version integer NOT NULL DEFAULT 0 CHECK (record_version >= 0),
  record jsonb NOT NULL,
  schema_version integer NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT sf_identity_records_record_object CHECK (jsonb_typeof(record) = 'object'),
  CONSTRAINT sf_identity_records_workspace_identity UNIQUE (workspace_id, user_id, record_id),
  CONSTRAINT sf_identity_records_scope_version UNIQUE (
    workspace_id,
    user_id,
    record_kind,
    scope_key,
    record_version
  )
);

CREATE INDEX IF NOT EXISTS sf_identity_records_active_lookup_idx
  ON sf_identity_records (workspace_id, user_id, record_kind, scope_key, record_version DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS sf_identity_records_workspace_created_idx
  ON sf_identity_records (workspace_id, user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS sf_content_planning_records (
  record_id text PRIMARY KEY,
  workspace_id text NOT NULL,
  record_kind text NOT NULL CHECK (record_kind IN (
    'NarrativeStrategy',
    'ContentPiece',
    'PlatformVariant',
    'PlatformVariantRevision'
  )),
  opportunity_id text,
  narrative_strategy_id text,
  content_piece_id text,
  destination text,
  status text NOT NULL,
  record jsonb NOT NULL,
  schema_version integer NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT sf_content_planning_records_record_object CHECK (jsonb_typeof(record) = 'object'),
  CONSTRAINT sf_content_planning_records_workspace_identity UNIQUE (workspace_id, record_id),
  CONSTRAINT sf_content_planning_records_opportunity_fk
    FOREIGN KEY (workspace_id, opportunity_id)
    REFERENCES sf_content_opportunities (workspace_id, opportunity_id)
    ON DELETE RESTRICT,
  CONSTRAINT sf_content_planning_records_strategy_fk
    FOREIGN KEY (workspace_id, narrative_strategy_id)
    REFERENCES sf_content_planning_records (workspace_id, record_id)
    ON DELETE RESTRICT,
  CONSTRAINT sf_content_planning_records_piece_fk
    FOREIGN KEY (workspace_id, content_piece_id)
    REFERENCES sf_content_planning_records (workspace_id, record_id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS sf_content_planning_records_opportunity_idx
  ON sf_content_planning_records (workspace_id, opportunity_id, record_kind, updated_at DESC)
  WHERE opportunity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS sf_content_planning_records_strategy_idx
  ON sf_content_planning_records (workspace_id, narrative_strategy_id, record_kind, updated_at DESC)
  WHERE narrative_strategy_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS sf_content_planning_records_piece_idx
  ON sf_content_planning_records (workspace_id, content_piece_id, record_kind, updated_at DESC)
  WHERE content_piece_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS sf_content_planning_records_status_idx
  ON sf_content_planning_records (workspace_id, record_kind, status, updated_at DESC);

COMMIT;
