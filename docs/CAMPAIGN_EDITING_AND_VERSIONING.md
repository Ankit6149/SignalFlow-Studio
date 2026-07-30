# Campaign editing, regeneration, and version state

This document is the product and engineering source of truth for issues #18, #20, and #21.

## Product guarantees

SignalFlow never replaces a manually edited draft silently.

When an existing campaign is regenerated, the user deliberately chooses one of these policies:

1. **Regenerate only unedited destinations** — edited drafts remain byte-for-byte unchanged.
2. **Archive edits and regenerate everything** — the complete current campaign is stored in Version history before replacement.
3. **Cancel** — no request is sent and campaign state is unchanged.

A user can also regenerate only the active destination. Other destinations are not mutated.

Generation failures are fail-safe. A rejected, malformed, or all-failed response does not commit any campaign mutation. Partial success updates only successful requested destinations and preserves existing drafts for failures.

## Channel draft state

Each channel stores:

- one generated baseline revision;
- one authoritative current revision;
- optional prior revisions;
- quality state (`generated`, `regenerated`, `needs_review`, or `failed`);
- whether current text differs from the generated baseline;
- explicit approval state;
- the generation run that owns the current generated baseline.

Editing always clears approval. Approval applies to the current revision, not merely to the channel name. Restoring generated copy changes only the selected channel.

Persistent channel labels are derived in this order:

1. source changed;
2. generation failed or no draft;
3. approved;
4. edited;
5. needs review;
6. regenerated/generated.

## Campaign state

The editor reducer owns these version fields:

- `revision` — increments for every content, approval, archive, restore, or regeneration mutation;
- `savedRevision` — revision last persisted to the current campaign ID;
- `exportedRevision` — revision last exported;
- `lastSavedAt` and `lastExportedAt`;
- `savedSourceFingerprint` — source snapshot represented by the saved record.

The UI derives persistent campaign status:

- **Source changed** when source inputs no longer match the generation snapshot;
- **Unsaved changes** when editor/source state differs from the saved record or the campaign has never been saved;
- **Saved** when the current stable campaign ID and revision match browser storage;
- **Generated** before the first save.

Copy, export, and publish availability use these selectors rather than duplicated button conditions. Blocked actions expose a visible and accessible reason.

## Stable identity and persistence

Campaign titles are display text, not identity.

- **Create** allocates a new opaque `campaignId` through the injected ID service.
- **Save changes** updates only the current ID.
- **Save as copy** allocates a new ID while retaining the original record.
- **Read/list/delete** operate only by ID.
- Multiple campaigns may use the same title without overwriting one another.

Temporary provider keys are request-scoped and never enter the domain aggregate or browser storage.

## Archived versions

A regeneration archive contains a portable snapshot of:

- current drafts and generated baselines;
- channel statuses and approvals;
- generation result metadata and generation run;
- active channel and editor revision;
- archive ID, reason, and timestamp.

Archives are limited to the latest 20 entries. A restored archive first archives the current state, making restore reversible. A user may explicitly discard an archive.

## Accessibility and responsive behavior

- The campaign status strip uses `role="status"` and `aria-live="polite"`.
- The regeneration policy surface is a modal dialog with an accessible title/description and Escape-to-cancel behavior.
- Channel tabs expose status in their accessible name.
- Blocked action reasons remain visible rather than toast-only.
- Controls remain usable at narrow widths and respect reduced-motion preference.

## Migration

Existing schema-v1 Campaign records are re-normalized on read:

- current text remains authoritative;
- old generated history becomes the generated baseline;
- missing editor version state defaults to a saved revision;
- existing campaign IDs and timestamps remain stable;
- missing archives become an empty list;
- existing draft history is preserved and deduplicated;
- temporary credentials remain excluded.

The outer domain schema remains version `1`; the reducer/editor state is version `2`. Additive fields remain backward-compatible with the schema-v1 parser. A future incompatible domain change must increment `DOMAIN_SCHEMA_VERSION` and provide a dedicated migration.

## Rollback

Before release, retain representative legacy and canonical browser records plus deterministic exports.

If rollback is required:

1. restore the prior application commit;
2. do not delete newer browser records;
3. keep the forward-compatible reader or provide an emergency reader for additive draft/editor fields;
4. advise export recovery rather than coercing records back into title-based or duplicate-draft storage.

## Required evidence

Completion requires:

- reducer tests for all regeneration policies, per-channel regeneration, cancel, failure, restore-generated, and restore-archive;
- selector tests for stale, edited, approved, failed, needs-review, saved, unsaved, and exported states;
- duplicate-title CRUD and save-as-copy tests;
- legacy migration and secret-exclusion tests;
- browser quota failure/recovery messaging;
- UI integration checks for persistent statuses, dialog accessibility, action reasons, version history, and responsive styles;
- frontend tests, production dependency audit, production build, MCP tests, and Python compatibility tests on the exact merge head.
