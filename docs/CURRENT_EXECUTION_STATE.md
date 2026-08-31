# SignalFlow Studio — Current Execution State

> **Authoritative execution frontier as of 2026-08-31.**
>
> Read this file before `AGENTS.md`, roadmap epics, or older implementation ledgers when deciding what to build next. Canonical product documents still define the long-term architecture; this file defines the current implementation frontier and sequencing.

## Current repository checkpoint

- Default branch: `master`
- Audited master checkpoint: `691fd28184f96d75860b2d4eb5a7135f7acd17d8` (merged PR #250)
- Golden Path 1: **accepted**
- Golden Path 2: **active; not yet owner-accepted end to end**
- Golden Path 3: **next after GP2 acceptance, not the current build slice**
- Open PRs at this checkpoint: **0** after stale landing PR #236 was closed without merge
- CI gate on current work: frontend regression tests + production dependency audit + production build + Python tests + MCP tests

## Current product execution rule

SignalFlow is built vertically. Do not open another broad horizontal foundation phase while the active Golden Path still lacks owner acceptance.

The current active outcome is:

```text
connected/hosted opportunity
        ↓
NarrativeStrategy + PlatformVariant revision
        ↓
media requirement = product screenshot when justified
        ↓
exact CaptureRecipe / CaptureJob
        ↓
claim the exact durable job
        ↓
bounded browser screenshot capture
        ↓
private immutable AssetVersion
        ↓
quality/privacy evaluation
        ↓
deterministic platform-safe derivative
        ↓
exact media binding
        ↓
new immutable PlatformVariantRevision
        ↓
protected exact-media owner preview
        ↓
approve / change / reject
        ↓
owner acceptance proof
```

## Golden Path status

### Golden Path 1 — manual thought to exact approved content

**Status: accepted / properly built for its defined owner-first vertical.**

Implemented and accepted behavior includes:

- manual ContentSignal intake;
- Signal → opportunity/angle planning;
- explicit owner Voice/Identity profile use;
- approved NarrativeStrategy;
- destination-specific LinkedIn/X PlatformVariant revisions;
- evidence/authenticity critics;
- immutable edit/regeneration/change-request behavior;
- exact revision approve/reject semantics;
- owner-facing Today/Plan continuity for the accepted vertical.

Do not rebuild GP1 foundations merely because older parent issues remain open.

### Golden Path 2 — connected work to screenshot-backed exact review

**Status: active / substantially built, but not yet complete end to end.**

Merged foundation and production slices:

- #238 — media intelligence + durable jobs + bounded CaptureRecipe/CaptureJob foundation;
- #239 — private hosted Asset storage foundation;
- #241 — real bounded CDP screenshot worker, same-origin/privacy checks, private canonical capture Asset persistence and provenance;
- #244 — screenshot quality evaluation + deterministic derivative planning/rendering + lineage;
- #245 — exact screenshot AssetVersion/derivative lineage bound to immutable PlatformVariantRevision; local/browser exact-media approval gate;
- #246 — hosted protected exact AssetVersion preview boundary with server-only private storage composition;
- #247 — runtime-injectable exact-media preview seam;
- #248 — durable hosted PlatformVariant generation/review/approval state with stale-current guards;
- #249 — owner-facing hosted review UI, protected exact-byte preview, revision-bound visibility receipts and fail-closed media approval;
- #250 — exact durable-job `claimById(jobId)` semantics for request-scoped capture orchestration.

**Current missing production slice:** compose the already-built pieces into one hosted operation that starts from one exact PlatformVariant revision and executes:

```text
exact capture request
→ exact durable-job claim
→ capture
→ private AssetVersion
→ quality/privacy result
→ deterministic derivative
→ exact media binding
→ new immutable PlatformVariantRevision
```

After that slice, GP2 still requires real owner acceptance covering refresh/reopen, retry, duplicate delivery, privacy blocking, stale revision behavior, partial/failure outcomes, and a real authorized source/capture fixture. Record the proof in `docs/acceptance/GOLDEN_PATH_2_OWNER_ACCEPTANCE.md`.

Keep #163 and #167 open until that acceptance is real.

### Golden Path 3 — exact approval to durable publication

**Status: planned next; not current execution.**

Target vertical:

```text
exact approved text revision + exact approved media revision
        ↓
editorial timing / Calendar entry
        ↓
immutable PublicationRequest
        ↓
durable publication execution
        ↓
confirmed / failed / unknown external outcome
        ↓
NarrativeMemory becomes confirmed-public only after external confirmation
```

Do not begin broad calendar/publishing expansion before GP2 owner acceptance.

## Repository truth problems to prevent

### Backlog priority inflation

At the audit checkpoint the issue register contained approximately 110 open issues, including 44 issue titles marked `[P0]` and 46 marked `[P1]`. This does not represent 90 simultaneous execution priorities.

Treat issues as one of:

1. **Active Golden Path blockers** — current execution;
2. **parent epics / architectural requirements** — retained for traceability;
3. **future roadmap** — not current;
4. **historical / acceptance-complete / superseded** — verify and close deliberately.

Never select work only because an old issue title says P0.

### Branch accumulation

The audited repository had 73 branches, mostly historical merged/superseded implementation branches. Development branches are temporary artifacts, not roadmap state.

After a PR is merged and production/acceptance evidence is recorded, delete its head branch unless it has an explicit continuing purpose.

### Deployment truth

At this checkpoint Vercel production was still on `2ea1c34f47d1946d9cabff4fc7897f325f5e0883` (PR #247) while GitHub `master` was already at #250. Preview deployments for the later slices were building successfully.

A change is not considered shipped merely because it merged. Release verification must prove that the production deployment SHA equals the intended approved `master` SHA.

### Documentation truth

Older ledgers and portions of `AGENTS.md` may describe a capability as unimplemented even after later GP2 slices landed. Use this priority when sources disagree:

1. current code + tests + accepted production evidence;
2. this execution-state file;
3. capability matrix / current implementation docs;
4. canonical product documents for direction;
5. old issue bodies / historical ledgers for requirements and history.

Do not claim target architecture as shipped merely because a document defines it.

## Not the next build slice

Unless a direct blocker is discovered, do **not** switch current execution to:

- screencast/video editing/rendering;
- carousel expansion beyond requirements needed by the active path;
- mobile application;
- Desktop Edge Agent;
- local/private model packs;
- broad provider-routing redesign;
- general calendar expansion;
- broad social-connector coverage;
- large legacy Studio rewrite;
- another landing-page redesign;
- large cross-cutting refactor performed only for cleanliness.

These remain valid roadmap areas, but they must not interrupt GP2 closure.

## Merge and release discipline

For every current product slice:

```text
issue acceptance criteria
→ focused branch
→ implementation
→ focused + regression tests
→ PR
→ green CI
→ preview verification when applicable
→ merge
→ verify production SHA / runtime when intended for production
→ record owner acceptance when the issue requires it
→ close only acceptance-complete issues
→ delete merged branch
→ update execution/capability truth
```

`master` should be protected with required CI checks and pull-request-based changes. Repository settings should also automatically delete merged head branches. These are repository settings and must be configured in GitHub if the available automation cannot mutate them.

## Immediate execution order

1. Keep repository truth synchronized and remove clearly historical noise.
2. Build the hosted GP2 screenshot orchestration slice directly after #250.
3. Run and document GP2 owner acceptance; close only issues whose complete definitions of done are satisfied.
4. Reconcile remaining open issues into active / parent / later / close categories.
5. Begin GP3 durable publication vertical.
6. After GP2/GP3 product behavior is dependable, decompose legacy UI/code debt and continue broader roadmap work.
