# SignalFlow Studio — Capability Matrix

> **Synchronized:** 2 September 2026.
>
> This file describes what may truthfully be treated as implemented/verified at the current checkpoint. Target architecture documents are not capability claims.
>
> Status vocabulary:
>
> - **Accepted** — owner journey accepted for its defined scope.
> - **Merged/verified** — implementation is on master and repository gates passed; live credentials may still be required for external acceptance.
> - **Production verified** — exact intended master SHA is READY in production and runtime checks are understood.
> - **Branch verified** — implementation exists on an unmerged branch with green code gates; not shipped.
> - **Partial/foundation** — meaningful substrate exists but promised user outcome is incomplete.
> - **Planned** — target contract/roadmap only.

## Current checkpoint

- master: `ea71fa39836dfadddd70f0fe5a135c2f4d8ce9e0`
- production: `dpl_ExhZUutbj3peG3BKX1FLDLmJe7Ez` READY on that exact SHA
- active PR #259 exact head: `6df646f76151e6544dbd506eb7e41909b83cb8cd`
- #259 GitHub CI #877: fully green
- #259 exact-head Vercel preview: not executed due account-level build-rate gate
- GP1: accepted
- GP2: active/not owner-accepted
- GP3: parked

## Owner/content intelligence

| Capability | Status | Current truth |
| --- | --- | --- |
| Manual ContentSignal intake/lifecycle | **Accepted foundation** | Manual thought/topic signals are first-class and persist in the GP1 path. |
| Manual signal → opportunity evaluation | **Accepted foundation** | Bounded evaluation, why-now/evidence/narrative fit and candidate angles exist in accepted GP1 scope. |
| Custom angle / `Something else` | **Accepted** | Owner can override offered angles. |
| Explicit Identity/Voice/Boundaries | **Accepted foundation** | Explicit owner profile/context snapshots are real; automatic learned identity is not. |
| NarrativeStrategy / ContentPiece | **Accepted foundation** | Canonical planning records exist and are used by GP1/hosted GP2. |
| LinkedIn/X planned variants + immutable revisions | **Accepted / merged hosted** | Exact revision model is real in local and hosted paths. |
| Evidence/authenticity critics | **Accepted local / merged hosted** | Exact critics exist; #259 automates normal hosted initiation but is unmerged. |
| Today exact review decisions | **Merged/production verified** | PR #258 projects canonical hosted exact review decisions into Today. |
| Today ranked opportunity queue | **Merged/production verified** | PR #257 surfaces post-worthy opportunities without auto-selecting owner angle. |
| Learned StyleMemory | **Partial/planned** | Target model exists conceptually; repeated-edit learning is not accepted end to end. |
| NarrativeMemory | **Partial/planned** | Must eventually represent confirmed public narrative; GP3 publication confirmation is not complete. |
| Full automatic opportunity ranking across all connected sources | **Partial** | GP2 GitHub path is the active vertical; broad source ecosystem not complete. |

## GitHub source integration

| Capability | Status | Current truth |
| --- | --- | --- |
| GitHub source connection/runtime architecture | **Merged** | Official App/source connection management foundations exist. |
| Owner-safe GP2 readiness UI | **Merged/production verified** | PR #256 surfaces allowlisted readiness classes without secret values. |
| Hosted owner lock / fail-closed owner access | **Merged/production verified** | Vercel/public-hosted missing owner key fails closed; owner responses private/no-store. |
| Exact merged-PR revision | **Merged** | `merge_commit_sha` is canonical; no PR head fallback. |
| Immutable release target handling | **Merged** | Already-immutable SHA can promote; mutable ref remains auditable/non-promotional. |
| Exact repository evidence refresh before opportunity inference | **Merged** | Exact revision evidence is refreshed/reused; failure blocks/retries. |
| Duplicate webhook idempotency | **Implemented substrate / acceptance pending** | Must still be proven in real hosted owner acceptance. |
| Meaningful-vs-noise event acceptance | **Acceptance pending** | Real meaningful + low-value/noise proof remains required before #161/#167 closure. |
| Broad non-GitHub sources | **Planned/partial** | GitHub is one source vertical, not product architecture limit. |

## Hosted persistence/jobs

| Capability | Status | Current truth |
| --- | --- | --- |
| Postgres hosted planning/review repositories | **Merged/production code** | Canonical hosted state used by GP2 review/Today. |
| Durable job lifecycle | **Merged** | Lease/retry/cancel/idempotency foundations exist. |
| Exact request-scoped `claimById(jobId)` | **Merged** | Prevents one capture request from stealing a different queued job. |
| Browser refresh/reopen canonical reconstruction | **Merged in major hosted paths / acceptance pending** | GP2 acceptance must still prove the complete journey across processing/review. |
| Full cross-device/team collaboration | **Planned** | Not current owner-first acceptance scope. |

## Asset/media/capture

| Capability | Status | Current truth |
| --- | --- | --- |
| Canonical Asset/AssetVersion/lineage | **Merged foundation** | Immutable originals/derived outputs and exact lineage are real. |
| Private S3-compatible Asset storage | **Merged** | Workspace-scoped private immutable storage exists; live configuration remains part of owner acceptance. |
| Protected exact AssetVersion preview | **Merged** | Owner-authenticated private exact-byte route; no permanent private storage URL/object key to browser. |
| Signed exact-media visibility receipt | **Merged** | Short-lived receipt proves exact AssetVersion was served before media-bound approval. |
| Versioned bounded CaptureRecipe/CaptureJob | **Merged** | Restricted action vocabulary; not arbitrary JS/shell. |
| Real CDP screenshot capture | **Merged** | Viewport/selector-region PNG capture with origin/privacy checks. |
| Screenshot quality/uncertainty evaluation | **Merged** | Blank/loading/error/subject/privacy/legibility uncertainty can block/require review. |
| Deterministic platform derivatives | **Merged** | Crop/resize around semantic evidence/focal regions, exact lineage, idempotent render reuse. |
| Screenshot derivative bound to immutable PlatformVariantRevision | **Merged** | Media rebound preserves exact text and creates new revision. |
| Hosted end-to-end screenshot production action | **Merged** | Exact revision → exact capture job → Asset → quality → derivative → rebound exists via hosted action. |
| Automatic required screenshot after strategy approval | **Not yet complete** | Current Plan still exposes `Prepare visual proof`; next GP2 slice must automate normal success path. |
| Screencast/video capture | **Planned/parked** | Explicitly not current GP2 slice. |
| Carousel production | **Planned/partial domain** | Not acceptance-complete. |
| Uploaded-footage Reel/Short editing | **Planned** | Not current. |
| Generative image/media production through final architecture | **Partial/planned** | Target contracts exist; not a complete accepted vertical. |

## Exact revision review/judgment

| Capability | Status | Current truth |
| --- | --- | --- |
| Exact review tied to immutable revision | **Accepted/merged** | Core invariant is real. |
| Owner edit/regenerate/restore/change | **Accepted local / merged hosted** | Exact-current guards prevent stale unseen mutations. |
| Exact approve/reject | **Accepted local / merged hosted** | Hosted approval additionally enforces media visibility receipts. |
| Required strategy media before final judgment | **Branch verified (#259)** | #259 enforces preparation deferral + Today suppression + API approval block; not on master yet. |
| Automatic exact review after generation/edit/restore | **Branch verified (#259)** | CI #877 green, exact-head preview still blocked/unexecuted. |
| Automatic exact review after media rebound | **Branch verified (#259)** | Final media-bound revision is reviewed automatically on branch. |
| Critic failure preserves successful persisted draft | **Branch verified (#259)** | Review becomes bounded recovery state instead of generation failure. |
| Manual critic initiation removed from normal flow | **Branch verified (#259)** | `Retry exact checks` remains recovery-only. |

## Low-attention orchestration

| Capability | Status | Current truth |
| --- | --- | --- |
| Signal/event → opportunity continuation | **Merged substrate / acceptance pending** | Durable exact-evidence path exists; real owner acceptance still required. |
| Opportunity appears in Today | **Merged** | #257. |
| Strategy planning after angle selection | **Merged hosted** | Uses exact evidence/Voice context. |
| Automatic destination generation after strategy approval | **Not complete** | Owner still starts generation in hosted Plan. |
| Automatic required screenshot after strategy approval | **Not complete** | Owner still starts visual proof preparation. |
| Automatic exact critics | **Branch verified (#259)** | Awaiting exact-head Vercel gate/merge. |
| Healthy strategy → Today judgment with no routine preparation clicks | **Not complete** | Next GP2 vertical. |

## Inference/privacy

| Capability | Status | Current truth |
| --- | --- | --- |
| Real configured model-provider routes | **Implemented** | Existing routes/adapters used by generation/intelligence. |
| Task-oriented inference application boundaries | **Partial/implemented in active domains** | Do not assume complete provider-neutral fabric/metering across every media task. |
| Private source minimization | **Merged GP2 rule** | Canonical minimized ProjectContext used; unnecessary repo identity/SourceArtifact IDs stay out of strategy prompt. |
| Local Only / Private Hybrid full end-to-end | **Planned/partial** | Target architecture, not current accepted capability. |
| SignalFlow Managed model plan | **Planned** | Not current proof. |
| Broad local intelligence packs | **Planned** | Not current. |

## Connections/publishing

| Capability | Status | Current truth |
| --- | --- | --- |
| Supported social connection/publishing code paths | **Implemented where configured** | Do not imply broad connector coverage without credential-backed verification. |
| Exact durable PublicationRequest vertical | **Parked GP3** | Existing branch contains early domain work but must not be activated before GP2 acceptance. |
| Editorial calendar as durable execution system | **Planned GP3** | Architecture documented; not current production acceptance. |
| Confirmed-only NarrativeMemory update | **Target invariant** | Must be completed/proven in GP3. |
| Unreviewed global autoposting | **Not a product goal** | Human approval remains final reputational judgment. |

## Client surfaces

| Surface | Status | Current truth |
| --- | --- | --- |
| Web owner workspace | **Primary implemented client** | Today/Signals/Plan/Voice/Connections and compatibility Create/Studio foundations. |
| MCP | **Implemented foundation** | Supported tool package exists; not a replacement for production webhook/background transport. |
| Browser extension | **Foundation/partial** | User-initiated browser context/capture direction exists; not current GP2 passive-event transport. |
| Mobile | **Planned** | Judgment/capture/approval client later. |
| Desktop Edge Agent | **Planned** | Private repos/files/local models/desktop capture later. |

## Current capability closing rules

A row marked **Merged** may still require live configuration/acceptance before user-facing claims about a real external service.

A row marked **Branch verified** is not shipped until merge + production exact-SHA verification.

GP2 remains NOT YET ACCEPTED until the owner acceptance ledger proves the entire hosted journey, including meaningful/noise source events, exact evidence, automatic generation/media preparation, exact review/judgment and recovery matrix.

Keep #161/#163/#167 open until their individual definitions of done are actually proven.
