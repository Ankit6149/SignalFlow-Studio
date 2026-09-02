# SignalFlow Studio Roadmap

> **Execution synchronization:** 2 September 2026.
>
> This roadmap defines sequencing. `docs/PRODUCT_VISION.md` defines the target product. `docs/CURRENT_EXECUTION_STATE.md` and `docs/NEW_CHAT_HANDOFF_2026-09-02.md` define the exact active repository/PR frontier. A target architecture item is not a shipped capability claim.

SignalFlow Studio is becoming an approval-first **content operating system** that reduces the amount of content work the owner has to think about.

## North-star journey

```text
Do meaningful work / add intentional creative input
  → SignalFlow notices or receives a useful signal
  → SignalFlow decides whether it is worth communicating
  → owner chooses/corrects the angle
  → SignalFlow plans the narrative
  → SignalFlow gathers exact evidence
  → SignalFlow produces only the required text/media
  → SignalFlow runs exact quality checks
  → owner judges the exact visible revision
  → SignalFlow handles approved timing/distribution durably
  → SignalFlow remembers only what was actually confirmed public
```

The user should spend attention on **selection, correction and final judgment**, not routine generation, capture, format conversion or scheduler operation.

## Execution model

Build one owner journey vertically at a time. Do not accumulate horizontal foundations that are not consumed by the active Golden Path.

Every active slice must preserve:

- exact provenance/revision identity;
- privacy/policy enforcement;
- idempotency and stale-current protection;
- partial-success durability;
- browser refresh/reopen reconstruction;
- human approval for reputational side effects;
- truthful capability/acceptance documentation.

## Golden Path 1 — manual thought/topic → authentic exact judgment

**Status: ACCEPTED.**

Issue: #166.

Accepted scope includes:

- manual ContentSignal intake;
- opportunity evaluation and explainable angles;
- custom `Something else` direction;
- explicit owner Identity/Voice/Boundaries;
- NarrativeStrategy + canonical ContentPiece;
- LinkedIn/X planned variants and immutable revisions;
- exact evidence/authenticity review;
- immutable edit/regeneration/change behavior;
- exact approve/reject semantics;
- owner-facing Plan/Today continuity for the defined vertical.

Do not reopen GP1 foundations merely because broad epics remain open.

## Golden Path 2 — connected GitHub work → evidence/media → owner judgment

**Status: ACTIVE / NOT OWNER-ACCEPTED.**

Primary proof issue: #167.

Key supporting issues still deliberately open:

- #161 — GitHub App/webhook event ingestion into canonical ContentSignals;
- #163 — campaign-ready screenshot capture/derivatives;
- #167 — full Golden Path 2 owner outcome.

### Merged foundation through PR #258

The repository already contains the substantive hosted substrate required for GP2:

- official GitHub connection/runtime boundaries;
- exact immutable source-revision handling;
- durable source/signal/opportunity dispatch foundations;
- exact ProjectContext/SourceArtifact provenance;
- privacy-minimized narrative inference context;
- hosted Postgres planning/review persistence;
- private immutable Asset storage;
- bounded CDP screenshot capture;
- quality/privacy gates;
- deterministic derivatives and lineage;
- immutable media-bound PlatformVariant revisions preserving text;
- protected exact AssetVersion preview;
- signed short-lived visibility receipts;
- owner-safe hosted review/change/approval endpoints;
- stale-current guards;
- canonical hosted review decisions projected into Today.

### Active PR #259 — automate exact review before owner judgment

Branch: `feat/gp2-auto-exact-review`

Exact head: `6df646f76151e6544dbd506eb7e41909b83cb8cd`

#259 adds automatic exact evidence/authenticity review after generation/regeneration/edit/restore and successful screenshot media rebound. Existing exact current reviews are reused. Critic failure is fail-soft. Manual critics become recovery-only.

It also enforces required non-text strategy media before final judgment at three layers: preparation, Today projection and server-side approval.

Exact-head GitHub CI #877 is fully green, but final-head Vercel preview has not executed because the account-level build-rate gate rejected it before build execution.

**Release rule: #259 does not merge until the exact final SHA gets a genuine Vercel READY preview.**

### GP2 next slice after #259 merge

The current Plan flow still requires owner clicks for draft generation and required screenshot preparation. That is the next real low-attention gap.

Build one vertical orchestration slice:

```text
approved NarrativeStrategy
  → automatically generate/reuse destination revisions
  → automatically satisfy required screenshot media
  → automatically exact-review the final judgment-ready revisions
  → project only judgment-ready decisions into Today
  → owner approves / changes / rejects
```

The orchestrator must be durable and idempotent. It must not regenerate successful work because another destination fails. It must survive refresh/reopen, reuse existing current work, preserve exact text during media rebound, and surface bounded recovery only when automatic preparation cannot complete.

### GP2 acceptance after orchestration

Do not call GP2 complete until `docs/acceptance/GOLDEN_PATH_2_OWNER_ACCEPTANCE.md` is filled using a real hosted credential-backed journey.

Required real proof includes:

- authorized GitHub App/source connection;
- real meaningful merged PR with exact `merge_commit_sha`;
- exactly one canonical signal despite duplicate delivery;
- exact evidence refresh at immutable source revision;
- useful opportunity + owner angle judgment;
- evidence-bound NarrativeStrategy;
- automatic generation and required visual proof;
- private immutable AssetVersion + derivative;
- exact media-bound revision preserving text;
- exact critics;
- protected preview + visibility receipt;
- exact owner judgment;
- low-value/noise event not promoted;
- recovery matrix for retry/stale/privacy/quality/partial failure/reopen.

Only then close #161/#163/#167 to the extent each issue's Definition of Done is actually evidenced.

## Golden Path 3 — exact approval → durable publication → NarrativeMemory

**Status: PARKED / NEXT AFTER GP2 ACCEPTANCE.**

Issue: #168.

Existing parked branch: `feat/editorial-execution-layer` at `b53f8faec74b346bc65c694a908728af46827322`.

Target vertical:

```text
exact approved text + media revisions
  → editorial timing / Calendar entry
  → immutable PublicationRequest
  → durable publication job
  → confirmed / failed / unknown connector result
  → exceptions return to Today
  → NarrativeMemory gains strong public state only after confirmed publication
```

Core rules:

- an empty calendar slot is valid;
- cadence is a constraint/goal, not a filler-content generator;
- publication freezes exact text/media/approval/target state;
- browser timers never own durable external side effects;
- request/job identity is idempotent;
- `unknown` is a truthful result and must not be blindly retried;
- only externally confirmed publication becomes strong public NarrativeMemory.

## Later verticals — intentionally behind GP2/GP3

### Media/creative expansion

- deterministic carousel production;
- uploaded-footage Reel/Short editing;
- raw screencast production;
- motion composition/multi-aspect render;
- broader image editing/generation/composition;
- media rights/face/voice/audio trust controls.

These should reuse the same canonical Assets, revision lineage, privacy policy and approval substrate rather than creating isolated media products.

### Identity/memory learning

- FeedbackEvent capture;
- explainable StyleMemory learning;
- NarrativeMemory repetition/timing support;
- explicit owner profile/boundary precedence over learned preferences;
- removable/inspectable learned rules.

### Client breadth

- mobile judgment/capture client;
- browser-extension maturity;
- paired Desktop Edge Agent/private repo/local inference flows;
- additional structured source connectors.

### SaaS/team breadth

Only after owner value is repeatedly proven:

- multi-user workspaces/roles;
- collaboration/review assignments;
- metering/billing;
- broader onboarding;
- team notifications;
- account lifecycle/export/deletion.

## Product invariants that affect roadmap priority

### Signals/opportunities

- not every event deserves content;
- noise remains auditable/non-promotional;
- exact source revision is required before exact-evidence opportunity inference;
- GitHub is one source, not the whole product;
- manual thought/Direct Create remain first-class.

### Identity/authenticity

- identity is more than a tone preset;
- explicit user boundaries outrank engagement optimization;
- learned preferences require evidence and reversibility;
- style memory and narrative memory are separate concepts.

### Inference/privacy

- application code requests task capabilities, not hard-coded provider brands;
- routing cannot silently lower privacy;
- protected raw evidence should be minimized before remote inference where policy requires it;
- private repository owner/name and opaque SourceArtifact IDs do not belong in model prompts merely for provenance;
- provider/API availability is an adapter concern, not the product architecture.

### Media

- upload does not equal publication permission;
- `NONE` is a successful MediaDecision;
- prefer real evidence/deterministic composition for factual product claims;
- originals stay immutable;
- media changes produce new immutable revisions and do not rewrite unrelated text.

### Publishing

- publication is an external reputational side effect;
- exact approved revisions are frozen into publication intent;
- target identity/scopes/capabilities must be verified;
- idempotency is mandatory;
- uncertain external outcome remains `unknown`.

## Engineering/release gates

Every active PR must earn:

1. focused behavior tests;
2. full frontend regression suite;
3. production dependency audit;
4. Next production build;
5. Python tests;
6. MCP tests;
7. exact-head preview verification when the slice affects hosted behavior;
8. clean PR review-thread/review state;
9. guarded merge using expected head SHA;
10. master CI;
11. exact merged-SHA production verification where intended;
12. runtime error/fatal inspection;
13. credential-backed owner acceptance where the issue promises an external/live journey;
14. truthful docs/capability update;
15. merged branch cleanup.

A compile-green PR is not enough. #259 specifically demonstrated why final diff/runtime-boundary audits remain necessary: an undefined runtime reference could compile successfully and was caught before merge only by final audit, then regression-locked.

## Branch discipline

Keep development branches temporary.

Current explicit exceptions:

- `feat/gp2-auto-exact-review` — active #259, retain until merged;
- `feat/editorial-execution-layer` — deliberately parked GP3 branch, retain until GP2 acceptance.

After a normal PR merges and release/acceptance evidence is recorded, delete its head branch unless it has an explicit continuing purpose.

## Vercel/deployment discipline

Do not create no-op commits merely to retry hosting. Each commit changes the exact candidate and can create another preview attempt.

When preview quota/rate limiting blocks an exact candidate before build execution:

- keep code/CI truth separate from hosting-infrastructure truth;
- do not label the result a code build failure;
- do not use an earlier branch preview as evidence for a newer SHA;
- do not weaken the release gate;
- wait for a genuine exact-head build opportunity without mutating the candidate.

Future helper/maintenance work should avoid generating unnecessary preview deployments wherever project configuration/workflow can safely skip them.

## Immediate execution order

1. Preserve #259 exact head; re-check exact-head Vercel status.
2. When exact-head Vercel is READY, re-verify PR metadata and squash-merge #259 with expected head SHA.
3. Verify new master CI + exact-SHA production READY + runtime logs; clean the merged branch.
4. Build the automatic post-strategy preparation orchestrator.
5. Prove the orchestrator's retry/idempotency/refresh/partial-success semantics.
6. Run real hosted GP2 owner acceptance and complete the acceptance ledger.
7. Close only genuinely satisfied #161/#163/#167 acceptance criteria.
8. Activate the parked GP3 branch and complete durable publication.
9. Only then expand broader media/client/SaaS roadmap slices.

## Final roadmap rule

> **Reduce the amount of content work the user has to think about. Do not automate the production of noise, and do not claim completion before the exact owner journey proves it.**
