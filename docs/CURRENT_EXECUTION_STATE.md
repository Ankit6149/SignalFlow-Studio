# SignalFlow Studio — Current Execution State

> **Authoritative execution frontier as of 2026-10-03.**
>
> Use this file for the current repository/deployment/acceptance state. Product and architecture documents define target behavior; this file only records what is active now.
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

## Current checkpoint

| Item | Current state |
| --- | --- |
| Default branch | `master` |
| Current master SHA | `0b739d7f757d66e04ade5f8cf590a75e5a8ea7b3` |
| Current master change | #338 — destination generate/retry/edit through MCP |
| Production SHA | `8a3cb236dd1b228652643e9f4d5fa8baf60cf251` |
| Production deployment | `dpl_jA3K3KXbbCf66n8mEESLVK9xybPs` — READY |
| Production change | #337 — hosted strategy planning through MCP |
| Master ↔ production | **Diverged by one master commit** |
| Why latest master is not production | Vercel commit status reports failure with the build-rate-limit upgrade URL |
| Golden Path 1 | Accepted |
| Golden Path 2 | Active; not accepted |
| Golden Path 3 | Not started end to end |
| Repository hygiene | Active under #340 |

Do not assume a merged commit is live until the production deployment SHA matches it.

## Current open pull requests

### #339 — active

**Expose hosted review retrieval and deterministic export through MCP**

This is the current active implementation PR. It advances #35 but does not claim hosted saved-campaign persistence or full #35 completion.

Resolve it through normal review/CI/merge discipline.

### #315 — reserved GP2 acceptance event

**Gate C: current-master workspace loading acceptance change**

This PR exists to provide one controlled meaningful GP2 positive event.

It must **not** be merged merely because it is mergeable. It remains reserved until the live GP2 prerequisites and acceptance run are ready.

The older execution-state reference to PR #291 is obsolete; #315 is the current replacement.

## Current repository hygiene state

The repository currently has 11 branches including `master`.

The cleanup controller is:

- #340 — repository reconciliation and hygiene sprint.

Until that sprint reconciles the active execution frontier, avoid starting unrelated feature families.

Current cleanup order:

1. reconcile runtime/master/production truth;
2. reconcile capability truth;
3. resolve the two intentional PRs;
4. classify and clean branches;
5. reconcile the open issue backlog;
6. reconcile documentation/public metadata;
7. remove or quarantine dead/experimental source surfaces;
8. execute the dedicated UI architecture cleanup;
9. perform the final cross-repository audit and sign-off.

## Golden Path 1

**Status: accepted for the Personal Alpha definition.**

Issue #166 is closed.

Do not rebuild GP1 because broader roadmap work remains open.

## Golden Path 2

**Status: active and not yet owner-accepted.**

Closing authority remains:

- #161 — GitHub signal ingestion;
- #163 — campaign-ready screenshots/derivatives;
- #167 — Golden Path 2;
- `docs/acceptance/GOLDEN_PATH_2_OWNER_ACCEPTANCE.md`.

The previous execution state recorded a real production GitHub ingestion path plus two important live blockers at that time:

- hosted inference authorization/continuation;
- remote CDP screenshot execution.

Those observations were verified on 2026-09-16. They are historical evidence, not permission to assume the same exact live blocker state indefinitely.

Before the next GP2 acceptance run, reverify:

1. owner GP2 readiness;
2. hosted inference route;
3. recoverable/dead opportunity continuation state;
4. ProjectContextSnapshot and ContentOpportunity continuation;
5. configured live CDP worker;
6. exact screenshot/media review binding;
7. duplicate/noise/reopen recovery behavior.

Do not replay GitHub history merely to manufacture a positive path if existing persisted work can be recovered safely.

## Gate C rule

PR #315 remains the reserved meaningful GP2 event.

Do not merge it until the live acceptance run is ready to trace the change through:

```text
GitHub event
→ canonical ContentSignal
→ bounded exact evidence
→ ProjectContext
→ ContentOpportunity
→ owner angle decision
→ NarrativeStrategy
→ LinkedIn/X exact revisions
→ automatic screenshot when justified
→ private Asset / derivative
→ exact text + media review
→ approve / change / reject
```

A separate low-value/noise event must also prove non-promotion behavior.

## Golden Path 3

**Status: not implemented end to end.**

The intended sequence remains:

```text
exact approved text/media
→ editorial timing decision
→ immutable PublicationRequest
→ durable execution
→ verified destination
→ published / failed / rejected / unknown
→ confirmed Publication
→ confirmed-public NarrativeMemory
```

Do not begin broad GP3 implementation before GP2 acceptance unless a narrowly scoped prerequisite is required to close GP2.

## Capability truth

`frontend/app/api/capabilities/route.js` is the runtime capability-discovery surface.

The current route still uses coarse cloud booleans such as database/object-storage/background-jobs. That model can under-report newer hosted content-OS persistence/execution foundations while correctly stating that broad campaign cloud persistence/autosave/collaboration are not generally available.

This is an active #340 Area-A reconciliation item.

Until the capability contract is updated and tested:

- do not infer broad hosted campaign persistence from the existence of Neon-backed source/content-OS repositories;
- do not describe all hosted persistence as absent merely because `cloudDatabase.available` is false;
- use the capability matrix plus exact implementation/runtime evidence for specific hosted records.

## Current issue/backlog truth

At the start of #340:

- open issues: **96**;
- effective backlog labels: **none**;
- effective milestones: **none**;
- multiple generations of roadmap/implementation issues coexist.

Do not treat all 96 as simultaneous active work.

Each issue must be reconciled as active, blocked, later, partially implemented, superseded, or close-with-evidence before it drives new implementation.

## Current branch truth

At the start of #340, the repository contains:

- `master`;
- `feat/connector-truth-batch` — current #339 work;
- `feat/refine-workspace-loader-gate-c-20260915` — reserved #315 work;
- `feat/editorial-execution-layer` — requires rescue/retire analysis;
- several merged/history-oriented docs/fix/test branches requiring verification before deletion.

Do not create another long-lived feature branch as a substitute for reconciling these.

## Immediate execution order

1. Complete #340 Area A1: current execution truth.
2. Complete #340 Area A2: capability contract/runtime truth with tests.
3. Review and resolve #339.
4. Make #315 unmistakably reserved/blocked.
5. Classify every non-master branch; rescue unique work or delete verified residue.
6. Reconcile the open issue backlog into a small execution frontier.
7. Reconcile public docs/metadata with the Content Operating System direction.
8. Perform source-tree cleanup and then #45/#44 architecture work.
9. Re-audit production, branches, PRs, issues, docs, CI and GP2 acceptance.
10. Close #340 only when the repository itself demonstrates the clean state.

## Release discipline

For every active slice:

```text
current verified problem
→ smallest truthful change
→ focused tests + normal CI
→ preview verification
→ merge
→ production exact-SHA verification
→ runtime/data inspection
→ real acceptance where required
→ update execution truth
```

Repository cleanup is complete only when the resulting state is simpler and more truthful, not merely when files, branches, or issues have been removed.
