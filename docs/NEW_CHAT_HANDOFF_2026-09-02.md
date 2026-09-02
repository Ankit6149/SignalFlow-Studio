# SignalFlow Studio — New Chat Handoff — 2 September 2026

> **Use this file first in the next execution chat.**
>
> It records the exact repository/PR/deployment frontier, the key architectural/security decisions that must not regress, the current external blocker, and the precise next implementation sequence.
>
> Historical product/architecture docs remain useful for rationale and target design. For current execution truth, this handoff + `CURRENT_EXECUTION_STATE.md` supersede older status snapshots.

## 1. Product identity

SignalFlow Studio is an approval-first **content operating system**.

Core principle:

> **The user's job is judgment. SignalFlow's job is everything between the work and that judgment.**

Canonical lifecycle:

```text
ContentSignal / Direct Create intent
→ ContentOpportunity
→ owner angle judgment
→ NarrativeStrategy
→ evidence + MediaRequirement / MediaPlan
→ text/media production
→ immutable PlatformVariant revision(s)
→ exact evidence/authenticity review
→ exact owner judgment
→ editorial timing / PublicationRequest
→ durable publication
→ confirmed NarrativeMemory + eligible feedback learning
```

Not the product:

- generic post generator;
- prompt wrapper;
- recurring filler-content scheduler;
- unrestricted browser agent;
- full Canva/Premiere/After Effects replacement;
- unreviewed global autoposting.

Human approval remains the reputational boundary.

## 2. Golden Path state

### GP1

**Accepted.**

Manual thought/topic → opportunity → angle → explicit Voice/Identity → NarrativeStrategy → LinkedIn/X immutable revisions → exact critics → edit/regenerate/change → exact approve/reject is accepted for its defined owner-first vertical.

Do not rebuild it just because broad parent epics remain open.

### GP2

**Active / substantially built / NOT owner-accepted.**

Current objective: real authorized GitHub work should become an evidence-backed, media-ready, judgment-ready campaign with routine production handled automatically.

### GP3

**Parked.**

Do not activate until GP2 owner acceptance.

Parked branch:

- `feat/editorial-execution-layer`
- SHA `b53f8faec74b346bc65c694a908728af46827322`

Target GP3 vertical later:

```text
exact approved revision
→ editorial timing
→ immutable PublicationRequest
→ durable publication
→ confirmed / failed / unknown
→ confirmed-public NarrativeMemory only after external confirmation
```

## 3. Exact repository checkpoint

### Master

`ea71fa39836dfadddd70f0fe5a135c2f4d8ce9e0`

Latest merged product PR: #258 — `GP2: unify hosted exact revisions into Today`.

### Production

- deployment `dpl_ExhZUutbj3peG3BKX1FLDLmJe7Ez`
- READY
- target production
- exact Git SHA `ea71fa39836dfadddd70f0fe5a135c2f4d8ce9e0`

### Active PR #259

Title: **GP2: automate exact review before owner judgment**

- branch `feat/gp2-auto-exact-review`
- exact head `6df646f76151e6544dbd506eb7e41909b83cb8cd`
- OPEN
- non-draft
- mergeable true at checkpoint
- zero review threads
- zero submitted reviews
- zero commits behind master at checkpoint
- final diff = 10 product/test files

Final files:

1. `frontend/app/api/platform-review/route.js`
2. `frontend/components/HostedPlatformDraftsPanel.js`
3. `frontend/components/HostedPlatformRevisionReviewPanel.js`
4. `frontend/lib/application/exactReviewPreparationApplication.mjs`
5. `frontend/lib/application/todayDecisionApplication.mjs`
6. `frontend/lib/infrastructure/browserHostedPlatformReviewClient.mjs`
7. `frontend/lib/server/hostedPlatformReviewDependencies.mjs`
8. `frontend/tests/exactReviewPreparation.test.mjs`
9. `frontend/tests/hostedOwnerReviewUi.test.mjs`
10. `frontend/tests/todayDecisionApplication.test.mjs`

No temporary helper workflow remains in final compare.

## 4. #259 behavior

The owner should not normally start exact critics manually.

#259 adds `exactReviewPreparationApplication` and wires automatic exact review after:

- generate;
- regenerate;
- owner edit;
- restore;
- successful screenshot media rebound.

Rules:

- if valid current exact review exists, reuse it;
- critic failure is fail-soft: persisted immutable revision remains successful/durable;
- browser receives bounded review status/failure code only;
- manual `Retry exact checks` is recovery-only;
- required non-text strategy media defers final review;
- successful media rebound automatically exact-reviews the final judgment-ready revision.

## 5. Required-media defense in depth

A significant audit finding: Today previously did not independently ensure strategy-required media was bound.

#259 enforces the invariant in three layers:

### Preparation

Required non-text media absent → exact review defers with `required_media_pending`.

### Today

Required-media-incomplete reviewed revision is not projected as a final owner decision.

This protects historical already-reviewed text-only state too.

### Hosted approval API

Direct/stale API approval independently resolves strategy and returns 409 `required_media_pending` when required non-text media is absent.

Do not remove any layer because another layer exists.

Bound private media still requires protected exact-byte preview + valid short-lived signed visibility receipt for each exact AssetVersion.

## 6. Runtime bug caught before merge

Final diff audit found a compile-green/runtime-red defect:

Authenticated GET `/api/platform-review` had been mechanically changed to `bundle: result.bundle`, but `result` does not exist in GET scope.

Why CI/build alone did not catch it: valid JavaScript can contain that unresolved runtime reference until the route executes.

Final corrected boundary:

- GET → `await responseBundle(apps, contentPieceId)`;
- `generate_ready` → preserve already-successful `result.bundle` and add bounded review-preparation status.

Reason for `generate_ready` choice: review preparation is downstream. If a later bundle/review read fails, successfully persisted generation should not suddenly appear to have failed.

A regression assertion now isolates GET and `generate_ready` code sections and locks this distinction.

Retain this release lesson: **final high-risk diff/runtime audit remains mandatory even after green build.**

## 7. #259 exact-head verification

Exact SHA:

`6df646f76151e6544dbd506eb7e41909b83cb8cd`

GitHub CI:

- run #877
- run id `33660704164`
- frontend regression tests ✅
- production dependency audit ✅
- Next production build ✅
- Python ✅
- MCP ✅

PR metadata at checkpoint:

- mergeable ✅
- non-draft ✅
- review threads 0 ✅
- reviews 0 ✅

## 8. Current blocker: exact-head Vercel preview

Final head `6df646f…` did **not** execute a Vercel preview build.

GitHub Vercel status points to an account-level build-rate/upgrade gate. This is an infrastructure/quota rejection before build execution, not evidence of application compilation failure.

Earlier #259 heads received READY previews, but they are not accepted as evidence for final head because the runtime route correction/regression guard occurred later.

Release rule:

> **Do not merge #259 until exact SHA `6df646f76151e6544dbd506eb7e41909b83cb8cd` gets a genuine Vercel READY/success preview.**

Do not create a no-op commit to retry:

- it changes the exact candidate;
- invalidates current exact-head evidence;
- can generate another preview attempt;
- can worsen account quota pressure.

If Vercel remains blocked, leave #259 untouched/unmerged and perform only non-mutating audits/planning.

## 9. Merged GP2 substrate already on master

Do not mistake the remaining gap for an absence of foundation. Master already includes:

### Git/source

- GitHub source connection/runtime architecture;
- owner-safe readiness;
- fail-closed hosted owner access;
- exact merged PR source revision using `merge_commit_sha`;
- no PR head fallback;
- mutable release target non-promotion;
- exact repository evidence refresh/reuse before opportunity inference;
- exact ProjectContextSnapshot/SourceArtifact continuity;
- privacy-minimized private-source model input.

### Persistence/jobs

- hosted Postgres planning/review state;
- durable jobs;
- exact request-scoped `claimById(jobId)`.

### Capture/media

- private immutable Asset storage;
- bounded CDP screenshot capture;
- worker-level origin/privacy checks;
- screenshot quality/uncertainty review;
- deterministic platform derivatives + lineage;
- exact media binding into immutable PlatformVariantRevision preserving text;
- hosted screenshot production composition;
- protected exact AssetVersion preview;
- short-lived signed visibility receipts.

### Owner workflow

- hosted exact draft/review/edit/regenerate/restore/change/approve/reject;
- stale-current guards;
- ranked opportunities in Today (#257);
- hosted exact review decisions in Today (#258);
- false-all-clear protections.

GP2 remains open because acceptance is an end-to-end owner outcome, not a checklist of isolated components.

## 10. Next product gap after #259 merge

The audit after #259 found that hosted Plan still requires routine owner clicks for:

- `Generate N drafts`;
- `Prepare visual proof`.

Therefore the next implementation slice is exactly:

```text
approved NarrativeStrategy
→ automatic destination generation/reuse
→ automatic required screenshot/reuse
→ automatic exact review
→ Today
→ owner judgment
```

Do not start GP3 instead.

### Orchestrator rules

- reuse existing generation/capture/review applications; no second pipeline;
- exact current revision/strategy identity;
- durable/idempotent continuation;
- preserve successful destination work if another destination fails;
- required media blocks final judgment; optional media does not;
- screenshot rebound preserves exact text;
- repeat/stale screenshot request does not duplicate capture/derivative/bound revision;
- critic failure leaves persisted revision intact;
- refresh/reopen reconstructs state rather than restarting work;
- normal success ends in Today, not internal production buttons;
- manual controls are recovery/override only.

## 11. Real GP2 owner acceptance after orchestration

Canonical ledger:

`docs/acceptance/GOLDEN_PATH_2_OWNER_ACCEPTANCE.md`

Status remains **NOT YET ACCEPTED**.

Required real journey:

```text
owner session + readiness
→ real GitHub App installation/repository scope
→ meaningful real merged PR
→ verified delivery/signature
→ exactly one ContentSignal
→ exact merge_commit_sha
→ duplicate delivery idempotent
→ exact ProjectContext refresh
→ useful Opportunity in Today
→ owner angle
→ evidence-bound NarrativeStrategy
→ automatic generation
→ automatic required screenshot
→ private immutable AssetVersion + derivative
→ immutable media-bound revision preserving text
→ automatic exact critics
→ protected preview + receipt
→ exact owner judgment
```

Also prove one routine/noise event does not become a manufactured opportunity/media campaign.

Recovery matrix includes:

- duplicate webhook;
- unresolved/mutable exact source revision non-promotional;
- opportunity inference retry;
- exact evidence refresh failure/mismatch;
- source enrichment failure;
- one destination generation failure with other success preserved;
- automatic critic failure with persisted draft preserved;
- capture retry;
- privacy block;
- screenshot quality needs-review/block;
- derivative failure/block;
- stale browser/current revision;
- repeat screenshot idempotency;
- refresh/reopen during processing and after review.

## 12. Issues that stay open

Do not close early:

- #161 — GitHub App/webhook event ingestion into canonical ContentSignals;
- #163 — campaign-ready screenshots and derivatives from CaptureRecipes;
- #167 — Golden Path 2 complete owner outcome.

Close only the acceptance criteria actually evidenced in the ledger.

## 13. Source/evidence rules not to regress

- additive optional `sourceRevision` keeps existing ContentSignal schema compatibility;
- merged PR exact evidence = `merge_commit_sha`;
- PR head SHA is not merge evidence;
- mutable release refs are not exact evidence;
- missing exact source revision remains auditable/non-promotional;
- exact evidence mismatch blocks before opportunity inference;
- exact snapshot/revision/SourceArtifact identity stays in canonical provenance/fingerprint/task identity;
- private repository owner/name and opaque SourceArtifact IDs stay out of model prompt text when unnecessary;
- reuse canonical minimized ProjectContext.

## 14. Owner/security rules not to regress

- `/api/gp2/readiness` owner-only;
- Vercel/public-hosted missing owner key fails closed;
- owner auth/readiness responses private/no-store;
- browser never receives owner access secret, webhook secret, S3 credentials, CDP credentials or signing secret;
- acceptance docs contain safe IDs/states only;
- no raw private repo/media payloads in acceptance evidence.

## 15. Media/revision rules not to regress

- upload does not authorize publication;
- originals immutable;
- required non-text media exists before Today/final approval;
- bound private media requires exact protected preview + signed visibility receipt;
- approval binds exact revision/media, never `latest`;
- media change creates immutable rebound child;
- media rebound preserves exact text;
- text change does not silently replace exact media;
- critic failure does not invalidate persisted revision;
- partial destination failure does not delete success.

## 16. Branch/release discipline

Current branches with explicit purpose:

- `master` — production branch;
- `feat/gp2-auto-exact-review` — active #259 until merge;
- `feat/editorial-execution-layer` — parked GP3 branch.

Do not merge branches indiscriminately.

After a normal implementation branch merges and master/production evidence is clean, delete it unless explicitly retained.

Exact release sequence:

```text
focused tests
→ full CI
→ final diff audit
→ exact-head preview
→ merge with expected head
→ master CI
→ production exact-SHA READY
→ runtime inspection
→ owner acceptance when required
→ issue/docs truth update
→ branch cleanup
```

## 17. Exact next-chat sequence

Start the next chat by doing, not re-planning:

1. fetch PR #259 current metadata;
2. confirm exact head still `6df646f…`;
3. confirm master current SHA and divergence;
4. inspect exact-head GitHub combined status;
5. inspect Vercel deployments for exact `githubCommitSha=6df646f…`;
6. if exact head is READY:
   - verify deployment metadata exact SHA;
   - inspect relevant build/runtime errors;
   - re-check PR mergeability/review threads/reviews;
   - squash-merge #259 with `expected_head_sha=6df646f…`;
7. after merge:
   - get new master SHA;
   - require master CI green;
   - require Vercel production exact merged SHA READY;
   - inspect runtime errors/fatals;
   - confirm owner/session/readiness/source-management anonymous requests remain safely blocked/no-store;
   - delete #259 branch;
8. create one focused GP2 automatic-preparation branch;
9. implement approved strategy → automatic generation → automatic required screenshot → automatic exact review → Today;
10. test failure/recovery/idempotency/reopen;
11. run the real owner acceptance ledger;
12. close only proven #161/#163/#167 criteria;
13. only then activate `feat/editorial-execution-layer` for GP3.

If Vercel is still rate-blocked, stop before mutation. Do not weaken the release gate or change the candidate merely to trigger another attempt.

## 18. Compact copy/paste checkpoint

```text
SignalFlow Studio — 2026-09-02

master = ea71fa39836dfadddd70f0fe5a135c2f4d8ce9e0
production = dpl_ExhZUutbj3peG3BKX1FLDLmJe7Ez READY on same SHA
GP1 = accepted
GP2 = active / NOT owner-accepted
GP3 = parked

#259 = GP2 automate exact review before owner judgment
branch = feat/gp2-auto-exact-review
head = 6df646f76151e6544dbd506eb7e41909b83cb8cd
CI #877 = all green
PR = non-draft, mergeable, 0 review threads/reviews
Vercel exact-head preview = NOT EXECUTED (account-level build-rate gate)
merge rule = DO NOT MERGE until exact head Vercel READY

#259 adds:
- automatic exact critics after generate/regenerate/edit/restore/media rebound
- current exact review reuse
- critic failure fail-soft
- required media deferral
- required media Today suppression
- required media server approval block
- recovery-only Retry exact checks
- GET vs generate_ready route boundary regression guard

next slice after merge:
approved strategy
→ automatic generation
→ automatic required screenshot
→ automatic exact review
→ Today
→ owner judgment

open acceptance issues = #161 #163 #167
parked GP3 branch = feat/editorial-execution-layer @ b53f8faec74b346bc65c694a908728af46827322
```
