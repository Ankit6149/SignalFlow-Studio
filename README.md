# SignalFlow Studio

SignalFlow Studio is an approval-first **content operating system** for turning real work, deliberate creative input, and connected-source events into worthwhile communication with as little routine content work as possible.

> **The user's job is judgment. SignalFlow's job is everything between the work and that judgment.**

SignalFlow is not intended to become a generic prompt wrapper, a post-volume machine, a manually filled scheduler, or a replacement for professional creative suites. The product should consume evidence created by real work, decide what is actually worth communicating, prepare only the text/media that story needs, and return to the owner only when a meaningful decision or exception requires attention.

## Canonical lifecycle

```text
Work / manual thought / Direct Create / connected source
        ↓
ContentSignal or explicit creative intent
        ↓
ContentOpportunity
        ↓
owner angle judgment
        ↓
NarrativeStrategy
        ↓
Evidence + MediaRequirement / MediaPlan
        ↓
text / capture / image / carousel / video production as required
        ↓
immutable PlatformVariant revision(s)
        ↓
exact evidence/authenticity review
        ↓
exact owner judgment
        ↓
Editorial Calendar / PublicationRequest
        ↓
durable publication
        ↓
confirmed NarrativeMemory + eligible feedback learning
```

Human approval remains the reputational boundary. Approval always binds exact text/media revisions rather than an implicit `latest` state.

## Current execution checkpoint — 2 September 2026

For detailed current state, read `docs/CURRENT_EXECUTION_STATE.md` and `docs/NEW_CHAT_HANDOFF_2026-09-02.md` before older ledgers or issue descriptions.

### Golden Paths

| Golden Path | Status | Current truth |
| --- | --- | --- |
| GP1 — manual thought/topic → authentic LinkedIn/X judgment | **Accepted** | Owner-first manual intelligence/review vertical is accepted for its defined scope. |
| GP2 — GitHub work event → exact evidence/media → owner judgment | **Active / not owner-accepted** | Hosted signal/evidence/planning/review/media substrate is substantially built. PR #259 is the active unmerged slice. |
| GP3 — exact approval → durable publication → NarrativeMemory | **Parked** | Do not activate until GP2 owner acceptance. |

### Repository/production

- `master`: `ea71fa39836dfadddd70f0fe5a135c2f4d8ce9e0`
- production deployment: `dpl_ExhZUutbj3peG3BKX1FLDLmJe7Ez`
- production state at checkpoint: READY on the same master SHA
- latest merged product slice: PR #258 — hosted exact revisions unified into canonical Today decisions

### Active PR #259

**PR #259 — `GP2: automate exact review before owner judgment`**

- branch: `feat/gp2-auto-exact-review`
- exact head: `6df646f76151e6544dbd506eb7e41909b83cb8cd`
- non-draft, mergeable, zero review threads/reviews at checkpoint
- final diff: 10 product/test files
- GitHub CI #877: frontend regression ✅, production dependency audit ✅, Next production build ✅, Python ✅, MCP ✅
- merge blocker: exact-head Vercel preview did not execute because the account-level build-rate gate rejected it before build execution

**Do not merge #259 until that exact final SHA receives a genuine Vercel READY preview.** Earlier READY branch previews do not substitute for the final head because a later runtime route correction and regression guard changed the candidate.

## What PR #259 changes

The normal hosted preparation path no longer requires the owner to manually start evidence/authenticity critics.

SignalFlow now prepares exact review automatically after generated, regenerated, edited, restored, and successfully screenshot-rebound revisions; reuses an existing exact current review when valid; and treats critic failure as recoverable downstream preparation rather than invalidating a successfully persisted immutable revision.

Manual `Retry exact checks` remains only as recovery.

A required-media invariant is enforced in three places:

1. exact-review preparation defers while strategy-required non-text media is missing;
2. Today suppresses a reviewed text-only revision that is not yet media-complete;
3. the hosted approval endpoint independently rejects approval with `required_media_pending` when required media is absent.

Private media approval continues to require protected exact-byte preview and a short-lived signed visibility receipt for every exact bound AssetVersion.

## Current GP2 gap after #259

Even after #259 merges, GP2 is not yet fully low-attention. The hosted Plan UI still exposes routine owner actions to generate drafts and to prepare required screenshot proof.

The next vertical slice is therefore:

```text
approved NarrativeStrategy
  → automatic platform generation
  → automatic required screenshot when justified
  → automatic exact review
  → Today
  → owner judgment
```

That slice must preserve durable exact revision identity, partial-success durability, stale-current protection, idempotent screenshot production, browser refresh/reopen recovery, and bounded exception states.

Only after this preparation orchestration is complete should the real credential-backed GP2 owner acceptance run be treated as the acceptance frontier.

## Current implementation truth

The repository currently contains real foundations for:

- browser-local manual ContentSignals and opportunity/angle selection;
- explicit owner Identity/Voice/Boundary context and immutable context snapshots;
- NarrativeStrategy, ContentPiece, planned platform variants and immutable revisions;
- exact evidence/authenticity review and exact approve/reject/edit/regenerate/change semantics;
- owner-facing Today/Signals/Plan direction, including durable hosted Today decisions for connected-source exact revisions;
- official GitHub App/source-connection runtime architecture with owner-protected hosted management;
- immutable exact Git source-revision handling for GP2 evidence continuity;
- Postgres-backed hosted planning/review state;
- private S3-compatible immutable Asset storage;
- bounded CDP screenshot capture;
- screenshot privacy/quality evaluation;
- deterministic derivatives with lineage;
- immutable media-rebound PlatformVariant revisions that preserve text;
- protected exact AssetVersion preview and signed visibility receipts;
- durable job/idempotency/stale-current foundations;
- real configured model-provider routes and capability discovery;
- deterministic export/portable browser archive foundations;
- existing MCP and supported social connector code paths where genuinely configured.

These foundations do **not** by themselves prove a live end-to-end GP2 run. `docs/acceptance/GOLDEN_PATH_2_OWNER_ACCEPTANCE.md` remains the acceptance authority.

## Not yet a production/acceptance claim

Do not advertise the following as complete merely because target contracts or partial code exist:

- fully automatic post-strategy generation/capture preparation;
- credential-backed end-to-end GP2 owner acceptance;
- closure of #161/#163/#167;
- GP3 durable schedule/publication and confirmed NarrativeMemory;
- broad calendar automation;
- automatic learned StyleMemory/NarrativeMemory across the full product;
- complete Direct Create media-intent automation;
- deterministic carousel vertical acceptance;
- uploaded-footage short-video production;
- screencast/motion-video production;
- mobile/desktop-agent breadth;
- broad provider/connector expansion;
- unreviewed global autoposting.

Video work remains deliberately parked while GP2/GP3 are unfinished.

## Git/source evidence rules

GP2 exact evidence follows strict provenance rules:

- a merged pull request uses GitHub `merge_commit_sha`; PR head SHA is not merge evidence;
- mutable release targets are not promoted as exact evidence unless resolved to an immutable Git SHA under an explicit supported contract;
- missing/unresolved exact revision may remain auditable but is non-promotional;
- opportunity inference must use/reuse evidence refreshed at the exact source revision rather than unrelated latest repository context;
- private repository identity and opaque SourceArtifact IDs are minimized out of model prompt input when not semantically necessary;
- exact identities remain available in canonical records, fingerprints and task provenance.

## Privacy and owner boundaries

- public-hosted/Vercel mode with missing owner access configuration fails closed;
- owner-only routes stay owner-only and use private/no-store responses;
- do not paste or commit access keys, OAuth codes, webhook secrets, S3 credentials, browser/CDP credentials, signed object URLs or raw private repository bodies;
- upload does not imply permission to publish;
- the most restrictive applicable privacy/use policy wins;
- original user media remains immutable; edits/renders/captures produce derived revisions with lineage.

## Media rules

SignalFlow decides whether a story actually needs media. `NONE` is a valid decision.

When factual product evidence is needed, prefer real bounded capture/deterministic composition over synthetic decoration. Automatic capture is recipe-bound, authorized, origin/privacy constrained, quality reviewed and persisted as canonical Assets.

Changing media creates a new immutable revision. It must not silently rewrite unrelated text or preserve an approval for unseen media.

## Publication rules

Publishing is an external reputational side effect and belongs behind exact immutable intent:

```text
exact approved text + exact approved media
  → verified destination target
  → PublicationRequest + idempotency identity
  → durable execution
  → confirmed / failed / unknown result
```

Only confirmed publication becomes strong public NarrativeMemory. An uncertain external result remains `unknown` rather than being blindly retried as though failure were certain.

## Repository execution discipline

For active vertical work:

```text
focused branch
→ implementation
→ focused tests
→ full regression/audit/build
→ PR
→ exact-head preview when applicable
→ merge with expected head SHA
→ master CI
→ production exact-SHA verification
→ runtime inspection
→ owner acceptance where required
→ truthful issue closure
→ merged branch cleanup
```

A green branch is not merged. A merge is not production. Production is not credential-backed Golden Path acceptance.

Do not create gratuitous/no-op commits to retry hosting gates; every candidate SHA must earn its own release evidence.

## Next-chat start sequence

1. Check PR #259 head is still `6df646f76151e6544dbd506eb7e41909b83cb8cd`.
2. Check exact-head Vercel deployment/status.
3. If exact-head Vercel is READY, re-check CI/mergeability/reviews and squash-merge with expected head SHA.
4. Verify new master CI and exact-SHA production READY; inspect runtime errors/fatals.
5. Delete merged #259 branch; preserve parked GP3 branch.
6. Build the post-strategy automatic preparation orchestrator as the next GP2 vertical slice.
7. Run real hosted GP2 owner acceptance and recovery matrix.
8. Close #161/#163/#167 only where the ledger proves their definitions of done.
9. Activate `feat/editorial-execution-layer` for GP3 only after GP2 is accepted.

## Canonical documentation

Start with:

1. `docs/NEW_CHAT_HANDOFF_2026-09-02.md` — exact current handoff/checkpoints.
2. `docs/CURRENT_EXECUTION_STATE.md` — authoritative execution frontier.
3. `docs/IMPLEMENTATION_LEDGER.md` — verified slice history/current acceptance boundary.
4. `docs/acceptance/GOLDEN_PATH_2_OWNER_ACCEPTANCE.md` — credential-backed GP2 proof ledger.
5. `docs/PRODUCT_VISION.md` — target product definition.
6. `docs/CONTENT_INTELLIGENCE_ARCHITECTURE.md` — canonical content intelligence domain.
7. `docs/IDENTITY_MEMORY_AND_AUTHENTICITY.md` — identity/voice/memory rules.
8. `docs/INFERENCE_AND_PRIVACY_ARCHITECTURE.md` — inference/privacy routing.
9. `docs/CAPTURE_AND_MEDIA_PRODUCTION.md` — capture/media architecture.
10. `docs/EDITORIAL_CALENDAR_AND_PUBLISHING.md` — GP3 target publication model.
11. `docs/CAPABILITY_MATRIX.md` — current capability claims.
12. `AGENTS.md` and `ROADMAP.md` — repository/execution rules.

When documents disagree, prefer current code/tests/exact Git metadata and credential-backed runtime evidence, then the current execution/handoff docs, then capability/readiness ledgers, then target architecture docs, and finally older issues/history for rationale.
