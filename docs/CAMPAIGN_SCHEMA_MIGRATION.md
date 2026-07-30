# Campaign schema v1 and editor-state v2 migration and rollback

This runbook covers the browser-local migration from legacy saved campaign objects to the canonical `Campaign` domain record introduced for issues #68 and #19.

## Scope

The migration applies to entries stored under the current browser library key. It does not create a cloud database, synchronize devices, upload assets, or change connector tokens.

## Canonical target

A migrated record has:

- `schemaVersion: 1`;
- `kind: "Campaign"`;
- a stable `campaignId`;
- one authoritative `ChannelDraft.current` revision per selected channel;
- one generated baseline, one authoritative current revision, and optional `ChannelDraft.history`;
- edited, approval, quality, and per-channel generation-run state;
- bounded regeneration archives;
- editor revision, saved/exported revisions, save/export timestamps, and saved-source fingerprint;
- portable source snapshot and generation run metadata;
- provider/model, warnings, and quality states;
- no temporary API key, browser `File`, framework request/response, database client, prompt bundle, generated Markdown/JSON duplicate, or duplicate active package posts.

## Read-time migration

`migrateLegacyCampaign` translates a legacy entry when the browser campaign repository lists or opens it.

1. Legacy `posts[channel]` becomes the authoritative current draft.
2. A different legacy `result.posts[channel]` becomes one generated-history revision.
3. Existing stable IDs and timestamps are retained when present.
4. Missing IDs are deterministically derived from generation/source identity.
5. `releaseNotes`, `release-notes`, and `release_notes` normalize to `release_notes`.
6. `hn`, `hacker-news`, and `hacker_news` normalize to `hackernews`.
7. Missing generated baselines are reconstructed from generated history or the authoritative current draft.
8. Missing editor version state defaults to a saved revision using the record timestamp and generation fingerprint.
9. Missing archives default to an empty list; existing archives and draft history are preserved and deduplicated.
10. Duplicate generated payload fields are removed.
11. The canonical record is written back to browser storage.

The operation is idempotent: reading schema v1 again validates it without creating another revision.

## Reopen and re-save behavior

Opening a canonical campaign projects the current drafts into editor state. Saving it again:

- preserves the same `campaignId` and original `createdAt`;
- updates `updatedAt` for the save;
- preserves generated baselines, approvals, channel state, archives, and existing history;
- does not duplicate an identical generated or edited revision;
- keeps current edited drafts authoritative;
- updates only the stable current ID; Save as copy allocates a new ID and preserves the original;
- excludes temporary provider credentials again.

Starting a new campaign clears the previous campaign ID, generation run, result, drafts, source inputs, and publish options before another save.

## Failure behavior

If a record cannot be parsed or migrated safely:

- it is not silently replaced with an empty campaign;
- the Studio reports that the local campaign cannot be opened;
- the user should retain or export the raw browser storage before manual recovery;
- other valid library records remain readable.

## Rollback

The migration does not have a destructive server-side rollback because storage is browser-local.

Before a release that changes schema:

1. export representative legacy and schema-v1 fixtures;
2. keep the prior compatible reader available in version control;
3. verify the new reader against copied storage data, never the only production copy;
4. retain deterministic Markdown/JSON exports as a portable recovery path.

If rollback is required after deployment:

1. restore the previous application commit;
2. do not delete schema-v1 browser records;
3. add a compatibility reader to the restored version or instruct users to use exported Markdown/JSON until a forward fix ships;
4. never coerce schema-v1 records into the older duplicate-draft shape.

## Verification evidence

The required automated evidence includes:

- legacy browser repository migration;
- canonical round-trip serialization;
- current-versus-history separation;
- temporary-secret exclusion;
- save → reopen → re-save generated baseline, approval, archive, and editor-state preservation;
- duplicate-title create/update/copy/read/delete behavior;
- browser quota failure propagation and export-recovery messaging;
- deterministic Markdown/JSON;
- ZIP contents derived from the same projections;
- new-campaign identity reset;
- local/memory and injected store-backed repository contract parity;
- production build and dependency audit.

Release evidence must identify the exact branch head that passed these checks. Evidence from an earlier head does not authorize merging a later migration or serialization change.


## Additive editor-state compatibility

The outer domain record remains schema version `1`. ChannelDraft and Campaign gained additive fields that older schema-v1 fixtures may omit. The canonical reader reconstructs safe defaults and rewrites the complete record on the next repository read/save.

The in-memory editor reducer uses schema version `2`; it is not serialized as an independent domain record. A future incompatible domain change must increment `DOMAIN_SCHEMA_VERSION` rather than overloading this additive migration.
