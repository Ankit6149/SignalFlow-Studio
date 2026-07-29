# SignalFlow Studio domain architecture

This document is the implementation boundary for SignalFlow Studio domain data, application services, persistence adapters, exports, and future hosted infrastructure.

## Dependency direction

```text
UI / routes / MCP / extension receiver
                ↓
       application services
                ↓
      domain contracts + ports
                ↑
 browser / memory / cloud adapters
```

Rules:

- Domain modules are pure JavaScript and cannot import React, Next.js, browser APIs, database clients, provider SDKs, or infrastructure adapters.
- UI and route modules call application services. They do not import infrastructure adapters directly.
- Infrastructure implements ports; it does not own campaign rules.
- Compatibility readers may translate legacy records into canonical records, but they cannot create a second source of business logic.
- All persisted or protocol-crossing records carry `schemaVersion` and stable IDs.

The static boundary tests live in `frontend/tests/architectureBoundaries.test.mjs`.

## Versioned records

The schema registry is `frontend/lib/domain/contracts.mjs`. Schema version `1` defines:

| Record | Owner | Stable identifier | Purpose |
| --- | --- | --- | --- |
| Workspace | workspace | `workspaceId` | Deployment/account collaboration boundary |
| Project | workspace | `projectId` | Brand or product context |
| Campaign | project | `campaignId` | Authoritative campaign aggregate |
| SourceSnapshot | campaign | `sourceSnapshotId` | Immutable generation input snapshot |
| SourceArtifact | campaign | `sourceArtifactId` | Note, link, repository, document, or captured source |
| Asset | workspace | `assetId` | Reusable media/file metadata |
| GenerationJob | campaign | `generationJobId` | Queued or running generation work |
| GenerationRun | campaign | `generationRunId` | Completed provider/model execution metadata |
| ChannelDraft | campaign | `draftId` | One channel’s authoritative current draft |
| DraftRevision | draft | `revisionId` | Generated or edited history entry |
| Approval | campaign | `approvalId` | Version-specific review decision |
| Export | campaign | `exportId` | Deterministic export snapshot |
| Publication | campaign | `publicationId` | Destination publish attempt and result |
| Connection | workspace | `connectionId` | Connector identity/status without tokens |
| UsageEvent | workspace | `usageEventId` | Quota/billing-ready usage fact |
| AuditEvent | workspace | `auditEventId` | Security and product activity fact |

## Portable serialization

`serializeDomainRecord` rejects:

- provider API keys, access tokens, refresh tokens, OAuth tokens, client secrets, passwords, cookies, and authorization values;
- browser `File` objects and other class instances;
- framework Request/Response objects;
- database clients or request-scoped infrastructure objects;
- functions, symbols, bigint values, circular references, and non-finite numbers.

Domain objects use IDs and metadata instead of runtime handles. Secrets remain in request-scoped provider/connector adapters.

## Canonical Campaign aggregate

`frontend/lib/domain/campaign.mjs` owns campaign invariants.

A Campaign contains:

- stable campaign ID and schema version;
- title, status, selected channels, created/updated timestamps;
- one `ChannelDraft` per channel;
- one authoritative `current` revision inside each draft;
- optional generated revision history when the current text was edited;
- source snapshot and generation run metadata;
- provider/model, warnings, and quality states;
- portable brief, publish options, source file metadata, and extracted document text;
- generation/package context with active `posts`, generated Markdown, generated JSON, and prompts removed.

The current edited draft is authoritative. Generated copy is never stored as a second active draft.

## Legacy migration

`migrateLegacyCampaign` accepts browser-library records created before schema version `1`.

Migration rules:

- legacy `posts[channel]` becomes the authoritative current draft;
- legacy `result.posts[channel]` becomes optional generated history only when different;
- duplicate `result.package.posts`, `result.markdown`, and `result.json` are removed;
- temporary API keys are excluded;
- existing IDs and timestamps are preserved when available;
- migrated records are written back by the browser repository.

This migration is intentionally local and idempotent. Hosted migrations will use the same canonical parser and fixtures.

## Application services

`frontend/lib/application/campaignApplication.mjs` provides the use cases:

- list and migrate saved campaigns;
- save/upsert a canonical campaign;
- open a campaign into editor state;
- delete a saved campaign;
- create an export snapshot;
- project Markdown and JSON.

`browserCampaignApplication.mjs` is the browser composition root. The page imports this application module, not local-storage infrastructure.

Future route, worker, MCP, or extension-receiver use cases should be added as application services before adding another UI or protocol implementation.

## Ports and adapters

The runtime port registry is `frontend/lib/domain/ports.mjs`.

Current ports:

- campaign repository;
- asset repository;
- blob storage;
- job queue;
- provider adapter;
- connector adapter;
- notification adapter;
- clock;
- ID service.

`frontend/lib/infrastructure/adapters.mjs` currently includes:

- browser-local campaign repository;
- in-memory campaign repository;
- injected async-store campaign repository for hosted/cloud implementations;
- memory and store-backed blob storage;
- memory and store-backed job queues.

The same contract suites run against local/memory and store-backed adapters. A database, object store, or durable queue implementation is not considered complete until it passes those suites plus its own integration, isolation, retry, backup, and restore tests.

## Authoritative export projection

`frontend/lib/export/campaignExport.mjs` projects from the canonical Campaign aggregate.

Markdown:

- includes metadata, source/generation IDs, provider/model, strategy/context, warnings, and quality state;
- includes each current edited draft exactly once;
- does not include generated history as another active section.

JSON:

- uses `CampaignExport` schema version `1`;
- separates `currentDrafts` from optional `history`;
- includes campaign ID, generation run, source snapshot, provider/model, snapshot timestamp, warnings, and quality states;
- omits duplicate active drafts from package/generation payloads;
- is deterministically key-sorted for identical campaign state.

ZIP must be assembled from the same projection when the current ZIP route is promoted into the supported product surface. It must not read `result.package.posts` directly.

## Adding a vertical slice

1. Define or extend a versioned domain record.
2. Add invariants and portable serialization tests.
3. Add an application service command/query.
4. Define the required port.
5. Implement local and hosted/store-backed adapters behind the port.
6. Run adapter contract suites.
7. Migrate one user flow to the application service.
8. Add compatibility migration and rollback notes.
9. Update README, agent guidance, capability documentation, and public AI-context files when product truth changes.

Do not add cloud database calls, object-store clients, provider SDKs, or connector SDKs directly to React components or domain modules.
