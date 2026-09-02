# Changelog

All notable changes to SignalFlow Studio are recorded here. This file distinguishes merged/shipped work from active unmerged work.

## Unreleased

### Active — PR #259: automatic exact review before owner judgment

Exact candidate: `6df646f76151e6544dbd506eb7e41909b83cb8cd`.

- added reusable automatic exact-review preparation for hosted PlatformVariant revisions;
- automatically reviews generated, regenerated, edited and restored exact revisions;
- automatically reviews the final screenshot media-bound revision after successful rebound;
- reuses an existing valid exact current review;
- keeps critic failure fail-soft so persisted immutable drafts remain durable/recoverable;
- exposes bounded review-preparation state to the browser;
- changes manual exact-check initiation into recovery-only `Retry exact checks`;
- defers final exact review while strategy-required non-text media is missing;
- suppresses required-media-incomplete revisions from Today;
- blocks hosted direct approval with `required_media_pending` while required media is absent;
- preserves protected exact AssetVersion preview + signed visibility-receipt approval requirements;
- added regression coverage for required-media gating and exact review preparation;
- final diff audit caught and fixed a compile-green runtime route error: authenticated GET `/api/platform-review` now correctly reconstructs `responseBundle`, while `generate_ready` preserves the already-successful `result.bundle` plus bounded preparation status;
- added regression assertions that lock the GET vs `generate_ready` bundle boundary.

Verification on exact head:

- GitHub CI #877 frontend regression ✅
- production dependency audit ✅
- Next production build ✅
- Python ✅
- MCP ✅
- PR non-draft/mergeable with zero review threads/reviews at checkpoint

Not merged yet: the exact final head has not received an executed Vercel preview because an account-level build-rate gate rejected it before build execution. Earlier branch previews are not accepted as final-head evidence.

### Next GP2 slice after #259 merge

The remaining normal-path preparation clicks are destination draft generation and required screenshot preparation.

Next vertical:

```text
approved strategy
→ automatic destination generation/reuse
→ automatic required screenshot
→ automatic exact review
→ Today
→ owner judgment
```

GP2 remains NOT YET ACCEPTED until the real credential-backed ledger passes.

## 2 September 2026 — merged GP2 owner-flow slices

### PR #258 — unify hosted exact revisions into Today

Merged master: `ea71fa39836dfadddd70f0fe5a135c2f4d8ce9e0`.

- reconstructs hosted pending decisions from canonical Postgres planning/review/signal/opportunity records using the existing Today projector;
- adds owner-authenticated private/no-store hosted Today decision read surface;
- adds exact-current hosted change-request endpoint reusing existing revision application;
- merges local/hosted Today decisions deterministically during migration;
- routes hosted approve/reject/change to hosted persistence;
- requires exact-media visibility receipts for media-bound Today approval;
- prevents hosted decision unavailability from becoming false `ALL CLEAR`;
- keeps browser-local history adapter separate from hosted canonical records.

### PR #257 — surface ranked opportunities in Today

- adds `Worth considering` opportunity queue;
- uses existing durable Plan opportunity state/snooze/reject semantics;
- shows why-now/evidence/repetition/angle/destination/media guidance;
- preserves owner angle judgment; Today never auto-selects;
- avoids false all-clear while opportunity/connected-source availability is unresolved.

### PR #256 — harden live GP2 readiness and owner access

Replacement for draft #255 using the same verified branch/head after connector ready-for-review failure.

- owner-safe GP2 readiness in Connections;
- allowlisted readiness contract + safe configuration-name reporting only;
- Vercel/public-hosted owner access fails closed when owner key is missing;
- local/self-hosted no-key remains intentionally unlockable under explicit design;
- constant-time owner-key verification;
- `/api/session`, readiness, GitHub source readiness and health share canonical hosted/owner policy;
- hardened owner failures use private/no-store responses;
- supported anonymous/BYOK flows remain non-owner.

## 1 September 2026 — GP2 evidence/capture acceptance hardening

### PR #254 — owner acceptance readiness and exact evidence continuity

- owner-only GP2 readiness endpoint;
- additive ContentSignal `sourceRevision` without schema bump;
- merged PR exact evidence uses `merge_commit_sha` only;
- mutable release targets remain auditable/non-promotional;
- exact source revision participates in opportunity identity;
- exact repository evidence refresh before opportunity inference;
- exact ProjectContextSnapshot binding into NarrativeStrategy;
- private source minimization excludes repository identity/opaque SourceArtifact IDs from model prompt input when unnecessary;
- missing/mismatched evidence fails closed;
- acceptance ledger explicitly remains NOT YET ACCEPTED.

### PR #253 — complete hosted screenshot production binding

Replacement for draft #252 using the same implementation after connector draft-state limitation.

- exact request-scoped durable capture job claim;
- production hosted screenshot composition over Postgres, bounded CDP, private Asset storage and deterministic image processing;
- owner-authenticated `produce_screenshot`;
- exact current revision → recipe/job → capture → private AssetVersion → quality → derivative → new immutable media-bound revision;
- media rebound preserves exact text;
- retry/stale/privacy/quality/derivative failure semantics fail closed/idempotently.

## 31 August 2026 — hosted exact owner review stack

### PR #251 — repository execution truth reset

- added current execution frontier documentation;
- recorded GP1 accepted / GP2 active / GP3 waiting;
- reinforced merge → production → acceptance distinctions.

### PR #250 — exact durable-job claim

- added `claimById(jobId)` for request-scoped capture;
- preserves `claimNext()` worker-loop behavior;
- prevents one capture request from claiming another queued capture job.

### PR #249 — hosted owner review UI + exact-media visibility proof

- durable hosted review UI;
- exact revision evidence/authenticity checks;
- immutable edit/regenerate/reject/approve/restore;
- protected exact-byte preview issues short-lived signed visibility receipt;
- media approval verifies every exact AssetVersion receipt;
- stale tabs fail closed.

### PR #248 — durable hosted platform review/judgment state

- Postgres exact revision review/approval persistence;
- server inference composition for generation/revision/critics;
- owner-only hosted platform-review API;
- exact-current judgment semantics.

### PR #247 — runtime-injectable exact-media preview adapter

- reusable local/hosted preview seam without forking review business rules.

### PR #246 — protected hosted exact AssetVersion preview

- owner-authenticated private exact image streaming;
- workspace/exact version identity verification;
- no permanent storage URL/object key/credential exposure.

## 30 August 2026 — screenshot derivative + exact media review foundation

### PR #245

- immutable media bindings on PlatformVariantRevision;
- media-only rebound preserves text;
- exact screenshot derivative lineage;
- restore historical text+media composite;
- media-bound approval blocks until exact preview is resolved.

### PR #244

- screenshot quality/uncertainty records;
- crop-safe deterministic derivative planning/rendering;
- focal/evidence-region preservation;
- raw captures remain immutable;
- derivative lineage/idempotency.

## 29 August 2026 — screenshot execution/storage foundation

### PR #241

- real bounded CDP screenshot worker;
- same-origin/privacy enforcement;
- viewport/selector-region PNG capture;
- private immutable Asset persistence;
- safe capture provenance.

### PR #239

- private S3-compatible immutable Asset byte storage;
- workspace-scoped authorization/content identity/idempotent reuse.

### PR #238

- media intent/use/privacy/lineage foundations;
- durable jobs;
- versioned bounded CaptureRecipe/CaptureJob foundations.

## Historical product evolution

Earlier prototype milestones included:

- ingestion/compositor/model/CLI/frontend scaffolds;
- launch-kit and guided workflow experiments;
- repository/notes/changelog context inputs;
- source/destination/review campaign generation;
- browser-local campaign identity/edit/version/export foundations;
- capability discovery, MCP and connector foundations;
- eventual product reset from a launch-kit/post generator into the current approval-first content operating system.

For current product truth use `README.md`, `docs/CURRENT_EXECUTION_STATE.md`, `docs/IMPLEMENTATION_LEDGER.md` and the acceptance ledgers rather than interpreting older prototype bullets as the present architecture.
