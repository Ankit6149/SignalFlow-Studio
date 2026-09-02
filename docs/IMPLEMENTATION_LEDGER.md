# SignalFlow Studio — Implementation Ledger

> **Synchronized:** 2 September 2026.
>
> **Purpose:** operational traceability. This ledger records what has actually landed, what was verified, what remains only on an unmerged branch, and what still requires credential-backed owner acceptance. Canonical product architecture remains owned by the architecture documents.
>
> **Truth rule:** `documented target ≠ feature-branch implementation ≠ green CI ≠ merged master ≠ production exact-SHA deployment ≠ credential-backed owner acceptance`.

## Traceability chain

Every substantive slice should be recoverable through:

```text
product invariant / owner burden
  → owning issue
  → focused branch + PR
  → exact candidate SHA
  → focused tests + full repository gates
  → exact-head preview when applicable
  → guarded merge
  → master CI
  → production exact-SHA verification
  → owner acceptance when promised
  → truthful capability/issue/docs update
```

## Current execution position

### Golden Paths

| Path | Issue | Status | Current boundary |
| --- | --- | --- | --- |
| GP1 — manual thought/topic → authentic exact judgment | #166 | **Accepted** | Defined owner-first manual intelligence/review vertical accepted. |
| GP2 — GitHub work → exact evidence/media → owner judgment | #167 | **Active / not accepted** | Major hosted substrate merged through #258; #259 unmerged; post-strategy preparation still has routine owner clicks; real hosted owner acceptance pending. |
| GP3 — exact approval → durable publication → NarrativeMemory | #168 | **Parked** | Starts only after GP2 owner acceptance. |

### Repository checkpoint

- master: `ea71fa39836dfadddd70f0fe5a135c2f4d8ce9e0`
- production: `dpl_ExhZUutbj3peG3BKX1FLDLmJe7Ez`, READY on the same SHA
- active PR: #259, head `6df646f76151e6544dbd506eb7e41909b83cb8cd`
- parked GP3 branch: `feat/editorial-execution-layer` at `b53f8faec74b346bc65c694a908728af46827322`

## Verified GP2 implementation progression

### PR #238 — media intelligence, durable jobs and bounded capture foundation

Established media/capture/job domain foundations without claiming real end-to-end screenshot acceptance:

- canonical media requirement/intent/use-policy/privacy/lineage foundations;
- durable job lifecycle, leases, retry/cancel/idempotency semantics;
- versioned CaptureRecipe/CaptureJob records;
- bounded action vocabulary instead of arbitrary JS/shell;
- deterministic screenshot worker foundation;
- screencast deliberately unavailable.

### PR #239 — private immutable Asset storage foundation

Merge commit: `4656384f14c24f0a279f5e33b0417788624f1f65`.

Established:

- private S3-compatible storage behind the existing storage boundary;
- workspace-scoped content-addressed immutable objects;
- SHA-256 identity/idempotent reuse;
- workspace authorization before read/preview/delete;
- private/device-restricted fail-closed behavior;
- truthful deletion semantics.

This was storage foundation, not full GP2 acceptance.

### PR #241 — real bounded screenshot Phase A

Merge commit: `ffd5fdecb2112f5e66a5e6f0423273d5829bece2`.

Established:

- real Chrome DevTools Protocol screenshot execution;
- isolated page target;
- explicit viewport/device scale;
- viewport and semantic selector-region PNG capture;
- same-origin enforcement at both recipe/domain and worker layers;
- privacy selector evaluation immediately before capture;
- captured bytes persisted as canonical private immutable Asset state;
- safe capture provenance with sanitized URL, exact recipe/version/job/checkpoint, dimensions/environment/hash/privacy/worker identity;
- query/fragment/credential stripping in provenance URLs;
- screencast still unavailable.

Final and post-merge repository gates were green. This established production-capable code, not proof that every deployment had live CDP/storage credentials.

### PR #244 — screenshot quality + crop-safe deterministic derivatives

Exact PR head: `3ef002150c80c7dd141ae626354989924fbf97a0`.

Established:

- canonical ScreenshotQualityReview and ImageDerivativePlan records;
- raw screenshots remain immutable;
- blank/error/loading/subject/privacy/legibility uncertainty remains fail-closed;
- 16:9, 9:16, 1:1 and 4:5 derivative planning around semantic focal/evidence regions;
- crops refuse to remove required evidence;
- memory/Postgres media persistence;
- bounded CDP image decode/analysis/crop/resize;
- only safe variants render;
- derivative AssetLineage to parent AssetVersion;
- retry does not re-render an already rendered variant.

The draft #243 was replaced only because of a connector draft→ready defect, not product code failure.

### PR #245 — exact screenshot media bound to exact review revision

Exact PR head: `d93d6a20ff74c07490a7815bc8b705da52534f01`.

Established:

- immutable media bindings on PlatformVariantRevision;
- exact screenshot derivative AssetVersion + quality/derivative lineage;
- media-only replacement creates `media_rebound` and preserves exact text;
- text edits preserve exact media unless explicitly changed;
- restore reconstructs historical text+media composite;
- stale revision/version/lineage fails closed;
- repeat binding is idempotent;
- Plan/Today render exact bound media;
- media-bound approval blocks while exact preview is unresolved.

### PR #246 — hosted protected exact AssetVersion preview

Established:

- workspace-scoped Postgres Asset repository over existing media durability;
- server-only composition of canonical Asset metadata + private blob storage;
- owner-authenticated `/api/assets/preview` exact `assetId + assetVersionId` stream;
- private/non-cacheable responses;
- no permanent storage URL/object key/presigned URL/credentials to browser;
- same-origin browser exact-preview client verifies identity + media type;
- stale/deleted/non-image/cross-workspace states fail closed.

### PR #247 — runtime-injectable exact-media preview seam

Established a `previewAdapter` injection seam so hosted exact preview could reuse the existing exact-media review component without creating a second UI/business-rule system. Local browser adapter remained the default compatibility path.

### PR #248 — durable hosted exact platform review/judgment state

Established:

- durable workspace-scoped exact-revision review/approval records;
- Postgres contentReviewRepository;
- server platform generation/revision/evidence/authenticity inference composition;
- hosted Postgres planning + identity + opportunity/signal integration into existing generation/review applications;
- owner-only `/api/platform-review` API;
- exact current revision checks for judgment;
- hosted media-bound approval initially fail-closed until exact visibility proof was wired.

### PR #249 — hosted owner review UI + signed exact-media visibility proof

Established:

- durable connected-source draft load/generate/reopen in Plan;
- immutable hosted LinkedIn/X revisions from `/api/platform-review`;
- exact revision critics;
- immutable owner edit, stale-safe regenerate, reject/approve/restore;
- exact HMAC visibility receipt issued only after protected preview serves requested private bytes;
- browser requires exact identity headers + signed receipt;
- approval must match every exact media binding;
- server verifies receipt against workspace + Asset + AssetVersion;
- expired/tampered/cross-workspace/stale receipts fail closed;
- no permanent private storage identifiers/credentials exposed.

### PR #250 — exact durable-job claim for request-scoped capture

Exact PR head: `e1be134e973c02a7b913c2e246c5b8a7eb76fdb9`.

Established `claimById(jobId)` semantics so one request-scoped screenshot operation cannot accidentally claim a different queued capture job. `claimNext()` remains available for ordinary worker loops.

### PR #251 — repository execution truth reset

Added the first `docs/CURRENT_EXECUTION_STATE.md`, reconciled stale execution guidance, and reinforced merge→production→acceptance distinctions. This was documentation/repository truth work, not product behavior.

### PR #253 — complete hosted screenshot production binding

Replacement for draft #252 only because of the connected draft→ready tooling defect. Exact head: `88f6b12f1e16c5bc8ebe496294b2018bda296719`.

Established the full hosted screenshot operation over already-built components:

```text
exact current PlatformVariantRevision
→ active CaptureRecipe/checkpoint
→ exact CaptureJob/durable job
→ bounded capture
→ private immutable AssetVersion
→ quality/privacy evaluation
→ deterministic derivative
→ exact media binding
→ new immutable PlatformVariantRevision preserving text
```

Also established owner-authenticated `produce_screenshot`, safe browser response shaping, strategy-driven screenshot requirement behavior and fail-closed/recovery tests for stale state, retry, quality needs-review/block, durable retry, privacy failure and derivative block.

This did **not** claim owner acceptance.

### PR #254 — owner acceptance readiness + exact evidence continuity

Merged master after exact-head CI/preview verification. Important contracts:

- owner-only `/api/gp2/readiness` with safe configuration-state names only;
- additive schema-v1-compatible ContentSignal `sourceRevision`;
- merged PR exact source revision uses `merge_commit_sha` and never PR head fallback;
- release promotes only when `target_commitish` is already immutable Git SHA;
- missing/mutable exact source state remains auditable but non-promotional;
- source revision participates in opportunity identity;
- exact requested commit can bootstrap/verify GitHub repository evidence;
- durable opportunity worker refreshes/reuses exact evidence before inference;
- exact evidence refresh failure blocks/retries instead of evaluating latest context;
- NarrativeStrategy resolves the exact ProjectContextSnapshot pinned by Opportunity;
- exact snapshot/revision/SourceArtifact identity remains in fingerprint/task provenance;
- model input reuses canonical minimized ProjectContext and excludes repository identity/opaque SourceArtifact IDs when not semantically needed;
- missing/mismatched planning evidence fails closed;
- GP2 acceptance ledger remains explicitly NOT YET ACCEPTED.

### PR #256 — live acceptance readiness UI + owner access hardening

PR #256 replaced draft #255 using the same branch/head after ready-for-review tooling failure. Exact head: `78ff279c06adb3824fea51845c8eb7bdd6fe1c4c`.

Established:

- owner-safe GP2 readiness panel in canonical Connections workspace;
- exact allowlisted readiness classes and safe missing configuration names only;
- fail-closed malformed readiness contract;
- canonical hosted-mode/owner-access policy;
- Vercel/public-hosted requires owner lock even if explicit hosted flag is absent;
- hosted missing owner access key returns safe 503 `owner_access_unconfigured` instead of becoming authorized;
- local/self-hosted no-key may remain intentionally unlocked;
- constant-time owner key verification;
- `/api/session`, readiness, GitHub source readiness and health/hosted-mode reporting share the same owner/hosted boundary;
- hardened owner auth failures use private/no-store responses;
- supported anonymous/BYOK paths remain non-owner and do not gain server-owner capability.

### PR #257 — ranked GP2 opportunities in Today

Exact head: `72dc6701712a5436c0ae2ced5fa0bf110a151c3c`.

Established a `Worth considering` Today opportunity queue:

- uses existing Plan opportunity application/canonical snooze/reject semantics;
- shows why-now/evidence/repetition/angle/destination/media guidance;
- `See ideas` links to exact opportunity in Plan;
- `Later` snoozes; `Ignore` rejects while preserving source/evidence history;
- never auto-selects owner angle;
- avoids false `ALL CLEAR` while opportunity/connected-source state is unresolved.

### PR #258 — unify hosted exact revisions into Today

Merged master SHA: `ea71fa39836dfadddd70f0fe5a135c2f4d8ce9e0`.

Exact PR head: `7531970beabb477d1d76bb48e3ddee385a9639fd`.

Established:

- hosted pending decisions reconstructed from canonical Postgres planning/review/signal/opportunity state using existing Today projector;
- owner-authenticated private/no-store `/api/today/decisions`;
- no second workflow-state store;
- exact-current hosted change-request endpoint reusing bounded AI revision application;
- local and hosted Today decisions merged deterministically during migration, preferring hosted canonical state on identical decision identity;
- hosted approve/reject/change routes preserve hosted persistence;
- hosted exact-media visibility receipts required before Today media-bound approval;
- hosted decision unavailability cannot become false `ALL CLEAR`;
- browser-local history adapter is not pointed at hosted records.

This is current production master.

## Active unmerged PR #259 — automatic exact review before owner judgment

Exact candidate: `6df646f76151e6544dbd506eb7e41909b83cb8cd`.

Final diff: 10 product/test files.

### Implemented on the branch

- reusable automatic exact-review preparation application;
- automatic exact review after generate/regenerate/edit/restore and successful screenshot media rebound;
- valid current exact review reuse;
- critic failure fail-soft; successfully persisted revision remains durable;
- bounded browser automatic-review/preparation status;
- manual exact-check action becomes recovery-only;
- required non-text media defers review until bound;
- successful screenshot rebound automatically reviews final media-bound revision;
- required media independently blocks Today projection and server approval;
- private exact-media visibility-receipt requirement remains unchanged.

### Runtime bug caught before merge

A final diff audit discovered authenticated GET `/api/platform-review` accidentally referenced `result.bundle`, where `result` did not exist. Compilation could still succeed.

Final corrected contract:

- GET uses `await responseBundle(apps, contentPieceId)`;
- `generate_ready` uses already-successful `result.bundle` plus bounded review-preparation state.

A regression assertion now locks those route sections separately.

### Verification

Exact head `6df646f76151e6544dbd506eb7e41909b83cb8cd`:

- CI #877 / run `33660704164`;
- frontend regression PASS;
- production dependency audit PASS;
- Next production build PASS;
- Python PASS;
- MCP PASS;
- PR mergeable/non-draft;
- zero review threads/reviews at checkpoint.

### Release gate not yet satisfied

Final exact head has no executed Vercel preview. Account-level build-rate limiting rejected it before build execution.

Earlier branch heads had READY previews but are not valid evidence for this later corrected SHA.

**#259 remains unmerged until exact final head receives a genuine Vercel READY preview.**

## Current GP2 remaining sequence

1. Preserve #259 exact candidate; do not create no-op retry commits.
2. When exact-head Vercel READY is available, re-check PR metadata and merge #259 with expected head SHA.
3. Verify master CI + exact merged-SHA production READY + runtime errors; delete merged branch.
4. Build the post-strategy automatic preparation orchestrator:
   `approved strategy → automatic generation → automatic required screenshot → automatic exact review → Today`.
5. Prove idempotency, stale-current handling, partial destination success, critic failure, capture retry and refresh/reopen recovery.
6. Run real credential-backed GP2 owner acceptance.
7. Complete sanitized `docs/acceptance/GOLDEN_PATH_2_OWNER_ACCEPTANCE.md`.
8. Close only proven #161/#163/#167 definitions of done.
9. Activate GP3 parked branch.

## Deliberately parked work

Until GP2 acceptance:

- screencast/video editing;
- motion composition;
- broad carousel expansion;
- mobile/desktop-agent breadth;
- broad source/social connector expansion;
- general-purpose media editor;
- broad provider-routing rewrite;
- collaboration/billing/analytics;
- another large product UI redesign;
- broad GP3 calendar/publishing implementation.

## Permanent acceptance/security rules

- no ContentSignal schema bump for additive optional `sourceRevision`;
- merged PR exact evidence = `merge_commit_sha`, not head SHA;
- mutable release refs are not exact evidence;
- exact evidence mismatch blocks before opportunity inference;
- private repository identity/opaque SourceArtifact IDs stay out of model prompts when not semantically necessary;
- owner-only hosted routes fail closed;
- owner auth/readiness responses are private/no-store;
- required strategy media must exist before Today/final approval;
- bound private media approval requires protected exact preview + signed short-lived exact AssetVersion receipt;
- media rebound preserves text;
- critic failure does not invalidate persisted draft;
- external unknown publication outcomes are not blindly retried;
- issues close on accepted user outcomes, not merely on code presence.

## Logging discipline

For every future merged slice record:

- date;
- owner burden/invariant;
- issue(s);
- PR + exact candidate;
- merge SHA;
- important domain/application/adapter/UI boundaries;
- exact verification gates;
- production exact-SHA evidence where applicable;
- capability truth change;
- remaining non-goals/acceptance gaps;
- next dependency.

If code, tests, issues, capability claims and this ledger disagree, stop and reconcile before calling the slice complete.
