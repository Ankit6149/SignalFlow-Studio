# Campaign schema v1 migration and rollback

This runbook covers the browser-local migration from legacy saved campaign objects to the canonical `Campaign` domain record introduced for issues #68 and #19.

## Scope

The migration applies to entries stored under the current browser library key. It does not create a cloud database, synchronize devices, upload assets, or change connector tokens.

## Canonical target

A migrated record has:

- `schemaVersion: 1`;
- `kind: "Campaign"`;
- a stable `campaignId`;
- one authoritative `ChannelDraft.current` revision per selected channel;
- optional `ChannelDraft.history` for different original generated copy;
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
7. Duplicate generated payload fields are removed.
8. The canonical record is written back to browser storage.

The operation is idempotent: reading schema v1 again validates it without creating another revision.

## Reopen and re-save behavior

Opening a canonical campaign projects the current drafts into editor state. Saving it again:

- preserves the same `campaignId` and original `createdAt`;
- updates `updatedAt` for the save;
- preserves existing generated-history revisions;
- does not duplicate an identical generated revision;
- keeps current edited drafts authoritative;
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
- save → reopen → re-save history preservation;
- deterministic Markdown/JSON;
- ZIP contents derived from the same projections;
- new-campaign identity reset;
- local/memory and injected store-backed repository contract parity;
- production build and dependency audit.
