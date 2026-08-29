# SignalFlow Studio — Implementation Ledger

> **Purpose:** operational traceability only. Product architecture remains owned by the canonical architecture documents and GitHub roadmap/issues. This ledger records what was actually changed, how it was verified, what capability truth changed, and what remains next.
>
> **Update rule:** do not mark a slice `verified` or `merged` until the normal repository gates prove it. A documented target is not a shipped capability.

## Traceability chain

Every substantive implementation slice should be recoverable through:

```text
decision / product invariant
    ↓
owning issue
    ↓
implementation branch + PR
    ↓
commit(s)
    ↓
normal CI / credential-backed evidence where required
    ↓
merged master state
    ↓
capability/document truth update
    ↓
next dependency
```

Do not use this ledger as a substitute for issue acceptance criteria or architecture docs.

## Current execution position

**Active product gate:** Golden Path 2 — real GitHub work → worthwhile opportunity → bounded evidence/media → LinkedIn/X review.

**Current engineering slice:** #163 Phase B — screenshot quality/uncertainty + platform-safe derivative planning and lineage.

**Golden Path status**

| Path | Issue | Status | Proof boundary |
| --- | --- | --- | --- |
| GP1 — manual thought → authentic approval | #166 | complete | End-to-end owner intelligence/review slice accepted. |
| GP2 — GitHub work → opportunity → automatic screenshot evidence | #167 | active | Raw screenshot Phase A is merged; real GitHub ingestion/noise proof, derivative quality, exact media binding, and final end-to-end evidence remain. |
| GP3 — exact approval → schedule/publish → NarrativeMemory | #168 | waiting | Starts only after GP2 closes. |

## Verified merged foundation

### 2026-08-29 — restore trustworthy green baseline

- **Issue context:** approved UI merge #234 left `master` with stale frontend tests and failed CI.
- **PR:** #237 — `fix: restore green frontend baseline after approved UI merge`
- **Merge commit:** `5b374a25d3b5a46c0053fa3d073324d90379f103`
- **What changed:** reconciled tests with the approved landing/workspace UI, restored accessibility/reduced-motion expectations, synchronized public schema truth, removed temporary diagnostic CI debris.
- **Verification:** normal frontend regression tests, production dependency audit, production build, Python tests, and MCP tests passed before merge and again on `master`.
- **Capability effect:** no new product capability; restored a trustworthy engineering baseline.
- **Lesson:** red `master` must never be treated as an acceptable starting point for product work.

### 2026-08-29 — media intelligence, durable jobs, and bounded capture foundation

- **Issues:** #162, #73, #179 and related media-domain work supporting #163/#167.
- **PR:** #238 — clean reconstruction replacing contaminated #235.
- **What changed:**
  - protected canonical domain discriminator ownership;
  - fixed `MediaRequirement.kind` versus selected `mediaKind` separation;
  - added media intent/use-policy/privacy/lineage foundation;
  - added durable job lifecycle, leases, heartbeats, retries, cancellation and idempotency semantics;
  - added versioned `CaptureRecipe` / `CaptureJob` records;
  - enforced a bounded capture action vocabulary rather than arbitrary recipe JS/shell;
  - added deterministic screenshot worker foundation;
  - kept screencast unavailable until its own slice.
- **Verification:** normal frontend tests/audit/build, Python and MCP passed.
- **Capability effect:** capture and media execution contracts exist, but this did **not** by itself make real automatic browser screenshots a shipped capability.

### 2026-08-29 — private immutable asset storage foundation

- **Issue:** #72 Phase A.
- **PR:** #239 — `product: add private immutable asset storage for GP2`
- **Merge commit:** `4656384f14c24f0a279f5e33b0417788624f1f65`
- **What changed:**
  - extended the existing blob-storage boundary rather than creating a second storage abstraction;
  - added private S3-compatible storage with SigV4;
  - workspace-scoped content-addressed immutable object identities;
  - SHA-256 content identity and idempotent reuse;
  - workspace authorization before read/preview/delete;
  - short-lived preview authorization kept ephemeral;
  - device-private/restricted hosted writes fail closed;
  - truthful idempotent deletion.
- **Verification:** normal frontend regression tests, production dependency audit/build, Python and MCP passed; post-merge `master` also passed.
- **Capability effect:** hosted private Asset byte storage foundation is verified. Resumable/multipart uploads remain #72 Phase B.

### 2026-08-29 — GP2 screenshot Phase A raw execution

- **Issues:** #163 Phase A, supporting GP2 #167; builds on #162/#72/#73.
- **PR:** #241 — `product: wire real GP2 screenshot capture into private asset storage`.
- **Superseded draft:** #240 contained the same implementation history and was closed only because the connected GitHub tool could not transition draft→ready due its GraphQL query requesting the nonexistent Repository field `fullDatabaseId`. No code defect caused the replacement.
- **Merge commit:** `ffd5fdecb2112f5e66a5e6f0423273d5829bece2`.
- **What changed:**
  - real Chrome DevTools Protocol screenshot worker adapter;
  - isolated target/page execution;
  - bounded recipe action surface;
  - worker-layer same-origin enforcement in addition to recipe-domain navigation enforcement;
  - explicit viewport + device-scale configuration;
  - viewport PNG capture;
  - selector/region PNG capture using semantic element bounds rather than blind center cropping;
  - privacy selector evaluation immediately before screenshot capture;
  - `fill_safe_fixture` requires an explicit selector;
  - hosted capture bytes flow through the private immutable Asset storage application;
  - deterministic/local blob path remains a compatibility fallback;
  - durable CaptureJob completion returns canonical Asset IDs;
  - structured capture-output provenance links exact Asset/version to recipe/version, CaptureJob, checkpoint, safe final URL, environment, viewport/dimensions, capture time, content hash, privacy outcome, and worker version;
  - provenance URLs remove query strings/fragments and reject credential-bearing URLs;
  - screencast remains deliberately unavailable.
- **Verification history:**
  1. Initial #240 CI exposed a real application-boundary defect: `privateAssetStorage` was incorrectly validated through the domain port registry.
  2. The fix kept `privateAssetStorage` as an application service and preserved `blobStorage` as the actual external storage port; no fake/duplicate domain port was introduced and no unrelated regression was weakened.
  3. Normal CI run `33273938719` passed after that fix.
  4. Output-provenance and documentation changes were added.
  5. Normal CI run `33274203844` passed on the final implementation/docs head used by #240.
  6. Non-draft replacement #241 ran normal CI again on latest head `0ac7080310d21e4c6f04b1f682d3dae6459d6160`; run `33274325933` passed frontend regressions, dependency audit, production build, Python and MCP.
  7. #241 merged at `ffd5fdecb2112f5e66a5e6f0423273d5829bece2`.
  8. Post-merge `master` push run `33274380066` passed frontend regressions, production dependency audit, production build, Python and MCP.
- **Capability effect:** production-capable bounded raw screenshot code is now on `master`; this is **not** a claim that every deployment currently has a configured/live CDP worker. Credential-backed/live worker acceptance remains part of final GP2 evidence.
- **Not complete:** #163 remains open for Phase B quality/derivatives and Phase C exact media review binding. #167 remains open for real GitHub event/noise and complete owner-journey proof.

## GP2 remaining sequence

1. #163 Phase B — screenshot quality/uncertainty state and platform-safe derivative planning/lineage.
2. #163 Phase C — bind an exact screenshot AssetVersion/derivative to an exact PlatformVariant review revision; media replacement must not rewrite unrelated text.
3. Finish/verify #161 official GitHub App/webhook event ingestion and deployment boundary.
4. Prove a meaningful real GitHub event end to end through #167.
5. Prove a low-value/noise event is preserved or ignored appropriately but not promoted into manufactured content.
6. Prove duplicate delivery, capture retry, partial generation, and refresh/reopen recovery.
7. Attach sanitized end-to-end evidence and close #163/#167 only when their user outcomes truly pass.
8. Start GP3 #168.

## Deliberately parked work

Until GP2 closes, do not divert the primary execution path into:

- #164 screencast production;
- #165 motion composition/rendering;
- general-purpose image/video editors;
- generative-video dependencies;
- desktop capture/agent breadth;
- many new source integrations;
- broad collaboration/billing/analytics SaaS work;
- another major product UI redesign.

These remain valid roadmap work, but not current blockers for proving the owner journey.

## Repository governance debt

### Branch protection

Current known state: `master` is not branch-protected and required status-check enforcement is off. Until repository settings are hardened, maintain the manual rule:

> **Never merge a red PR. Never weaken unrelated regressions just to obtain green CI.**

This ledger must not claim branch protection is enabled until repository settings prove it.

### Public repository description

The GitHub repository description has been observed lagging behind the current approval-first content operating system direction. Internal package/public schema truth has been corrected in prior work, but repository metadata should be updated when the available GitHub write surface permits it.

## Logging discipline going forward

For each merged product slice, append a compact entry containing:

- date;
- decision/invariant;
- issue(s);
- PR;
- merge commit;
- meaningful changed boundaries;
- exact verification gates/evidence;
- capability truth change;
- known limitations/non-goals;
- next dependency.

If implementation, issues, capability matrix, and this ledger disagree, stop and reconcile them before declaring the slice complete.
