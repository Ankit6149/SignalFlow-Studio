# SignalFlow Studio — Current Execution State

> **Authoritative execution frontier as of 2026-11-10.**
>
> This is the only short-lived repository status document. Architecture/product documents describe target design; this file records what is merged, deployed, accepted, blocked, and next.
>
> Truth order: live runtime → deployed production SHA → `master` → acceptance evidence → capability/execution docs → roadmap/README → historical notes.
>
> Planned ≠ coded ≠ merged ≠ deployed ≠ accepted.

## Current checkpoint

| Item | Current truth |
| --- | --- |
| Default branch | `master` |
| Latest product-code checkpoint | `612875aef4104a679a3e59c9b46215952fce2870` — #412 AI Gateway model-eligibility readiness |
| Dependency-security checkpoint | `97e56344a36e051cea170f3b85267f10d3ce7f10` — #413 Next.js 16.4.5 / current critical-high production audit baseline, included in current `master` |
| Runtime checkpoint | #412 is READY in production at `dpl_3r5QKunB2djGsdeo1gX7nDQQ7uEY` |
| Post-reconciliation checkpoint | `repo-hygiene-2026-10-05` — immutable repository-reconciliation tag created by #405 |
| Runtime/code relationship | **Aligned at #412.** Current READY production matches current code-bearing `master`; documentation-only commits may advance `master` without a new deployment when the Vercel guard proves `frontend/` is unchanged. |
| Intentional branches | `master`; `feat/refine-workspace-loader-gate-c-20260915` only |
| Open PRs | #315 only — reserved / DO NOT MERGE |
| Golden Path 1 | Accepted |
| Golden Path 2 | Active; not owner-accepted |
| Golden Path 3 | Not accepted end to end |
| Repo-hygiene control issue | #340 — final closeout |
| Client decomposition | #45 closed complete |
| Landing rebuild | #135 closed complete |
| CSS architecture | #44 architecture complete; #404 live desktop overflow defect fixed/verified; explicit tablet/mobile + 200% zoom capture remains acceptance-only |
| No-Playwright rule | Preserved; unsupported Playwright capture remains absent |

## Repository hygiene outcome

The repository reconciliation sprint removed competing implementations and stale control-plane state instead of merely moving files around.

### Source tree

- verified-dead pre-Content-OS UI was removed;
- unsupported Go/protobuf/Rust product-runtime scaffolding was retired;
- browser extension support is explicitly experimental rather than silently overstated;
- Python remains utility-only for maintained scan/render/record paths;
- Studio network transport, static catalog, stage presentation, provider routing, owner/connectors, route-surviving editor state, persistence/export, generation, publishing/manual handoff, source intake, and Review coordination each have explicit owners;
- `/`, `/studio`, `/library`, `/connections`, and `/settings` have explicit route ownership;
- `StudioRootController.js` is **714 lines**, down from the earlier monolithic application controller, and now serves as Create composition/orchestration rather than a hidden second application.

Current controller boundaries:

- `useProviderRouteController`
- `useOwnerConnectionsController`
- `CampaignEditorSessionProvider`
- `useCampaignPersistenceController`
- `useCampaignGenerationController`
- `useCampaignPublishingController`
- `useCampaignSourceController`
- `useCampaignReviewController`

Further splitting purely to reduce line count is not a cleanup objective.

### Documentation and maintenance structure

- `docs/README.md` is the documentation map and separates current authorities from historical/reference documents;
- `docs/CURRENT_EXECUTION_STATE.md` remains the only short-lived execution-state authority;
- `docs/ISSUE_TRIAGE.md` remains the scheduling authority for open work;
- the former `IMPLEMENTATION_LEDGER.md` is now a historical pointer instead of a competing stale current-status source;
- the one-shot reconciliation-checkpoint workflow was removed after `repo-hygiene-2026-10-05` was verified;
- branch pruning no longer carries hard-coded retired branch names; it deletes only merged or zero-ahead refs while preserving the default branch, reserved Gate-C branch, open-PR heads, and unproven unique work.

### Deployment hygiene

- `master` is the sole automatic Vercel branch;
- non-production commits are skipped unless a commit explicitly carries `[vercel-preview]`;
- on `master`, the ignored-build guard compares against `VERCEL_GIT_PREVIOUS_SHA` and skips a deployment when no `frontend/` project change exists since the previous successful deployment;
- if the comparison cannot prove equivalence, the guard fails open to a normal build rather than risking a missed runtime deployment;
- feature-branch commits continue to produce CANCELED non-production deployment records unless explicitly marked for preview;
- #407 and #408 proved docs-only `master` commits are canceled before a redundant production runtime build;
- real frontend changes continue to receive exact-SHA production deployments while docs-only merges are skipped;
- #413 restored the production security baseline on Next.js 16.4.5 after newly disclosed critical advisories;
- #412 then deployed the current AI Gateway model-eligibility readiness check on top of that patched baseline.


### CSS ownership

Root CSS authority is now:

1. `globals.css`
2. `app-workspace.css`
3. `studio-product.css`

`responsive-studio.css` and `studio-decision-flow.css` are retired. Exact selector overlap between workspace and Studio product layers is **0** and guarded by CI.

A live production audit exposed desktop horizontal overflow on Library/Connections because secondary-page width used viewport units inside a fixed-rail shell. #404 changed the desktop secondary frame to container-relative sizing and added a regression guard. Current production includes that fix, and a post-deploy regression pass verified that both routes no longer expose horizontal scrollbars or clipped content. The available browser automation cannot directly resize to 768px/390px or set browser zoom to 200%, so those exact rendered states remain unclaimed acceptance evidence under #44.

### Branch / PR hygiene

The repository had dozens of cleanup/history branches. #402 added fail-closed branch pruning and #403 explicitly retired the final three superseded refs after forensic comparison.

Current branch set is intentionally only:

- `master`;
- `feat/refine-workspace-loader-gate-c-20260915` — reserved #315 Gate-C event.

The branch-pruner never deletes the default branch, the reserved Gate-C branch, open-PR heads, or unproven unique work.

### Public truth

README/frontend docs/public AI metadata describe SignalFlow as an approval-first Content Operating System and separate implemented capability from product direction. #135 was closed after live production copy and responsive landing acceptance verified that stale autoposting/post-generator positioning is absent from the product surface.

GitHub's repository **About description/topics remain stale** because the connected GitHub App does not expose repository-administration writes. This is an external admin-surface blocker, not hidden code debt.

## Issue control plane

`docs/ISSUE_TRIAGE.md` is the canonical open-issue execution classification.

The actual execution frontier is intentionally small. Open does not mean active.

Current active frontier:

- #34 — remaining request-rate/concurrent-campaign/cost controls;
- #35 — residual external MCP/auth/cost/saved-Campaign acceptance;
- #159 — Today/Signals/Plan decision-first center;
- #161 — GitHub connected-source acceptance;
- #163 — screenshot/media acceptance;
- #167 — Golden Path 2 owner outcome;
- #209 — shared UI consolidation parent;
- #222 — repository onboarding/project-context outcome.

Everything else is explicitly classified as blocked, partially implemented, later, or close-with-evidence.

## GP2 live blocker boundary

Repository implementation is no longer the primary GP2 blocker.

### Hosted inference

- the Vercel AI Gateway adapter uses the documented Bearer/OIDC contract and the generation path remains fail-closed;
- #412 replaced the older team-credit-balance readiness proxy with Vercel's authenticated `/v1/models?include_availability` contract;
- readiness now evaluates the **actual configured generation model** (`VERCEL_AI_GATEWAY_MODEL`, otherwise SignalFlow's Gateway default) and proceeds only when Vercel marks that model eligible;
- missing, ineligible, unknown, invalid-response, 401, 403, 429, unreachable and upstream-error states all remain blocked;
- a configured direct hosted provider can still satisfy the existing explicit fallback boundary; no fake/template generation is introduced;
- the live public Gateway catalog on 2026-11-10 still contains SignalFlow's default `google/gemini-2.5-flash-lite`, so no model migration was justified;
- project OIDC was previously normalized through the connected Vercel project API, but project environment-variable metadata remains inaccessible to the current connector (403), so the protected owner readiness check is still required to prove **this deployment's** live inference admission;
- #412 is exact-SHA deployed and its post-deploy runtime-error scan is clean.

### Hosted screenshot capture

- the existing server CDP transport requires WSS, rejects URL userinfo credentials, and supports an optional `Authorization: Bearer` handshake token;
- Cloudflare Browser Rendering / Browser Run is the preferred bounded GP2 capture authority because its direct CDP contract matches that existing transport without an adapter rewrite;
- production still needs the external account/token plus `SIGNALFLOW_CDP_BROWSER_WS_ENDPOINT` and, when required, `SIGNALFLOW_CDP_BROWSER_AUTH_TOKEN`;
- the owner-triggered live browser-worker probe must pass before capture acceptance is claimed.

### Immediate Gate-C sequence

1. run the protected GP2 readiness check and require hosted inference to report genuinely eligible/operational;
2. configure the approved remote CDP authority and pass the live worker probe;
3. retry recoverable persisted opportunity work through the existing recovery action;
4. verify exact ProjectContextSnapshot + ranked opportunity production evidence;
5. refresh reserved #315 from then-current `master` (currently 96 master commits behind with 2 unique intended commits);
6. run #315 as the meaningful positive GitHub event;
7. complete exact screenshot/media binding, recovery/noise controls, and sanitized GP2 acceptance evidence.

Do not create replacement inference/capture architecture while these external prerequisites remain unresolved.

## Reserved PR #315

#315 is the controlled GP2 positive acceptance event. It must **not** enter normal merge flow.

Before it can merge:

1. reverify production/runtime prerequisites;
2. verify hosted inference authorization and operation;
3. verify live bounded screenshot/CDP path;
4. refresh the reserved branch from then-current `master`;
5. pass normal CI/build/security gates;
6. prepare the acceptance observer/evidence path;
7. complete positive-event and low-value/noise-control evidence.

Do not treat deployment readiness as owner acceptance.

## GitHub administration blockers

Current repository settings verified from GitHub:

- About description still says “Local-first autoposting workspace…”;
- topics still include stale `autoposting`, `post-generator`, `gif-generator`, `fastapi`, and related legacy terms;
- merge commit, rebase, and squash are all enabled;
- `delete_branch_on_merge` is disabled;
- current live branch metadata confirms `master` is **not protected**;
- the connected GitHub surface can read this repository/admin truth but still exposes no write operation for repository About/topics, merge-policy settings, or branch-protection/ruleset configuration.

Desired admin state:

- update About description/topics to current Content Operating System positioning;
- make squash the normal merge path;
- enable delete-branch-after-merge;
- protect `master`: PR required, green CI required, no force-push/delete.

These cannot be truthfully marked done from the current connector surface.

## Vercel / release truth

The latest code-bearing checkpoint (#412) is exact-SHA deployed and READY in production at `dpl_3r5QKunB2djGsdeo1gX7nDQQ7uEY`. The immediately preceding #413 security checkpoint is also exact-SHA deployed and restored the production audit gate before #412 was refreshed and rerun.

The non-production Vercel ignore-build policy remains effective: both #412/#413 feature-branch records were CANCELED rather than retained as READY preview artifacts. Documentation-only master merges should likewise be skipped when the frontend project diff is empty.

Use the immutable `repo-hygiene-2026-10-05` tag for the repository-reconciliation milestone; use live Vercel deployment identity for current runtime evidence.

## Next product execution

After repository hygiene closeout, do not restart cleanup/refactor loops without a concrete defect.

Execution returns to the product frontier:

1. reverify GP2 runtime prerequisites;
2. refresh reserved #315 only when those prerequisites are ready;
3. execute positive + noise-control GP2 owner acceptance;
4. then resume the explicitly triaged product backlog.

