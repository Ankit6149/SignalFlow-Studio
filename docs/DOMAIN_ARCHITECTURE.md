# SignalFlow Studio — Domain Architecture

> **Status:** implementation boundary for current domain data plus the canonical migration direction for the content operating system. Current schema/code remains authoritative for shipped records; new target records are introduced through versioned migrations and application services rather than by bypassing existing contracts.

## 1. Dependency direction

```text
UI / routes / MCP / extension / webhook / workers
                    ↓
           application services
                    ↓
          domain contracts + ports
                    ↑
 browser / memory / cloud / provider / connector / worker adapters
```

Rules:

- Domain modules are pure JavaScript and cannot import React, Next.js, browser APIs, database clients, provider SDKs, queue SDKs, Playwright/browser-worker clients, renderer SDKs, or infrastructure adapters.
- UI/routes/MCP/webhooks/workers call application services. They do not own business rules or write repositories directly.
- Infrastructure implements ports; it does not own campaign/editorial/identity policy.
- Compatibility readers may translate legacy records into canonical records, but cannot create a second source of business logic.
- Persisted or protocol-crossing records carry `schemaVersion` and stable IDs.
- Secrets are referenced through secure adapters/secret IDs, never embedded in campaign/signal/memory/media records.
- Runtime `File`, `Blob`, Request/Response, SDK/client handles and browser objects do not cross domain boundaries.

Static boundary tests currently live in `frontend/tests/architectureBoundaries.test.mjs` and should expand as new packages/services are introduced.

## 2. Product domain lifecycle

The target lifecycle is:

```text
Source/event/manual input
        ↓
ContentSignal
        ↓
ContentOpportunity
        ↓
NarrativeStrategy
        ↓
Campaign
        ↓
ContentPiece(s)
        ↓
PlatformVariant(s)
        ↓
DraftRevision + Asset/MediaComposition revisions
        ↓
Approval
        ↓
EditorialCalendarEntry / PublicationRequest
        ↓
Publication
        ↓
NarrativeMemory + FeedbackEvent / StyleMemory
```

The current campaign system occupies the Campaign/Draft/Approval/Export portion of this lifecycle and remains a compatibility foundation while earlier/later stages are added.

## 3. Current schema-version-1 record foundation

The current registry in `frontend/lib/domain/contracts.mjs` includes records such as:

| Record | Owner | Stable identifier | Purpose |
| --- | --- | --- | --- |
| Workspace | workspace | `workspaceId` | deployment/account collaboration boundary |
| Project | workspace | `projectId` | product/brand context |
| Campaign | project | `campaignId` | current authoritative campaign aggregate |
| SourceSnapshot | campaign | `sourceSnapshotId` | immutable generation-input snapshot |
| SourceArtifact | campaign/workspace | `sourceArtifactId` | note/link/repository/document/captured source |
| Asset | workspace | `assetId` | reusable media/file metadata |
| AssetProcessing | workspace | `processingId` | processor/version input/output lineage |
| GenerationJob | campaign | `generationJobId` | queued/running generation work |
| GenerationRun | campaign | `generationRunId` | completed provider/model execution metadata |
| ChannelDraft | campaign | `draftId` | current destination draft |
| DraftRevision | draft | `revisionId` | generated/edited history entry |
| Approval | campaign | `approvalId` | version-specific review decision |
| Export | campaign | `exportId` | deterministic export snapshot |
| Publication | campaign | `publicationId` | destination attempt/result foundation |
| Connection | workspace | `connectionId` | connector identity/status without raw tokens |
| UsageEvent | workspace | `usageEventId` | quota/billing-ready usage fact |
| TransferReport | workspace/destination | `transferReportId` | import validation/outcomes/resume/rollback journal |
| AuditEvent | workspace | `auditEventId` | security/product activity fact |

Do not delete these simply because the target lifecycle adds richer concepts.

## 4. Target additive domain records

New work should converge on the following first-class concepts.

| Record | Owner | Example stable ID | Responsibility |
| --- | --- | --- | --- |
| IdentityProfile | user/workspace | `identityProfileId` | who the user is in public communication |
| PerceptionProfile | identity | `perceptionProfileId` | how the user wants to be understood |
| VoiceProfile | identity | `voiceProfileId` | explicit communication preferences/examples |
| BoundaryProfile | identity/project | `boundaryProfileId` | privacy/content/style restrictions |
| PlatformVoiceProfile | identity/platform | `platformVoiceProfileId` | destination-specific expression overlay |
| ContentSignal | workspace/project | `signalId` | something that happened or was manually supplied |
| ContentOpportunity | workspace/project | `opportunityId` | explainable editorial recommendation |
| NarrativeStrategy | campaign | `narrativeStrategyId` | chosen story before platform formatting |
| ContentPiece | campaign | `contentPieceId` | one semantic communication unit |
| PlatformVariant | content piece | `platformVariantId` | destination-native expression of a piece |
| FeedbackEvent | user/workspace | `feedbackEventId` | review/selection/rejection learning evidence |
| StyleMemory | user/workspace | `styleMemoryId` | evidence-backed learned communication hypothesis |
| NarrativeMemory | workspace/project | `narrativeMemoryId` | what was actually told publicly and how |
| CadencePolicy | workspace/project/platform | `cadencePolicyId` | editorial frequency/timing constraints |
| EditorialCalendarEntry | workspace | `calendarEntryId` | editorial intent/execution placement |
| MediaRequirement | content piece | `mediaRequirementId` | what visual/audio evidence the story needs |
| CaptureRecipe | project/workspace | `captureRecipeId` | bounded reproducible product walkthrough |
| MediaCompositionPlan | content piece | `mediaCompositionPlanId` | semantic media timeline/layout plan |
| MediaComposition | content piece | `mediaCompositionId` | rendered/versioned media relationship |
| PublicationRequest | platform variant | `publicationRequestId` | immutable exact approved external intent |
| PerformanceSnapshot | publication | `performanceSnapshotId` | optional later provider analytics snapshot |

The exact physical database may normalize/merge tables where appropriate, but these domain meanings must remain explicit and testable.

## 5. `ContentSignal`

A signal is **evidence/context before editorial judgment**.

It may represent:

- GitHub event;
- manual thought/topic;
- browser capture;
- release/milestone;
- document/research item;
- future connected-work event.

Rules:

- not generated copy;
- may exist without any opportunity/campaign;
- stable provenance/source relationship;
- external event delivery compatible with idempotency;
- optional project ownership for personal/cross-project topics;
- ignore/snooze/archive are durable user decisions;
- raw webhook tokens/private payloads do not belong in the record.

Issue #152 owns the first implementation.

## 6. `ContentOpportunity`

An opportunity is SignalFlow's **explainable editorial judgment** that one or more signals may deserve communication.

It should represent:

- `whyNow`;
- evidence readiness;
- freshness/aging;
- novelty/repetition;
- narrative fit;
- destination recommendations/exclusions;
- candidate angles;
- media-form suggestions;
- score/breakdown/confidence;
- valid `skip / do not post` outcome.

Opportunity scoring consumes NarrativeMemory and explicit identity/boundary context. It does not grant publication permission.

Issue #156 owns the first implementation.

## 7. Identity / perception / voice / boundaries

Identity is intentionally not one `tone` field.

Recommended composition:

```text
Person IdentityProfile
+ PerceptionProfile
+ VoiceProfile
+ BoundaryProfile
+ project/brand guidance
+ PlatformVoiceProfile
+ relevant learned StyleMemory
+ campaign NarrativeStrategy
```

Precedence must keep explicit boundaries above learned/engagement preferences.

Generation should record the profile/memory versions used so changing a profile later does not rewrite historical provenance.

See `docs/IDENTITY_MEMORY_AND_AUTHENTICITY.md` and #153/#154.

## 8. Campaign evolution

### Current Campaign aggregate

`frontend/lib/domain/campaign.mjs` currently owns invariants including:

- stable campaign ID/schema;
- title/status/selected channels/timestamps;
- one authoritative current revision per channel;
- generated baseline/history;
- edited/approval state;
- generation-run ownership;
- bounded archives for reversible regeneration;
- editor/saved/export revisions;
- source snapshot/generation metadata;
- provider/model/warnings/quality state;
- portable source/brief/package context.

These invariants remain valuable.

### Target Campaign aggregate

Campaign should evolve toward:

```text
Campaign
 ├─ opportunity or manual intent
 ├─ NarrativeStrategy revision(s)
 ├─ SourceSnapshot/evidence versions
 ├─ ContentPiece(s)
 │   └─ PlatformVariant(s)
 │       └─ DraftRevision(s)
 ├─ Assets / MediaComposition revisions
 ├─ Approvals
 ├─ Editorial plan references
 └─ Publication history
```

A campaign may contain several pieces sequenced across time rather than one simultaneous omnichannel response.

Migration must preserve legacy/current saved campaigns and their authoritative drafts.

Issue #157 owns this additive evolution.

## 9. Authoritative draft/version rules

Current rules remain mandatory:

- one authoritative current edited revision;
- generated text is baseline/history, not another active draft;
- editing clears approval for affected exact revision;
- failed regeneration preserves current work;
- per-channel/platform regeneration affects only the target;
- campaign title is not identity;
- Save updates current stable ID; Save as copy allocates a new ID;
- source changes create explicit freshness/staleness rather than silent mutation.

Future PlatformVariant/ContentPiece/media revision logic must extend these guarantees rather than weaken them.

## 10. Narrative strategy and content pieces

`NarrativeStrategy` stores **why/how to tell the story before platform formatting**.

`ContentPiece` stores one semantic unit such as:

- problem/reason story;
- demo;
- technical breakdown;
- release note;
- carousel;
- retrospective.

`PlatformVariant` exists only for appropriate/selected destinations.

Explicit destination absence/deferment is representable and should not be converted into empty draft records merely to satisfy a global schema.

## 11. Narrative memory

`NarrativeMemory` answers:

> What has the audience actually been told?

It may reference:

- topic;
- angle;
- claims/features/limitations;
- evidence/media shown;
- destination;
- confirmed publication timestamp;
- follow-up possibilities.

Confirmed publication is strong public-story evidence. Approved-but-unpublished content may inform internal duplication but must not be treated as definitely seen by the audience.

Narrative memory is separate from StyleMemory.

See #155.

## 12. Feedback/style memory

`FeedbackEvent` records user decisions such as approve unchanged, approve after edit, reject, regenerate, too corporate, too personal, wrong angle, platform removed, explicit preference, etc.

`StyleMemory` represents an evidence-backed hypothesis, not an immediate hidden personality mutation.

Rules:

- one edit normally creates evidence, not a permanent rule;
- supporting/contradicting events adjust confidence;
- user can inspect/confirm/edit/forget;
- explicit rules/boundaries outrank learned hypotheses;
- raw private draft text need not be duplicated in logs/memory when revision references/structured observations are sufficient.

See #154.

## 13. Canonical source graph

`frontend/lib/domain/sourceArtifacts.mjs` remains the canonical definition for `Asset`, `SourceArtifact`, and `AssetProcessing` until/additionally migrated through versioned contracts.

It owns:

- source kinds and ingestion methods;
- lifecycle/usability/evidence states;
- upload/processing;
- privacy/retention/deletion;
- safe references/provenance;
- graph validation;
- campaign snapshot references;
- generation compatibility projection.

The graph rejects duplicate IDs, cross-workspace/campaign references, missing links, unsafe references and provenance cycles.

Campaign/source/evidence snapshots store stable SourceArtifact version references. Editable labels/storage locations must not become the source-freshness identity.

See `docs/SOURCE_ASSET_CONTRACT.md` and #127–#129.

## 14. Capture/media domain

### `MediaRequirement`

Describes what the content piece needs to show and why.

### `CaptureRecipe`

Versioned, bounded, target-scoped walkthrough specification. It stores safe action/configuration metadata and secret references, not runtime credentials.

### Capture outputs

Screenshots/screencasts become canonical Assets with recipe/job/deployment/checkpoint provenance.

Raw captures are immutable source assets; crops/trims/renders are derived assets/records.

### `MediaCompositionPlan`

Semantic scene/timeline/layout plan generated/edited through validated data.

### `MediaComposition`

Versioned rendered relationship referencing exact source/output Assets and renderer/job version.

Changing media creates a new revision and may invalidate approval/publication readiness.

See `docs/CAPTURE_AND_MEDIA_PRODUCTION.md` and #151–#165.

## 15. Editorial calendar domain

`CadencePolicy` stores editorial constraints/preferences such as target range, minimum gaps, preferred days/windows and empty-slot behavior.

`EditorialCalendarEntry` may represent:

- open/proposed slot;
- planned piece;
- production/review due state;
- approved publication;
- launch/event marker;
- manual block.

The calendar is not only a table of publication timestamps.

An intentionally empty slot is valid domain state.

See #160 and `docs/EDITORIAL_CALENDAR_AND_PUBLISHING.md`.

## 16. Publication request versus publication

A `PublicationRequest` freezes the exact approved external intent:

- campaign/content piece/platform variant;
- exact draft revision;
- exact media revision(s);
- target connection/identity;
- approval/source freshness/capability snapshots;
- immediate/scheduled time and timezone;
- idempotency key.

A `Publication` records the external result.

States must support `unknown` where the provider may have accepted the side effect but confirmation is unavailable.

Manual handoff is not direct publication confirmation.

Issue #103 remains the publication-job foundation; #168 proves the owner golden path.

## 17. Application services

Current `frontend/lib/application/campaignApplication.mjs` provides campaign list/read/create/update/copy/open/delete/export use cases and should remain the pattern for new services.

Target application modules should own use cases such as:

```text
SignalApplication
  createManualSignal
  list/read/update/ignore/snooze/archive

OpportunityApplication
  evaluate/rank/explain/select/reject/snooze
  selectAngle/setCustomAngle

IdentityApplication
  read/update/version profiles
  resolveIdentityContextSnapshot

CampaignPlanningApplication
  createCampaignFromOpportunity
  reviseNarrativeStrategy
  create/update ContentPieces/PlatformVariants

ProductionApplication
  create MediaRequirements
  request CaptureJob/RenderJob
  bind/replace media revisions

EditorialApplication
  manage CadencePolicy
  plan/replan CalendarEntries

PublicationApplication
  create immutable PublicationRequest
  cancel/reschedule/reconcile

MemoryApplication
  record FeedbackEvent
  update/retrieve StyleMemory/NarrativeMemory
```

UI/routes/connectors/workers do not duplicate these rules.

## 18. Ports and adapters

Current runtime port families include campaign/asset/source/approval/export/transfer/blob/job/provider/connector/notification/clock/ID services.

Target additional ports may include:

- signal repository;
- opportunity repository;
- identity/profile repository;
- narrative/style memory repository;
- content-piece/platform-variant repositories;
- cadence/calendar repository;
- capture recipe repository;
- capture worker/client port;
- media-composition repository;
- render worker/client port;
- publication-request repository;
- source-event connection/event ingestion adapter;
- analytics/performance adapter later.

Add ports only for real application boundaries. Do not invent generic abstractions with no current vertical slice.

## 19. Browser/local/cloud adapters

Current browser/memory/injected-store adapters demonstrate the contract pattern.

Future production relational/object-storage/queue adapters are not complete merely because CRUD exists. They require:

- shared contract suites;
- tenant isolation;
- idempotency;
- migration/backfill;
- concurrency/conflict handling;
- retention/deletion;
- backup/restore;
- operational recovery.

Personal Alpha may use simpler owner adapters first if they preserve the same domain IDs/contracts.

## 20. Durable jobs

Long-running work belongs behind the job port/infrastructure:

- remote ingestion;
- expensive opportunity analysis;
- staged generation;
- asset processing;
- capture;
- screencast finalization;
- media rendering;
- exports;
- scheduled publication;
- performance sync;
- retention/deletion.

Jobs use stable IDs, idempotency keys, bounded retry, cancellation semantics, safe errors and correlation IDs.

Browser refresh/deploy/worker restart must not erase durable work.

See #73.

## 21. Portable serialization

Existing serialization rules remain:

Reject/exclude:

- provider/API/OAuth secrets, passwords, cookies, authorization values;
- browser `File`/runtime class instances;
- framework Request/Response;
- database/SDK clients;
- functions/symbols/bigint/non-finite values;
- circular references.

New identity/memory/signal/media/calendar records must obey the same portable discipline.

Portable transfer schema must evolve deliberately before claiming these new records are included. Do not silently omit important user-owned memory after it becomes production state.

## 22. Portable archive/transfer foundation

Current `frontend/lib/transfer/` owns browser archive schema, sanitization, SHA-256 integrity, optional signing, conflict mapping, import ordering, reports, resume/cancellation and rollback.

Existing `.signalflow.json` behavior remains current capability truth.

As new records ship, portable ownership should eventually include compatible export/import for:

- identity/profile state;
- signals/opportunities where appropriate;
- narrative/style memory;
- campaign/content-piece additions;
- calendar/publication metadata;
- capture/media provenance where exportable.

Secrets, private endpoints and non-exportable content remain excluded with explicit reasons.

## 23. Authoritative export projection

Current Markdown/JSON export continues projecting from canonical Campaign state and authoritative drafts.

As ContentPiece/PlatformVariant becomes canonical, export should evolve through versioned projection rather than reading legacy giant generation payloads directly.

Exports must clearly separate:

- current approved/edited content;
- optional history;
- source/evidence provenance;
- media references/metadata;
- publication status;
- campaign/narrative metadata.

Do not duplicate active text from provider response blobs.

## 24. Security/authorization

Every tenant-owned command/query eventually receives server-derived authorization context.

Sensitive new surfaces include:

- identity/private boundaries;
- GitHub/private-work signals;
- capture recipes/session requirements;
- raw recordings/screenshots;
- destination tokens;
- publication requests;
- narrative memory.

Requirements:

- workspace scope enforced server-side;
- secrets referenced by ID;
- logs/metrics allowlist safe metadata;
- capture origins/actions scoped;
- private content excluded from analytics by default;
- queued sensitive jobs revalidate authorization before external side effects;
- export/delete traverses new records/bytes according to policy.

## 25. Capability-driven architecture

A record existing in the domain does not mean its infrastructure capability is available.

Examples:

- CaptureRecipe may exist while no capture worker is configured;
- MediaCompositionPlan may exist while render service is unavailable;
- a destination Connection may be configured but lack video-publish scope;
- a signal source may be installed but paused/revoked;
- EditorialCalendar may plan a piece while publication connector is manual-only.

Clients derive current availability from the server-owned capability contract and resource-specific state.

## 26. Adding a vertical slice

Before implementation:

1. identify the user burden/decision removed;
2. identify owning domain record(s);
3. add/extend versioned schema/invariants;
4. add application command/query;
5. define only necessary port(s);
6. implement owner/local + future-compatible adapter boundaries;
7. add authorization/capability behavior;
8. add job/idempotency/retry if side effects/long work exist;
9. migrate one complete user flow;
10. add compatibility/migration/rollback;
11. update README/AGENTS/capability/product docs;
12. attach end-to-end evidence.

Do not add database/object-store/provider/connector/capture/render clients directly to React/domain modules.

## 27. Architecture completion rule

> **A new record is not a feature. A feature is complete only when its domain/application/infrastructure/UI/recovery path produces the intended owner outcome truthfully end to end.**
