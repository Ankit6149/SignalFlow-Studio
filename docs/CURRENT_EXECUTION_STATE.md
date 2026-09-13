# SignalFlow Studio — Current Execution State

> **Authoritative execution frontier as of 2026-09-14.**
>
> Read this file before `AGENTS.md`, roadmap epics, historical implementation ledgers, or older audit summaries when deciding what to build next. Canonical product documents still define the long-term architecture; this file defines the current implementation and deployment frontier.
>
> Capability rule: documented target ≠ code present ≠ merged master ≠ deployed production ≠ credential-backed owner acceptance.

## Current repository checkpoint

- Default branch: `master`
- Audited master checkpoint: `75bf4fbc7c5df0799da4a4061ab7ae941ef12746` (merged PR #282)
- Golden Path 1: **accepted**
- Golden Path 2: **implementation substantially assembled; production acceptance blocked by deployment configuration + live proof**
- Golden Path 3: **not yet implemented end to end; begin only after GP2 acceptance**
- Current CI gate: frontend regression tests + production dependency audit + production build + Python tests + MCP tests + preview/production verification where relevant

## Product execution rule

SignalFlow is still built vertically. Do not start another broad foundation phase while Golden Path 2 lacks real owner acceptance.

The active owner outcome remains:

```text
real GitHub work
    ↓
verified GitHub App/source scope
    ↓
canonical ContentSignal at an immutable source revision
    ↓
bounded exact repository evidence
    ↓
noise gate + durable opportunity continuation
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

## Golden Path 1 — manual thought to exact approved content

**Status: accepted / complete for the Personal Alpha definition.**

The owner-first browser-local path proves:

- manual ContentSignal intake;
- ContentOpportunity + explainable angle choice;
- `Something else` custom direction;
- explicit Identity/Perception/Voice/Boundary context;
- NarrativeStrategy + ContentPiece + LinkedIn/X PlatformVariants;
- evidence/authenticity critics;
- exact immutable edits/regeneration/change requests;
- exact approve/reject semantics;
- review-derived StyleMemory evidence with owner control;
- prepared-internal NarrativeMemory without falsely claiming publication;
- refresh/reopen continuity.

Issue #166 is closed. Do not rebuild this path merely because parent epics remain open.

## Golden Path 2 — current truth

**Status: active / code path is much further than the August 31 checkpoint, but the real hosted journey is not accepted.**

### Merged implementation now present

The repository has progressed through the complete hosted screenshot/review composition that the previous execution-state file still described as missing:

- #253 — hosted screenshot production from exact revision-scoped capture through private AssetVersion quality/derivative processing and exact media binding;
- #257 — ranked hosted opportunities surfaced in Today;
- #258 — durable hosted exact revisions unified into Today;
- #259 — exact evidence/authenticity review automated before owner judgment;
- #261 — low-attention hosted preparation after strategy approval, including screenshot production/reuse and idempotent reopen;
- #267 — hosted runtime configuration simplified around Neon/Postgres fallback storage, derived signing and Vercel inference;
- #268 — Vercel request-scoped OIDC inference readiness;
- #269 — dependency-aware GP2 readiness presentation;
- #270 — GitHub App manifest provisioning with encrypted per-workspace credentials and per-installation webhook authority;
- #271 — manifest-backed webhook readiness support;
- #277 — authenticated remote CDP browser support;
- #280/#281 — action-first workspace/GitHub setup and removal of remaining dead/duplicate UX states;
- #282 — preferred manifest webhook readiness no longer asks for the legacy static webhook secret when GitHub authority is blocked upstream.

Earlier screenshot foundations remain part of the same vertical: #238, #239, #241, #244, #245, #246, #247, #248, #249 and #250.

### Current production blocker 1 — database wiring

A real Neon project and migrated SignalFlow schema exist, including source connections, ContentSignals, ContentOpportunities, project-context snapshots, encrypted secret records, capture jobs and hosted review records.

However, the deployed Vercel runtime currently reports `DATABASE_URL` as missing.

Consequences:

- GitHub manifest installation cannot start;
- encrypted GitHub App credentials cannot be persisted;
- SourceConnections cannot persist;
- repository bootstrap cannot persist source/project context;
- Postgres private-blob fallback cannot become active;
- therefore the user never reaches repository selection or receives GitHub-origin signals/opportunities.

This is a deployment configuration blocker, not a missing GitHub UI input and not a runtime crash.

### Current production blocker 2 — remote CDP capture worker

`SIGNALFLOW_CDP_BROWSER_WS_ENDPOINT` is not configured in the hosted runtime.

Consequences:

- GitHub installation itself should **not** be blocked by this;
- signal/opportunity/planning can proceed after GitHub/database setup;
- automatic screenshot capture/quality/derivative production cannot execute in the real hosted acceptance path until a reachable approved CDP worker is configured;
- optional authenticated CDP transport is supported through `SIGNALFLOW_CDP_BROWSER_AUTH_TOKEN`.

### Current ready dependencies

The current production readiness surface reports these dependency classes ready:

- owner access lock;
- exact media visibility receipt authority;
- hosted inference route (Vercel OIDC-backed).

Postgres private Asset storage is intentionally able to use the same `DATABASE_URL`; external S3/R2 storage is optional for Personal Alpha and is not a prerequisite to connect GitHub.

### GitHub connection UX truth

The GitHub source flow intentionally has no manual repository URL field before authorization.

Expected flow:

```text
Unlock workspace
  → Create/install private GitHub App through manifest flow
  → GitHub authorization returns to SignalFlow
  → list repositories exposed by that installation
  → owner chooses repository
  → bounded repository bootstrap + first opportunity
```

If Step 2 is unavailable, Step 3 has nothing truthful to show. The current direct blocker is the hosted database prerequisite.

### Acceptance still required

`docs/acceptance/GOLDEN_PATH_2_OWNER_ACCEPTANCE.md` remains the closing authority and is still **NOT YET ACCEPTED**.

A real hosted run must still prove at minimum:

- live manifest GitHub App installation + repository selection;
- exact installation/repository authority;
- meaningful merged-PR/release webhook → exactly one canonical ContentSignal;
- duplicate delivery idempotency;
- one routine/noise event not promoted into a high-priority opportunity;
- exact repository evidence refresh at the immutable event revision;
- ranked opportunity in Today;
- owner angle + evidence-backed strategy;
- automatic screenshot for a genuinely visual story;
- private immutable AssetVersion + derivative + exact revision binding;
- exact LinkedIn/X review with evidence/authenticity critics;
- owner approval/change/reject;
- refresh/reopen and recovery cases;
- sanitized evidence only.

Keep #161, #163 and #167 open until their definitions of done are proven by this real path.

## Neon / hosted data truth

A `SignalFlow-Studio` Neon project exists and the current migration set is present. At the 2026-09-14 audit, hosted source-related tables contained no source connection, signal, opportunity, project-context, encrypted GitHub secret or hosted review records yet.

Interpretation: schema exists; real GitHub onboarding has never reached persistence on the current deployment.

Do not respond to this by creating another database abstraction. Wire the existing deployment to the existing database first.

## Today / Signals / Plan / hosted review

**Status: implementation present; connected-source production data path blocked upstream.**

Current code includes:

- manual browser-local Signals/Plan/Today path from GP1;
- hosted ranked opportunity projection into Today;
- hosted identity/planning continuity;
- durable hosted LinkedIn/X exact revisions;
- owner edits/change requests/review decisions;
- exact media preview/visibility receipts;
- automated hosted critics and preparation.

What the owner currently lacks is not another Today/Plan architecture rewrite. The missing live input is the upstream connected GitHub source.

## Inference / privacy

**Status: thin execution spine implemented; broader long-term fabric remains partial.**

Implemented/currently useful:

- task-oriented server inference paths used by the current content-intelligence vertical;
- privacy-aware hosted routing boundaries;
- Vercel OIDC-backed hosted inference readiness;
- explicit BYOK/provider alternatives remain available in supported flows.

Still later/partial:

- complete capability/cost/fallback registry;
- Private Hybrid end-to-end execution;
- curated local intelligence packs;
- broad local-only routing UX;
- external AI-assistant client expansion beyond current MCP/application surfaces.

Do not interrupt GP2 to generalize this further unless a direct acceptance blocker is discovered.

## Media truth

### Screenshot vertical

**Status: code substantially complete; production execution blocked by CDP + real owner acceptance.**

The current code includes:

- bounded CaptureRecipe/CaptureJob contracts;
- exact durable-job claims;
- CDP capture adapter;
- privacy/same-origin enforcement;
- private immutable Asset persistence;
- quality evaluation;
- crop-safe/platform derivative planning and rendering;
- lineage;
- exact media binding to PlatformVariantRevision;
- protected hosted preview + short-lived visibility receipts;
- automated hosted preparation/review integration.

### Broader creative-media system

**Status: mostly planned/partial, not the current build slice.**

Still not complete end to end:

- general image editing/compositing/generation pipeline;
- deterministic carousel renderer;
- uploaded-footage Reel/Short editor;
- semantic video-edit plan execution;
- automatic screencast/motion composition system;
- rights/face/voice/audio consent layer;
- full multimodal Direct Create convergence.

Do not let these roadmap items block GP2 screenshot acceptance.

## Publishing / destinations

### Manual/export destinations

**Status: available.**

The product can generate/review/export/copy approved content for the manual destinations represented in the workspace. Manual handoff is not direct publication confirmation.

### LinkedIn / X / Reddit official connectors

**Status: connector code exists; production credentials/authorization/live verification are not complete.**

Current deployment reports provider credentials absent, so these connectors are not connected. Even after credentials are configured, production readiness still requires real OAuth authorization, target identity/capability verification and real API publication tests.

### Durable publication / Golden Path 3

**Status: not implemented end to end.**

Still required:

```text
exact approved text/media
→ editorial time decision
→ immutable PublicationRequest
→ durable execution
→ verified target connector
→ published / failed / rejected / unknown
→ confirmed Publication record
→ confirmed-public NarrativeMemory
```

Issues #103/#160/#168 remain the main execution area after GP2 acceptance.

## Other roadmap capability status

| Area | Current state |
| --- | --- |
| Full account/workspace multi-tenant auth | Left / future; Personal Alpha owner lock exists |
| Cross-device cloud autosave/sync | Left |
| Team collaboration/review | Left |
| Billing/quota enforcement | Left |
| Mobile low-attention companion | Left |
| Paired Desktop Edge Agent | Left |
| Desktop-app bounded capture | Left / future |
| Curated local-model packs | Left |
| Browser extension handshake | Partial foundation |
| Browser extension acknowledged ingestion/media capture | Left |
| Remote URL evidence hardening/revalidation | Partial/open (#127–#129) |
| Broad analytics/performance learning | Future |
| Unreviewed global autoposting | Explicitly not a Personal Alpha target |

## UI / UX truth

The primary workspace has been moved to the Content OS shell and then refined through #280/#281:

- action-first GitHub setup;
- in-place owner unlock;
- focused Create surface without duplicate global flow;
- less technical Library backup/restore language;
- responsive navigation improvements.

Do not start another full visual redesign while the main operational path is blocked by deployment wiring.

## Documentation truth

The previous version of this file and the top of `docs/IMPLEMENTATION_LEDGER.md` were stale: they stopped at the August 31 #250 frontier and still described the #253 production-composition work as missing.

When sources disagree, use this order:

1. current code + tests + credential-backed production evidence;
2. this `CURRENT_EXECUTION_STATE.md`;
3. current capability/readiness implementation and acceptance ledgers;
4. implementation ledger entries as historical traceability;
5. architecture/product docs for target direction;
6. old issue bodies for requirements/history.

An open parent issue is not proof that all of its code is missing. A merged implementation is not proof of live acceptance.

## Immediate execution order

Do this in order. Do not restart architecture discovery.

1. Configure the deployed Vercel project with the existing Neon `DATABASE_URL` and redeploy.
2. Confirm readiness now shows database/GitHub manifest/private Postgres storage healthy; do **not** add a manual `GITHUB_WEBHOOK_SECRET` for the preferred manifest flow.
3. From Connections, create/install the SignalFlow private GitHub App through the manifest flow and authorize it.
4. Select one controlled repository and prove repository bootstrap/project context/first opportunity persistence.
5. Configure one approved remote CDP browser endpoint (and bearer auth if the provider requires it).
6. Recheck full GP2 readiness.
7. Use a controlled real meaningful GitHub event as Gate C (PR #274 was deliberately held for this purpose; rebase/revalidate it before use rather than merging it prematurely).
8. Exercise one routine/noise event as the negative-control proof.
9. Complete `GOLDEN_PATH_2_OWNER_ACCEPTANCE.md` with sanitized real evidence and close only acceptance-complete #161/#163/#167 work.
10. Only then start GP3 durable scheduling/publication.

## Things that should *not* distract the current execution

Unless directly required to close GP2, do not switch to:

- another landing/workspace redesign;
- full video/screencast editor;
- carousel expansion;
- mobile app;
- Desktop Edge Agent;
- local-model marketplace/packs;
- broad provider-routing rewrite;
- every social connector;
- multi-tenant SaaS/billing;
- broad refactor for cleanliness alone.

## Release discipline

For every active slice:

```text
current owner blocker
→ smallest truthful change
→ focused tests + full normal CI
→ preview verification where applicable
→ merge
→ production exact-SHA verification
→ runtime/log inspection
→ real owner acceptance when required
→ update execution truth
```

The goal now is not more architecture. It is to turn the already-built GP2 code into one real, accepted GitHub-to-judgment owner journey.
