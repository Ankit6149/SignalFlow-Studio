# StyleMemory implementation — Personal Alpha

> **Status:** implemented browser-local owner path. This document records implementation truth for #154. Hosted/cross-device persistence is not implemented.

## Product outcome

SignalFlow can learn recurring communication preferences from eligible owner review actions without silently mutating explicit Identity, Voice, Boundary, or Platform Expression profiles.

The implemented flow is:

```text
exact owner review action
        ↓
FeedbackEvent
        ↓
eligibility filter
        ↓
structured safe observation
        ↓
StyleMemoryHypothesis
        ↓
candidate / active / user-confirmed
        ↓
bounded relevant-memory query
        ↓
platform generation / exact change request
        ↓
exact PlatformVariantRevision.styleMemoryRefs[]
```

## What is implemented

### Feedback evidence

The domain supports normalized `FeedbackEvent` kinds for approval, edits/change requests, regeneration, rejection, destination/content/style complaints, explicit preferences, and explicit boundaries.

Current owner-review integration records feedback only after the authoritative review/change/regeneration operation succeeds. Style-memory storage failure does not turn a successful owner action into a failed review action.

Approved-after-edit analysis stores revision references and bounded structured style observations rather than copying the raw before/after drafts into StyleMemory records.

Factual, compliance, source-change, one-off, and explicit-boundary corrections can be excluded from automatic style learning.

### Explainable hypotheses

`StyleMemoryHypothesis` records contain:

- stable StyleMemory ID;
- hypothesis key and user-readable hypothesis;
- category;
- global/platform/project scope;
- confidence and evidence count;
- supporting/contradicting FeedbackEvent references;
- approved/rejected revision references where available;
- candidate/active/user-confirmed/rejected/superseded state;
- evaluated/created/updated timestamps.

One isolated eligible correction normally remains a candidate. Repeated supporting and contradicting evidence changes confidence deterministically.

### Voice → Learned preferences

The browser-local Voice workspace exposes learned hypotheses without turning them into a separate hidden profile.

Owner controls are:

- **Confirm** — explicitly confirms the current hypothesis;
- **Edit** — changes the user-readable preference and explicitly confirms the edited wording;
- **Not always** — weakens it back to candidate state so more evidence is required before automatic use;
- **Forget** — removes that learned hypothesis;
- **Reset learning** — removes learned hypotheses while preserving immutable feedback/campaign/review history.

The UI shows scope, current state, confidence, and evidence count. Evidence/revision references remain canonical domain records and can be surfaced through progressive disclosure without copying raw private draft text into the hypothesis.

## Precedence

Learned memory is deliberately lower authority than explicit intent.

```text
safety / authorization
        ↓
explicit boundaries
        ↓
explicit campaign instruction
        ↓
explicit platform preference
        ↓
explicit global Identity / Voice
        ↓
active or user-confirmed StyleMemory
        ↓
generic platform defaults
```

Generation and exact natural-language revision prompts state this precedence explicitly. Learned preferences must be ignored when they conflict with the exact Voice/Boundary context, approved strategy, or current owner instruction.

## Generation integration

Platform generation and exact natural-language change requests retrieve a small relevant set through the StyleMemory application service.

The current Personal Alpha query:

- filters to active/user-confirmed hypotheses;
- respects platform/project/global scope;
- ranks by scope relevance, confidence, and evidence count;
- returns at most the requested bounded limit (currently eight for generation);
- does not dump supporting feedback events or raw edit history into the model input.

A change in the bounded StyleMemory snapshot participates in the platform-generation input fingerprint, so a materially changed memory version is not silently treated as the same cached generation context.

## Exact provenance

Generated and AI-revised `PlatformVariantRevision` records store only safe memory references:

```text
styleMemoryRefs[] = {
  styleMemoryId,
  updatedAt
}
```

The timestamp distinguishes the exact hypothesis state used when a StyleMemory record is subsequently edited or re-evaluated.

Owner-edited child revisions inherit the memory provenance of the parent draft because the owner edit itself did not rerun generation. AI change-request revisions record the current bounded memory snapshot actually supplied to that inference task.

No raw feedback text, before/after draft text, prompt, API key, provider secret, or hidden chain-of-thought is stored in `styleMemoryRefs`.

## Data lifecycle, export, and deletion truth

Identity and learned-memory data is personal data and must remain independently controllable.

### Current browser-local behavior

- explicit Identity/Voice profiles and StyleMemory are stored in browser-local repositories for Personal Alpha;
- **Forget** deletes one StyleMemory hypothesis but does not rewrite historical campaign/review records;
- **Reset learning** deletes all StyleMemory hypotheses for the owner/workspace but preserves immutable `FeedbackEvent` records and campaign/publication history;
- browser storage deletion clears the browser-local copies according to the browser's own storage controls;
- hosted account deletion/retention enforcement is not implemented yet.

### Current export boundary

The existing portable `.signalflow.json` transfer is campaign-oriented. It does **not** currently claim to export or synchronize the complete Identity/StyleMemory owner profile across devices or deployments.

Until a dedicated identity/memory export contract is implemented, the UI/docs must not imply that StyleMemory is included in hosted sync, portable campaign transfer, backup, or account recovery.

A future identity/memory export should preserve explicit profile versions and user-approved memory state without exporting secrets, hidden provider history, or raw private edit logs by default.

### Deletion implications

Deleting a learned hypothesis stops it from being returned by future StyleMemory retrieval. Historical exact `PlatformVariantRevision.styleMemoryRefs` may still contain the opaque ID/timestamp showing what influenced that historical revision; this is provenance, not an active preference and does not recreate the deleted hypothesis text.

Resetting learning therefore does not falsify historical generation provenance and does not require campaign history deletion.

## Privacy / non-goals

This implementation does not:

- fine-tune a model;
- infer personality traits from unrelated private content;
- optimize engagement by silently overriding explicit user rules;
- expose raw before/after drafts in StyleMemory records;
- provide hosted or cross-device StyleMemory synchronization;
- turn approval into publication truth.

## Verification contract

#154 is complete only when repository verification proves:

- review actions create normalized feedback where appropriate;
- approved-after-edit structured observations do not copy raw drafts;
- one isolated correction remains non-permanent;
- repeated support/contradiction changes confidence predictably;
- factual/compliance/one-off corrections can be excluded;
- platform/project/global scope is enforced;
- owner can inspect/control learned preferences;
- generation/change requests retrieve bounded relevant memory;
- exact draft revisions record safe memory provenance;
- explicit Voice/Boundary rules retain precedence;
- forget/reset behavior is deterministic;
- frontend tests, dependency audit, production build, MCP tests, and Python tests pass on the exact merge head.
