# SignalFlow Studio — Current Execution State

> **Authoritative execution frontier as of 2 September 2026 (Asia/Kolkata).**
>
> Read this file and `NEW_CHAT_HANDOFF_2026-09-02.md` before older ledgers/issues when deciding what to build next. Canonical architecture documents define the target system; this file defines what is current, what is proven, what is blocked, and the next sequence.

## 1. Repository checkpoint

### Master

- branch: `master`
- exact SHA: `ea71fa39836dfadddd70f0fe5a135c2f4d8ce9e0`
- latest merged product slice: PR #258 — **GP2: unify hosted exact revisions into Today**

### Production

- URL: `https://signal-flow-studio.vercel.app/`
- deployment: `dpl_ExhZUutbj3peG3BKX1FLDLmJe7Ez`
- target: production
- exact Git SHA: `ea71fa39836dfadddd70f0fe5a135c2f4d8ce9e0`
- checkpoint state: READY

### Active branch/PR

- branch: `feat/gp2-auto-exact-review`
- PR: #259 — **GP2: automate exact review before owner judgment**
- exact head: `6df646f76151e6544dbd506eb7e41909b83cb8cd`
- PR state: OPEN, non-draft, mergeable
- behind master: 0 at checkpoint
- review threads: 0
- submitted reviews: 0
- final diff: 10 product/test files
- GitHub CI #877: all required jobs PASS
- release blocker: exact-head Vercel preview was rejected before build execution by the account-level build-rate gate

### Explicitly parked branch

- `feat/editorial-execution-layer`
- SHA: `b53f8faec74b346bc65c694a908728af46827322`
- purpose: GP3 distribution/publication domain work
- rule: do not activate before GP2 owner acceptance.

## 2. Golden Path status

| Path | Status | Current proof boundary |
| --- | --- | --- |
| GP1 — manual thought/topic → exact approved content | **Accepted** | Defined owner-first manual intelligence/review vertical accepted. |
| GP2 — connected GitHub work → exact evidence/media → owner judgment | **Active / not accepted** | Major hosted substrate merged; #259 unmerged; post-strategy preparation still contains routine owner clicks; real hosted owner acceptance still missing. |
| GP3 — exact approval → durable publication → NarrativeMemory | **Parked** | Starts only after GP2 is genuinely accepted. |

## 3. GP1 truth

GP1 is not theoretical and should not be rebuilt as a broad foundation project.

Accepted behavior includes:

- manual ContentSignal intake;
- bounded opportunity evaluation;
- useful angle selection + custom `Something else`;
- explicit owner Voice/Identity/Boundary use;
- approved NarrativeStrategy;
- canonical ContentPiece;
- LinkedIn/X planned variants and immutable revisions;
- exact evidence/authenticity review;
- immutable edit/regenerate/change behavior;
- exact approve/reject decisions;
- browser reopen/decision continuity within the accepted scope.

Broad identity/memory/media/publishing epics may remain incomplete without invalidating GP1 acceptance.

## 4. GP2 merged substrate through PR #258

The following are no longer just target architecture:

- official GitHub source-connection/runtime foundations;
- owner-protected hosted connection/readiness paths;
- exact immutable Git source revision carried into GP2 signal/evidence continuity;
- exact evidence refresh/reuse before opportunity inference;
- ProjectContextSnapshot/SourceArtifact provenance at exact revision;
- privacy-minimized model input for private source context;
- durable Postgres repositories for hosted planning/review state;
- private immutable S3-compatible Asset storage;
- durable jobs with exact job identity/idempotent claim semantics;
- bounded CDP browser screenshot worker;
- worker-layer origin/privacy enforcement;
- immutable canonical screenshot AssetVersion;
- screenshot quality/uncertainty review;
- deterministic derivative planning/rendering + lineage;
- immutable media-rebound PlatformVariantRevision preserving exact text;
- protected exact AssetVersion preview;
- short-lived signed exact-media visibility receipt;
- hosted exact revision edit/regenerate/restore/change/approve/reject with stale-current guards;
- hosted exact review decisions projected through canonical Today logic;
- false all-clear prevention when hosted state cannot be read.

This is a substantial GP2 implementation, but it is not equivalent to real owner acceptance.

## 5. Active PR #259

PR #259 moves exact critics from routine owner work into preparation.

### Added application behavior

`frontend/lib/application/exactReviewPreparationApplication.mjs`:

- reviews a persisted exact current revision automatically;
- reuses a valid current exact review when one already exists;
- optionally refreshes only when explicitly requested;
- captures failure as bounded `review_failed` state rather than throwing away successful persisted work;
- defers review with `required_media_pending` when the strategy requires non-text media that is not yet bound;
- can prepare all current revisions for a ContentPiece without duplicating existing review work.

### Hosted route behavior

Automatic exact review occurs after:

- initial destination generation;
- destination regeneration;
- owner edit;
- restore;
- successful screenshot media rebound.

The browser receives bounded automatic-review/preparation status rather than internal exception payloads.

### Owner UI behavior

- normal success no longer asks the owner to manually start critics;
- `Retry exact checks` is recovery-only;
- required media displays preparation state instead of a premature judgment control;
- successful screenshot binding reports whether exact critics completed/reused/need recovery.

## 6. Required-media invariant

A major audit finding was that Today historically did not independently prove strategy-required media was bound.

#259 fixes this at three layers.

### Preparation layer

If strategy requires non-text media and the exact revision has none, exact review is deferred.

### Today layer

A reviewed current text-only revision is suppressed from Today while required non-text media is absent. This also protects historical already-reviewed state.

### Server approval layer

Hosted approval independently resolves the NarrativeStrategy and rejects approval with 409 `required_media_pending` when required media is absent.

This is deliberate defense in depth. Do not remove one guard because another exists.

For media-bound approval, exact protected preview + signed short-lived visibility receipt remain mandatory.

## 7. Runtime route bug caught before merge

Final diff audit found a compile-green runtime error in `/api/platform-review`.

A mechanical replacement had made GET reference `result.bundle`, but `result` does not exist in GET scope. Build/compilation could remain green because this was a runtime reference.

Correct final contract:

- GET reconstructs canonical state using `await responseBundle(apps, contentPieceId)`;
- `generate_ready` returns the already-successful generation `result.bundle` plus bounded review-preparation status so downstream review preparation cannot retroactively make successful generation appear failed.

A regression assertion now separately slices GET and `generate_ready` route code and locks this distinction.

This is a release-discipline lesson: **green build is not a substitute for final behavior/diff audit.**

## 8. #259 exact-head verification

Exact head: `6df646f76151e6544dbd506eb7e41909b83cb8cd`.

GitHub Actions:

- run number: #877
- run id: `33660704164`
- frontend regression tests: PASS
- production dependency audit: PASS
- Next.js production build: PASS
- Python tests: PASS
- MCP tests: PASS

PR metadata:

- non-draft
- mergeable true
- zero review threads
- zero submitted reviews

Final changed files only:

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

Temporary one-shot maintenance workflows used during branch work are not in the final diff.

## 9. Vercel gate for #259

Final exact head has no executed preview build.

GitHub combined status reports Vercel failure linking to an account-level build-rate/upgrade page. The final deployment attempt was rejected before build execution.

Treat this precisely:

- this is **not evidence of a code build failure**;
- earlier #259 heads received READY previews;
- earlier previews are **not valid exact-head release evidence** after later runtime-route correction/regression changes;
- GitHub CI does not replace the explicit hosted-preview gate.

Release rule:

> **Do not merge #259 until exact SHA `6df646f76151e6544dbd506eb7e41909b83cb8cd` receives a genuine Vercel READY/success preview.**

Do not create a no-op commit to retry. That changes the exact candidate and can consume another preview attempt.

## 10. Current missing GP2 product slice

#259 automates exact review, but the successful hosted post-strategy path is still not fully automatic.

`HostedPlatformDraftsPanel` still exposes routine owner preparation buttons:

- `Generate N drafts` / generation action;
- `Prepare visual proof` / required screenshot action.

Therefore the next vertical after #259 merge is:

```text
approved strategy
  → automatic generate/reuse current destination revisions
  → automatic required screenshot capture/derivative/media rebound
  → automatic exact review
  → Today
  → owner judgment
```

### Required orchestrator properties

- reuse canonical generation/review/capture applications; do not create a second pipeline;
- durable/idempotent state;
- preserve successful destination work when another destination fails;
- required media blocks final judgment until satisfied, but optional media does not;
- exact current revision guards before capture/change/approval;
- media rebound preserves exact text;
- repeat/stale capture request cannot duplicate capture/derivative/bound revision;
- critic failure remains recoverable without invalidating persisted generation;
- refresh/reopen reconstructs current state instead of restarting completed work;
- owner normally sees judgment or one bounded recovery exception, not a manual chain of internal pipeline buttons.

## 11. GP2 owner acceptance remains mandatory

Status in `docs/acceptance/GOLDEN_PATH_2_OWNER_ACCEPTANCE.md`: **NOT YET ACCEPTED**.

A real meaningful GitHub event must prove:

```text
verified source authority
→ exact immutable merge/release revision
→ one canonical signal
→ exact evidence refresh
→ opportunity
→ owner angle
→ evidence-bound approved strategy
→ automatic generation
→ automatic required visual proof
→ private immutable AssetVersion + derivative
→ exact media-bound revision
→ exact critics
→ protected exact preview + receipt
→ exact owner judgment
```

Also prove a routine/noise event does not get promoted.

Recovery matrix includes duplicate delivery, missing exact revision, inference retry, evidence mismatch, capture retry, privacy block, quality needs-review, derivative block, partial destination failure, critic failure, stale browser/current revision and refresh/reopen continuity.

Keep #161/#163/#167 open until their individual definitions of done are actually evidenced.

## 12. Do-not-regress source/privacy rules

- optional additive `sourceRevision` does not require a ContentSignal schema bump;
- merged PR exact evidence uses `merge_commit_sha`, never PR head SHA;
- mutable release ref targets do not promote without exact immutable resolution;
- missing exact revision means auditable but non-promotional;
- exact evidence mismatch blocks before opportunity inference;
- private repo owner/name and opaque SourceArtifact IDs are minimized out of narrative model prompts when not semantically needed;
- canonical minimized ProjectContext is reused;
- exact opaque IDs/revisions stay in canonical provenance/fingerprints where required;
- secret material never becomes normal model input.

## 13. Do-not-regress owner/media rules

- `/api/gp2/readiness` is owner-only;
- Vercel/public-hosted missing owner key fails closed;
- owner auth/readiness responses are private/no-store;
- never record secret values in docs/acceptance evidence;
- required strategy media must exist before Today/final approval;
- private bound media is approved only after exact protected preview + valid signed visibility receipt;
- media change creates immutable revision and cannot preserve stale media approval;
- media rebound preserves text unless text change was explicitly requested;
- critic failure does not delete/rollback successful persisted draft.

## 14. Not the next build slice

Do not divert execution into:

- GP3 before GP2 acceptance;
- video/screencast/motion composition;
- carousel breadth;
- mobile app;
- desktop agent breadth;
- broad social/source connector expansion;
- broad provider-routing rewrite;
- collaboration/billing/analytics;
- another large UI redesign;
- refactor-only work that does not unblock the active owner journey.

## 15. Next-chat execution sequence

1. Fetch #259 and verify exact head remains `6df646f…`.
2. Verify branch/master divergence and exact-head GitHub status.
3. Check Vercel deployment list for exact `githubCommitSha=6df646f…`.
4. If exact head gets READY:
   - verify deployment metadata exact SHA;
   - inspect build/runtime errors where appropriate;
   - re-check mergeability/review threads/reviews;
   - squash-merge #259 using expected head SHA.
5. Post-merge:
   - record new master SHA;
   - require master CI green;
   - require Vercel production READY on exact merged SHA;
   - inspect runtime error/fatal logs;
   - verify owner/auth endpoints remain fail-closed/no-store to anonymous access;
   - delete merged #259 branch.
6. Build automatic post-strategy GP2 preparation orchestration.
7. Test recovery/idempotency/partial-success/reopen semantics.
8. Run real hosted GP2 owner acceptance.
9. Close only proven #161/#163/#167 acceptance criteria.
10. Activate parked GP3 branch only after acceptance.

If exact-head Vercel remains rate-blocked, keep #259 unchanged/unmerged and avoid gratuitous commits.

## 16. Completion truth

Use explicit state names:

- target/documented;
- implemented on feature branch;
- CI verified;
- preview verified;
- merged;
- production deployed exact SHA;
- credential-backed owner accepted.

Never collapse those into the word `complete` when the stronger boundary has not been proven.
