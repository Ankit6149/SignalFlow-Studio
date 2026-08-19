BEGIN;

CREATE TABLE IF NOT EXISTS sf_project_context_snapshots (
  project_context_snapshot_id text PRIMARY KEY,
  workspace_id text NOT NULL,
  project_id text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  supersedes_id text,
  fingerprint text NOT NULL,
  repository_ref jsonb,
  source_artifact_ids text[] NOT NULL DEFAULT '{}',
  supplemental_source_artifact_ids text[] NOT NULL DEFAULT '{}',
  asset_ids text[] NOT NULL DEFAULT '{}',
  privacy_class text NOT NULL CHECK (privacy_class IN ('public', 'workspace_private', 'device_private', 'restricted')),
  synthesis jsonb NOT NULL,
  synthesis_provenance jsonb NOT NULL,
  schema_version integer NOT NULL,
  created_at timestamptz NOT NULL,
  CONSTRAINT sf_project_context_snapshots_fingerprint_shape
    CHECK (fingerprint ~ '^sf-project-context-v1-[a-f0-9]{16}$'),
  CONSTRAINT sf_project_context_snapshots_not_self_superseding
    CHECK (supersedes_id IS NULL OR supersedes_id <> project_context_snapshot_id),
  CONSTRAINT sf_project_context_snapshots_owner_identity
    UNIQUE (workspace_id, project_id, project_context_snapshot_id),
  CONSTRAINT sf_project_context_snapshots_project_version_unique
    UNIQUE (workspace_id, project_id, version),
  CONSTRAINT sf_project_context_snapshots_project_fingerprint_unique
    UNIQUE (workspace_id, project_id, fingerprint),
  CONSTRAINT sf_project_context_snapshots_supersedes_fk
    FOREIGN KEY (workspace_id, project_id, supersedes_id)
    REFERENCES sf_project_context_snapshots (workspace_id, project_id, project_context_snapshot_id)
);

CREATE INDEX IF NOT EXISTS sf_project_context_snapshots_latest_idx
  ON sf_project_context_snapshots (workspace_id, project_id, version DESC);

CREATE INDEX IF NOT EXISTS sf_project_context_snapshots_created_idx
  ON sf_project_context_snapshots (workspace_id, created_at DESC);

COMMIT;
