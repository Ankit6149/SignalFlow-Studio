# SignalFlow Studio — Current Execution State

> **Authoritative execution frontier as of 2026-10-05.**
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
| Latest code-bearing checkpoint | `8a8057c47f245994ff1463e2c39cfdd4a55275c0` — #404 secondary workspace overflow fix |
| Runtime checkpoint | #404 is READY in production at `dpl_GHbw1LERqWua5w9N7H4s3ZudEjFx` |
| Post-reconciliation checkpoint | `repo-hygiene-2026-10-05` — created at the merge commit of final reconciliation PR #405 |
| Runtime/code relationship | **Aligned at #404**; #405 is documentation/governance-only and does not change product runtime behavior |
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
- connected GitHub App cannot read/write the administration endpoints needed to prove/configure master protection/rulesets.

Desired admin state:

- update About description/topics to current Content Operating System positioning;
- make squash the normal merge path;
- enable delete-branch-after-merge;
- protect `master`: PR required, green CI required, no force-push/delete.

These cannot be truthfully marked done from the current connector surface.

## Vercel / release truth

The latest product-code checkpoint (#404) is exact-SHA deployed and READY in production. The final reconciliation PR (#405) changes only documentation/governance files, so Git commit identity may advance without changing product runtime behavior.

Use the immutable `repo-hygiene-2026-10-05` tag as the repository reconciliation checkpoint instead of repeatedly editing this file merely to echo its own merge SHA. Exact deployment SHA remains observable in Vercel when release evidence is required.

Vercel preview failures caused by Hobby deployment-rate limits remain separate from GitHub CI failures. A quota-limited preview is not evidence of a code regression.

## Next product execution

After repository hygiene closeout, do not restart cleanup/refactor loops without a concrete defect.

Execution returns to the product frontier:

1. reverify GP2 runtime prerequisites;
2. refresh reserved #315 only when those prerequisites are ready;
3. execute positive + noise-control GP2 owner acceptance;
4. then resume the explicitly triaged product backlog.

