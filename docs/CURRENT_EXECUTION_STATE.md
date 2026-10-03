# SignalFlow Studio — Current Execution State

> **Authoritative execution frontier as of 2026-10-04.**
>
> Use this file for the current repository, deployment and owner-acceptance state. Product/architecture documents define target behavior; this file records only the active execution frontier.
>
> Truth precedence:
>
> ```text
> live runtime
> → deployed production SHA
> → master
> → current acceptance evidence
> → capability/execution docs
> → roadmap/README
> → historical issues and notes
> ```
>
> Planned ≠ coded ≠ merged ≠ deployed ≠ accepted.

> `docs/NEXT_CHAT_HANDOFF.md` is a retired historical pointer, not current execution authority.

## Current checkpoint

| Item | Current state |
| --- | --- |
| Default branch | `master` |
| Latest functional/code checkpoint | `32b45e7cc07a0feec17bb23cc5f72ee3b2e29d3d` — #339 hosted review retrieval + deterministic MCP export |
| Execution-state note | This documentation revision follows that code checkpoint; use `master` itself for the exact current ref SHA |
| Production SHA | `8a3cb236dd1b228652643e9f4d5fa8baf60cf251` |
| Production deployment | `dpl_jA3K3KXbbCf66n8mEESLVK9xybPs` — READY |
| Production change | #337 — hosted strategy planning through MCP |
| Master ↔ production | **Diverged** |
| Deployment blocker | Vercel free deployment/build daily rate limit; do not interpret this as an application test failure |
| Golden Path 1 | Accepted |
| Golden Path 2 | Active; not accepted |
| Golden Path 3 | Not started end to end |
| Repository hygiene | Active under #340 |
| Open PRs | #315 only; intentionally reserved |

Do not claim a merged change is live until the production deployment SHA matches it.

## Repository hygiene progress

Completed/merged during #340:

- #343 — upgraded Next.js 16.3.4 → 16.3.6 to clear the critical ImageResponse RCE advisory exposed by CI;
- #341 — replaced stale execution-state control-plane truth;
- #342 — added granular owner-scoped hosted-record capability reporting while preserving browser-local Campaign semantics;
- #339 — completed the current MCP review/export parity slice and fixed two CI integration defects discovered during reconciliation.

Current issue reconciliation has updated the stale scope/status of #34, #35, #44, #45, #53, #135, #153–#159, #161, #163, #167, #209, #214 and #222. #137 was closed as superseded by #209 rather than treated as completed functionality.

## Pull requests

### #315 — RESERVED / DO NOT MERGE

`feat/refine-workspace-loader-gate-c-20260915` is the controlled GP2 positive acceptance event.

Current rules:

- it is not ordinary UI cleanup;
- it remains intentionally unmerged;
- it is behind current master and must be refreshed from then-current `master` immediately before the final Gate-C run;
- its intended event remains limited to `frontend/app/loading.js` and `frontend/app/state.module.css`;
- refresh/CI/preview readiness does not replace the required live GP2 acceptance evidence.

Required before merge:

1. current production/runtime prerequisites reverified;
2. hosted inference authorized and operational;
3. live bounded screenshot/CDP path ready;
4. branch refreshed onto current master;
5. normal CI/build/security gates green;
6. acceptance observer/evidence path ready.

## Golden Path 2

**Status: active and not owner-accepted.**

Closing authority remains:

- #161 — GitHub connected-source ingestion;
- #163 — campaign-ready screenshot/media proof;
- #167 — Golden Path 2;
- `docs/acceptance/GOLDEN_PATH_2_OWNER_ACCEPTANCE.md`.

Historical production evidence from 2026-09-16 proved real GitHub ingestion and identified hosted inference + remote CDP as blockers at that time. Reverify current runtime state before acting; do not assume historical blockers or recoveries are unchanged.

The closing journey remains:

```text
real GitHub event
→ canonical ContentSignal at exact revision
→ bounded evidence + ProjectContext
→ worthwhile ContentOpportunity
→ owner angle decision
→ NarrativeStrategy
→ exact LinkedIn/X revisions
→ automatic screenshot when justified
→ private immutable Asset / derivative
→ exact text + media review
→ owner approve / change / reject
```

A separate low-value/noise event must prove non-promotion.

## Capability truth

`frontend/app/api/capabilities/route.js` remains the runtime discovery surface.

The capability contract now distinguishes:

- general Campaign cloud persistence/autosave/collaboration — still unavailable;
- owner-scoped hosted connected-source persistence;
- hosted ContentSignal / ProjectContext / ContentOpportunity records;
- hosted planning records;
- hosted exact-review records;
- durable opportunity-job state;
- hosted private Asset persistence.

Runtime configuration is not the same thing as production acceptance. In particular, durable database-backed job state does not imply an always-on worker.

## Issue frontier

At the start of #340 there were 96 open issues with no effective labels/milestones and several generations of planning mixed together.

Do not treat all open issues as simultaneous execution.

Current practical frontier:

- #340 — repository hygiene/reconciliation;
- #167 — GP2 acceptance;
- #161 — GitHub source slice;
- #163 — screenshot/media slice;
- #222 — repository onboarding/project-context outcome;
- #35 — MCP residual external-client/auth/cost/saved-Campaign acceptance;
- #34 — remaining request-rate/concurrent-campaign/cost controls;
- #135 — landing acceptance review rather than another rebuild;
- #209 — UI consolidation parent;
- #44 — CSS authority cleanup;
- #45 — client decomposition.

Broader cloud/media/mobile/collaboration/destination expansion remains later unless it becomes a direct prerequisite for the active owner journey.

## Branch truth

There are currently 14 branch refs including `master`. Most are merged/history residue.

Intentional branches:

- `master`;
- `feat/refine-workspace-loader-gate-c-20260915` — reserved #315.

Branches already classified as deletion candidates after verification include merged #313/#314/#316/#317/#318/#321/#341/#342/#343 work plus the zero-ahead GP2 ledger branch and the merged #339 branch.

`feat/editorial-execution-layer` was forensically reviewed. Nearly all of its changed paths are already identical to or superseded by current master. Its only branch-only domain module, `distributionPlanning.mjs`, belongs to later editorial-calendar/publication work and is not accepted GP2 scope. **Retire this branch rather than rescuing it wholesale.**

The currently connected GitHub action surface cannot delete branch refs. The branch decisions are recorded in #340; actual ref deletion remains a mechanical cleanup step on a GitHub surface with ref-deletion permission.

## Production divergence

Current production is healthy but behind master because the Vercel account hit its free daily deployment/build limit.

Do not repeatedly trigger deployments to work around the quota.

When the limit permits:

1. deploy/reconcile current `master`;
2. verify exact production SHA;
3. inspect runtime errors and capability output;
4. update this checkpoint only after production truth is known.

## Immediate execution order

1. Finish #340 issue/branch/documentation reconciliation.
2. Reconcile public repository/product metadata with the Content Operating System direction.
3. Classify/remove dead or experimental source surfaces after dependency verification.
4. Execute #45 client decomposition and #44 CSS authority consolidation as behavior-preserving architecture work under #209.
5. Reverify GP2 runtime prerequisites.
6. Refresh #315 from then-current master only when the acceptance run is ready.
7. Complete positive + noise-control GP2 evidence.
8. Reconcile production to an exact current master SHA.
9. Perform the final cross-repository audit and close #340 only with evidence.

## Release discipline

For every active slice:

```text
current verified problem
→ smallest truthful change
→ focused tests + normal CI
→ preview/deployment verification where available
→ merge
→ production exact-SHA verification
→ runtime/data inspection
→ real acceptance where required
→ update execution truth
```

Repository cleanup is complete only when the resulting state is simpler, truthful and verifiable, not merely when files, branches or issues have been removed.
