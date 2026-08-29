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

**Golden Path status**

| Path | Issue | Status | Proof boundary |
| --- | --- | --- | --- |
| GP1 — manual thought → authentic approval | #166 | complete | End-to-end owner intelligence/review slice accepted. |
| GP2 — GitHub work → opportunity → automatic screenshot evidence | #167 | active | Must still prove real GitHub event ingestion/noise filtering plus exact automatic screenshot review. |
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

## Active slice — PR #240

**Branch:** `feat/gp2-real-screenshot-capture`

**PR:** #240 — `product: wire real GP2 screenshot capture into private asset storage`

**Owning issues:** #163 Phase A, supporting GP2 #167; depends on merged #162/#72 foundations.

### Implemented on the branch

- real Chrome DevTools Protocol screenshot worker adapter;
- isolated target/page execution;
- bounded recipe action surface;
- worker-layer same-origin enforcement in addition to recipe-domain navigation enforcement;
- explicit viewport + device-scale configuration;
- viewport PNG capture;
- selector/region PNG capture using semantic element bounds rather than blind center cropping;
- privacy selector evaluation immediately before screenshot capture;
- screencast deliberately unavailable;
- `fill_safe_fixture` now requires an explicit selector;
- CaptureExecutionApplication routes hosted capture bytes through the private immutable Asset storage application;
- deterministic/local blob path remains a compatibility fallback;
- durable CaptureJob completion returns canonical Asset IDs;
- safe structured capture-output provenance links exact Asset/version to recipe/version, CaptureJob, checkpoint, safe final URL, environment, viewport/dimensions, capture time, content hash, privacy result, and worker version;
- source URL provenance drops query strings/fragments and rejects credential-bearing URLs.

### Verification history

1. Initial #240 CI exposed a real application-boundary defect: `privateAssetStorage` was incorrectly validated through the domain port registry.
2. The fix kept `privateAssetStorage` as an application service and preserved `blobStorage` as the actual external storage port; no duplicate domain port was introduced.
3. Follow-up normal CI run `33273938719` passed:
   - frontend regression tests — **success**;
   - production dependency audit — **success**;
   - production build — **success**;
   - Python tests — **success**;
   - MCP tests — **success**.
4. Additional provenance commits were added after that green run; a fresh normal CI result is required before this PR may become ready or merge.

### Still required before #240 can merge

- fresh normal CI after the provenance changes;
- synchronize the canonical capture/execution documentation with the verified Phase-A boundary;
- keep capability wording honest: branch implementation is not merged/current `master` capability yet;
- final PR diff review for unrelated files/diagnostic workflow changes (none intentionally added).

## GP2 remaining sequence after #240

1. Merge #240 only after all normal gates pass.
2. Verify post-merge `master` green.
3. #163 Phase B — screenshot quality/uncertainty state and platform-safe derivative planning/lineage.
4. #163 Phase C — bind an exact screenshot AssetVersion/derivative to an exact PlatformVariant review revision; media replacement must not rewrite unrelated text.
5. Finish/verify #161 official GitHub App/webhook event ingestion.
6. Prove a meaningful real GitHub event end to end through #167.
7. Prove a low-value/noise event is preserved or ignored appropriately but not promoted into manufactured content.
8. Prove duplicate delivery, capture retry, partial generation, and refresh/reopen recovery.
9. Close #163/#167 only with sanitized end-to-end evidence.
10. Start GP3 #168.

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
