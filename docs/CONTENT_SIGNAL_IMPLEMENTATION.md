# ContentSignal Manual Intake — Implemented Contract

> Status: implemented by issue #152 for the browser-local Personal Alpha path. This document describes the capability that exists now, not the broader automatic signal engine planned for later issues.

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

The UI deliberately states that automatic detection is not implemented.

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
- optional external event reference for future ingestors;
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
3. generic store-backed adapter — future Postgres/service adapter seam.

All expose:

```text
list
get
upsert
remove
```

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

## 12. Automatic ingestion remains separate

Automatic event detection remains unimplemented.

In particular, issue #152 does not implement:

- GitHub webhook ingestion;
- background repository monitoring;
- automatic opportunity ranking;
- event deduplication from external providers;
- scheduled polling;
- ContentOpportunity persistence;
- AI interpretation of incoming events.

GitHub App/webhook ingestion is owned by #161.

ContentOpportunity scoring/ranking is owned by #156.

The Today/Signals/Plan unified decision center is owned by #159.

## 13. Scale path

The Personal Alpha implementation is intentionally browser-local, but the core contract is not browser-specific.

The scale path is:

```text
current
ContentSignal domain
  → ContentSignal application service
  → browser repository

later
same ContentSignal domain
  → same application-service contract
  → authenticated hosted API / Postgres repository adapter
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

The next owner-visible intelligence step is not automatic publishing.

It is:

```text
ContentSignal
  → explainable ContentOpportunity
  → why this matters now
  → 3–5 angle choices + Something else
  → user judgment
```

That preserves the core SignalFlow rule:

> **The user's job is judgment. SignalFlow's job is everything between the work and that judgment.**
