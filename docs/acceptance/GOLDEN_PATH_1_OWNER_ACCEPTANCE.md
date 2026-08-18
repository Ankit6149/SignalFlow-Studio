# Golden Path 1 — Owner Acceptance Evidence

Status: acceptance candidate for issue #166. This document records the browser-local owner Golden Path proved by the automated acceptance scenario. It does **not** claim durable publishing, confirmed audience exposure, connected-source automation, or hosted/cross-device persistence.

## Scope

Golden Path 1 proves that an owner can begin with a manual thought/lesson and reach exact, reviewable LinkedIn and X approvals through the canonical Content-OS application services:

```text
manual ContentSignal
→ ContentOpportunity
→ recommended angle
→ approved NarrativeStrategy
→ ContentPiece
→ LinkedIn/X PlatformVariants
→ evidence + authenticity critics
→ owner correction
→ fresh exact critics
→ exact revision approvals
→ NarrativeMemory + StyleMemory evidence
→ browser/application reopen
```

Publishing is intentionally outside this acceptance gate.

## Sanitized owner scenario

The acceptance test creates a workspace-private manual lesson:

- headline: `Privacy changed the inference routing design`
- summary: protected context must not silently fall back to a remote provider; if no permitted route exists, the system should fail closed; privacy is treated as execution routing rather than only a UI setting.
- explicit boundary: do not expose private repository details, credentials, customers, metrics, or unimplemented capabilities.

The deterministic acceptance inference produces:

- opportunity title: `Privacy is an execution boundary`
- recommendation: `post`
- score: `91`
- confidence: `0.93`
- four materially distinct candidate angles
- recommended angle: `Architecture boundary`
- strong evidence readiness
- LinkedIn and X as the two destinations intentionally scoped to Golden Path 1
- text-only media for this scenario

The approved NarrativeStrategy is titled `Privacy changes the execution architecture` and preserves the factual/privacy constraints from the source Signal.

## Exact revision progression

Both initial destination drafts are generated as immutable revisions and pass evidence/authenticity review before entering Today.

LinkedIn then exercises the natural-language correction path:

```text
generated LinkedIn revision
→ request: "Make the opening more direct and keep the architecture boundary precise."
→ AI-revised immutable child
→ fresh evidence critic
→ fresh authenticity critic
→ exact owner approval of the revised child
```

The revised LinkedIn opening begins with the concrete architectural statement that privacy changes where inference is allowed to run. The change-request route preserves the existing destination and format contract rather than replacing the draft with an unrelated artifact.

X independently exercises the direct owner-edit path:

```text
generated X revision
→ owner-edited immutable child
→ fresh evidence critic
→ fresh authenticity critic
→ exact owner approval of the edited child
```

The owner edit states, in sanitized form, that protected context changes the routing rule: use an allowed inference route or stop; privacy must be execution behavior rather than a label.

Each child retains its parent revision. Prior reviews remain historical; the corrected current revisions must earn new critics and do not inherit current approval.

## Judgment result

After both exact visible revisions are explicitly approved:

- both approvals bind to the exact reviewed revision IDs;
- Today contains zero remaining decisions for this scenario;
- stale or invisible newer revisions cannot be silently approved through this path;
- no publication action is implied by approval.

## NarrativeMemory result

The scenario creates exactly two NarrativeMemory records, one for LinkedIn and one for X.

Every record is:

- bound to the exact approved `PlatformVariantRevision`;
- `historyStrength = prepared_internal`;
- `publishedAt = null`.

The acceptance explicitly does **not** create `published_confirmed` history. Approval records what SignalFlow has prepared and the owner has approved internally; external audience exposure requires the later durable publishing path.

## StyleMemory result

The same owner journey records explainable feedback without allowing one correction to rewrite the owner's personality.

The acceptance requires feedback containing:

- `changes_requested`;
- `approved_after_edit`;
- `approved_unchanged`.

The explicit direct-opening correction can create a bounded candidate style hypothesis. In this isolated run every learned hypothesis remains `candidate`; none becomes an active/permanent preference from a single piece of evidence.

StyleMemory remains about **how** the owner prefers to communicate. NarrativeMemory remains about **what** has been approved/heard. The two stores are not conflated.

## Browser reopen / persistence proof

The test recreates the browser applications against the same persisted browser storage and verifies that:

- Today remains clear;
- LinkedIn current revision is still the AI-revised child and its exact approval remains valid;
- X current revision is still the owner-edited child and its exact approval remains valid;
- both destinations retain two immutable revisions;
- parent/history records remain available;
- both `prepared_internal` NarrativeMemory records remain present;
- StyleMemory feedback and candidate hypotheses remain present;
- canonical record counts do not duplicate on reopen.

This proves browser-local recovery only. It is not evidence of hosted or cross-device synchronization.

## Composition defects found and fixed by this acceptance

The end-to-end acceptance intentionally exercises the real browser application/domain/repository composition rather than only isolated unit services. It exposed two integration gaps that were fixed rather than hidden by weakening the test:

1. the browser inference adapter had no registered `platform_variant_revision` route even though the exact change-request feature existed in isolation; the route is now registered through `/api/intelligence/platform-revision` and normalized through the existing exact revision request contract;
2. the explicit phrase `more direct` was valid feedback but lacked a supported explainable StyleMemory observation; direct-opening feedback can now become bounded candidate evidence while factual-only corrections still do not silently become style.

The landing-page capability split was also corrected so shipped browser-local NarrativeMemory and explainable StyleMemory are not incorrectly described as future features. Connected-source detection, durable publishing, cross-device memory sync, confirmed-public history, and media production remain future/product-direction claims.

## Verification candidate before this documentation commit

The code/test head immediately before this evidence file was added was:

`92f21d6b5bc3f0de1c00564bd737cfd8379078f5`

GitHub Actions run:

`https://github.com/Ankit6149/SignalFlow-Studio/actions/runs/32167579812`

Results on that exact code/test head:

- frontend: PASS
- frontend tests: **450 passed / 450 total / 0 failed**
- production dependency audit gate (`--audit-level=high`): PASS
- Next.js production build: PASS
- MCP tests: PASS
- Python tests: PASS

The dependency audit passing the configured high-severity gate is not a claim of zero dependency advisories; npm reported two moderate advisories in the dependency tree.

Exact Vercel preview for the same code/test SHA:

`https://signal-flow-studio-lnl1wb33m-ankit6149s-projects.vercel.app`

Deployment ID: `dpl_58U4Fm4vDWF4bvaDHGXMXfPXuDUy`

Verified metadata:

- state: `READY`
- branch: `test/golden-path-owner-acceptance`
- GitHub PR: `#219`
- Git commit SHA: `92f21d6b5bc3f0de1c00564bd737cfd8379078f5`
- preview root returned HTTP 200.

Because adding this evidence file creates a newer PR head, **the PR must not be merged on the verification above alone**. CI and Vercel preview must be re-verified against the final documentation-inclusive head before #166 is closed.

## Acceptance boundary

This Golden Path establishes the first coherent owner loop. It does not broaden the product boundary to only LinkedIn/X; those destinations are the intentionally limited proof set for GP1. Connected-source automation, destination/content-form selection driven by owner preferences and calendar policy, broader content packs, media production, durable scheduling/publishing, and confirmed-public memory remain subsequent vertical product slices behind the same canonical records and judgment rules.
