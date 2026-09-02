# Golden Path 2 — Owner Acceptance Ledger

> **Status: NOT YET ACCEPTED**
>
> **Synchronized:** 2 September 2026.
>
> This file is an evidence ledger, not a declaration of completion. Do not mark an item passed without a credential-backed hosted run or deterministic recovery proof that actually satisfies it.
>
> Never paste GitHub tokens, OAuth codes, webhook secrets, owner access keys, private source bodies, browser/CDP credentials, S3 credentials, signed object URLs, cookies, or raw private repository content into this ledger.

## 0. Current pre-acceptance engineering checkpoint

### Production baseline

- production master SHA: `ea71fa39836dfadddd70f0fe5a135c2f4d8ce9e0`
- production deployment: `dpl_ExhZUutbj3peG3BKX1FLDLmJe7Ez`
- production state at synchronization: READY
- latest merged product slice: PR #258 — hosted exact revision decisions unified into Today

### Active unmerged acceptance-preparation PR

- PR: #259 — `GP2: automate exact review before owner judgment`
- branch: `feat/gp2-auto-exact-review`
- exact head: `6df646f76151e6544dbd506eb7e41909b83cb8cd`
- final diff: 10 product/test files
- CI #877: frontend regression, production dependency audit, Next production build, Python and MCP all PASS
- PR metadata: non-draft, mergeable, zero review threads/reviews at checkpoint
- exact-head Vercel preview: **NOT EXECUTED**; account-level build-rate gate rejected the deployment before build execution
- merge rule: do not merge #259 until this exact SHA receives a genuine READY Vercel preview

Earlier READY #259 branch previews are not accepted as evidence for the final head because later runtime-route correction/regression changes altered the candidate.

### What #259 contributes to this ledger

Once merged/production-verified, #259 is expected to provide:

- automatic exact evidence/authenticity review after exact revision generation/regeneration/edit/restore;
- review reuse when the exact current review already exists;
- critic failure as recoverable downstream preparation rather than loss of persisted generation;
- required non-text media deferral until the final media-bound revision exists;
- automatic exact review after successful screenshot media rebound;
- required-media enforcement at preparation + Today + hosted approval;
- recovery-only `Retry exact checks` instead of manual critic initiation on normal success.

This is **not** owner acceptance by itself.

### Remaining low-attention product gap after #259

The current hosted Plan path still contains routine owner preparation actions for:

- destination draft generation;
- required screenshot preparation.

Before GP2 can satisfy its intended low-attention acceptance shape, the next vertical must make normal preparation automatic:

```text
approved NarrativeStrategy
→ automatic destination generation/reuse
→ automatic required screenshot when justified
→ automatic exact review
→ Today
→ owner judgment
```

## 1. Acceptance target

The accepted visual-proof journey is:

```text
real meaningful GitHub work event
  → verified GitHub App/source authority
  → exactly one canonical ContentSignal with immutable source revision
  → exact repository evidence refresh/reuse at that revision
  → cheap noise gate + durable opportunity dispatch
  → ranked ContentOpportunity in Today
  → owner angle judgment
  → exact ProjectContext/SourceArtifact evidence snapshot
  → evidence-bound approved NarrativeStrategy
  → automatic platform generation
  → automatic bounded screenshot when the strategy actually requires it
  → private immutable AssetVersion + deterministic derivative
  → immutable media-bound PlatformVariantRevision preserving exact text
  → automatic exact evidence/authenticity review
  → exact LinkedIn/X judgment-ready decisions in Today
  → protected exact-media preview + visibility receipt
  → owner approval/change/rejection of exact visible text + media
```

A routine dependency-only or similarly low-value event must also be exercised and must **not** be promoted merely because a webhook arrived.

## 2. Production checkpoint

Record safe identifiers/states only after the actual acceptance run.

- Production Git SHA: `TBD`
- Vercel production deployment ID: `TBD`
- Production readiness endpoint result: `TBD`
- GitHub source connection safe ID: `TBD`
- Selected repository safe provider ID/name: `TBD`
- Project ID: `TBD`
- ContentPiece ID: `TBD`

Do not pre-fill these from feature-branch/pre-acceptance evidence.

## A. Connection authority

- [ ] Owner-only GP2 readiness reports every required dependency configured without exposing secret values.
- [ ] GitHub App installation completes through signed setup state + separate owner OAuth authorization.
- [ ] Exact installation identity is independently verified before persistence.
- [ ] Repository selection is verified through installation authority.
- [ ] SourceConnection becomes `active` with only the selected enabled repository scope.
- [ ] Pause/resume/revoke behavior remains correct after the live install.
- [ ] Anonymous/unowned browser state cannot manage the source connection.
- [ ] Hosted deployment with missing owner lock fails closed rather than silently becoming owner-authorized.

Evidence:

- Safe connection status: `TBD`
- Installation/repository permission class (names only): `TBD`
- Readiness state (safe names only): `TBD`
- Relevant test/run references: `TBD`

## B. Real webhook and idempotency

### Meaningful event

- [ ] Use a real merged pull request with an exact GitHub `merge_commit_sha`, or a published release whose `target_commitish` is already an immutable Git SHA.
- [ ] Do not substitute PR head SHA as merged-PR evidence.
- [ ] A release whose target is only a mutable branch/ref remains auditable but non-promotional until exact-ref resolution is explicitly supported/proven.
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
- [ ] Signal may remain auditable, but `shouldEvaluateOpportunity` is false or the durable decision is explicitly non-promotional.
- [ ] No high-priority opportunity is manufactured from the event.
- [ ] The noise event does not cause screenshot/media generation merely because it arrived.

Safe evidence:

- Noise event class: `TBD`
- Decision/status: `TBD`

## C. Opportunity and exact evidence

- [ ] Meaningful signal produces/reuses one durable opportunity job only when an exact source revision is available.
- [ ] Before opportunity inference, SignalFlow refreshes/reuses bounded repository evidence at the exact signal revision.
- [ ] Exact evidence refresh failure blocks/retries the job instead of evaluating against unrelated latest repository context.
- [ ] Exact revision mismatch fails closed before opportunity inference.
- [ ] Browser close/refresh does not destroy pending or completed continuation state.
- [ ] Opportunity explains what changed, why now, evidence readiness, narrative fit and repetition risk.
- [ ] Opportunity pins the exact `projectContextSnapshotId` used during evaluation.
- [ ] The pinned ProjectContextSnapshot resolves to immutable SourceArtifact IDs and the exact GitHub repository revision.
- [ ] Owner can choose an offered angle or `Something else`.
- [ ] Today does not auto-select the owner's angle.

Safe evidence:

- Opportunity ID: `TBD`
- ProjectContextSnapshot ID/version/fingerprint: `TBD`
- GitHub revision SHA/reference: `TBD`
- SourceArtifact IDs/count: `TBD`
- Selected angle ID/origin: `TBD`

## D. Evidence-backed planning

- [ ] NarrativeStrategy production is bound to the selected Opportunity and its exact evidence context, not only free-form signal text.
- [ ] Exact snapshot/revision/artifact identities participate in task provenance/strategy identity without leaking unnecessary repository identity or opaque SourceArtifact IDs into the model prompt.
- [ ] Strategy model input uses canonical minimized project synthesis: safe claims, architecture/constraints and uncertainties allowed by active privacy policy.
- [ ] Strategy preserves factual/boundary constraints from evidence-backed planning input.
- [ ] Strategy media requirement is meaningful for the chosen story; do not force a screenshot for a genuinely non-visual event.
- [ ] Approved strategy creates canonical ContentPiece + intended LinkedIn/X planned variants.
- [ ] Owner approval of strategy is the last routine preparation judgment before automatic destination/media preparation begins.

Safe evidence:

- NarrativeStrategy ID/revision: `TBD`
- Evidence context reference(s): `TBD`
- MediaRequirement decision: `TBD`
- ContentPiece ID: `TBD`

## E. Automatic post-strategy preparation

This section is required before GP2 can be called low-attention accepted.

- [ ] After exact NarrativeStrategy approval, normal destination generation starts/reuses automatically without an owner `Generate drafts` click.
- [ ] Already-successful current destination revisions are reused rather than regenerated.
- [ ] One destination failure does not erase/restart another destination's successful revision.
- [ ] When required screenshot media is present in the strategy, screenshot production starts/reuses automatically without an owner `Prepare visual proof` click.
- [ ] Optional/non-required media does not block judgment unnecessarily.
- [ ] Required-media preparation remains exact-current/stale-safe.
- [ ] Browser refresh/reopen reconstructs the preparation state instead of starting duplicate work.
- [ ] A normal successful path ends in Today with judgment-ready revisions rather than exposing internal pipeline controls.
- [ ] Recovery controls appear only for bounded exceptions/failures.

Safe evidence:

- Preparation application/job safe ID(s): `TBD`
- LinkedIn preparation state: `TBD`
- X preparation state: `TBD`
- Required media state: `TBD`

## F. Automatic screenshot vertical

For a visual-proof event:

- [ ] Exact current PlatformVariantRevision requests/reuses screenshot production.
- [ ] Active CaptureRecipe/version + checkpoint are resolved for the same project.
- [ ] Exactly one durable CaptureJob is claimed by exact job ID.
- [ ] Request-scoped capture cannot steal another queued job.
- [ ] Privacy gate passes immediately before capture.
- [ ] Real PNG bytes are stored privately as an immutable canonical AssetVersion.
- [ ] Screenshot quality is `ready`; uncertainty remains `needs_review`; blocking quality/privacy fails closed.
- [ ] Required derivative is rendered with exact lineage.
- [ ] New media-bound PlatformVariantRevision preserves the exact text of its parent revision.
- [ ] Repeating a stale/retried request does not duplicate capture/derivative/bound revisions.
- [ ] No private storage object key/credential/permanent URL reaches browser-facing response.

Safe evidence:

- CaptureRecipe ID/version/checkpoint: `TBD`
- CaptureJob/durable job IDs and final states: `TBD`
- Raw Asset/AssetVersion IDs: `TBD`
- Quality review ID/state: `TBD`
- Derivative plan/variant/output AssetVersion IDs: `TBD`
- Media-bound revision ID: `TBD`

## G. Exact automatic review and owner judgment

- [ ] LinkedIn and X exact immutable revisions are visible.
- [ ] Evidence/authenticity critics are automatically tied to the exact current judgment-ready revision.
- [ ] Existing exact current reviews are reused instead of duplicating inference.
- [ ] Critic failure leaves the immutable revision durable and returns a bounded recovery state.
- [ ] Required non-text media defers final exact review until media is actually bound.
- [ ] A required-media text-only revision cannot surface in Today as final judgment.
- [ ] Direct/stale API approval also fails with `required_media_pending` when required media is absent.
- [ ] Bound private media is streamed only through the protected exact-preview route.
- [ ] Every media-bound approval requires a valid short-lived visibility receipt for each exact AssetVersion.
- [ ] Changing media creates a new revision and cannot silently preserve old media approval.
- [ ] Changing text does not regenerate/replace selected exact media unless explicitly requested.
- [ ] Owner can approve, reject, edit, restore and request a targeted change using stale-current guards.
- [ ] Manual `Retry exact checks` is recovery-only, not normal success flow.

Safe evidence:

- LinkedIn revision ID/review/decision: `TBD`
- X revision ID/review/decision: `TBD`
- Exact-media safe IDs shown: `TBD`
- Recovery-only review retry exercised: `TBD`

## H. Browser/reopen continuity

- [ ] Closing/reopening browser after Opportunity does not lose canonical hosted state.
- [ ] Closing/reopening after strategy approval does not duplicate generation/media preparation.
- [ ] Closing/reopening during capture/retry reconstructs durable state.
- [ ] Closing/reopening after exact review reconstructs Today decision.
- [ ] Local browser adapters are not used as canonical storage for hosted exact review records.
- [ ] Hosted state unavailability never becomes false `ALL CLEAR`.

Evidence: `TBD`

## I. Recovery matrix

Exercise and record each state as `retryable`, `blocked`, `failed`, `non_promotional`, `unknown`, or safely resumed.

- [ ] duplicate webhook delivery
- [ ] unresolved/missing GitHub exact source revision remains non-promotional
- [ ] mutable release target remains non-promotional
- [ ] opportunity inference failure + retry
- [ ] source/project enrichment failure without connection loss
- [ ] exact evidence refresh/revision mismatch blocks before inference
- [ ] browser refresh/reopen during opportunity processing
- [ ] one destination generation failure while successful work remains intact
- [ ] automatic critic failure with persisted revision intact
- [ ] capture worker retry
- [ ] privacy block
- [ ] screenshot quality `needs_review`
- [ ] screenshot quality blocked
- [ ] derivative failure/block
- [ ] stale browser tab / stale current revision
- [ ] repeat/stale screenshot request remains idempotent
- [ ] media replacement creates new revision/invalidates stale approval
- [ ] browser refresh/reopen after exact review

For every case record only safe stable error/state codes. Do not paste raw exception payloads if they could contain private source/media data.

## J. Release gates

### Candidate PR gate

- [ ] focused slice tests green
- [ ] frontend regression tests green
- [ ] production dependency audit green
- [ ] Next.js production build green
- [ ] Python tests green
- [ ] MCP tests green
- [ ] exact-head Vercel preview READY/success
- [ ] PR mergeable
- [ ] no unresolved review threads/blocking reviews
- [ ] final high-risk diff audit complete

### Post-merge gate

- [ ] master CI green on merged SHA
- [ ] Vercel production READY on exact merged SHA
- [ ] post-deploy error/fatal runtime-log inspection clean or understood
- [ ] owner/session/readiness/source-management anonymous probes remain fail-closed/no-store where applicable
- [ ] no secret values appear in responses/log evidence
- [ ] merged implementation branch deleted after verification

## K. Current open issues / closing rule

Keep open until the evidence above proves the applicable Definition of Done:

- #161 — GitHub App/webhook event ingestion into canonical ContentSignals
- #163 — campaign-ready screenshots/derivatives from CaptureRecipes
- #167 — Golden Path 2 complete owner outcome

Close each only to the extent its **individual** acceptance criteria are actually satisfied.

Do not close all three merely because one end-to-end run passes a subset.

## Closing rule

GP2 is accepted only when a real hosted authorized GitHub journey works from exact immutable source event through automatic evidence/media preparation to exact owner judgment, with no manual campaign manufacture and no routine manual screenshot/cropping/critic initiation for the visual-proof success case.

The ledger must remain `NOT YET ACCEPTED` until that proof exists.
