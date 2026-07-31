# Portable transfer, import, and recovery

SignalFlow Studio supports an explicit, user-initiated transfer contract for moving campaign data between browser-local, self-hosted, and compatible hosted adapters. The current web product imports and exports through the browser library. The same application ports are tested with injected store-backed adapters so a future hosted implementation can use the same archive rather than creating a second data model.

This feature is **not synchronization**. SignalFlow does not automatically upload a browser library, continuously mirror unrelated deployments, or claim that a hosted database and object-storage service already exist.

## Product guarantees

A portable transfer must remain:

- explicit and user initiated;
- previewed before import changes the destination;
- versioned and integrity protected;
- free of temporary credentials and private deployment references;
- deterministic for the same canonical records and timestamps;
- reversible through an auditable journal where supported;
- honest about missing assets, unsupported fields, warnings, and partial failure;
- compatible with local and injected store-backed application adapters;
- historical: imported generation, approval, and export events are not presented as newly created activity.

## Archive format

The browser downloads a UTF-8 JSON document using the suffix:

```text
.signalflow.json
```

The root record has:

- `kind: "SignalFlowPortableArchive"`;
- `schemaVersion: 1`;
- stable `archiveId` and `createdAt`;
- sanitized source-deployment metadata;
- a manifest with campaign, asset, source-artifact, approval, export, blob, byte, and exclusion counts;
- canonical campaign and metadata records;
- optional encoded blob payloads;
- SHA-256 integrity metadata;
- optional HMAC-SHA-256 signature metadata when a compatible signer/verifier is configured.

The archive intentionally remains a single JSON contract for the current browser profile. Large hosted deployments may transport the same manifest and records through multipart/object-storage adapters later, but they must preserve the same validation, provenance, and rollback rules.

## Included records

The contract can carry:

- canonical Campaign records;
- authoritative current channel drafts and generated baselines;
- draft revision history and regeneration archives;
- generation run and source snapshot metadata;
- persistent edited, approval, saved, and exported revision state;
- Asset metadata and optional blob payloads;
- SourceArtifact records;
- explicit and derived historical Approval records;
- Export records;
- transfer provenance and import reports.

Browser/runtime objects are never embedded in canonical records. Binary data is encoded only inside the archive blob section and restored through the `blobStorage` port.

## Exclusions and privacy

Archive creation recursively removes private or unsupported fields and records every removal in `manifest.exclusions`.

Excluded categories include:

- API keys and provider credentials;
- OAuth access/refresh tokens, cookies, session secrets, authorization data, private keys, and passwords;
- signed URLs and temporary/private references;
- private provider endpoints and local base URLs;
- Windows, macOS, Linux, mounted-volume, and `file://` filesystem paths;
- browser/framework/runtime objects;
- unsupported non-portable values.

The exclusion report contains field paths and safe reasons, not the excluded values. Tests separately verify that secret values, private addresses, local paths, signed references, and raw runtime data do not enter the archive, storage, diagnostics, or UI.

## Integrity and optional signatures

The archive digest is calculated over the canonical archive without `integrity` and `signature` fields:

```text
SHA-256(stable canonical JSON)
```

Import recomputes the digest before any destination write. A mismatch blocks import.

A deployment may configure an `archiveSigner` port using HMAC-SHA-256 or a future compatible signer. A signed archive can be imported without a verifier only when signatures are optional; the preview then shows a warning. A destination that requires signatures fails closed when a signature is absent, invalid, or unverifiable.

Signing secrets are never stored inside the archive.

## Validation gates

`validatePortableArchive` runs before conflict resolution or destination mutation. It validates:

- root object and archive kind;
- supported/future schema version;
- configured serialized-byte limit;
- traversal-safe `blobs/...` paths;
- blob Base64 encoding and declared byte lengths;
- SHA-256 integrity;
- optional/required signature state;
- missing asset payloads.

Current browser imports are limited to 50 MiB. Larger hosted transport may use a different bounded adapter, but it must not bypass the archive manifest, integrity, path, schema, and payload checks.

A future schema blocks with upgrade guidance. A legacy schema may proceed only through an explicit compatibility migration and warning.

## Preview and destination selection

The Library page validates a selected archive before enabling import. The preview shows:

- destination workspace/profile;
- archive schema and integrity state;
- campaign, asset, source-artifact, approval, export, and blob counts;
- estimated asset bytes;
- exclusions made during export;
- missing/metadata-only asset warnings;
- schema, signature, and validation errors;
- existing-record conflicts;
- the selected conflict policy.

The current browser product exposes one destination: **This browser library**. The UI states that hosted destinations become available only when a compatible hosted workspace adapter is actually connected.

## Conflict policies

The import application supports three explicit policies:

### Skip

Existing IDs and records already imported from the same archive are retained. The report records each skipped item. Re-import with Skip is idempotent.

### Copy

Conflicting campaigns, assets, artifacts, approvals, exports, blobs, and draft references receive new destination IDs. References are remapped through one import identity map. The source archive remains unchanged.

### Replace

Matching destination IDs are replaced by the archive version. The previous value is written to the rollback journal before the report can complete. Historical timestamps from the archive remain historical and are not replaced by the import time.

## Import order and reference mapping

The transfer application imports in dependency order:

1. campaigns and draft identity mappings;
2. assets and optional blobs;
3. source artifacts;
4. approvals;
5. exports.

Every imported record receives `transferProvenance` containing:

- archive ID and schema;
- safe source-deployment metadata;
- the source record ID;
- destination workspace ID;
- import timestamp;
- `historical: true`.

Campaign normalization explicitly preserves transfer provenance. Save/reopen and re-export therefore retain the import chain.

## Partial failure, cancellation, resume, and rollback

Each import creates a persistent TransferReport containing:

- status;
- archive digest and schema;
- destination and conflict policy;
- validation snapshot;
- per-record outcomes;
- warnings and safe errors;
- ordered rollback journal;
- summary and timestamps.

Supported states include preparing, validating, warnings found, blocked, selecting destination, importing, partially imported, complete, cancelled, failed, and rolled back.

### Atomic import

The normal browser import is atomic. If a non-cancellation error occurs, SignalFlow reverses every journaled write in reverse order. The report states whether rollback completed.

### Cancellation

Cancellation is checked between transfer records. Completed records and the journal remain visible. The cancelled report can resume with the same archive digest.

### Partial/resumable import

Injected adapters may use non-atomic import. Completed/skipped records are recorded by stable source key. Resume uses the same report and archive digest and does not duplicate already completed records.

### Manual rollback

A completed, partial, cancelled, or failed import with journaled changes can be rolled back from the Library transfer workspace. The UI requires a second explicit confirmation. Rollback is idempotent after the report reaches `rolled_back`.

A rollback failure is never hidden; safe per-record errors remain in the report.

## Browser storage keys

The browser transfer application uses separate bounded records for campaigns, assets, source artifacts, approvals, exports, blobs, and transfer reports. The campaign key remains compatible with the current local library.

Temporary provider credentials are excluded by both Campaign normalization and portable transfer sanitization.

Browser quota/storage errors propagate to the product UI. Users should export the current campaign/archive before leaving when local persistence fails.

## Application ports

Portable transfer depends only on the following ports:

- `campaignRepository`;
- `assetRepository`;
- `sourceArtifactRepository`;
- `approvalRepository`;
- `exportRepository`;
- `blobStorage`;
- `transferReportRepository`;
- `clock`;
- `idService`;
- optional `archiveSigner`.

Memory, browser-local, and injected store-backed adapters implement the same contracts. React components may call the browser application factory but must not perform domain migration, repository writes, digest calculation, or conflict resolution themselves.

## Hosted-adapter boundary

This implementation proves contract compatibility with store-backed repositories; it does not claim production hosted infrastructure.

A future hosted adapter must additionally prove:

- authenticated destination workspace selection;
- tenant authorization for every imported record and blob;
- object-storage upload limits and resumability;
- durable background jobs where import cannot complete in one request;
- server-side idempotency and correlation IDs;
- audit-log retention and redaction;
- quota enforcement;
- partial failure recovery;
- backup/restore and disaster recovery;
- credential-backed cross-device acceptance tests.

Until those gates pass, the capability document must report browser import/export as available and hosted import as unavailable.

## Verification

Required automated evidence includes:

- deterministic archive creation;
- SHA-256 and optional signature verification;
- secret/private-path/signed-reference exclusion;
- corrupt, malformed, traversal, oversized, invalid-Base64, length-mismatch, missing-asset, and future-schema fixtures;
- byte, text, and JSON blob round trips;
- local → store-backed adapter → local round trip;
- authoritative draft, generated baseline, approval, archive, generation timestamp, source snapshot, export, artifact, asset, blob, and provenance preservation;
- duplicate Skip, Copy, and Replace behavior;
- atomic rollback, partial resume, cancellation, and manual rollback;
- legacy browser Campaign migration;
- browser adapter persistence;
- accessible Library UI source assertions;
- responsive and reduced-motion CSS checks;
- full frontend regression suite;
- production dependency audit and Next.js build;
- MCP and Python compatibility suites;
- Vercel preview for the exact final head.

## Rollout and rollback

Portable transfer is additive. Existing browser Campaign records continue to migrate through the canonical Campaign reader.

Rollback options:

1. Disable the Library transfer component while retaining the domain/archive modules for data recovery.
2. Revert the UI integration without deleting transfer reports or imported campaigns.
3. Use each TransferReport journal to reverse an applied import.
4. Revert the full feature commit only after users have had a path to export any imported campaigns.

Do not delete browser transfer keys as a deployment rollback. Removing stored reports or blobs without user action would break recovery and auditability.
