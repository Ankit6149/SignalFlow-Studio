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
| Current master SHA | `4ddf7486b48c995ecd351e0a8704c6bd238309b3` |
| Current master change | #353 — extracted Studio API client; `page.js` now has zero direct `fetch()` calls |
| Production SHA | `8a3cb236dd1b228652643e9f4d5fa8baf60cf251` |
| Production deployment | `dpl_jA3K3KXbbCf66n8mEESLVK9xybPs` — READY |
| Production change | #337 — hosted strategy planning through MCP |
| Master ↔ production | **Diverged** |
| Deployment blocker | Vercel free deployment/build daily rate limit; do not interpret this as an application test failure |
| Golden Path 1 | Accepted |
| Golden Path 2 | Active; not accepted |
| Golden Path 3 | Not started end to end |
| Repository hygiene | Active under #340; truth/docs/dead-code/runtime/extension/governance + first #45 slice merged |
| Open PRs | #315 only; intentionally reserved |
| Production runtime errors | None found in the current 7-day Vercel error window |
| GitHub `master` protection | Disabled; required checks are not enforced by branch protection |
| GitHub merge modes | squash, merge-commit and rebase are all currently enabled |

Do not claim a merged change is live until the production deployment SHA matches it.

## Repository hygiene progress

Completed/merged during #340:

- #353 — extracted Studio transport into `studioApiClient.mjs`; `page.js` dropped 2,881 → 2,800 lines and direct `fetch()` calls 9 → 0;
- #352 — strengthened the PR template with issue ownership, truth-level, validation, deployment/acceptance and remaining-work gates;
- #351 — retired the stale 2026-09-20 next-chat handoff to a short historical pointer;
- #350 — made the browser extension explicitly experimental and guarded against capture/delivery overclaims;
- #349 — removed unsupported Go/protobuf/Rust runtime scaffolds while retaining the tested Python scan/render/record utility path;
- #348 — removed 4,631 lines of verified-unreachable pre-Content-OS UI and added absence guards;
- #347 — reconciled public product/AI/crawler metadata and added root/deployed metadata-parity CI;
- #343 — upgraded Next.js 16.3.4 → 16.3.6 to clear the critical ImageResponse RCE advisory exposed by CI;
- #342 — added granular owner-scoped hosted-record capability reporting while preserving browser-local Campaign semantics;
- #341/#344 — replaced and refreshed stale execution-state control-plane truth;
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

There are currently **25 branch refs including `master`**. Only `master` and the reserved Gate-C branch have current execution purpose; the rest are merged/history or verified retirement residue.

Intentional branches:

- `master`;
- `feat/refine-workspace-loader-gate-c-20260915` — reserved #315.

Branches already classified as deletion candidates after verification now also include the merged #347–#353 cleanup/refactor branches in addition to the earlier #313/#314/#316/#317/#318/#321/#339/#341/#342/#343 residue and the zero-ahead GP2 ledger branch.

`feat/editorial-execution-layer` was forensically reviewed. Nearly all of its changed paths are already identical to or superseded by current master. Its only branch-only domain module, `distributionPlanning.mjs`, belongs to later editorial-calendar/publication work and is not accepted GP2 scope. **Retire this branch rather than rescuing it wholesale.**

The currently connected GitHub action surface cannot delete branch refs. The branch decisions are recorded in #340; actual ref deletion remains a mechanical cleanup step on a GitHub surface with ref-deletion permission.

## Production divergence

Current production is healthy and Vercel reports no grouped runtime errors in the current 7-day window, but production remains on `8a3cb236…` (#337) while master is `4ddf7486…` (#353).

Recent Preview deployments continue to be canceled/blocked while the account is constrained by the deployment/build quota.

Do not repeatedly trigger deployments to work around the quota.

When the limit permits:

1. deploy/reconcile current `master`;
2. verify exact production SHA;
3. inspect runtime errors and capability output;
4. update this checkpoint only after production truth is known.

## Immediate execution order

1. Continue #45 decomposition with Library/Connections/Settings route-level presentation extraction; keep behavior unchanged.
2. Execute #44 CSS authority consolidation after component ownership is clearer. Current audit found 91 class names spanning multiple global stylesheet layers.
3. Reconcile GitHub About description/topics, which still use old autoposting/post-generator/FastAPI positioning.
4. Mechanically delete verified merged/history branches when a ref-deletion surface is available.
5. Add real `master` protection/ruleset enforcement through a GitHub admin surface; the current connected GitHub App cannot write repository administration settings.
6. Reverify GP2 runtime prerequisites.
7. Refresh #315 from then-current master only when the acceptance run is ready.
8. Complete positive + noise-control GP2 evidence.
9. Reconcile production to an exact current master SHA.
10. Perform the final cross-repository audit and close #340 only with evidence.

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


## Residual repository metadata / governance debt

Verified on 2026-10-04:

- GitHub repository description still says “Local-first autoposting workspace…”;
- GitHub topics still include obsolete framing such as `autoposting`, `post-generator`, `gif-generator`, `fastapi`, and `social-media-automation`;
- `master` is not protected;
- squash merge is enabled, but merge-commit and rebase merge are also enabled;
- branch deletion on merge is disabled;
- repository ref deletion and admin protection writes are not exposed by the current connected GitHub App.

Do not mark Areas B/D/F complete until those external repository settings are reconciled or explicitly accepted as manual/admin work.
