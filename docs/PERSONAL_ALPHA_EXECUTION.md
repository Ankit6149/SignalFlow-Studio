# SignalFlow Studio — Personal Alpha Execution Strategy

> **Status:** canonical execution strategy for proving the owner product before broad SaaS expansion.
>
> **Operational state:** see `IMPLEMENTATION_LEDGER.md` for verified PR/commit/test history. This document defines execution order and exit conditions; the ledger records what has actually landed.
>
> **Capability truth:** a target described here is not automatically available in the current product. `CAPABILITY_MATRIX.md`, merged code, and verification evidence define what may be claimed as working.

## 1. Why Personal Alpha comes first

SignalFlow has a large possible surface:

- source integrations;
- AI providers;
- content strategy;
- identity and narrative memory;
- browser capture;
- image/video production;
- calendar planning;
- destination connectors;
- cloud persistence;
- teams;
- billing;
- analytics.

Building these horizontally would recreate the failure mode where the repository contains many foundations but the owner still has to think of the post, gather the evidence, record the product, format every destination, and publish manually.

The execution rule is therefore:

> **Prove one complete owner journey, add only the infrastructure needed to make it real, verify it end to end, then expand the next vertical slice.**

## 2. Product test

Personal Alpha succeeds when ordinary meaningful work can become reviewable communication with minimal deliberate content operations from the owner.

Target loop:

```text
REAL WORK / MANUAL THOUGHT
        ↓
ContentSignal
        ↓
ContentOpportunity
        ↓
angle selection / Something else
        ↓
NarrativeStrategy / Campaign
        ↓
ContentPiece(s)
        ↓
Evidence + media production
        ↓
PlatformVariant(s)
        ↓
exact text/media review + approval
        ↓
EditorialCalendar / PublicationRequest
        ↓
durable publication
        ↓
NarrativeMemory + feedback learning
```

The user's job is judgment. SignalFlow should remove as much repeatable work between the original event and that judgment as possible without inventing noise or weakening safety.

## 3. Cross-cutting product invariants

These rules apply to every gate:

- `ContentSignal` is not a `ContentOpportunity`.
- `ContentOpportunity` is not a `ContentPiece`.
- `StyleMemory` is not `NarrativeMemory`.
- media role is not media permission.
- `MediaRequirement` is not a `MediaPlan`.
- canonical `MediaRequirement.kind` remains `MediaRequirement`; selected media type belongs in `mediaKind`.
- original Assets are immutable; derivatives have explicit lineage.
- GitHub App/webhooks are source-event ingestion; MCP is an agent-control/query interface.
- GitHub is one source, not the definition of SignalFlow.
- `DO_NOT_POST` is a valid recommendation.
- media `NONE` is a valid requirement.
- `Something else` is a valid owner override.
- an empty editorial slot is valid; cadence must never manufacture filler.
- exact approval binds exact immutable text/media revisions.
- approval is not publication.
- publication is confirmed only after the destination confirms the external side effect.
- unknown external outcomes remain unknown until reconciled safely.
- privacy and authorization fail closed.
- consumer AI subscriptions are not API-credit guarantees.

## 4. Architecture rule: owner-first does not mean throwaway

Even Personal Alpha uses stable IDs, workspace ownership, versioned records, and application/adapter boundaries.

Representative identity set:

```text
workspaceId
userId
projectId
identityProfileId
signalId
opportunityId
campaignId
narrativeStrategyId
contentPieceId
platformVariantId
draftId
revisionId
assetId
captureRecipeId
captureJobId
mediaCompositionId
approvalId
calendarEntryId
publicationRequestId
publicationId
jobId
```

Application services own use cases. Provider/storage/browser/connector implementations stay behind their adapters. React components and route handlers do not become hidden domain models.

## 5. Gate 0 — product truth and documentation reset

### Goal

A contributor or coding agent must not be able to read an old file and conclude that SignalFlow is permanently a `Source → Destinations → Generate posting package` wizard.

### Required outcome

- canonical product, identity, media, editorial, information-architecture, execution, and capability docs;
- README/AGENTS/roadmap aligned to the content operating system lifecycle;
- old integration/product assumptions marked superseded or removed;
- target architecture clearly separated from current capability truth.

### Exit condition

Documentation and issues describe the same lifecycle and contributors can locate a change through:

```text
domain record
→ application service
→ port/adapter
→ UI / API / webhook / worker / MCP
```

## 6. Gate 1 — Golden Path 1: manual thought → authentic approval

**Owner issue:** #166

### Goal

Prove the intelligence, identity, narrative, generation, review, and exact-approval loop before automatic work detection.

### Vertical slice

```text
manual thought/topic
    ↓
ContentSignal
    ↓
ContentOpportunity + explanation
    ↓
3–5 materially different angles + Something else
    ↓
NarrativeStrategy
    ↓
ContentPiece
    ↓
LinkedIn / X PlatformVariants
    ↓
staged generation + authenticity/evidence/repetition checks
    ↓
user edit / targeted change / reject / approve
    ↓
exact approved revisions + persistent history
```

### Supporting areas

- #152 ContentSignal/manual intake;
- #153 identity/perception/voice/boundaries;
- #155 narrative/publication memory foundation;
- #156 explainable opportunity scoring and angles;
- #157 NarrativeStrategy/ContentPiece/PlatformVariant contracts;
- #158 staged generation and quality critics;
- #159 Today/Signals/Plan decision surfaces;
- existing draft/version/approval invariants under #60.

### Exit condition

The owner can type one real thought, make a small number of useful decisions, receive authentic LinkedIn/X variants, make surgical edits/changes, approve exact revisions, refresh/reopen, and lose nothing.

### Current execution state

GP1 #166 is accepted as the first complete owner proof. Broader parent issues may remain open where their full reusable product-wide acceptance exceeds the GP1 slice.

## 7. Gate 2 — Golden Path 2: GitHub work → worthwhile opportunity → automatic evidence

**Owner issue:** #167

This gate intentionally combines the earlier separate “GitHub signal” and “automatic screenshot” milestones. GP2 is not complete merely because a webhook arrives; for a visual product story the owner must also avoid doing the manual screenshot work.

### Goal

Meaningful real work becomes a worthwhile, evidence-backed content opportunity without manual campaign creation, and a visual story receives automatically captured reviewable proof.

### Vertical slice

```text
meaningful GitHub event
    ↓
verified GitHub App / webhook boundary
    ↓
canonical ContentSignal
    ↓
cheap deterministic noise filtering
    ↓
ContentOpportunity ranking / why-now / repetition context
    ↓
Today: Worth considering
    ↓
angle selection / Something else
    ↓
NarrativeStrategy / Campaign
    ↓
bounded repository/source evidence snapshot
    ↓
MediaRequirement when visual proof is useful
    ↓
versioned CaptureRecipe + durable CaptureJob
    ↓
real bounded browser screenshot capture
    ↓
private immutable canonical Asset
    ↓
quality/privacy state + platform derivative
    ↓
exact screenshot revision in LinkedIn/X review
```

### Required areas

- #161 GitHub App/webhook → ContentSignal;
- #127/#129 source boundary/evidence versioning where required;
- #156 opportunity scoring/noise separation;
- #158 generation and critics;
- #162 versioned bounded capture/job foundation;
- #163 real screenshot execution, derivatives, exact review binding;
- #72 private object storage foundation where hosted;
- #73 durable execution foundation.

### Required positive proof

Use a real meaningful GitHub event class such as:

- merged PR with a clear product/engineering outcome; or
- published release.

Do not hand-author a signal and call GitHub integration complete.

### Required negative/noise proof

Use at least one low-value event such as a dependency-only/routine change. SignalFlow may preserve the raw signal, but it must not manufacture a high-priority opportunity merely because an event arrived.

### Screenshot proof

For the visual fixture:

- capture executes through bounded recipe actions, not arbitrary recipe code;
- same-origin policy exists at both domain and worker boundaries;
- privacy is revalidated immediately before capture;
- raw bytes are stored privately with immutable content identity;
- capture provenance links the exact Asset to recipe version, job, checkpoint, safe final URL, viewport/dimensions, capture time, privacy outcome, worker version, and content hash;
- social derivatives preserve lineage;
- exact media revision is visible in review and independently replaceable from text.

### Exit condition

The owner does real GitHub work and later finds a genuinely useful opportunity waiting in SignalFlow, including automatically produced visual evidence when appropriate. A noisy event does not become manufactured content. Duplicate/retried event and capture delivery remain idempotent and recoverable.

### Current execution state

This is the active gate. See #167, #163, #161 and `IMPLEMENTATION_LEDGER.md` for verified implementation state.

## 8. Gate 3 — automatic product-demo production

**Primary issues:** #151, #164, #165 plus shared asset/job/storage work.

### Goal

A campaign that genuinely benefits from a short product demo can receive one without manual screen recording and repetitive editing.

### Vertical slice

```text
MediaRequirement: screencast/demo
    ↓
CaptureRecipe
    ↓
deterministic raw screencast
    ↓
immutable raw video Asset
    ↓
MediaCompositionPlan
    ↓
semantic scenes / callouts / captions / brand treatment
    ↓
durable render
    ↓
16:9 + 9:16 outputs
    ↓
quality/privacy review
    ↓
exact media revision approval
```

### Boundaries

- no unrestricted browser agent;
- no hidden desktop/user recording;
- no Premiere/After Effects replacement;
- no requirement for stochastic generative video when deterministic product capture/composition is sufficient;
- raw capture remains immutable when trims/compositions are produced.

### Exit condition

At least one real product-demo fixture can be captured, composed, rendered in 16:9 and 9:16, and reviewed as exact media revisions without manual recording/editing.

This gate is deliberately parked until GP2 screenshot evidence is solid.

## 9. Gate 4 — Golden Path 3: approve once → durable publication → memory

**Owner issue:** #168

### Goal

After approving exact text/media and schedule, the owner should no longer manually copy, upload, reopen a platform, or supervise browser timers.

### Vertical slice

```text
exact text revision approved
+ exact media revision approved
    ↓
editorial time/window recommendation
    ↓
user approves schedule / post now / changes time
    ↓
immutable PublicationRequest
    ↓
durable job
    ↓
verified target connection + capability
    ↓
published | failed | rejected | unknown
    ↓
confirmed Publication
    ↓
NarrativeMemory
    ↓
Today surfaces only actionable exceptions
```

### Required areas

- #160 cadence/editorial planning;
- #102 verified connector identity/scopes/capabilities;
- #103 immediate/scheduled publication jobs;
- #73 durable jobs;
- #155 NarrativeMemory;
- exact media binding from #163/#165 where applicable.

### Required reliability proof

- browser closure after scheduling;
- worker/deploy restart;
- duplicate queue delivery;
- connector timeout/unknown outcome;
- token expiry/revocation/rate limit;
- stale or edited revision before run;
- cancel/reschedule race.

At most one external publication may exist for one publication intent.

### Exit condition

The owner approves once and stops thinking about the operational posting step. Normal success becomes history; only exceptions return to Today. Only confirmed publication becomes strong public-story memory.

## 10. Gate 5 — learn repeated corrections

**Primary issue:** #154, supported by #153/#155/#158.

### Goal

Repeated user corrections stop recurring.

### Required outcome

- FeedbackEvent evidence from review actions;
- revision-delta analysis;
- explainable StyleMemory hypotheses;
- confidence/evidence accumulation;
- scope-aware learned preferences;
- inspect/confirm/edit/forget controls;
- generation/quality integration;
- explicit boundaries always outrank learned preferences or engagement signals.

### Exit condition

A repeated correction becomes an explainable user-controlled preference and future generation stops making the same mistake without silently rewriting identity/boundary rules.

## 11. Gate 6 — source, asset, and extension completeness

### Goal

Expand the evidence layer after the owner golden paths prove the architecture.

Includes, as justified by real workflows:

- canonical Asset/SourceArtifact follow-through;
- hardened remote URL/source ingestion;
- immutable evidence versions and freshness;
- repository discovery/planning;
- trusted local repository mode;
- source-health diagnostics;
- browser extension pairing;
- page context/screenshot/user-initiated recording;
- capture review/redaction;
- offline queue;
- asset inbox/library;
- OCR/transcription/analysis processors;
- hashing/duplicate/retention/deletion lifecycle.

### Boundary

Extension capture is user-initiated browsing-context capture.

Automatic campaign capture (#162–#165) is a separate worker pathway.

Both produce canonical Assets but solve different user burdens.

## 12. Gate 7 — hosted owner reliability / cloud foundation

### Goal

Make the proven owner loop durable across services/devices without turning infrastructure into a separate product.

Includes:

- hosted auth/workspace selection;
- multi-tenant repository/database layer;
- object storage/resumable uploads;
- autosave/cross-device conflict recovery;
- centralized authorization;
- secret/privacy/retention/redacted observability;
- migrations/backups/restore;
- usage/quota ledger;
- guided onboarding and data controls.

Some foundations may be implemented earlier when a Golden Path requires them, as happened with durable jobs and private object storage for GP2. Their broader issues remain open until their complete scope is proven.

## 13. Gate 8 — complete product UI system

### Goal

Finish route/system quality around the proven lifecycle rather than repeatedly redesigning isolated pages.

Target information architecture:

```text
Today
Signals
Plan
Calendar
Create
Assets
Library
Connections
Voice
Settings
```

Current/manual Create remains available until replacement paths are proven.

Required quality includes:

- one coherent shell/navigation model;
- responsive/mobile decision surfaces;
- 200%/400% reflow;
- keyboard/screen-reader acceptance;
- long-content/error/loading/offline fixtures;
- visual regression coverage;
- exact text/media review surfaces;
- truthful unavailable states rather than fake capability screens.

Do not use this gate as justification for another broad visual redesign while GP2/GP3 are incomplete.

## 14. Gate 9 — broader destinations, integrations, collaboration, and SaaS breadth

Only after Personal Alpha is repeatedly useful:

- broaden destination generation/publishing one connector at a time;
- add source integrations such as Linear/Jira/Notion only through ContentSignal/source contracts;
- add members/roles/comments/review workflows;
- add managed plans/billing after metering is trustworthy;
- add performance analytics only where official APIs and product value justify it.

Generation capability and publication capability remain separate truths. A destination can have a reviewable Content Pack while direct publishing remains unsupported/manual-only.

## 15. Gate 10 — release proof and operations

### Goal

Every advertised capability has reproducible, sanitized evidence and safe rollback/recovery behavior.

Required layers include:

- domain/unit tests;
- adapter/contract tests;
- integration tests;
- web/worker E2E;
- accessibility and visual regression;
- credential-backed model/source/connector acceptance where necessary;
- correlation IDs and redacted operational diagnostics;
- migration/backup/restore/rollback drills;
- Golden Path closing evidence.

Normal CI passing is necessary but not sufficient for a Golden Path that depends on real external credentials/side effects.

## 16. Personal Alpha cost boundaries

- prefer one strong configured writing/reasoning route before provider breadth;
- deterministic pre-filtering before expensive model calls;
- bounded evidence retrieval instead of dumping entire source archives;
- structured relational records before specialized vector infrastructure is justified;
- deterministic capture/render before generative video;
- bounded vision/media calls only when they add real value;
- durable jobs/idempotency so retries do not duplicate expensive or external work;
- cloud infrastructure should be introduced to support a proven owner slice, not because every SaaS system usually has it.

## 17. Owner data safety

Personal Alpha may process private plans, unpublished features, screenshots, repository context, destination credentials, and identity preferences.

Required throughout the execution plan:

- secret references rather than raw credentials in canonical records;
- no authorization headers/tokens/cookies in logs or release evidence;
- source- and workspace-scoped authorization;
- short-lived private media previews;
- no signed URLs as canonical Asset metadata;
- bounded capture targets and privacy checks;
- explicit source/privacy/rights state;
- no unapproved publication;
- truthful unknown/failure states;
- deletion/export paths appropriate to the data class;
- capability labels never outrun verified implementation.

## 18. Definition of “ready for me”

SignalFlow is ready for serious owner use only when this loop works repeatedly:

```text
I work
  ↓
SignalFlow finds or receives a worthwhile signal
  ↓
I choose a direction with minimal thought
  ↓
SignalFlow gathers the required evidence and produces the content/media itself
  ↓
I review one coherent campaign
  ↓
I approve exact revisions
  ↓
SignalFlow schedules/publishes them reliably
  ↓
It remembers only what actually happened and improves future recommendations
```

If the owner still routinely has to remember the post, gather the proof, screen-record, crop, format, schedule, and manually publish after SignalFlow generates copy, the product promise has not been achieved.

## 19. Per-slice completion rule

Do not close a product issue merely because isolated code exists.

A slice is complete only when, as applicable:

- issue acceptance criteria pass;
- required deterministic tests pass;
- existing relevant regressions remain green;
- production build/audit passes;
- the actual user flow is exercised;
- responsive/accessibility requirements are verified;
- secrets/private content are absent from logs/evidence;
- migration/recovery/idempotency behavior is handled;
- capability/public docs remain truthful;
- sanitized evidence is attached;
- `IMPLEMENTATION_LEDGER.md` records the verified result.

> **Primary execution rule:** finish the active Golden Path before expanding horizontally into attractive but non-blocking breadth.
