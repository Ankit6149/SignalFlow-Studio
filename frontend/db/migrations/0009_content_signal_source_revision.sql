ALTER TABLE sf_content_signals
  ADD COLUMN IF NOT EXISTS source_revision text;

COMMENT ON COLUMN sf_content_signals.source_revision IS
  'Immutable source revision captured from a connected source event when available; GitHub merged pull requests use the exact merge commit SHA.';
