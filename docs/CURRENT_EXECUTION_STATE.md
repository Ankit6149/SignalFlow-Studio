# SignalFlow Studio — Current Execution State

> **Authoritative execution frontier as of 2026-09-04.**
>
> Read this before older handoffs, issue descriptions, or implementation ledgers when deciding what to build next. Canonical product documents still define the long-term architecture; this file defines the current shipped state, acceptance boundary, and sequencing.

## Current repository checkpoint

- Default branch: `master`
- Current production master: `47954ff92cede61966956dd3536ea92ac5ca3288` (PR #261)
- Vercel production: `dpl_7DCWxbrSPZxu8FD9A33fseTN9gDr`, READY on the exact current master SHA
- Master CI #886: frontend regression tests, production dependency audit, Next production build, Python tests, and MCP tests all green
- Production runtime verification after #261: no runtime error clusters and no warning/error/fatal logs in the inspected window
- Golden Path 1: **accepted**
- Gate A / GP2 automatic exact review: **released** via #259
- Gate B / GP2 automatic hosted preparation + resume: **released** via #261
- Gate C / real credential-backed GP2 acceptance: **active and blocked only on a real production GitHub App/source installation plus owner journey evidence**
- Gate D / repository and release hardening: **active**
- Golden Path 3 durable publication: **parked until Gate C is accepted**
- Direct Create unification: **after durable publication unless an acceptance blocker forces earlier work**

## Current product execution rule

SignalFlow is built vertically. Do not declare a Golden Path accepted from tests or fixtures when its definition requires a real credential-backed hosted run.

The current real target is:

```text
real GitHub App installation + selected repository
        ↓
verified real webhook delivery
        ↓
exactly one canonical ContentSignal with immutable source revision
        ↓
exact bounded repository evidence refresh
        ↓
ProjectContextSnapshot + ranked ContentOpportunity
        ↓
Today → owner angle judgment
        ↓
evidence-bound NarrativeStrategy
        ↓
automatic destination revision generation/reuse
        ↓
automatic required screenshot production/reuse
        ↓
private immutable AssetVersion + deterministic derivative
        ↓
exact media-bound PlatformVariantRevision
        ↓
automatic exact evidence/authenticity critics
        ↓
Today → exact owner judgment
```

## Gate status

### Gate A — automatic exact review before owner judgment

**Status: COMPLETE / RELEASED.**

PR #259 moved exact evidence/authenticity critics into preparation, including review reuse, fail-soft critic recovery, required-media deferral, automatic review after media rebound, and protection against presenting required-media-incomplete revisions as final owner judgment.

Release proof:

- frozen exact head `6df646f76151e6544dbd506eb7e41909b83cb8cd` passed original CI #877 and fresh CI #883;
- exact-head Vercel preview `dpl_HMsWGuR1mopcdyirW8XFiuBTjJLx` was READY and healthy;
- squash merge produced `beefe536ff0aa496442df8d151562b958a74cb48`;
- post-merge master CI #884 passed;
- production `dpl_H35QrfASiBX7WRsm2jCmqvdSGhxG` was READY on that exact SHA.

### Gate B — automatic hosted preparation after strategy approval

**Status: COMPLETE / RELEASED.**

PR #261 completed the low-attention continuation:

`approved NarrativeStrategy → generate/reuse non-omitted destination revisions → produce/reuse required screenshot → bind exact derivative → run/reuse exact critics → Today`.

Normal workflow no longer requires routine `Generate drafts`, `Prepare visual proof`, or `Retry exact checks` clicks. Those controls remain recovery/override paths. Reopening an approved Plan automatically resumes the same idempotent preparation application.

Release proof:

- clean release head `b9dd4e93acc1883ca2ac89664fbf8ae6c55cb27b` was rebuilt as one commit directly on released master with exactly 10 Gate-B files;
- CI #885 passed frontend regressions, dependency audit, production build, Python, and MCP;
- exact-head Vercel preview `dpl_7ZBxDeemDZok2itS1BtQFEJwhcQ8` was READY and healthy;
- squash merge produced current master `47954ff92cede61966956dd3536ea92ac5ca3288`;
- master CI #886 passed;
- production `dpl_7DCWxbrSPZxu8FD9A33fseTN9gDr` is READY on that exact SHA;
- production runtime inspection is clean.

### Gate C — real GP2 owner acceptance

**Status: ACTIVE / NOT ACCEPTED.**

The code path is materially complete, but acceptance cannot be manufactured from unit tests or the ChatGPT GitHub connector. The SignalFlow production source database was inspected on 2026-09-04 and currently contains:

- 0 `sf_source_connections` rows;
- 0 `sf_source_connection_resources` rows;
- 0 `sf_content_signals` rows;
- 0 `sf_source_artifacts` rows;
- 0 `sf_project_context_snapshots` rows;
- 0 `sf_content_opportunities` rows;
- 0 `sf_signal_opportunity_jobs` rows.

Therefore no SignalFlow GitHub App installation/repository scope exists in the production workspace yet, and the #261 merge could not have entered SignalFlow as a real webhook event.

Do **not** close #167 until the real owner-authorized journey is evidenced in `docs/acceptance/GOLDEN_PATH_2_OWNER_ACCEPTANCE.md`, including:

1. production readiness;
2. GitHub App installation and exact repository selection;
3. real meaningful merged PR or immutable release delivery;
4. exactly one canonical signal and duplicate-delivery idempotency;
5. low-value/noise event kept non-promotional;
6. exact evidence snapshot and ranked Today opportunity;
7. explicit owner angle;
8. evidence-bound approved NarrativeStrategy;
9. automatic screenshot/private AssetVersion/derivative when the story needs visual proof;
10. exact LinkedIn/X review and owner judgment;
11. refresh/reopen/retry/stale/privacy/partial-failure acceptance;
12. sanitized closing evidence.

### Gate D — repository and release hardening

**Status: ACTIVE.**

Completed in the current pass:

- obsolete Sep-2 documentation PR #260 was closed without merge rather than allowing stale frozen-candidate truth onto master;
- current execution truth is being replaced from the exact production master, not rebased from stale handoff history;
- release discipline remains exact-SHA preview → guarded merge → master CI → production exact-SHA READY → runtime inspection.

Outstanding GitHub administration items:

- protect `master` and require CI before merge;
- enable automatic deletion of merged head branches;
- remove merged/validation branches left by #259/#261 and temporary validation work.

The connected GitHub automation available in this execution environment can read branch protection and mutate PRs/files/refs, but does not expose branch deletion or branch-protection writes. Do not mark those two administration items complete until GitHub settings actually show them enabled/applied.

### Gate E — Golden Path 3 durable publication

**Status: PARKED until Gate C acceptance.**

Target:

```text
exact approved revision
→ immutable PublicationRequest
→ durable enqueue/worker
→ one real destination connector
→ CONFIRMED | FAILED | UNKNOWN external outcome
→ Publication record
→ NarrativeMemory becomes confirmed-public only after CONFIRMED
```

Important rule: timeout/ambiguous provider response must become `UNKNOWN`; never blindly retry when the provider may already have accepted the publication.

### Gate F — Direct Create unification

**Status: PLANNED after publication vertical.**

Target:

`Post about X + images/video/files/links → media intent → ContentPiece/NarrativeStrategy → same immutable destination revisions → same exact review → same publication path`.

Do not build a second editor/generator/review pipeline for Direct Create.

## Repository truth rules

### Backlog priority inflation

The repository still has roughly 110 open issues. `[P0]`/`[P1]` labels in old titles do not mean simultaneous current execution. Classify work as:

1. active Golden Path blocker;
2. parent/architectural requirement;
3. future roadmap;
4. acceptance-complete, superseded, duplicate, or historical cleanup candidate.

### Branch truth

Current branch inventory still contains merged and temporary Gate-A/Gate-B branches in addition to `master` and the intentionally parked `feat/editorial-execution-layer`. These should be deleted once repository tooling/settings permit. Branch existence is not roadmap state.

### Deployment truth

A merge is not shipped until Vercel production reports READY on the exact intended `master` SHA. A prior preview, prior production deployment, or green build on another SHA does not satisfy the gate.

### Documentation truth

When sources disagree, use this priority:

1. current production code + tests + verified runtime/acceptance evidence;
2. this file;
3. current acceptance ledgers/capability docs;
4. canonical product architecture for intended direction;
5. old issue bodies and old handoffs for historical requirements only.

## Immediate execution order

1. Finish Gate D repository-truth cleanup that does not alter product sequencing.
2. Owner installs/connects the SignalFlow GitHub App to the intended repository in production.
3. Run Gate C end-to-end with a real meaningful event + duplicate/noise proof and record the evidence.
4. Close #167 only when its definition of done is genuinely satisfied.
5. Begin Gate E durable publication vertical.
6. After publication is dependable, unify Gate F Direct Create onto the same domain/application path.
7. Broader media/video/mobile/desktop/local-model/SaaS work follows these Golden Paths rather than interrupting them.
