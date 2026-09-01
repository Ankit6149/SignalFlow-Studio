# Golden Path 2 — Owner Acceptance Ledger

> Status: **NOT YET ACCEPTED**
>
> This document is an evidence ledger, not a declaration of completion. Do not mark an item passed without a credential-backed hosted run or deterministic recovery proof that actually satisfies it. Never paste GitHub tokens, OAuth codes, webhook secrets, private source bodies, browser credentials, S3 credentials, signed object URLs, cookies, or raw private repository content here.

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

## Production checkpoint

Record only safe identifiers and states.

- Production Git SHA: `TBD`
- Vercel production deployment ID: `TBD`
- Production readiness endpoint result: `TBD`
- GitHub source connection safe ID: `TBD`
- Selected repository safe provider ID/name: `TBD`
- Project ID: `TBD`

## A. Connection authority

- [ ] Owner-only GP2 readiness reports every required dependency configured without exposing secret values.
- [ ] GitHub App installation completes through signed setup state + separate owner OAuth authorization.
- [ ] Exact installation identity is independently verified before persistence.
- [ ] Repository selection is verified through installation authority.
- [ ] SourceConnection becomes `active` with only the selected enabled repository scope.
- [ ] Pause/resume/revoke behavior remains correct after the live install.

Evidence:

- Safe connection status: `TBD`
- Installation/repository permission class (names only): `TBD`
- Relevant test/run references: `TBD`

## B. Real webhook and idempotency

### Meaningful event

- [ ] Use a real merged pull request with an exact GitHub `merge_commit_sha`, or a published release whose `target_commitish` is already an immutable Git SHA.
- [ ] A release whose target is only a mutable branch/ref remains an auditable signal but is not promoted until exact-ref resolution support exists; do not treat that case as GP2 acceptance evidence.
- [ ] GitHub delivery signature is accepted by the hosted webhook.
- [ ] Delivery ID/event family is normalized safely.
- [ ] Exactly one canonical ContentSignal is persisted.
- [ ] The canonical signal retains the exact immutable source revision used for evidence freshness.
- [ ] A duplicate delivery resolves to the same signal / does not create a second editorial chain.
- [ ] No raw private payload or credential material appears in logs/evidence.

Safe evidence:

- Delivery/event safe reference: `TBD`
- ContentSignal ID: `TBD`
- Exact source revision SHA: `TBD`
- Duplicate result: `TBD`

### Noise event

- [ ] Exercise one dependency-only/routine/trivial event fixture or real event.
- [ ] Signal may remain auditable, but `shouldEvaluateOpportunity` is false or the resulting decision is non-promotional.
- [ ] No high-priority opportunity is manufactured from the event.

Safe evidence:

- Noise event class: `TBD`
- Decision/status: `TBD`

## C. Opportunity and exact evidence

- [ ] Meaningful signal produces/reuses one durable opportunity job only when an exact source revision is available.
- [ ] Before opportunity inference, SignalFlow refreshes/reuses bounded repository evidence at the exact signal revision; failure blocks/retries the job instead of evaluating against unrelated latest context.
- [ ] Browser close/refresh does not destroy pending or completed continuation state.
- [ ] Opportunity explains what changed, why now, evidence readiness, narrative fit, and repetition risk.
- [ ] Opportunity pins the exact `projectContextSnapshotId` used during evaluation.
- [ ] The pinned ProjectContextSnapshot resolves to immutable SourceArtifact IDs and the exact GitHub repository revision.
- [ ] Owner can choose an offered angle or `Something else`.

Safe evidence:

- Opportunity ID: `TBD`
- ProjectContextSnapshot ID/version/fingerprint: `TBD`
- GitHub revision SHA/reference: `TBD`
- SourceArtifact IDs/count: `TBD`
- Selected angle ID/origin: `TBD`

## D. Evidence-backed planning

- [ ] NarrativeStrategy production is bound to the selected opportunity and its exact evidence context, not only free-form signal text.
- [ ] Exact snapshot/revision/artifact identities participate in task provenance and strategy identity without exposing repository identity or opaque SourceArtifact IDs in model prompt input.
- [ ] Strategy receives only the canonical minimized project synthesis, including safe claims, constraints/architecture context, and uncertainties allowed by the active privacy route.
- [ ] Strategy preserves factual/boundary constraints from the evidence-backed planning input.
- [ ] Strategy media requirement is meaningful for the chosen story; do not force a screenshot for a genuinely non-visual event.
- [ ] Approved strategy creates canonical ContentPiece + LinkedIn/X planned variants.

Safe evidence:

- NarrativeStrategy ID/revision: `TBD`
- Evidence context reference(s): `TBD`
- MediaRequirement decision: `TBD`

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

- CaptureRecipe ID/version/checkpoint: `TBD`
- CaptureJob/durable job IDs and final states: `TBD`
- Raw Asset/AssetVersion IDs: `TBD`
- Quality review ID/state: `TBD`
- Derivative plan/variant/output AssetVersion IDs: `TBD`

## F. Exact review and judgment

- [ ] LinkedIn and X exact immutable revisions are visible.
- [ ] Evidence/authenticity critics are tied to the exact reviewed revision.
- [ ] Bound private media is streamed only through the protected exact-preview route.
- [ ] Every media-bound approval requires a valid short-lived visibility receipt for the exact AssetVersion.
- [ ] Changing media creates a new revision and cannot silently preserve the old media approval.
- [ ] Changing text does not regenerate/replace the selected exact media unless explicitly requested.
- [ ] Owner can approve, reject, edit, restore, and request a targeted change using stale-current guards.

Safe evidence:

- LinkedIn revision ID/review/decision: `TBD`
- X revision ID/review/decision: `TBD`
- Exact-media safe IDs shown: `TBD`

## G. Recovery matrix

- [ ] duplicate webhook delivery
- [ ] unresolved/missing GitHub source revision remains non-promotional
- [ ] opportunity inference failure + retry
- [ ] source/project enrichment failure without connection loss
- [ ] exact evidence refresh/revision mismatch blocks before opportunity inference
- [ ] capture worker retry
- [ ] privacy block
- [ ] quality `needs_review`
- [ ] derivative failure/block
- [ ] one destination generation failure while successful work remains intact
- [ ] stale browser tab / stale current revision
- [ ] browser refresh/reopen during processing and after review

For every case, record whether state was `retryable`, `blocked`, `failed`, `non_promotional`, or safely resumed, plus the stable safe error code. Do not paste raw exception payloads if they could contain private source data.

## H. Release gates

- [ ] frontend regression tests green
- [ ] production dependency audit green
- [ ] Next.js production build green
- [ ] Python tests green
- [ ] MCP tests green
- [ ] Vercel preview green
- [ ] post-merge `master` CI green
- [ ] Vercel production READY on the exact merged SHA
- [ ] post-deploy error/fatal runtime-log inspection clean or understood

## Closing rule

Close #161, #163, and #167 only to the extent their individual Definitions of Done are actually evidenced above. GP2 is accepted only when the real hosted journey works from a real authorized GitHub event with an immutable source revision through exact owner judgment with no manual campaign manufacture and no manual screenshot/cropping step for the visual proof case.
