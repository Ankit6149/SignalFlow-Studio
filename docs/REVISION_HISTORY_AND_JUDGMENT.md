# Revision History and Exact Judgment

## Purpose

SignalFlow treats revision history as part of the owner decision experience, not as an implementation log.

The owner must be able to understand what changed, inspect prior exact content, see the review and decision that applied to that exact revision, and deliberately return to prior wording without destroying later work.

This document describes the **currently implemented browser-local Personal Alpha contract** for LinkedIn/X `PlatformVariantRevision` history. It does not claim hosted cross-device synchronization or publication history.

## Product invariant

A visible owner judgment always binds one exact immutable revision.

```text
visible revision
+ exact review
+ current-pointer expectation
+ owner action
= one auditable judgment
```

A stale UI must never reinterpret an action as applying to a newer unseen revision.

## Revision lineage

Generated, owner-edited, AI-revised, and restored revisions remain immutable records.

Example:

```text
r1  generated
 ↓
r2  owner edit
 ↓
r3  AI change          ← current

owner prefers r1

r1  generated
r2  owner edit
r3  AI change
 ↓
r4  restored from r1   ← new current
```

Restoring does **not** overwrite r3 or repoint history backward. It creates a new immutable child whose:

- parent is the current revision at restore time;
- content/format come from the selected historical revision;
- provenance records `restoredFromRevisionId`;
- exact planning contract must match the current story;
- review/approval must be earned again for the new revision.

## Current owner experience

### Plan

The primary review surface remains focused on the current working revision. Revision history is progressive disclosure beneath the primary controls.

The owner can:

- inspect current and prior immutable revisions;
- see origin, timestamp, parent lineage, and relevant change-request/restore provenance;
- compare selected historical content with the current content without mutation;
- inspect the exact evidence/authenticity review and findings associated with the selected revision;
- inspect the exact approval/rejection state associated with the selected revision;
- run/re-run critics on an eligible historical revision;
- explicitly approve or reject an eligible historical revision without silently changing the current pointer;
- restore eligible historical wording as a new immutable current child.

Plan restoration deliberately leaves the new current revision unreviewed so the owner can continue through the normal exact-review controls.

### Today

Today remains a judgment inbox rather than a history-management cockpit. Revision history lives under the existing `Details` disclosure.

If the owner restores a historical revision from Today:

```text
restore historical revision
→ create new immutable current child
→ run exact evidence/authenticity checks
→ reconstruct Today
→ keep the restored revision in the judgment loop
```

If restoration succeeds but the critics fail, SignalFlow does not pretend the operation rolled back. The restored revision remains current, is not approval-ready, and the owner receives an explicit recovery message.

## Stale-client protection

Historical/current judgment operations accept an `expectedCurrentRevisionId`.

Before a judgment or restore proceeds, the application service verifies that the canonical `PlatformVariant.currentRevisionId` still matches the revision the UI believed was current.

If it does not, the operation fails with `stale_revision_context` and the UI refreshes instead of applying the action to unseen content.

The same principle is used by primary Plan/Today judgment controls: approval/rejection is bound to the exact revision shown to the owner rather than a late lookup of whatever happens to be latest.

## Planning-contract protection

History is broader than current actionability.

A revision from an older story/planning contract remains inspectable for audit/history, but SignalFlow will not newly review, judge, or restore it into the current story merely because it belongs to the same destination.

Application actions require the selected revision to remain bound to the current canonical ContentPiece/NarrativeStrategy/strategy revision contract.

## Review and decision semantics

Reviews and owner decisions are exact-revision records.

A newer revision never deletes or mutates:

- the prior revision;
- its critic result;
- its prior approval/rejection record;
- its provenance.

A historical approval does not silently make that historical revision current.

A restore does not inherit the source revision's approval. The newly restored child requires its own review and owner judgment.

## NarrativeMemory interaction

NarrativeMemory remains separate from revision history.

- An explicit approval can create truthful `prepared_internal` NarrativeMemory for the exact approved revision.
- Merely inspecting a historical revision creates no NarrativeMemory.
- Restoring historical wording creates no NarrativeMemory by itself.
- The restored child creates new NarrativeMemory only if that exact child is explicitly approved.
- No restore operation rewrites prior NarrativeMemory records.
- `published_confirmed` still requires the durable publishing path and is not implied by approval/history.

## StyleMemory interaction

StyleMemory remains separate from story/revision history.

- Authoritative owner approve/reject actions may feed eligible StyleMemory learning through the existing decorator.
- Historical approve/reject uses the same learning boundary as current-revision judgment.
- Restore itself is not treated as a style preference signal.
- Restored revisions preserve the selected source revision's safe StyleMemory provenance references; this does not copy raw feedback history into the revision.
- Explicit Voice/boundaries still outrank learned StyleMemory.

## Persistence truth

Implemented and verified for this slice:

- browser-local persistence/reopen of revision lineage;
- browser-local persistence/reopen of exact historical review/decision records;
- generic store-backed repository contract preserves the same records/invariants.

Not claimed:

- hosted account persistence;
- cross-device synchronization;
- collaboration/multi-user conflict resolution;
- durable publication history;
- confirmed audience exposure.

## Application boundaries

UI surfaces use the existing browser-composed application service. They do not directly mutate local storage, call model providers, or create a second history state machine.

Canonical direction remains:

```text
Plan / Today / future clients
          ↓
PlatformReviewApplication
          ↓
domain records + repository ports
          ↑
browser / memory / future hosted adapters
```

## Verification contract

The implementation is covered by deterministic tests for:

- immutable restore lineage;
- current-vs-historical judgment behavior;
- historical critic/decision attachment;
- stale-client rejection;
- old planning-contract rejection;
- NarrativeMemory behavior on exact approval;
- additive StyleMemory decorator capability;
- browser reopen persistence;
- generic store-backed persistence;
- Plan/Today exact-visible-revision binding;
- responsive/focus-visible revision-history UI;
- Today restore → re-review → continued judgment flow.

Issue #215 should only be considered complete after the final PR head passes repository CI, the exact preview deployment is Ready, the PR is merged, and the issue is closed against the merged implementation.
