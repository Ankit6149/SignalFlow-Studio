# Golden Path 2 — Owner Acceptance Ledger

> Status: **NOT YET ACCEPTED**
>
> This is an evidence ledger, not a declaration of completion. Do not mark an item passed without a credential-backed hosted run or deterministic recovery proof that actually satisfies it. Never paste GitHub tokens, OAuth codes, webhook secrets, private source bodies, browser credentials, storage credentials, signed object URLs, cookies, or raw private repository content here.

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
  → automatic destination generation/reuse
  → automatic bounded screenshot when required
  → private immutable AssetVersion + derivative
  → exact media-bound LinkedIn/X PlatformVariantRevision
  → automatic exact critics
  → owner approval of exact visible text + media
```

A routine dependency-only or similarly low-value event must also be exercised and must **not** be promoted merely because a webhook arrived.

## Production checkpoint — 2026-09-04

Safe release evidence already established:

- Production Git SHA: `47954ff92cede61966956dd3536ea92ac5ca3288`
- Vercel production deployment ID: `dpl_7DCWxbrSPZxu8FD9A33fseTN9gDr`
- Production deployment state: `READY` on the exact Git SHA above
- Master CI: `#886` — frontend regressions, production dependency audit, Next production build, Python, and MCP all green
- Production runtime verification: no runtime error clusters and no warning/error/fatal logs in the inspected post-release window
- Gate A exact-review automation: released via #259
- Gate B automatic hosted preparation/resume: released via #261

Current live acceptance blocker:

- SignalFlow production source database contains **0 source connections, 0 selected source resources, 0 content signals, 0 source artifacts, 0 project-context snapshots, 0 opportunities, and 0 opportunity jobs**.
- Therefore a SignalFlow GitHub App installation/repository scope has not yet been completed in the production workspace.
- The ChatGPT GitHub connector is not acceptance evidence for the SignalFlow GitHub App and must not be substituted for the real source integration.

Safe IDs still to record after the real installation:

- Production readiness endpoint result: `TBD — owner-authenticated live check`
- GitHub source connection safe ID: `TBD`
- Selected repository safe provider ID/name: `TBD`
- Project ID: `TBD`

## A. Connection authority

- [ ] Owner-only GP2 readiness reports every required dependency configured without exposing secret values.
- [ ] GitHub App installation completes through signed setup state + owner authorization.
- [ ] Exact installation identity is independently verified before persistence.
- [ ] Repository selection is verified through installation authority.
- [ ] SourceConnection becomes `active` with only the selected enabled repository scope.
- [ ] Pause/resume/revoke behavior remains correct after the live install.

Evidence:

- Safe connection status: `TBD`
- Installation/repository permission class (names only): `TBD`
- Relevant run references: `TBD`

## B. Real webhook and idempotency

### Meaningful event

- [ ] Use a real merged pull request with an exact GitHub `merge_commit_sha`, or a published release whose target is already an immutable Git SHA.
- [ ] GitHub delivery signature is accepted by the hosted webhook.
- [ ] Delivery ID/event family is normalized safely.
- [ ] Exactly one canonical ContentSignal is persisted.
- [ ] The signal retains the exact immutable source revision used for evidence freshness.
- [ ] A duplicate delivery resolves to the same signal / does not create a second editorial chain.
- [ ] No raw private payload or credential material appears in logs/evidence.

Safe evidence:

- Delivery/event safe reference: `TBD`
- ContentSignal ID: `TBD`
- Exact source revision SHA: `TBD`
- Duplicate result: `TBD`

### Noise event

- [ ] Exercise one dependency-only/routine/trivial event.
- [ ] Signal may remain auditable, but `shouldEvaluateOpportunity` is false or the resulting decision is non-promotional.
- [ ] No high-priority opportunity is manufactured from the event.

Safe evidence:

- Noise event class: `TBD`
- Decision/status: `TBD`

## C. Opportunity and exact evidence

- [ ] Meaningful signal produces/reuses one durable opportunity job only when an exact source revision is available.
- [ ] Before opportunity inference, SignalFlow refreshes/reuses bounded repository evidence at the exact signal revision; failure blocks/retries instead of evaluating unrelated latest context.
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

## D. Evidence-backed planning and automatic preparation

Code-level behavior for this section is released, but the real credential-backed run remains required.

- [ ] NarrativeStrategy is bound to the selected opportunity and exact evidence context.
- [ ] Strategy receives only the canonical minimized project synthesis allowed by the active privacy route.
- [ ] Strategy preserves factual/boundary constraints from evidence-backed planning input.
- [ ] Strategy media requirement is meaningful for the chosen story; do not force a screenshot for a genuinely non-visual event.
- [ ] Owner explicitly approves the visible strategy.
- [ ] Approved strategy creates/reuses canonical ContentPiece + non-omitted LinkedIn/X planned variants.
- [ ] Preparation continues automatically after approval without routine Generate/Prepare/Retry clicks.
- [ ] Reopen automatically resumes idempotent preparation from durable state.

Safe evidence:

- NarrativeStrategy ID/revision: `TBD`
- Evidence context reference(s): `TBD`
- MediaRequirement decision: `TBD`
- ContentPiece ID: `TBD`

## E. Automatic screenshot vertical

For a visual proof event:

- [ ] Required screenshot is inferred/requested from the exact strategy.
- [ ] Active CaptureRecipe/version + checkpoint are resolved for the same project.
- [ ] Exactly one durable CaptureJob is claimed by exact job ID.
- [ ] Privacy gate passes immediately before capture.
- [ ] Real PNG bytes are stored privately as an immutable canonical AssetVersion.
- [ ] Screenshot quality is `ready`; uncertainty remains `needs_review` and blocking quality fails closed.
- [ ] Required derivative is rendered with lineage.
- [ ] New media-bound PlatformVariantRevision preserves the exact text of its parent revision.
- [ ] Repeating/reopening does not duplicate capture, derivative, or bound revisions.

Safe evidence:

- CaptureRecipe ID/version/checkpoint: `TBD`
- CaptureJob/durable job IDs and final states: `TBD`
- Raw Asset/AssetVersion IDs: `TBD`
- Quality review ID/state: `TBD`
- Derivative output AssetVersion IDs: `TBD`

## F. Exact automatic review and owner judgment

- [ ] LinkedIn and X exact immutable revisions are visible in Today/review.
- [ ] Evidence/authenticity critics are tied to the exact current revision and run automatically when judgment-ready.
- [ ] Existing current exact review is reused rather than duplicated.
- [ ] Required media blocks final owner judgment until bound.
- [ ] Bound private media is streamed only through the protected exact-preview route.
- [ ] Every media-bound approval requires a valid short-lived visibility receipt for the exact AssetVersion.
- [ ] Changing media creates a new revision and cannot silently preserve old media approval.
- [ ] Changing text does not replace selected exact media unless explicitly requested.
- [ ] Owner can approve, reject, edit, restore, and request targeted change using stale-current guards.

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
- [ ] automatic critic failure remains recoverable without false owner-ready state
- [ ] stale browser tab / stale current revision
- [ ] browser refresh/reopen during preparation and after review

For every case, record whether state was `retryable`, `blocked`, `failed`, `non_promotional`, or safely resumed, plus the stable safe error code.

## H. Release gates

For the current code candidate/releases:

- [x] frontend regression tests green
- [x] production dependency audit green
- [x] Next.js production build green
- [x] Python tests green
- [x] MCP tests green
- [x] exact-head Vercel preview green for #259 and #261
- [x] post-merge `master` CI green through #886
- [x] Vercel production READY on exact merged SHA `47954ff92cede61966956dd3536ea92ac5ca3288`
- [x] post-deploy runtime error inspection clean

These release checks prove the code release, **not** the remaining credential-backed GP2 owner acceptance.

## Closing rule

Close #167 only when the real hosted journey works from a real authorized SignalFlow GitHub App event with an immutable source revision through exact owner judgment, including the duplicate/noise proof and automatic screenshot path when visual evidence is required.

Do not start Golden Path 3 publication merely because the code-level GP2 pieces are green. The credential-backed Gate C proof remains the sequencing boundary.
