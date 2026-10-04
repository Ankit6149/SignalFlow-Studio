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
| Current code checkpoint | `a5e76aa41950510bc2283774dd40780c6a0bcb1d` |
| Current code checkpoint change | #382 — extracted provider/model-route state ownership into `useProviderRouteController` |
| Production SHA | `e958cd27b45579be0a6d81bfcd6281bb9fd9dcb1` |
| Production deployment | `dpl_99MuHiAYTAEoAc8rdvU6bR2a3UMg` — READY |
| Production change | #358 — Source stage presentation boundary |
| Master ↔ production | **Split** — production is behind the #382 code checkpoint |
| Deployment status | Latest verified production is READY at #358; recent cleanup previews are canceled/ignored or quota-limited and do not prove #359–#382 deployment |
| Golden Path 1 | Accepted |
| Golden Path 2 | Active; not accepted |
| Golden Path 3 | Not started end to end |
| Repository hygiene | Active under #340; cleanup is through #382; #44 architecture consolidation is complete and awaits current-SHA visual acceptance, while #45 remains at its controller/state-ownership decision point |
| Open PRs | #315 only; intentionally reserved |
| Production runtime errors | None found in the current 7-day Vercel error window |
| GitHub `master` protection | Disabled; required checks are not enforced by branch protection |
| GitHub merge modes | squash, merge-commit and rebase are all currently enabled |

Do not claim a merged change is live until the production deployment SHA matches it.

## Repository hygiene progress

Completed/merged during #340:

- #382 — extracted provider/model-route controller ownership into `useProviderRouteController`; `page.js` is now 1,622 lines and full GitHub CI passed;
- #380 — eliminated the final exact selector overlap between `app-workspace.css` and `studio-product.css` (22 → 0) and added a CI invariant preventing duplicate selectors from returning;
- #379 — scoped Studio frame/heading/workflow-rail authority to the staged Studio surface, reducing exact cross-layer selector overlap 34 → 22;
- #378 — retired `studio-decision-flow.css` by folding final Source/Destinations/Review composition into `studio-product.css`; root CSS imports dropped 4 → 3;
- #377 — retired `responsive-studio.css`; Studio breakpoints moved into `studio-product.css`, reduced-motion moved into `app-workspace.css`, and root CSS imports dropped 5 → 4;
- #374 — moved all remaining non-media responsive base rules into `app-workspace.css`; `responsive-studio.css` is now breakpoint-only plus reduced-motion at 174 lines; full GitHub CI passed;
- #373 — moved shared workspace containment/intrinsic sizing/long-content resilience into `app-workspace.css`; `responsive-studio.css` dropped from 336 to 235 lines; full GitHub CI passed after reconciling the stale responsive contract test;
- #372 — scoped RegenerationDialog viewport containment into `RegenerationDialog.module.css`; `responsive-studio.css` dropped from 351 to 336 lines; full GitHub CI passed;
- #371 — refreshed this execution control plane against the verified #370 code checkpoint / #358 production split;
- #370 — moved secondary-route page-frame/heading responsive authority into `app-workspace.css`; `responsive-studio.css` is now 351 lines;
- #369 — moved Library/Connections/Settings responsive ownership into `app-workspace.css`;
- #368 — moved responsive application chrome ownership into `app-workspace.css`;
- #367 — extracted `RegenerationDialog` with scoped module styling and removed `campaign-versioning.css`; root CSS imports are now 5 and `page.js` is 1,706 lines;
- #366/#365/#364 — moved Review/Source state and freshness/version-history styling into component modules;
- #363/#362/#361 — removed public-surfaces/ui-containment/connector global layers after moving their behavior to scoped owners;
- #360/#359/#358/#357 — extracted Review, Destinations, Source, and Studio catalog presentation boundaries while keeping orchestration in the controller;
- #355 — extracted Library/Connections/Settings presentation; `page.js` is now 2,488 lines, down from 2,881 at cleanup start;
- #354 — refreshed execution truth against the post-#353 repository/deployment/governance state;
- #353 — extracted Studio transport into `studioApiClient.mjs`; direct `fetch()` calls in `page.js` dropped 9 → 0;
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

At the #374 code checkpoint there were **46 branch refs including `master`**; the count can increase when cleanup PR branches cannot be deleted through the connected GitHub surface. The stable execution truth is that only `master` and the reserved Gate-C branch have current execution purpose; the rest are merged/history or verified retirement residue.

Intentional branches:

- `master`;
- `feat/refine-workspace-loader-gate-c-20260915` — reserved #315.

Branches already classified as deletion candidates after verification now also include the merged #347–#355 cleanup/refactor branches in addition to the earlier #313/#314/#316/#317/#318/#321/#339/#341/#342/#343 residue and the zero-ahead GP2 ledger branch.

`feat/editorial-execution-layer` was forensically reviewed. Nearly all of its changed paths are already identical to or superseded by current master. Its only branch-only domain module, `distributionPlanning.mjs`, belongs to later editorial-calendar/publication work and is not accepted GP2 scope. **Retire this branch rather than rescuing it wholesale.**

The currently connected GitHub action surface cannot delete branch refs. The branch decisions are recorded in #340; actual ref deletion remains a mechanical cleanup step on a GitHub surface with ref-deletion permission.

## Production alignment

Production is currently **behind the #382 code checkpoint**.

Verified on 2026-10-04:

- code checkpoint SHA: `a5e76aa41950510bc2283774dd40780c6a0bcb1d` (#382);
- latest READY production SHA: `e958cd27b45579be0a6d81bfcd6281bb9fd9dcb1` (#358);
- production deployment: `dpl_99MuHiAYTAEoAc8rdvU6bR2a3UMg`;
- recent cleanup previews include canceled/ignored deployments; Vercel quota/check noise must remain distinct from GitHub CI and from production runtime failure.

Do not claim #359–#382 are live until an exact-SHA production deployment proves it. Deployment still does not imply GP2 owner acceptance.

## Current #44 measured CSS frontier

Verified after #380:

- root CSS imports are **3**: `globals.css` → `app-workspace.css` → `studio-product.css`;
- `responsive-studio.css` is retired;
- `studio-decision-flow.css` is retired;
- exact selectors shared by `app-workspace.css` and `studio-product.css`: **0**, enforced by CI;
- shared shell/component primitives remain in `app-workspace.css`;
- Studio-only composition is scoped beneath the staged Studio surface in `studio-product.css`;
- `page.js` is **1,622 lines** after #382; provider/model-route ownership is now separated, while remaining state families still require individual coupling decisions.

The architecture portion of #44 is complete. Do not close #44 until current-SHA visual evidence covers desktop/tablet/mobile, 200% zoom, and long-content states. Current production remains #358, so existing production visuals cannot prove the #380 CSS state.

## GP2 runtime recheck — 2026-10-04

Reverified against the current production deployment (#358):

- deployment `dpl_99MuHiAYTAEoAc8rdvU6bR2a3UMg` remains **READY** at `e958cd27b45579be0a6d81bfcd6281bb9fd9dcb1`;
- Vercel reports **no production runtime errors** in the available 7-day window;
- project deployment protection has Vercel SSO enabled for `all_except_custom_domains`;
- the connected Vercel surface is not permitted to list/decrypt project environment variables;
- the protected production capability/readiness endpoints cannot be queried anonymously from the current browser/fetch surfaces;
- no retained production invocation evidence for `/api/gp2/readiness` was available within the plan's runtime-log retention.

Therefore hosted inference authorization and the CDP capture path remain **not currently verified**, not failed. Do not refresh reserved #315 or claim GP2 readiness until an authenticated owner-session readiness probe is captured.

## Immediate execution order

1. Keep #44 open only for current-SHA visual/responsive acceptance evidence; do not restart CSS architecture work unless evidence exposes a concrete defect.
2. Continue #45 only by cohesive state family. #382 extracted provider/model-route ownership; do not replace the remaining controller with one monolithic mega-hook.
3. Reconcile GitHub About description/topics, which still use old autoposting/post-generator/FastAPI positioning.
4. Mechanically delete verified merged/history branches when a ref-deletion surface is available.
5. Add real `master` protection/ruleset enforcement through a GitHub admin surface; the current connected GitHub App cannot write repository administration settings.
6. Reverify GP2 runtime prerequisites against the current production checkpoint before refreshing reserved #315.
7. Complete positive + noise-control GP2 evidence.
8. Perform the final cross-repository audit and close #340 only with evidence.

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
