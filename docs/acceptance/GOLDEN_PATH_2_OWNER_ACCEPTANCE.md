# Golden Path 2 — Owner Acceptance Ledger

> Status: **NOT YET ACCEPTED**
>
> This document is an evidence ledger, not a declaration of completion. Mark an item passed only when a credential-backed hosted run or deterministic recovery proof actually satisfies it. Never paste GitHub tokens, OAuth codes, webhook secrets, private source bodies, browser credentials, S3 credentials, signed object URLs, cookies, or raw private repository content here.

## Acceptance target

```text
real meaningful GitHub work event
  → verified GitHub App/source scope
  → one canonical ContentSignal with immutable source revision
  → exact repository evidence refresh at that revision
  → cheap noise gate / durable opportunity dispatch
  → ranked ContentOpportunity in Today
  → owner angle decision
  → exact project/source evidence snapshot
  → approved NarrativeStrategy
  → automatic bounded screenshot when required
  → private immutable AssetVersion + derivative
  → exact LinkedIn/X PlatformVariantRevision review
  → owner approval of exact visible text + media
```

A routine dependency-only or similarly low-value event must also be exercised and must **not** be promoted merely because a webhook arrived.

## Production checkpoint — verified 2026-09-19

Record only safe identifiers and states.

- Production Git SHA: `33295c64e306eee55644193b7dced567dbf410e6`
- Vercel production deployment ID: `dpl_CnJkXdG9mDntfqM9cFJQTwgDXwFW` — `READY`
- Production readiness: **not fully ready** — hosted inference is operationally blocked by `vercel_gateway_http_403`; remote CDP endpoint is not configured
- GitHub source connection safe ID: `signalflow-github-connection-794c1349-dbfa-414a-ae96-6ebb4444d0fd`
- Selected repository safe provider ID/name: GitHub repository ID `1269263906`, `Ankit6149/SignalFlow-Studio`
- Project ID: `sf-project-github-1269263906`
- Current live ingestion count: 21 GitHub Signals / 20 revision-bound / 189 bounded SourceArtifacts
- Current continuation state: 20 dead signal-opportunity jobs, 0 pending, 0 completed; latest jobs still fail once with safe error code `vercel_gateway_http_403`
- Current ProjectContextSnapshot count: 0
- Current ContentOpportunity count: 0

## A. Connection authority

- [ ] Owner-only GP2 readiness reports every required dependency configured without exposing secret values. **Blocked by inference + CDP, so not yet passable.**
- [x] GitHub App installation completes through signed setup state + separate owner OAuth authorization.
- [x] Exact installation identity is independently verified before persistence.
- [x] Repository selection is verified through installation authority.
- [x] SourceConnection becomes `active` with only the selected enabled repository scope.
- [ ] Pause/resume/revoke behavior remains correct after the live install.

Evidence:

- Safe connection status: `active`, verified, installed; no current connection error
- Permission scopes: `contents:read`, `metadata:read`, `pull_requests:read`
- Capabilities: `repository_contents`, `repository_events`, `repository_metadata`
- Latest observed GitHub event during audit: `2026-09-16T17:40:35Z`
- Initial first-install webhook 503 is historical/transitional; current event delivery is succeeding

## B. Real webhook and idempotency

### Meaningful event

- [ ] Use a real merged pull request with an exact GitHub `merge_commit_sha`, or a published release whose `target_commitish` is already an immutable Git SHA, as the final controlled GP2 positive acceptance event.
- [x] GitHub delivery signature is accepted by the hosted webhook in current production operation.
- [x] Delivery ID/event family is normalized safely for current live events.
- [x] Canonical ContentSignals are being persisted from live GitHub events.
- [x] Revision-bound live signals retain exact immutable source revisions.
- [x] Deterministic duplicate/burst delivery converges on one canonical Signal/job chain and cannot reopen completed work. **Final live duplicate-delivery evidence remains part of the hosted acceptance run.**
- [x] No raw credential material was exposed in the safe production evidence collected for this ledger.

Safe evidence:

- Revision-bound GitHub Signals: `20`
- Distinct immutable revisions: `20`
- Distinct external idempotency keys: `20`
- Distinct external event IDs: `20`
- Duplicate accumulation detected in current persisted set: `none`
- Reserved final positive acceptance event: PR #291, currently unmerged

### Noise event

- [ ] Exercise one explicit dependency-only/routine/trivial event fixture or real event as the final negative-control proof.
- [ ] Signal may remain auditable, but `shouldEvaluateOpportunity` is false or the resulting decision is non-promotional.
- [ ] No high-priority opportunity is manufactured from the event.

Safe evidence:

- An older GitHub signal exists with no immutable source revision and no continuation job; it is not being treated as promotional GP2 evidence.
- Final negative-control event class/decision: `TBD`

## C. Opportunity and exact evidence

- [x] Revision-bound live signals currently produce one durable continuation job each; 20 revision-bound Signals map to 20 durable jobs.
- [ ] Before opportunity inference, SignalFlow refreshes/reuses bounded repository evidence at the exact signal revision and completes ProjectContext synthesis. **99 bounded SourceArtifacts already exist, but inference blocks before ProjectContextSnapshot completion.**
- [x] Browser close/refresh is deterministically resumable through canonical hosted preparation state; final live hosted proof remains part of the acceptance run.
- [ ] Opportunity explains what changed, why now, evidence readiness, narrative fit, and repetition risk.
- [ ] Opportunity pins the exact `projectContextSnapshotId` used during evaluation.
- [ ] The pinned ProjectContextSnapshot resolves to immutable SourceArtifact IDs and the exact GitHub repository revision.
- [ ] Owner can choose an offered angle or `Something else` for the hosted GitHub-origin opportunity.

Safe evidence:

- Current SourceArtifact count: `189`
- Current ProjectContextSnapshot count: `0`
- Current ContentOpportunity count: `0`
- Current durable-job blocker: `vercel_gateway_http_403` on all 20 continuation jobs
- Owner-safe recovery path: merged PR #295; requeue remains gated on live inference readiness

## D. Evidence-backed planning

- [ ] NarrativeStrategy production is bound to the selected opportunity and its exact evidence context, not only free-form signal text.
- [ ] Exact snapshot/revision/artifact identities participate in task provenance and strategy identity without exposing repository identity or opaque SourceArtifact IDs in model prompt input.
- [ ] Strategy receives only the canonical minimized project synthesis, including safe claims, constraints/architecture context, and uncertainties allowed by the active privacy route.
- [ ] Strategy preserves factual/boundary constraints from the evidence-backed planning input.
- [ ] Strategy media requirement is meaningful for the chosen story; do not force a screenshot for a genuinely non-visual event.
- [ ] Approved strategy creates canonical ContentPiece + LinkedIn/X planned variants.

Safe evidence:

- Hosted planning implementation exists, but no GitHub-origin Opportunity has crossed the blocked inference boundary yet.

## E. Automatic screenshot vertical

For a visual proof event:

- [ ] Exact current PlatformVariantRevision requests screenshot production.
- [ ] Active CaptureRecipe/version + checkpoint are resolved for the same project.
- [ ] Exactly one durable CaptureJob is claimed by exact job ID.
- [ ] Privacy gate passes immediately before capture.
- [ ] Real PNG bytes are stored privately as an immutable canonical AssetVersion.
- [ ] Screenshot quality is `ready`; uncertainty remains `needs_review` and blocking quality fails closed.
- [ ] Required derivative is rendered with lineage.
- [ ] New media-bound PlatformVariantRevision preserves the exact text of its parent revision.
- [ ] Repeating a stale request does not duplicate capture/derivative/bound revisions.

Safe evidence:

- Current CaptureRecipe count: `0`
- Current CaptureJob count: `0`
- Current media record count: `0`
- `SIGNALFLOW_CDP_BROWSER_WS_ENDPOINT` still requires production configuration
- WSS transport + optional bearer-token support is already implemented
- Reserved Gate-C loading surface is compatible with planned `4:5` and `16:9` derivative generation under the current capture geometry

## F. Exact review and judgment

- [ ] LinkedIn and X exact immutable revisions are visible for the GitHub-origin acceptance opportunity.
- [ ] Evidence/authenticity critics are tied to the exact reviewed revision.
- [ ] Bound private media is streamed only through the protected exact-preview route.
- [ ] Every media-bound approval requires a valid short-lived visibility receipt for the exact AssetVersion.
- [ ] Changing media creates a new revision and cannot silently preserve the old media approval.
- [ ] Changing text does not regenerate/replace the selected exact media unless explicitly requested.
- [ ] Owner can approve, reject, edit, restore, and request a targeted change using stale-current guards.

Safe evidence:

- Hosted exact-review implementation is merged, but no GitHub-origin acceptance revision has reached owner judgment because continuation is blocked upstream.

## G. Recovery matrix

- [x] duplicate webhook delivery — deterministic concurrent delivery coverage converges on one stable Signal/job chain and cannot reopen completed work
- [x] unresolved/missing GitHub source revision remains without a continuation job in the observed legacy/non-promotable case
- [x] opportunity inference failure enters a durable dead state with safe code `vercel_gateway_http_403`; owner-safe bounded recovery is deployed but final retry success awaits healthy inference
- [x] source/project enrichment failure without connection loss — deterministic coverage schedules a safe retry, does not enter Opportunity inference, and preserves active verified GitHub authority
- [x] exact evidence refresh/revision mismatch blocks before opportunity inference
- [x] capture worker retry
- [x] privacy block
- [x] quality `needs_review`
- [x] derivative failure/block
- [x] one destination generation failure while successful work remains intact
- [x] stale browser tab / stale current revision
- [x] browser refresh/reopen during processing and after review

Current deterministic recovery evidence:

- 20 dead opportunity jobs are workspace-scoped and share the same safe error class.
- PR #295 provides bounded dead-only recovery and refuses requeue while inference is still unhealthy.
- No manual production SQL is required for final recovery.

For remaining cases, record whether state was `retryable`, `blocked`, `failed`, `non_promotional`, or safely resumed, plus the stable safe error code. Do not paste raw exception payloads if they could contain private source data.

## H. Release gates

Current `master` / recovery production:

- [x] frontend regression tests green for PR #295
- [x] production dependency audit green for PR #295
- [x] Next.js production build green for PR #295
- [x] Python tests green for PR #295
- [x] MCP tests green for PR #295
- [x] Vercel preview green for PR #295
- [x] Vercel production READY after merge
- [x] current runtime-error-cluster inspection showed no unresolved production error cluster during the recovery deployment audit window

Reserved Gate-C PR #291 after refresh onto hardened master:

- [ ] behind master: 10 as of the 2026-09-19 audit; refresh immediately before final live acceptance without changing the intended two-file Gate-C diff
- [x] diff remains exactly two intended loading-surface files
- [x] frontend regression tests green
- [x] production dependency audit green
- [x] Next.js production build green
- [x] Python tests green
- [x] MCP tests green
- [x] Vercel preview READY at refreshed commit `770a0284ebad79f387b592b331e9d3dcc1971d4a`
- [ ] merge #291 only after inference and CDP are operational for the live acceptance run
- [ ] final post-merge `master` CI green for Gate C
- [ ] final Vercel production READY on the exact Gate-C merged SHA
- [ ] final post-deploy runtime/data inspection clean or understood

## Current external blockers

1. Hosted inference: production AI Gateway generation currently returns HTTP 403. SignalFlow's raw OpenAI-compatible Gateway call follows Vercel's documented Bearer/OIDC contract, so treat this as an authorization/account condition unless a later credential-backed probe proves otherwise.
2. Remote screenshot execution: production still needs an approved WSS CDP endpoint, plus `SIGNALFLOW_CDP_BROWSER_AUTH_TOKEN` only if that provider requires bearer auth.

Do not merge #291, replay GitHub history, create manual Opportunities, or manually modify dead jobs while either blocker remains.

## Closing rule

Close #161, #163, and #167 only to the extent their individual Definitions of Done are actually evidenced above. GP2 is accepted only when the real hosted journey works from a real authorized GitHub event with an immutable source revision through exact owner judgment with no manual campaign manufacture and no manual screenshot/cropping step for the visual proof case.
