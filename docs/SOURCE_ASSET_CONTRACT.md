# Canonical Asset, SourceArtifact, and AssetProcessing contract

SignalFlow Studio uses one versioned source graph across browser uploads, API requests, MCP, repository ingestion, trusted-local references, extension capture, campaign snapshots, portable transfer, and future hosted adapters.

This document is the implementation and migration runbook for issue #86. It does not claim that every ingestion algorithm or source workspace is complete. Hardened remote fetching is tracked in #127, links-only readiness in #22, the full source-health UI in #128, immutable remote evidence versions in #129, the Asset Library in #87, processing adapters in #88, and retention/deletion enforcement in #89.

## Why the contract exists

Legacy SignalFlow paths used several incompatible shapes:

- browser uploads became `{name, type, size, description}`;
- generation used `media_items`;
- campaign freshness hashed the display metadata;
- portable transfer accepted minimally validated Asset and SourceArtifact objects;
- API and MCP could receive different source fields;
- derived processing, ownership, privacy, provenance, retention, and deletion were not represented consistently.

The canonical source graph removes those competing meanings. Compatibility projections may remain at old provider or generation boundaries, but the compatibility payload is never the authoritative record.

## Contract versions and domain kinds

The source contract uses schema version `1` and the domain schema version remains `1`.

Canonical records:

- `Asset` — stored original or derived binary/text object metadata;
- `SourceArtifact` — a source/evidence identity and its usability, provenance, and relationship to one or more assets;
- `AssetProcessing` — a versioned processor run linking source artifacts and input/output assets.

All three are portable plain objects. Browser `File`, `Blob`, request/response, database clients, provider SDK objects, functions, symbols, BigInt, circular objects, and other runtime values never enter the domain record.

## Ownership and stable identity

Every record has a stable opaque ID and workspace ownership:

- `Asset.assetId` and `assetVersionId`;
- `SourceArtifact.sourceArtifactId` and `sourceArtifactVersionId`;
- `AssetProcessing.processingId`;
- required `workspaceId`;
- optional `projectId` and `campaignId`.

IDs must not contain filesystem paths. A graph cannot mix workspaces. When a campaign-scoped graph is validated, records owned by another campaign fail closed.

Stable version identity is derived from content/version inputs, not editable display metadata. Changing a description, tag, alt text, or intended use does not rewrite source provenance or the source version that generated a campaign. Changing extracted content, content hash, extraction result, or an immutable source reference creates a different source-artifact version.

## Asset

An Asset records:

- stable asset and asset-version IDs;
- workspace/project/campaign ownership;
- type: document, image, video, audio, archive, data, code, or other;
- lifecycle: original or derived;
- original name and MIME type;
- byte size, optional dimensions, optional duration;
- optional cryptographic content hash;
- safe application storage reference;
- user metadata: description, tags, alt text, intended use;
- privacy classification and export/processing permissions;
- immutable provenance events;
- parent and derived asset IDs;
- upload and processing states;
- retention and deletion states;
- creation/update timestamps;
- safe normalization-exclusion codes;
- optional transfer provenance for historical imports.

`storageRef` stores only opaque application identifiers such as provider, blob ID, region, or deployment-relative object key. It rejects HTTP URLs, signed URLs, absolute filesystem paths, traversal, authorization fields, cookies, tokens, and credentials.

For portable-transfer compatibility, canonical Asset also exposes read-compatible `blobId`, `contentType`, and availability fields derived from the authoritative storage/MIME state. New code should use `storageRef` and `mimeType`.

## SourceArtifact

A SourceArtifact records:

- stable artifact and version IDs;
- ownership;
- source kind and ingestion method;
- canonical safe source reference;
- original name, MIME type, and byte size;
- optional content hash;
- zero or more Asset IDs;
- extraction state, text hash/fingerprint, character count, truncation, processor identity, and safe issue codes;
- usability state and evidence-verification state;
- user metadata;
- privacy and export/processing permissions;
- immutable provenance events;
- parent/derived SourceArtifact IDs;
- generation-run and source-snapshot references;
- retention/deletion state;
- timestamps and migration exclusions;
- optional historical transfer provenance.

Supported source kinds:

- browser/API/MCP upload;
- public link;
- repository and repository file;
- trusted local repository reference;
- extension page context;
- screenshot;
- recording;
- note;
- imported portable archive.

### URL references

Canonical URL references:

- allow HTTP and HTTPS only;
- remove fragments;
- sort query parameters deterministically;
- reject embedded usernames/passwords;
- reject credential/signature query keys;
- do not become `usable_evidence` merely because a URL is syntactically valid.

Remote links and extension pages remain `reference_only` until the hardened fetch boundary verifies them. Issue #127 owns DNS, SSRF, redirect, timeout, MIME, decompression, extraction, and network safety. The contract fails if an unverified remote URL is mislabeled usable evidence.

### Repository references

Public repository references store provider, owner, repository, revision, safe relative path, and optional canonical public URL. Relative paths reject traversal, roots, and drive prefixes.

Trusted-local references store an opaque `localReferenceId`, display name, revision, and safe relative path. They never persist the absolute checkout path. Device-private data is not silently exported.

## AssetProcessing

AssetProcessing represents derived work such as thumbnailing, extraction, OCR, transcription, or analysis without claiming those processors exist before they are implemented.

It records:

- stable processing ID and ownership;
- source artifact ID;
- input and output Asset IDs;
- output SourceArtifact IDs;
- processor name, version, and optional model;
- queued/running/complete/partial/failed/unsupported/cancelled status;
- safe issue codes;
- start/completion/update timestamps;
- optional historical transfer provenance.

Processor name and version are mandatory. UI or APIs must never show an output as complete merely because an AssetProcessing record exists.

## Usability and evidence states

Source usability is explicit:

- `usable_evidence` — verified content can contribute to generation readiness;
- `reference_only` — retained for creative/context reference but not counted as extracted evidence;
- `processing` — not ready yet;
- `failed` — attempted ingestion/extraction failed;
- `unsupported` — the current deployment does not support this processing path.

Evidence state is separate:

- `verified`;
- `unverified`;
- `not_applicable`.

Generation readiness and the future source-health workspace must derive from these shared fields. A filename, URL, attachment count, or successful upload event alone is not proof of usable evidence.

## Provenance graph

Provenance is append-only and ordered by event time and event ID. Each event records:

- event ID and event type;
- ingestion method;
- timestamp;
- actor type and optional opaque actor ID;
- parent SourceArtifact/Asset IDs;
- optional processor identity;
- safe issue codes.

Metadata editing preserves provenance and creation identity.

`validateSourceGraph` rejects:

- duplicate IDs;
- cross-workspace references;
- cross-campaign records in campaign-scoped validation;
- missing Asset, SourceArtifact, processing input/output, parent, or derived references;
- provenance cycles.

The graph validator is shared by API and MCP. Future extension, job, and hosted adapters must call the same contract before persistence.

## Privacy and portable transfer

Privacy classification:

- public;
- workspace private;
- device private;
- restricted.

Each record separately states whether export and processing are allowed.

Portable archive creation excludes:

- Asset or SourceArtifact records with `privacy.exportAllowed === false`;
- processing records that reference excluded sources/assets;
- credentials, signed/temporary references, private endpoints, local paths, and runtime values.

The archive manifest stores only safe paths/reasons for exclusions. It never stores excluded values.

Campaign-scoped export can recover canonical assets/artifacts embedded in saved campaign source files. It includes only records related to the selected campaigns unless additional IDs are explicitly selected. AssetProcessing records are carried in archive schema version 1 as an additive collection and their references are remapped under Copy.

## Browser upload flow

The browser handler may read a selected browser File, but it immediately projects plain metadata and extracted text into `createUploadSourceBundle`.

The stored campaign source-file entry contains:

- compatibility display fields;
- canonical Asset;
- canonical SourceArtifact;
- no browser File object;
- no local filesystem path;
- no provider secret.

Text/code extraction creates a verified usable SourceArtifact with an extraction text fingerprint. Images and unsupported media remain honest reference-only artifacts until a real processing adapter produces verified evidence. The existing file list shows this state, while the complete diagnostics/filter/detail experience belongs to #128.

## Campaign freshness

Campaign source fingerprints use a stable SourceArtifact snapshot reference:

- source artifact ID;
- source artifact version ID;
- source kind;
- usability/evidence state;
- content hash where available;
- related Asset IDs.

Editable metadata, storage references, raw provenance, and runtime state do not change the source fingerprint. A changed immutable content/extraction version does.

Historical generation runs retain their original source snapshot. Issue #129 will add remote evidence revalidation and deliberate adoption of changed remote content.

## API and MCP boundaries

The generation API accepts additive arrays:

- `assets`;
- `source_artifacts` / `sourceArtifacts`;
- `processing_records` / `processingRecords`.

It validates one workspace-scoped graph before generation. Invalid graphs return HTTP 400 with a stable `sourceIssue.code` and safe message. No raw source record, secret, local path, signed URL, private address, or stack trace is returned.

MCP exposes the same fields and calls the same graph validator. It sends canonical records plus a `media_items` compatibility projection derived from SourceArtifact. The compatibility projection contains identity, version, display metadata, usability/evidence state, and Asset IDs—not storage credentials or provenance internals.

## Persistence and migration

Memory, browser, and store-backed repositories normalize legacy Asset and SourceArtifact records on read/upsert. Browser and store-backed adapters write the canonical migrated value back when it differs from storage.

Legacy behavior:

- missing workspace becomes `legacy-local`;
- legacy `{name,type,size,description}` becomes canonical Asset metadata;
- unknown legacy artifact categories safely become upload/reference records;
- extracted legacy text becomes usable evidence;
- unprocessed legacy images/media remain reference only;
- existing transfer provenance and historical flags are preserved;
- future source schema versions fail with upgrade guidance.

AssetProcessing is additive. Existing transfer callers that do not supply a processing repository receive a bounded in-application compatibility repository; browser and future hosted composition roots provide the explicit port.

## Retention and deletion

The contract represents retention and deletion state; it does not itself execute deletion jobs.

Retention states: active, expiring, retained, deletion requested, deleted.

Deletion states: active, requested, in progress, deleted, failed.

Issue #89 owns enforcement, duplicate handling, storage cleanup, retention jobs, and verified deletion across derived records/blobs. Until then, UI and public claims must describe these as recorded policy/state, not completed background enforcement.

## Rollout

The change is additive to domain schema version 1.

Rollout steps:

1. deploy canonical record normalizers and migrations;
2. migrate browser/store-backed records on read;
3. create canonical bundles for new browser uploads;
4. use stable SourceArtifact version references in source fingerprints;
5. validate API and MCP source graphs;
6. include AssetProcessing in portable archives;
7. keep legacy media projection only at generation compatibility boundaries;
8. update capabilities and public documentation;
9. require all new ingestion paths to use this module.

## Rollback

A safe UI/API rollback can stop creating new canonical records while retaining the additive fields in existing campaign/transfer data. Do not delete canonical records, processing records, provenance, or migration storage keys.

If reverting the product integration:

- preserve repository readers and portable transfer support;
- continue accepting canonical API/MCP records or fail with explicit compatibility guidance;
- retain SourceArtifact version references in saved campaign snapshots;
- never reconstruct absolute local paths or excluded credentials;
- provide export before destructive storage changes.

## Verification gates

Required evidence includes:

- record serialization/round trips;
- legacy migration and persistent writeback;
- future-schema failure;
- runtime/secret/path/signed-reference exclusion;
- URL/repository/trusted-local validation;
- upload, link, repository, extension, capture, note, and import fixtures;
- original/derived Assets and processing lineage;
- cross-workspace/campaign/missing-reference/cycle failures;
- metadata edits preserving immutable provenance;
- same-length extracted content creating a new source version;
- stable campaign fingerprints based on source-artifact versions;
- browser upload and visible usability state;
- API/MCP parity and safe errors;
- portable processing records, privacy exclusions, Copy remapping, and local/store/local round trips;
- full frontend regressions, dependency audit, production build, MCP tests, Python tests, and exact-head Vercel preview.
