# SignalFlow Studio — Current Execution State

> **Authoritative execution frontier as of 2026-09-16.**
>
> Read this before historical ledgers, roadmap epics, or older audit summaries when deciding what to build next. Canonical product documents define the target architecture; this file defines the current repository, deployment, and owner-acceptance frontier.
>
> Truth rule: **code/runtime > deployed production > current PRs > acceptance evidence > capability docs > README > historical notes.** A merged implementation is not live acceptance, and an open parent issue is not proof that all of its implementation is missing.

## Current repository checkpoint

- Default branch: `master`
- Current production master checkpoint: `7ec89657badb8a3bfab146a51e1dfd03dbc989f5`
- Vercel production deployment: `dpl_3eRv9BgVJw2dADE21bousyJarHgK` — **READY**
- Golden Path 1: **accepted**
- Golden Path 2: **live GitHub ingestion works; continuation is blocked at hosted inference and screenshot execution still requires remote CDP**
- Golden Path 3: **not yet implemented end to end; begin only after GP2 acceptance**
- Reserved Gate-C PR: **#291**, refreshed onto current hardened `master`, behind `0`, still exactly two changed files, CI green, preview READY; **do not merge until GP2 live acceptance is ready to consume the event**

Repository hygiene on 2026-09-16 removed 45 stale branches. The intentional branch set is now:

- `master`
- `feat/refine-workspace-loader-gate-c-20260915` — reserved #291 acceptance event
- `feat/editorial-execution-layer` — preserved because it still contains unique unmerged history

## Product execution rule

Do not restart architecture discovery or broaden the product while GP2 lacks one real accepted owner journey.

The active outcome remains:

```text
real GitHub work
    ↓
verified GitHub App/source authority
    ↓
canonical ContentSignal at immutable source revision
    ↓
bounded exact repository evidence
    ↓
durable opportunity continuation
    ↓
ranked ContentOpportunity in Today
    ↓
owner angle decision
    ↓
evidence-backed NarrativeStrategy
    ↓
LinkedIn/X exact revisions
    ↓
automatic bounded screenshot when justified
    ↓
private immutable AssetVersion + derivative
    ↓
exact media/text review + critics
    ↓
approve / change / reject exact visible revision
```

## Golden Path 1

**Status: accepted / complete for the Personal Alpha definition.**

Issue #166 is closed. Do not rebuild GP1 merely because broader roadmap work remains open.

## Golden Path 2 — live production truth

**Status: active. GitHub ingestion is real and healthy. The current stop point is inference-dependent continuation.**

### GitHub / database path — working in production

The previous execution state incorrectly described `DATABASE_URL` and GitHub onboarding as current blockers. That is no longer true.

Verified production evidence on 2026-09-16:

- Neon production wiring is active.
- SignalFlow private GitHub App manifest provisioning completed.
- Encrypted GitHub credential persistence completed.
- Active GitHub SourceConnection safe ID: `signalflow-github-connection-794c1349-dbfa-414a-ae96-6ebb4444d0fd`.
- SourceConnection status: `active`.
- Installation/account authority is present and independently persisted.
- Verified permission scopes: `contents:read`, `metadata:read`, `pull_requests:read`.
- Capabilities: `repository_contents`, `repository_events`, `repository_metadata`.
- Selected project ID: `sf-project-github-1269263906`.
- Controlled repository: `Ankit6149/SignalFlow-Studio` (GitHub repository ID `1269263906`).
- Latest observed GitHub event at audit time: `2026-09-16T17:40:35Z`.
- Current webhook delivery is functioning; the old first-install 503 was transitional and is not representative of current delivery.

### Live ingestion integrity

At the 2026-09-16 production audit:

- canonical GitHub ContentSignals: **11**;
- revision-bound GitHub Signals: **10**;
- distinct immutable revisions among those 10: **10**;
- distinct external idempotency keys: **10**;
- distinct external event IDs: **10**;
- bounded SourceArtifacts: **99**;
- duplicate accumulation detected: **none**.

One older signal has no immutable source revision and no continuation job. It is not being treated as GP2 promotional evidence.

### Exact current stop point — hosted inference

Production has **10 dead signal-opportunity continuation jobs**, and every one has the same safe failure code:

```text
vercel_gateway_http_403
```

This is the actual current GP2 stop point.

Consequences:

- GitHub webhook ingestion does **not** need replay/rebuild.
- canonical Signals and bounded source evidence already exist.
- ProjectContextSnapshots remain at **0** because the inference-dependent continuation cannot complete.
- ContentOpportunities remain at **0** for the same reason.
- automatic screenshot jobs have not started because the journey has not yet reached the strategy/media stage.

Vercel documentation confirms that the raw OpenAI-compatible `/v1/chat/completions` endpoint accepts `AI_GATEWAY_API_KEY` or `VERCEL_OIDC_TOKEN` as Bearer credentials. SignalFlow's adapter follows that contract. The production 403 is therefore being treated as a Gateway/account authorization condition unless a later live probe proves otherwise.

### Recovery path — merged and deployed

PR #295 added owner-safe blocked-work recovery and is merged into production.

Recovery properties:

- workspace scoped;
- dead/recoverable opportunity work only;
- bounded requeue count;
- live Gateway authorization gate before any requeue;
- durable post-response processing restart;
- no manual production SQL required;
- UI recovery action remains disabled while inference health is not ready.

Once inference is genuinely healthy, use this recovery path to revive the existing jobs rather than replaying GitHub history.

### Inference resilience issue discovered during audit

The current readiness/provider-selection implementation gives a present Vercel OIDC credential priority over direct provider configuration. Because Vercel can inject OIDC even when Gateway access is forbidden, a configured direct provider can be masked by a failing Gateway.

This is a real resilience concern inside the same GP2 slice. Any fix must preserve privacy routing and use an explicit precedence such as:

```text
explicit requested provider
→ configured DEFAULT_MODEL_PROVIDER
→ operational Gateway
→ configured allowed direct remote provider
```

Do not add silent local/private fallback or cross privacy boundaries. Do not partially change readiness without making execution selection consistent.

### Remote CDP capture worker — still external setup

`SIGNALFLOW_CDP_BROWSER_WS_ENDPOINT` is still not configured in production.

Current screenshot implementation already includes:

- WSS-only remote CDP transport;
- optional Bearer auth via `SIGNALFLOW_CDP_BROWSER_AUTH_TOKEN`;
- bounded CaptureRecipe/CaptureJob contracts;
- privacy/same-origin enforcement;
- private immutable Asset persistence;
- deterministic quality checks;
- crop-safe/platform derivative planning/rendering;
- exact revision/media binding;
- protected preview + short-lived visibility receipts.

With the default 1440×900 capture viewport, the reserved Gate-C loading surface can produce LinkedIn `4:5` and X `16:9` derivatives without requiring >2× upscale or forced alternate layout.

A remote browser provider must still be connected and proven live before screenshot acceptance. Do not build another screenshot architecture around this configuration gap.

## Gate C — reserved event

PR #291 is the controlled meaningful product change for live GP2 acceptance.

Current state:

- branch: `feat/refine-workspace-loader-gate-c-20260915`;
- refreshed onto current `master` without history rewrite;
- behind master: `0`;
- diff remains exactly:
  - `frontend/app/loading.js`
  - `frontend/app/state.module.css`
- frontend regression tests: green;
- dependency audit: green;
- production build: green;
- Python tests: green;
- MCP tests: green;
- Vercel preview for refreshed commit `770a0284ebad79f387b592b331e9d3dcc1971d4a`: **READY**.

**Do not merge #291 until hosted inference and the screenshot worker are ready for the controlled acceptance run.**

## Acceptance still required

`docs/acceptance/GOLDEN_PATH_2_OWNER_ACCEPTANCE.md` remains the closing authority and is still **NOT YET ACCEPTED**.

Already observed evidence may be recorded there, but do not infer untested steps. Still required includes:

- full readiness with operational inference and live CDP;
- durable recovery of the existing blocked continuation jobs;
- ProjectContextSnapshot creation at exact immutable revisions;
- ContentOpportunity creation/ranking in Today;
- one meaningful Gate-C event through planning/review;
- one explicit routine/noise negative control that does not promote;
- automatic screenshot, private AssetVersion, quality/derivative proof and exact media binding;
- exact LinkedIn/X owner review and judgment;
- duplicate-delivery recovery proof;
- refresh/reopen/stale guards;
- sanitized evidence only.

Keep #161, #163 and #167 open until their actual Definitions of Done are evidenced.

## Publishing / Golden Path 3

Manual/export destinations remain available. LinkedIn/X/Reddit connector code exists but production credentials/OAuth/live publication verification are not complete.

Durable publication remains GP3:

```text
exact approved text/media
→ editorial time decision
→ immutable PublicationRequest
→ durable execution
→ verified connector
→ published / failed / rejected / unknown
→ confirmed Publication
→ confirmed-public NarrativeMemory
```

Do not start GP3 until GP2 is accepted.

## Immediate execution order

Do this in order:

1. Resolve the hosted inference route so a real generation call is authorized; if using a direct-provider fallback, fix readiness and execution selection together without weakening privacy policy.
2. Recheck owner-only GP2 readiness.
3. Use #295 recovery to revive existing dead opportunity jobs; do not replay GitHub history.
4. Verify ProjectContextSnapshots + Opportunities materialize from the already-persisted Signals and exact source revisions.
5. Configure one approved remote CDP endpoint and optional Bearer token; run the explicit live browser-worker probe.
6. Recheck complete GP2 readiness.
7. Merge reserved PR #291 as the controlled positive Gate-C event.
8. Trace its exact merge SHA through webhook → canonical Signal → evidence/context → Opportunity → Today → strategy → exact LinkedIn/X revisions → screenshot → private AssetVersion/derivative → exact owner review.
9. Exercise one explicit low-value/noise negative control and verify it does not promote.
10. Complete the acceptance ledger with sanitized live evidence; close only acceptance-complete #161/#163/#167 scope.
11. Only then start GP3.

## Do not distract the current execution

Unless directly required to close GP2, do not switch to:

- another visual redesign;
- full video/screencast editor;
- carousel expansion;
- mobile app;
- Desktop Edge Agent;
- local-model marketplace/packs;
- broad provider architecture rewrite;
- every social connector;
- multi-tenant SaaS/billing;
- refactors for cleanliness alone.

## Release discipline

For every active slice:

```text
current owner blocker
→ smallest truthful change
→ focused tests + full normal CI
→ preview verification
→ merge
→ production exact-SHA verification
→ runtime/data inspection
→ real owner acceptance
→ update execution truth
```

The goal is no longer to prove that SignalFlow can ingest GitHub. That is already real. The goal is to move one already-ingested, revision-bound GitHub signal through inference, planning, automatic evidence capture, and exact owner judgment without manual campaign manufacture.
