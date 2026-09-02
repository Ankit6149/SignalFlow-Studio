# SignalFlow Studio — Capture & Media Production

> **Synchronized implementation status:** 2 September 2026.
>
> This document combines the durable capture/media contract with current GP2 implementation truth. Capture/media target breadth extends beyond what is accepted today; video/screencast work remains parked.

## Purpose

SignalFlow should produce factual product visual proof without forcing the owner to manually record, crop and prepare routine screenshots.

Preferred architecture:

```text
NarrativeStrategy / ContentPiece
  → meaningful MediaRequirement
  → bounded CaptureRecipe / existing Asset decision
  → durable CaptureJob
  → authorized privacy-aware capture
  → immutable canonical AssetVersion
  → quality/uncertainty review
  → deterministic platform derivative
  → exact AssetLineage
  → immutable media-bound PlatformVariantRevision
  → protected exact preview
  → exact owner judgment
```

Automatic capture is not permission for arbitrary browsing. Recipes are bounded, authorized, target-scoped and privacy-aware.

## Current GP2 implementation truth

The screenshot vertical is substantially implemented on master.

### Capture domain/job foundation

Merged foundations include:

- versioned CaptureRecipe/CaptureJob records;
- bounded action vocabulary instead of arbitrary script/shell;
- durable job lifecycle with retry/lease/cancel/idempotency semantics;
- exact request-scoped `claimById(jobId)` so one capture request cannot steal another queued capture;
- exact project/recipe/version/checkpoint identity.

### Real screenshot worker

Merged real CDP worker behavior includes:

- isolated page target;
- explicit viewport/device scale;
- bounded navigation/action execution;
- same-origin enforcement at recipe/domain and worker layers;
- viewport PNG capture;
- semantic selector/region PNG capture using element bounds rather than blind center crop;
- privacy selector evaluation immediately before screenshot capture;
- explicit selector requirement for safe fixture fills;
- sanitized final URL provenance without query/fragment/credentials.

### Private immutable storage

Captured bytes flow through canonical private immutable Asset storage.

Important rules:

- workspace-scoped access;
- content hash identity/idempotent reuse;
- original/canonical capture remains immutable;
- browser does not receive private object keys/permanent storage URLs/credentials;
- capture provenance binds exact AssetVersion to CaptureJob + recipe/version/checkpoint + safe environment/viewport/dimensions/hash/privacy/worker context.

### Screenshot quality

Capture success is not equivalent to usable publication evidence.

Merged quality evaluation separates:

- blank/near-blank output;
- error state;
- loading/incomplete state;
- required subject/evidence presence;
- privacy state;
- legibility/quality uncertainty.

Quality states must preserve uncertainty:

- `ready` → may continue;
- `needs_review` → do not automatically bind as final approval media;
- blocked/privacy failure → fail closed.

### Deterministic derivatives

Merged derivative planning/rendering supports platform-safe aspect ratios including:

- 16:9;
- 9:16;
- 1:1;
- 4:5.

Cropping must preserve required semantic evidence/focal regions. A crop that would remove required proof is not silently accepted.

Rendered outputs are canonical derived AssetVersions with AssetLineage to the exact parent capture.

Retries reuse already-rendered safe outputs rather than creating unnecessary duplicates.

### Exact media binding

Merged media-binding behavior:

- bind exact derivative AssetVersion to an immutable PlatformVariantRevision;
- media-only change creates a `media_rebound` child revision;
- exact text is preserved across media rebound;
- text edit preserves selected media unless media was separately changed;
- stale revision/version/lineage fails closed;
- repeat binding is idempotent;
- restore reconstructs the exact historical text+media composite.

### Hosted screenshot production

Merged hosted production action composes the above:

```text
exact current PlatformVariantRevision
→ active CaptureRecipe/checkpoint
→ exact CaptureJob/durable job
→ bounded CDP capture
→ private immutable source AssetVersion
→ quality/privacy review
→ deterministic derivative
→ exact media binding
→ new immutable PlatformVariantRevision preserving text
```

Owner-authenticated `produce_screenshot` returns only review-safe identities/status, not private storage implementation details.

## Protected exact-media review

Hosted exact media preview:

- resolves exact `assetId + assetVersionId` under workspace authority;
- streams verified image bytes privately/non-cacheably;
- includes exact identity headers;
- issues a short-lived signed visibility receipt only after serving the requested exact bytes;
- browser rejects mismatched/missing identity/receipt;
- media-bound approval must match every exact role/Asset/AssetVersion;
- server verifies receipt against workspace + exact identity;
- expired/tampered/cross-workspace/stale receipts fail closed.

Approval never binds `latest media` implicitly.

## Required-media judgment rule

PR #259 (currently unmerged) hardens strategy-required non-text media at three layers:

1. automatic exact review defers until required media is bound;
2. Today suppresses media-incomplete reviewed revisions;
3. hosted approval independently rejects `required_media_pending`.

This prevents temporary text-only drafts from becoming accidental final decisions.

#259 also automatically exact-reviews the final media-bound revision after successful screenshot rebound.

Exact candidate: `6df646f76151e6544dbd506eb7e41909b83cb8cd`, CI #877 fully green. Exact-head Vercel preview still has not executed because account-level build-rate gating rejected it before build.

## Remaining GP2 capture/product gap

The **capture implementation exists**, but normal post-strategy orchestration still asks the owner to click `Prepare visual proof`.

The next GP2 vertical must remove that routine production burden:

```text
approved strategy
→ automatic generate/reuse text revisions
→ if screenshot required: automatic screenshot production/reuse
→ automatic exact review of final revision
→ Today
```

A recovery control may remain for failed/blocked/needs-review cases. Normal success should not require manual production clicks.

## Capture idempotency/stale rules

A correct implementation must guarantee:

- exact current revision is checked before creating/using capture work;
- exact durable job is claimed by ID;
- retry cannot execute unrelated queued capture;
- a stale source revision cannot create a second bound child revision;
- same successful capture/derivative may be reused under its exact identity;
- privacy/quality block prevents derivative/binding progression;
- `needs_review` is not silently treated as `ready`;
- non-rendered/blocked derivative never becomes publication media;
- successful destination work remains durable when another destination/capture fails.

## Privacy/authorization invariants

- target/origin is bounded before and during worker execution;
- credential-bearing/sensitive URLs are rejected/sanitized from provenance;
- privacy checks run immediately before capture where required;
- secret/private selectors or state must not leak into logs/model prompts;
- protected/private capture data follows DataClassification/ProcessingPolicy;
- upload/capture does not itself authorize publication;
- owner review remains exact and visible.

## Media decision rules

Not every story needs capture.

`MediaDecision.NONE` is valid.

Prefer:

1. existing real evidence when appropriate and permitted;
2. bounded real capture for factual product proof;
3. deterministic composition for exact UI/typography/layout;
4. generative editing/generation only when the transformation requires it and policy permits it.

Do not generatively alter factual product screenshots while presenting them as unchanged evidence.

## Future capture/media work — parked behind GP2/GP3

### Screencast

Target later:

- bounded recipe video capture;
- canonical raw footage Asset;
- exact timeline/VideoEditPlan;
- deterministic trim/reframe/caption/overlay/audio handling;
- exact rendered revision review.

Not current GP2 acceptance requirement.

### Motion composition

Target later:

- versioned motion composition;
- deterministic multi-aspect render;
- callouts/captions/brand layers;
- exact media revisions.

### Carousel/static composition

Target later:

- semantic slide roles;
- stable slide IDs;
- evidence bindings;
- deterministic typography/layout;
- surgical slide edits;
- exact rendered carousel revision approval.

### Desktop capture

A future paired Desktop Edge Agent may capture local/private desktop applications, but it must reuse the same canonical Asset/lineage/policy/revision/approval substrate. Do not create a second media system for desktop capture.

## Acceptance boundary

#163 and #167 remain open.

Screenshot code is extensive, but real GP2 acceptance still requires:

- configured live worker/storage;
- real source event/evidence continuity;
- automatic post-strategy preparation;
- privacy/quality/derivative/stale/retry/reopen recovery evidence;
- exact owner judgment of protected visible media.

Record that proof in `docs/acceptance/GOLDEN_PATH_2_OWNER_ACCEPTANCE.md`.
