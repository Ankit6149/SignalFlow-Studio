# SignalFlow Studio Agent Guide

> **Synchronized:** 2 September 2026.
>
> This guide defines how an implementation agent should work in this repository. Read `docs/NEW_CHAT_HANDOFF_2026-09-02.md` and `docs/CURRENT_EXECUTION_STATE.md` first for the exact active PR/deployment frontier. Target architecture does not override current capability truth.

## Mission

SignalFlow Studio is an approval-first **content operating system**.

Canonical lifecycle:

```text
Work / manual thought / Direct Create / connected source
  → ContentSignal / explicit creative intent
  → ContentOpportunity
  → owner angle judgment
  → NarrativeStrategy
  → Evidence + MediaRequirement / MediaPlan
  → text/media production
  → immutable PlatformVariant revision(s)
  → exact evidence/authenticity review
  → exact owner judgment
  → editorial timing / PublicationRequest
  → durable publication
  → confirmed NarrativeMemory + eligible feedback learning
```

> **The user's job is judgment. SignalFlow's job is everything between the work and that judgment.**

Do not turn SignalFlow into a generic post generator, prompt wrapper, manually filled scheduler, random browser agent, or professional creative-suite replacement.

## Read order

Before changing product behavior, read:

1. `docs/NEW_CHAT_HANDOFF_2026-09-02.md`
2. `docs/CURRENT_EXECUTION_STATE.md`
3. `docs/IMPLEMENTATION_LEDGER.md`
4. `docs/acceptance/GOLDEN_PATH_2_OWNER_ACCEPTANCE.md`
5. `docs/PRODUCT_VISION.md`
6. `docs/PERSONAL_ALPHA_EXECUTION.md`
7. `docs/CONTENT_INTELLIGENCE_ARCHITECTURE.md`
8. `docs/IDENTITY_MEMORY_AND_AUTHENTICITY.md`
9. `docs/INFERENCE_AND_PRIVACY_ARCHITECTURE.md`
10. `docs/AI_CLIENT_INTEGRATIONS.md`
11. `docs/CLIENT_ECOSYSTEM_AND_EDGE_AGENT.md`
12. `docs/MEDIA_INTELLIGENCE_AND_CREATIVE_PRODUCTION.md`
13. `docs/CREATIVE_MEDIA_DOMAIN_CONTRACTS.md`
14. `docs/CAPTURE_AND_MEDIA_PRODUCTION.md`
15. `docs/EDITORIAL_CALENDAR_AND_PUBLISHING.md`
16. `docs/PRODUCT_INFORMATION_ARCHITECTURE.md`
17. `docs/CAPABILITY_MATRIX.md`
18. `docs/DOMAIN_ARCHITECTURE.md`
19. `docs/SOURCE_ASSET_CONTRACT.md`
20. `docs/CAMPAIGN_EDITING_AND_VERSIONING.md`
21. `docs/CONNECTOR_READINESS.md`
22. `SECURITY.md`

When sources conflict, use this truth order:

1. current code/tests/exact Git/PR metadata;
2. credential-backed deployed/runtime evidence;
3. current execution/handoff docs;
4. capability/readiness/implementation ledgers;
5. canonical architecture docs for intended design;
6. older issues/history for rationale.

## Exact current frontier

### Master / production

- master SHA: `ea71fa39836dfadddd70f0fe5a135c2f4d8ce9e0`
- production deployment: `dpl_ExhZUutbj3peG3BKX1FLDLmJe7Ez`
- production exact SHA: same master SHA
- state at checkpoint: READY

### Golden Paths

- GP1: accepted.
- GP2: active, substantially built, **not owner-accepted**.
- GP3: parked until GP2 acceptance.

### Active PR #259

- title: `GP2: automate exact review before owner judgment`
- branch: `feat/gp2-auto-exact-review`
- exact head: `6df646f76151e6544dbd506eb7e41909b83cb8cd`
- final diff: 10 product/test files
- CI #877: all required GitHub jobs green
- PR: non-draft, mergeable, zero review threads/reviews at checkpoint
- blocker: final exact-head Vercel preview has not executed because an account-level build-rate gate rejected it before build execution

**Do not modify #259 just to retry Vercel. Do not merge until this exact SHA gets a genuine READY preview.**

### Parked GP3 branch

- `feat/editorial-execution-layer`
- SHA `b53f8faec74b346bc65c694a908728af46827322`
- do not activate before GP2 owner acceptance.

## Current next implementation slice

After #259 merges and production is verified, the next GP2 vertical is:

```text
approved NarrativeStrategy
  → automatic destination generation/reuse
  → automatic required screenshot production
  → automatic exact review
  → Today
  → owner judgment
```

The owner should not normally click `Generate drafts`, `Prepare visual proof`, or `Run exact checks` merely to move a healthy strategy into a judgment-ready state.

Manual controls may remain for explicit recovery/override, but the successful path must be automatic and durable.

Do **not** start GP3 instead.

## Architecture direction

Dependency direction:

```text
UI / routes / MCP / extension / mobile / edge / webhook / workers
                            ↓
                   application services
                            ↓
                    domain records + ports
                            ↑
 browser / Postgres / object storage / provider / local / connector / renderer adapters
```

Do not create duplicate persistence/planning/generation/media engines for a new client or Golden Path.

## Core domain rules

### Signals

- A signal is evidence/context, not generated copy.
- GitHub is one source, not the whole product.
- Manual thoughts and Direct Create remain first-class.
- Not every event deserves an opportunity.
- Event ingestion must be authorized, idempotent and provenance-preserving.
- A missing exact immutable source revision may remain auditable but must not be promoted into exact-evidence opportunity inference.

### GitHub exact-revision rule

For a merged PR:

- use `merge_commit_sha` as immutable merge evidence;
- never substitute PR head SHA as merge evidence.

For a release:

- promote only when the target is already an immutable Git SHA or exact resolution is explicitly supported/proven;
- mutable branch/ref targets remain non-promotional until safely resolved.

Do not bump the ContentSignal schema merely for the additive optional `sourceRevision` field.

### Opportunities

- Scoring/ranking must be explainable.
- `do not post` is a valid outcome.
- Noise/routine dependency events must not become manufactured high-priority content.
- Opportunity inference must use/reuse exact evidence refreshed at the signal's immutable source revision.
- Exact evidence mismatch/failure blocks or retries before inference; do not silently fall back to unrelated latest context.

### Identity/authenticity

- Identity is not a tone dropdown.
- Explicit owner boundaries outrank engagement optimization and learned preferences.
- StyleMemory and NarrativeMemory are separate.
- Learned preferences must be evidence-backed, inspectable and removable.

### Inference/privacy

- Application code asks for task capabilities, not hard-coded provider brands.
- Fallback must re-check capability, quality, budget and privacy; never silently reduce privacy.
- Private/protected source material is minimized before remote inference where policy requires it.
- Private repository owner/name and opaque SourceArtifact IDs do not belong in model prompts merely for provenance.
- Reuse canonical ProjectContext minimization.
- Exact IDs/revisions belong in canonical records/fingerprints/task provenance where required.
- Secret material must not become normal model input.

### Media intent/use

- Upload does not mean permission to publish.
- MIME type does not define intended use.
- `NONE` is a valid MediaDecision.
- Reference/evidence/private assets cannot silently become publication media.
- Originals stay immutable; edits/captures/renders produce derived revisions with lineage.
- Prefer deterministic composition for exact product UI, screenshots, typography and repeatable demos.
- Do not generatively alter factual evidence while presenting it as unchanged exact UI.

### Revisions/approval

- Approval binds an exact current revision, never `latest` implicitly.
- A stale client cannot approve unseen newer text/media.
- Required non-text strategy media must exist before a revision can surface as a final Today decision or be approved.
- Media-bound approval requires protected exact preview plus short-lived signed visibility receipt for each exact AssetVersion.
- Media changes create immutable rebound revisions and preserve parent text unless text change was separately requested.
- Text changes do not silently replace selected media.
- Critic failure must not invalidate successfully persisted immutable drafts.

### Capture

- Use bounded CaptureRecipes, never arbitrary script/shell/random unrestricted browsing.
- Enforce origin/target/privacy boundaries again at the worker layer.
- Run privacy checks immediately before capture where required.
- Store real output as canonical private immutable Assets with provenance.
- Quality uncertainty remains `needs_review`; blocking quality/privacy fails closed.
- Derivatives preserve lineage.
- Exact request/job identity must be idempotent; stale retries must not duplicate bound revisions.

### Publishing

- Publishing is an external reputational side effect.
- Publication intent freezes exact text/media/target/approval/source state.
- Durable workers own scheduled/immediate external execution; browser timers do not.
- Duplicate request/job delivery creates at most one external publication.
- `unknown` is a truthful external outcome and must not be blindly retried.
- NarrativeMemory gains strong public state only after confirmed publication.

## Hosted owner/auth rules

- `/api/gp2/readiness` remains owner-only.
- Public-hosted/Vercel mode with missing owner access key fails closed.
- Local/self-hosted no-key behavior may remain intentionally unlocked where explicitly designed.
- Owner auth/readiness responses must be private/no-store.
- Do not leak raw secret/config values in readiness/UI/errors.
- Never request that the owner paste access keys, GitHub secrets, OAuth codes, webhook secrets, S3 credentials, CDP credentials or signed private object URLs into chat/issue evidence.

## GP2 #259 behavioral rules

PR #259 introduces automatic exact-review preparation.

Normal path:

- generated/regenerated/edited/restored exact revisions auto-review;
- valid current exact review is reused;
- required non-text media defers review until bound;
- successful screenshot media rebound auto-reviews final revision;
- critic failure is fail-soft and bounded;
- manual exact-check action is recovery-only.

Defense-in-depth required-media enforcement exists at:

1. preparation;
2. Today projection;
3. hosted approval API.

Do not remove one layer because another exists.

A final diff audit caught a compile-green runtime bug where GET `/api/platform-review` accidentally referenced `result.bundle`. The final contract is regression-locked:

- GET → `responseBundle(apps, contentPieceId)`;
- `generate_ready` → already-successful `result.bundle` plus bounded review-preparation status.

Treat this as a reminder that normal CI does not replace final runtime/diff audit.

## Failure semantics

For every pipeline stage, distinguish:

- successful persisted work;
- retryable downstream preparation;
- blocked privacy/quality state;
- non-promotional/noise state;
- hard failure;
- unknown external side-effect outcome.

Do not collapse these into one generic `failed` state.

Partial destination failure must preserve successful destination revisions.

Browser refresh/reopen must reconstruct canonical state; it must not become a hidden new source of truth.

## Repository workflow

For substantive changes:

```text
read current handoff/status
→ identify one vertical owner outcome
→ focused branch
→ implement only required domain/application/adapter/UI changes
→ focused tests
→ full regression/audit/build
→ PR
→ final high-risk diff audit
→ exact-head preview when applicable
→ verify review threads/reviews/mergeability
→ merge with expected head SHA
→ master CI
→ exact-SHA production verification
→ runtime inspection
→ owner acceptance when promised
→ truthful issue/docs update
→ branch cleanup
```

### Do not

- merge red CI;
- weaken unrelated tests to manufacture green;
- close issues because code exists when live acceptance is still missing;
- use old READY previews as evidence for a newer SHA;
- create no-op commits to force hosting retries;
- start another broad foundation branch while the active Golden Path lacks acceptance;
- merge all branches indiscriminately;
- delete the intentionally parked GP3 branch before its role is resolved;
- claim future architecture as shipped capability.

## Vercel preview discipline

Feature/helper commits can consume preview capacity. Temporary maintenance work should avoid creating unnecessary hosted previews wherever configuration/workflow safely permits it.

If an exact candidate is rejected before build because of account-level deployment/rate gating:

- record it as infrastructure gating, not a code build failure;
- keep candidate SHA stable;
- do not use a prior preview as evidence;
- do not weaken the release gate;
- resume merge only after that exact SHA genuinely builds READY.

## GP2 acceptance rule

Canonical ledger: `docs/acceptance/GOLDEN_PATH_2_OWNER_ACCEPTANCE.md`.

Keep #161/#163/#167 open until a real credential-backed hosted run proves the applicable definitions of done.

Required recovery evidence includes duplicate webhook, missing exact revision, inference retry, evidence mismatch, capture retry, privacy block, quality needs-review, derivative block, partial destination generation failure, critic failure, stale browser/current revision and refresh/reopen continuity.

## Current immediate sequence

At the next implementation session:

1. re-fetch #259 and exact head;
2. check exact-head Vercel deployment/status;
3. if READY, re-check CI/review state/mergeability and squash-merge with expected head;
4. verify master CI + exact-SHA production READY + runtime errors;
5. clean merged branch;
6. build automatic post-strategy preparation orchestration;
7. run real GP2 owner acceptance;
8. close only proven #161/#163/#167 criteria;
9. then activate GP3.

## Completion standard

A feature is complete only when its actual user promise is demonstrated at the correct boundary.

`code exists` is not completion.

`tests green` is not merge.

`merged` is not production.

`production READY` is not necessarily credential-backed Golden Path acceptance.

Keep those states explicit in code, docs, issues and user-facing claims.
