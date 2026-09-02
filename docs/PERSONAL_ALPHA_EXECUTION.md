# SignalFlow Studio — Personal Alpha Execution Strategy

> **Synchronized:** 2 September 2026.
>
> This is the owner-first vertical execution strategy. `CURRENT_EXECUTION_STATE.md` defines the exact current PR/deployment frontier; `IMPLEMENTATION_LEDGER.md` records verified implementation history.

## Why Personal Alpha comes first

SignalFlow can eventually span sources, AI, media, calendar, publishing, clients, teams, billing and analytics. Building those horizontally would recreate the old failure mode: many foundations while the owner still manually thinks of the story, gathers evidence, records/crops media and moves content between platforms.

Execution rule:

> **Prove one complete owner journey, build only the infrastructure it consumes, verify recovery/acceptance, then expand the next vertical.**

## Product test

Personal Alpha succeeds when ordinary meaningful work can become reviewable communication with minimal deliberate content operations from the owner.

```text
real work / manual thought / intentional creative input
→ signal / intent
→ worthwhile opportunity
→ owner angle judgment
→ narrative strategy
→ exact evidence
→ only the media actually needed
→ platform-native immutable revisions
→ exact critics
→ owner judgment
→ durable publication later
→ confirmed public memory
```

The owner should not supervise routine pipeline mechanics on healthy paths.

## Permanent invariants

- ContentSignal ≠ ContentOpportunity ≠ ContentPiece.
- StyleMemory ≠ NarrativeMemory.
- media role ≠ media permission.
- MediaRequirement ≠ MediaPlan.
- GitHub webhooks are event transport; MCP is agent control/query.
- GitHub is one source, not the definition of SignalFlow.
- `DO_NOT_POST` / noise non-promotion is valid.
- media `NONE` is valid.
- `Something else` owner override is valid.
- originals are immutable; derivatives have explicit lineage.
- exact approval binds exact text/media revisions.
- approval ≠ publication.
- publication is confirmed only after external confirmation.
- `unknown` external outcomes remain unknown until safely reconciled.
- privacy/authorization fail closed.
- consumer AI subscriptions are not assumed to be backend API credits.

## Gate 0 — product/repository truth

**Status: complete enough to execute; keep synchronized.**

Required ongoing behavior:

- architecture docs describe target lifecycle;
- current execution/capability docs describe actual state;
- old launch-kit/post-generator assumptions do not outrank current product direction;
- agents can trace domain → application → adapter → UI/API/worker;
- no issue closes merely because a component exists.

## Gate 1 — GP1 manual thought → authentic exact judgment

**Status: ACCEPTED.**

Owner proof includes:

```text
manual thought/topic
→ ContentSignal
→ explainable ContentOpportunity
→ useful angle choices + Something else
→ explicit owner Voice/Identity
→ NarrativeStrategy
→ ContentPiece
→ LinkedIn/X immutable revisions
→ exact evidence/authenticity checks
→ edit/regenerate/change/reject/approve
→ exact persistent judgment state
```

Do not rebuild GP1 as a broad foundation project.

## Gate 2 — GP2 real GitHub work → exact evidence/media → owner judgment

**Status: ACTIVE / NOT OWNER-ACCEPTED.**

Owner issue: #167. Supporting acceptance issues: #161 and #163.

### Merged substrate

Already on master:

- GitHub source connection/runtime foundations;
- exact immutable `merge_commit_sha` evidence rule;
- exact evidence refresh before opportunity inference;
- privacy-minimized ProjectContext;
- durable hosted planning/review state;
- private immutable Asset storage;
- bounded screenshot worker;
- quality/privacy evaluation;
- deterministic derivative lineage;
- exact media-bound revision preserving text;
- protected exact preview + visibility receipt;
- hosted review/change/approval with stale guards;
- ranked opportunities in Today;
- hosted exact review decisions in Today.

### Active #259

Exact head `6df646f76151e6544dbd506eb7e41909b83cb8cd`.

Branch adds automatic exact critics, valid review reuse, fail-soft critic recovery and required-media gating at preparation/Today/API approval.

CI #877 is green. Exact-head Vercel preview has not executed due account-level build-rate gating. Do not merge until exact-head Vercel READY.

### Next GP2 slice

After #259 merge:

```text
approved NarrativeStrategy
→ automatic destination generation/reuse
→ automatic required screenshot/reuse
→ automatic exact review
→ Today
→ owner judgment
```

This is the next Personal Alpha implementation target.

Normal success should not require manual `Generate drafts`, `Prepare visual proof`, or `Run exact checks` clicks.

### GP2 exit condition

A real authorized GitHub event produces a genuinely useful opportunity and, for a visual story, automatically produces the required screenshot proof and exact judgment-ready revisions. Noise does not become manufactured content. Duplicate/retry/stale/privacy/quality/partial-failure/reopen cases preserve truth.

The exit condition is satisfied only when `acceptance/GOLDEN_PATH_2_OWNER_ACCEPTANCE.md` contains sanitized real evidence.

## Gate 3 — GP3 approve once → durable publication → confirmed memory

**Status: PARKED until GP2 acceptance.**

Owner issue: #168.

Parked branch: `feat/editorial-execution-layer` at `b53f8faec74b346bc65c694a908728af46827322`.

Target:

```text
exact approved text + media
→ editorial timing
→ immutable PublicationRequest
→ durable job
→ verified connector target
→ confirmed / failed / rejected / unknown
→ exception to Today when needed
→ strong NarrativeMemory only on confirmed publication
```

Exit condition: owner approves once, closes SignalFlow, and the durable system publishes at most once to the verified target; ordinary success needs no supervision.

## Gate 4 — learn repeated corrections

After GP2/GP3 owner loops are reliable:

- FeedbackEvents from review actions;
- explainable StyleMemory hypotheses;
- scope/confidence/evidence;
- owner inspect/confirm/edit/forget;
- explicit boundaries always outrank learned preference;
- NarrativeMemory remains separate and publication-grounded.

## Gate 5 — broader media production

Only after GP2/GP3 unless a direct blocker appears:

- deterministic carousel vertical;
- raw screencast capture;
- motion composition/multi-aspect render;
- uploaded-footage short-video editing;
- broader image edit/generation/composition;
- rights/face/voice/audio trust controls.

All reuse canonical Assets/lineage/privacy/revisions/approval.

Do not build a separate media product per acquisition type.

## Gate 6 — client/source breadth

Expand after core owner value:

- browser extension maturity;
- structured sources beyond GitHub;
- mobile judgment/capture client;
- paired Desktop Edge Agent/private repositories/files/local models;
- desktop capture.

All clients call the same application/domain rules.

## Gate 7 — SaaS/team breadth

After repeated owner usefulness:

- members/roles/invitations;
- collaboration/review assignment;
- cross-device conflict handling;
- metering/billing;
- account export/deletion;
- broader onboarding/notifications;
- analytics where official data access justifies it.

## Current cost/complexity rules

- deterministic/noise filtering before expensive reasoning;
- bounded relevant evidence, not whole private repositories by default;
- reuse Postgres/object storage/job foundations already consumed by GP2;
- deterministic capture/render before stochastic video generation;
- no specialized infrastructure merely because it is common in SaaS;
- no provider breadth before the active vertical needs it;
- retry/idempotency prevents duplicate expensive/external work.

## Current privacy/safety rules

- exact source evidence uses immutable revisions;
- private repository identity/opaque artifact IDs are minimized out of prompts when not semantically needed;
- secret references, not raw secrets, in canonical records;
- owner-hosted mode fails closed when access lock is missing;
- protected media previews are short-lived/exact;
- upload does not authorize public use;
- bounded capture targets/privacy checks;
- no unapproved publication;
- external unknown outcome remains truthful.

## Release/acceptance rule

Every Golden Path slice follows:

```text
focused implementation
→ focused tests
→ full CI
→ final diff/runtime audit
→ exact-head preview
→ guarded merge
→ master CI
→ production exact-SHA verification
→ runtime inspection
→ credential-backed owner proof when required
→ truthful issue closure
→ branch cleanup
```

#259 is the current example of why these distinctions matter: exact GitHub CI is green, but it remains unmerged because final-head Vercel preview has not actually run.

## Immediate Personal Alpha sequence

1. clear #259 exact-head Vercel gate without changing candidate SHA;
2. merge/production-verify #259;
3. build automatic post-strategy preparation;
4. run full real GP2 acceptance + recovery matrix;
5. close only proven #161/#163/#167 criteria;
6. activate GP3 and finish durable publication;
7. then expand media/memory/client/SaaS breadth.

## Final Personal Alpha rule

> **Minimize routine content operations while preserving exact evidence, privacy, authenticity and human judgment. The product is not proven until the real owner journey works through failure/recovery, not merely until the code looks complete.**
