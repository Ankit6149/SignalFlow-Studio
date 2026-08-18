# ContentSignal Manual Intake — Implemented Contract

> Status: manual browser-local intake is implemented by #152. The GitHub connected-source ingestion core is implemented in code and its durable webhook/Postgres boundary is in progress under #161/#167/#71; production automatic detection is not yet configured or verified.

## 1. Product boundary

A manual signal is not a post, campaign, or opportunity.

It is a durable, provenance-bearing record that says:

> something happened, I learned something, or I may want to talk about this later.

Creating a manual ContentSignal does **not**:

- call a model provider;
- generate copy;
- choose a destination;
- create a Campaign;
- score a ContentOpportunity;
- schedule or publish anything;
- imply that SignalFlow detected the event automatically.

This is intentionally the first persistent record before editorial judgment.

## 2. Current owner path

The implemented browser-local path is:

```text
/signals
  → manual thought/event/topic
  → createManualSignal application service
  → canonical ContentSignal
  → browser ContentSignal repository
  → localStorage persistence
  → refresh/reopen
  → same ContentSignal history
```

The current route is `/signals`.

The Signals workspace lets the owner:

- capture free-form context;
- choose a signal kind;
- optionally associate a project reference;
- choose a privacy classification;
- optionally record when the event occurred;
- record an explicit boundary note;
- edit signal metadata;
- ignore a signal without deleting its provenance;
- snooze it for a future window;
- archive it;
- restore ignored/snoozed/archived records.

The current Signals UI deliberately states that automatic detection is not implemented for the live owner experience. GitHub connected-source ingestion core is implemented behind application/server boundaries, but production automatic detection is not yet configured: there is no completed GitHub App install flow, dedicated migrated SignalFlow database, production webhook secret/configuration, or background Opportunity continuation yet.

## 3. Canonical domain record

`ContentSignal` is registered in `frontend/lib/domain/contracts.mjs` and normalized in `frontend/lib/domain/contentSignals.mjs`.

The record contains:

- stable `signalId`;
- global domain `schemaVersion`;
- signal-specific `signalSchemaVersion`;
- owning `workspaceId`;
- optional `projectId`;
- `sourceType`;
- optional `sourceConnectionId`;
- canonical `sourceArtifactIds[]` references;
- canonical `assetIds[]` references;
- optional external event reference for connected ingestors;
- `occurredAt` and `observedAt` timestamps;
- headline and summary;
- signal kind;
- importance hints;
- privacy classification;
- optional boundary note;
- lifecycle status;
- optional snooze deadline;
- provenance.

The current manual source type is `manual`.

## 4. Lifecycle

Current statuses are:

```text
new
interpreted
used
ignored
snoozed
archived
```

`interpreted` and `used` exist now so later ContentOpportunity and NarrativeStrategy work can transition the same stable record instead of inventing a second signal representation.

User-facing manual intake currently exercises:

```text
new ↔ ignored
new ↔ snoozed
new ↔ archived
```

Restoration returns a record to `new`.

A snoozed record requires a valid future `snoozedUntil` timestamp.

## 5. Signal kinds

The implemented contract supports:

- feature
- bugfix
- release
- milestone
- lesson
- thought
- research
- launch
- personal_update
- career_update
- opinion
- question
- external_topic
- other

These are editorial evidence categories, not posting templates.

## 6. Provenance and privacy

Manual records preserve provenance including:

- source;
- ingestion method;
- capture timestamp;
- non-secret actor reference.

Manual signals default to `workspace_private`.

They reuse the canonical privacy vocabulary from the source/asset domain:

- public
- workspace_private
- device_private
- restricted

Domain serialization remains governed by `frontend/lib/domain/contracts.mjs`:

- raw credentials/tokens/password-like fields are forbidden;
- request/response runtime objects are forbidden;
- functions, symbols, bigint values, circular references, and non-plain runtime objects cannot be serialized;
- filesystem paths are not accepted where signal records require opaque IDs.

Signal metadata therefore remains portable domain state instead of carrying provider clients, HTTP objects, database handles, or secrets.

## 7. Application-service boundary

`frontend/lib/application/contentSignalApplication.mjs` owns the workflow.

Supported operations:

- `createManualSignal`
- `createExternalSignal`
- `listSignals`
- `readSignal`
- `updateSignalMetadata`
- `ignoreSignal`
- `snoozeSignal`
- `archiveSignal`
- `markInterpreted`
- `markUsed`
- `restoreSignal`
- `attachSignalToProject`
- `attachSourceToSignal`
- `deleteSignal`

UI code does not directly mutate signal localStorage records.

Workspace ownership is enforced at the application boundary. A signal from another workspace cannot be read or changed through an application scoped to the current workspace.

## 8. Canonical source and asset references

ContentSignal does not copy source or asset payloads into itself.

It stores only canonical IDs:

```text
sourceArtifactIds[]
assetIds[]
```

When source/asset repositories are supplied, the application validates:

- the referenced record exists;
- the record belongs to the current workspace where workspace ownership exists.

This avoids domain duplication and keeps future storage migrations additive.

## 9. Repository adapters

`frontend/lib/infrastructure/contentSignalAdapters.mjs` provides the same logical repository contract through:

1. memory adapter — deterministic domain/application tests;
2. browser adapter — current Personal Alpha persistence;
3. generic store-backed adapter — portable service/storage seam.

The canonical ContentSignal repository port now exposes:

```text
list
get
upsert
remove
findByExternalEvent
insertExternalIfAbsent
```

The browser/memory/store-backed adapters implement the same contract. Connected-source server ingestion additionally has a Postgres adapter in `frontend/lib/infrastructure/postgresConnectedSourceAdapters.mjs`; its migration and production configuration are tracked separately from browser-local manual durability.

The browser key is currently:

```text
signalflow_content_signals_v1
```

A duplicate `signalId` cannot be silently reassigned to another workspace.

## 10. Refresh and recovery

The browser application is composed in `frontend/lib/application/browserContentSignalApplication.mjs`.

Regression coverage reconstructs the application over the same browser storage and verifies that:

- the signal survives;
- its stable ID survives;
- project association survives;
- lifecycle status survives.

This is browser-local durability, **not** cloud sync.

## 11. Portable transfer

ContentSignal history is **not yet included in the portable campaign archive**.

That is an explicit current limitation rather than silent omission.

Before signals become cloud-only or cross-device-owned state, portable ownership must be extended through a new archive schema/version or a workspace-level export that includes ContentSignals. The existing campaign archive must not be falsely described as exporting signal history today.

## 12. Connected-source ingestion remains a separate vertical capability

Manual intake and automatic source observation share the canonical ContentSignal record, but they have different trust and durability boundaries.

The GitHub connected-source ingestion core is implemented in code: allowlisted merged-PR/release normalization, raw-body HMAC verification, SourceConnection/resource authorization, bounded event metadata, external-event idempotency operations, dependency-only prefiltering, Postgres repository/migration code, and a Node webhook route.

Production automatic detection is not yet configured or verified. Remaining work under #161/#167 includes the GitHub App install/connect lifecycle, a dedicated migrated SignalFlow database, production webhook/database secrets, real delivery acceptance, durable/background continuation into ContentOpportunity, and bounded repository evidence/media steps.

ContentOpportunity scoring/ranking for manual Signals is implemented under #156/#166; the connected-source trigger must reuse that canonical intelligence rather than inventing a GitHub-specific destination generator.

The Today/Signals/Plan decision center remains the owner-judgment surface under #159/#167.

## 13. Scale path

The Personal Alpha implementation is intentionally browser-local, but the core contract is not browser-specific.

The scale path is:

```text
current
ContentSignal domain
  → ContentSignal application service
  → browser repository

connected-source server path in code
same ContentSignal domain
  → same application-service contract
  → Postgres repository adapter + authenticated provider webhook boundary

later production
  → dedicated migrated/configured database
  → GitHub App installation lifecycle + durable background continuation
  → broader authenticated hosted APIs and sources
```

Workspace/project IDs are already part of the record so SaaS ownership does not require replacing the signal model.

The browser route is therefore a real first adapter, not a disposable prototype.

## 14. Verification contract

Issue #152 is complete only when tests prove:

- versioned signal creation;
- project-less and project-scoped records;
- canonical source/asset ID reference behavior;
- workspace isolation;
- duplicate-ID ownership protection;
- ignore/snooze/archive durability;
- browser refresh/reopen recovery;
- memory/browser/store-backed repository behavior;
- domain serialization safety;
- current Campaign application remains independent;
- UI truthfully says manual intake is available and automatic detection is not.

## 15. Next vertical slice

Manual ContentSignal → explainable ContentOpportunity → owner judgment is already implemented and accepted in Golden Path 1. The next vertical slice is not automatic publishing; it is connected work reaching that same canonical judgment path:

```text
verified GitHub work event
  → canonical ContentSignal
  → cheap noise gate
  → explainable ContentOpportunity
  → bounded authorized evidence
  → media/content-form requirement when useful
  → Today / Plan owner judgment
```

Destination choice remains downstream policy informed by owner preference, connected destinations and the editorial calendar; GitHub ingestion must never hardcode LinkedIn/X.

That preserves the core SignalFlow rule:

> **The user's job is judgment. SignalFlow's job is everything between the work and that judgment.**
