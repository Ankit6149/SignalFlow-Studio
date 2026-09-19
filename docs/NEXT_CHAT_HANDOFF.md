# SignalFlow Studio — Next Chat Handoff

**Prepared:** 2026-09-20 IST  
**Repository:** https://github.com/Ankit6149/SignalFlow-Studio  
**Production:** https://signal-flow-studio.vercel.app/  
**Purpose:** authoritative continuation context for the next working chat. Read this file first, then verify the live repo/infrastructure state before changing code.

---

## 0. Start here — execution rules for the next chat

The next chat should continue the current professional workflow rather than restart analysis from scratch.

1. **Use MCP/connectors for repo/infrastructure work.** The user explicitly asked not to use TinyFish for this project. Prefer GitHub, Vercel, and Neon MCP actions.
2. **Verify live state first.** This repository is actively changing. Before work, re-check current `master`, production deployment, open PRs, GP2 readiness, and current Neon counts. Do not assume the numeric snapshot below is still exact.
3. **Never merge a PR just because code exists.** Use the sequence: narrow branch → narrow PR → full CI → Vercel preview READY → merge → exact production deployment READY → runtime/data verification.
4. **Keep PRs narrow.** One contract/reliability slice at a time. Avoid unrelated UI, architecture, or documentation churn.
5. **Do not fabricate GP2 acceptance.** No manual insertion of Opportunities, Context snapshots, Capture records, review records, or approvals merely to make the path look complete.
6. **Do not mutate production SQL to recover GP2 jobs.** The owner-safe recovery path exists. Use product/application recovery once inference is operational.
7. **Separate deterministic proof from live acceptance.** Tests can prove idempotency, stale guards, privacy blocking, retry behavior, etc. They do not prove the hosted end-to-end path.
8. **Do not broaden into GP3, video, mobile, multi-platform expansion, billing, or large redesigns until GP2 is accepted.**
9. **Protect secrets.** Never expose API keys, GitHub tokens, cookies, CDP credentials, signed object URLs, private source bodies, or raw authorization headers in docs, logs, chat, issues, or acceptance evidence.
10. **Keep user updates short and scannable.** The user explicitly asked not to receive long chat paragraphs. Put detailed state into repo docs/files instead.
11. **Do not re-build already proven subsystems.** Audit first; if the contract is already implemented and tested, add only missing proof or integration.
12. **When external credentials are missing, keep building only credential-independent gaps.** Do not create architectural workarounds that weaken provider, privacy, or capture boundaries.

---

## 1. Product definition

SignalFlow Studio is a **private-first Content Operating System**, not simply a post generator.

Canonical loop:

```text
Observe
  ↓
Understand
  ↓
Decide
  ↓
Plan
  ↓
Capture
  ↓
Produce
  ↓
Review
  ↓
Remember
  ↓
Publish
  ↓
Learn
```

Current golden-path sequencing:

- **GP1:** manual thought → opportunity → authentic LinkedIn/X review/approval with memory. **Accepted.**
- **GP2:** real GitHub work → useful opportunity → exact source evidence → automatic screenshot when meaningful → exact LinkedIn/X review/approval. **Current focus; not yet accepted.**
- **GP3:** exact approved text/media → durable schedule/publish → confirmed publication → public NarrativeMemory. **Do not start until GP2 closes.**

The current project strategy remains:

> **Finish GP2 in production first. Do not broaden the product until that path works end-to-end.**

---

## 2. Current baseline before this handoff-doc merge

This is the last verified baseline **before merging this handoff documentation PR**. The handoff merge itself may create another GitHub signal/job, so the next chat must query live counts rather than treating these values as immutable.

### Git / production

- Baseline `master`: `fe192c4f1bd42cc7f2b0b456eb58a5837db0b3c3`
- Commit: **Prove GP2 capture worker retry recovery (#314)**
- Vercel production deployment: `dpl_3MXL3qkTTqtqCtNPnXq2xmLp9KdL`
- Deployment state: **READY**
- Production alias: `signal-flow-studio.vercel.app`
- Vercel runtime-error audit over the prior 24 hours: **no runtime error clusters found**

### Production database snapshot

Measured on Neon main branch before this handoff merge:

| Record | Count |
|---|---:|
| Canonical ContentSignals | 25 |
| Revision-bound Signals | 24 |
| SourceArtifacts | 225 |
| ProjectContextSnapshots | 0 |
| ContentOpportunities | 0 |
| Signal-opportunity jobs | 24 |
| Dead signal-opportunity jobs | 24 |
| Pending signal-opportunity jobs | 0 |
| CaptureRecipes | 0 |
| CaptureJobs | 0 |
| Media records | 0 |

All 24 signal-opportunity jobs currently share the safe terminal error:

`vercel_gateway_http_403`

Latest observed job update in the pre-handoff snapshot:

`2026-09-19T18:50:09.608Z`

Interpretation:

```text
GitHub connection       ✅
webhook verification    ✅
event normalization     ✅
canonical Signal        ✅
exact merge SHA         ✅
bounded SourceArtifacts ✅
durable opportunity job ✅
hosted inference        ❌ 403
ProjectContext          ⛔ not reached
Opportunity             ⛔ not reached
live capture            ⛔ not reached
exact GP2 review        ⛔ not reached
```

The singular live continuation choke point is still hosted inference. The second external gate is the remote CDP browser worker.

---

## 3. Infrastructure identities

### Vercel

- Project: `signal-flow-studio`
- Project ID: `prj_QPTqKYD8cp10YcRIqxxFBOVWerVi`
- Team ID: `team_PQPHlgiyMpXsDBat5NePAQ3d`
- Team/account slug: `ankit6149s-projects`

### Neon

- Project: `SignalFlow-Studio`
- Project ID: `patient-resonance-91149144`
- Main branch ID: `br-divine-mode-af8u7y9q`
- Database: `neondb`

Never expose the connection string.

### GitHub App / source authority

Known active production connection:

`signalflow-github-connection-794c1349-dbfa-414a-ae96-6ebb4444d0fd`

Repository:

- GitHub repository ID: `1269263906`
- `Ankit6149/SignalFlow-Studio`
- SignalFlow project: `sf-project-github-1269263906`

Read-only permission scope:

- `contents:read`
- `metadata:read`
- `pull_requests:read`

Capabilities:

- `repository_contents`
- `repository_events`
- `repository_metadata`

The GitHub source is already connected. **Do not ask the user to reinstall/reconnect GitHub unless live evidence proves the current authority is invalid.**

---

## 4. Current reserved GP2 positive event — PR #315

The old reserved PR **#291 is closed**. It was auto-closed during controlled branch cleanup and is no longer the acceptance PR.

The replacement is:

### PR #315 — Gate C: current-master workspace loading acceptance change

- State: **OPEN**
- Mergeable: **true**
- Head: `feat/refine-workspace-loader-gate-c-20260915`
- Head SHA: `8b652cfe029975535fd9522d73a5af21b39505aa`
- Behind current baseline master: **0**
- Ahead: **2 commits**
- Diff: **exactly 2 intended files**
  - `frontend/app/loading.js`
  - `frontend/app/state.module.css`
- Additions/deletions: +232 / -26
- CI for current head: **success**
- Current Vercel preview: **READY**
- Preview deployment observed: `dpl_7NwXaJkxYCQAcik8fnmRi61agmim`

### Critical rule

**DO NOT MERGE #315 until hosted inference and remote CDP are operational and the final GP2 live acceptance run is ready to begin.**

#315 is intentionally preserved as the controlled meaningful visual product event.

Expected acceptance use:

```text
merge #315
   ↓
GitHub webhook
   ↓
one canonical Signal
   ↓
exact merge SHA
   ↓
bounded source evidence
   ↓
ProjectContext
   ↓
ranked Opportunity
   ↓
Today
   ↓
owner angle / Something else
   ↓
NarrativeStrategy
   ↓
LinkedIn + X exact revisions
   ↓
automatic screenshot of the Gate-C loading surface
   ↓
private raw AssetVersion
   ↓
4:5 / 16:9 derivative as required
   ↓
exact media-bound owner review
   ↓
owner judgment
```

If `master` changes before final acceptance, refresh #315 again while preserving the same exact two-file intent and re-run CI/preview.

---

## 5. GP2 deterministic preflight

The repo now has a named credential-free GP2 preflight:

```bash
cd frontend
npm run gp2:preflight
```

This is intentionally enforced in CI.

The preflight currently covers the major credential-independent GP2 contracts, including:

### GitHub/source authority

- GitHub App connection lifecycle
- revoked/reinstall/reselection safety
- webhook ingestion
- concurrent burst/idempotency
- exact source-revision binding
- unauthorized/unmapped fail-closed behavior
- repository enrichment recovery without authority loss

### Inference/recovery

- operational hosted provider selection
- Vercel Gateway readiness behavior
- provider fallback policy
- owner-safe blocked-job recovery
- no automatic local/private fallback
- exact provider semantics when explicitly requested

### Opportunity / owner decision / planning

- hosted Signal → Opportunity continuation
- Opportunity inbox behavior
- offered-angle selection
- owner-authored **Something else**
- Today integration
- stale Today/revision protection
- evidence-bound NarrativeStrategy planning
- hosted planning continuity
- browser refresh/resume of preparation state

### Capture/media

- private capture storage
- bounded CDP action surface
- redirect-origin rejection
- bounded secret/cookie boundary
- selector timeout behavior
- large semantic focused-region capture
- capture privacy rules
- capture worker retry recovery
- loading/error/required-subject quality state
- `needs_review` on uncertainty
- screenshot derivative planning
- semantic evidence-aware crop safety
- exact parent AssetVersion lineage
- retry-idempotent derivative rendering
- hosted screenshot production
- exact media/review binding
- protected exact asset preview

### Exact review

- immutable PlatformVariant revision history
- stale current-revision guards
- owner review UI behavior
- media visibility/approval binding
- one-platform failure preserving successful work
- owner-facing GP2 trace panel

The preflight is **not** the same as live GP2 acceptance. It means the code path is strongly prepared for the hosted run.

---

## 6. Recent reliability work already merged — do not redo it

### #295 — owner-safe GP2 blocked-work recovery

Implemented bounded dead-only recovery.

Important behavior:

- only known recoverable inference errors
- workspace-scoped
- small bounded batch
- retry budget reset
- no manual production SQL needed
- recovery refuses mutation while inference is unavailable

### #300 — operational hosted inference selection

Centralized hosted provider selection.

Policy:

```text
explicit requested provider
        ↓
configured DEFAULT_MODEL_PROVIDER
        ↓
operational Vercel Gateway
        ↓
configured approved direct hosted provider
        ↓
fail closed
```

Important:

- explicit provider stays exact
- automatic fallback does not jump to local/Ollama/LM Studio
- direct hosted fallback can bypass an unhealthy Gateway if configured
- readiness/execution use shared policy

### #302 — recovery aligned with provider selection

Fixed the cross-layer mismatch where recovery previously hard-gated only on Vercel Gateway even if a direct hosted provider was operational.

### #303 — GP2 named preflight + burst idempotency

Added deterministic burst/duplicate proof and the named `gp2:preflight`.

### #304 — GitHub reconnect authority lifecycle

Proved:

```text
revoked
  ↓
reinstall
  ↓
same canonical installation identity
  ↓
pending
  ↓
old repository scopes remain disabled
  ↓
explicit repository reselection
  ↓
active
```

### #305 — hosted Opportunity / Today / evidence-bound planning preflight

Extended preflight across the middle of GP2:

- offered angle
- Something else
- Today
- exact evidence
- NarrativeStrategy

### #306 — CDP capture edge safety

Added proof for:

- final cross-origin redirect rejection
- bounded secret cookie resolution
- no secret persistence in session/provenance
- bounded selector timeout
- focused region larger than viewport without blind crop

### #307 — read-only GP2 acceptance inspector

Added an owner-only, read-only trace keyed by one exact Git source revision.

It can inspect:

- Signal
- opportunity job
- exact ProjectContext
- Opportunity
- planning
- media/capture
- review
- approval

It must remain read-only and fail closed on invalid/ambiguous revisions.

### #309 — recovery-matrix preflight expansion

Pulled existing recovery tests into the single GP2 preflight:

- capture privacy/failure
- partial destination preservation
- stale Today/revision guards
- hosted planning continuity

### #310 — repository enrichment recovery

Added deterministic proof that repository/project enrichment failure:

- schedules safe retry
- does not enter Opportunity inference
- does not lose active verified GitHub authority/scope

### #311 — acceptance-ledger reconciliation

Updated the formal GP2 evidence ledger to current deterministic recovery proof.

The ledger should remain the acceptance source of truth, but the next chat must keep it synchronized with actual current master/live evidence.

### #312 — controlled branch cleanup

Performed one-shot branch cleanup, then removed the cleanup workflow.

This auto-closed old #291; #315 is its replacement.

### #313 — owner-facing GP2 revision trace

Added a compact read-only trace panel on **Connections**.

Owner can enter an exact Git SHA and inspect safe stage/status progress:

```text
Signal → Opportunity → Context → Planning → Media → Review → Approval
```

No raw source body, secrets, or mutation path.

### #314 — capture worker retry recovery

Proved a retryable browser failure such as `browser_crash`:

- reschedules the same durable capture job
- persists no output on failed attempt
- later succeeds once
- produces one canonical output Asset
- does not duplicate the capture chain

---

## 7. What is finished vs partial vs external

### Finished / strongly proven

#### GP1
Accepted.

#### GitHub source ingestion
Live production proof exists for:

- GitHub App authority
- webhook delivery
- signature verification
- canonical Signal creation
- exact immutable merge SHA
- bounded SourceArtifacts
- durable signal-opportunity job creation
- continued ingestion across many real repo merges

#### Idempotency / recovery architecture
Deterministically proven:

- duplicate/burst delivery
- stale current guards
- repository enrichment retry
- inference dead-state preservation
- owner-safe recovery
- capture retry
- privacy block
- quality `needs_review`
- derivative block
- one-destination failure preserving successful work
- refresh/resume

#### Exact media/review architecture
Implemented and tested:

- private immutable AssetVersion
- exact derivatives + lineage
- exact media bindings
- visibility receipts
- stale-review protection
- approval invalidation on changed exact media/text
- targeted changes / restore history

#### Observability
Owner-facing exact-revision GP2 trace exists on Connections.

### Implemented but waiting for live hosted proof

- ProjectContext synthesis from a real GitHub-origin continuation
- ranked ContentOpportunity in production
- Today opportunity from the real live event
- owner angle selection on a real GitHub-origin Opportunity
- evidence-backed NarrativeStrategy from the live chain
- LinkedIn/X exact revisions from the live chain
- automatic screenshot CaptureRecipe → real CDP → real PNG
- derivative generated from real PNG
- exact media-bound review
- owner approval on the real acceptance event

### External configuration / live gates

#### Hosted inference

Current production signal-opportunity jobs still fail with:

`vercel_gateway_http_403`

The software now supports an approved configured direct hosted provider if Gateway is unavailable.

The next chat should not build another provider abstraction. Instead, once the user connects/configures the intended provider:

1. verify owner readiness
2. confirm the selected operational hosted provider
3. recover a small bounded set of dead jobs
4. observe whether ProjectContext and Opportunity records materialize

If no direct provider is configured and Gateway still returns 403, this is an account/team/provider-access condition, not a reason to rebuild GitHub or the DB.

#### Remote browser / CDP

Production still needs the approved remote CDP connection, typically:

- `SIGNALFLOW_CDP_BROWSER_WS_ENDPOINT`
- `SIGNALFLOW_CDP_BROWSER_AUTH_TOKEN` if the provider requires bearer auth
- correct capture environment/target-origin configuration

Do not weaken WSS, same-origin, privacy, or secret boundaries to make a provider work.

---

## 8. Current live GP2 recovery state

Pre-handoff live snapshot:

- 24 revision-bound Signals
- 24 signal-opportunity jobs
- all 24 jobs currently `dead`
- all 24 use `vercel_gateway_http_403`
- no pending/completed signal-opportunity jobs
- no production ProjectContextSnapshot yet
- no production ContentOpportunity yet

### Recovery rule

When inference becomes operational:

**Do not replay GitHub history and do not manufacture events.**

Use the owner-safe recovery path from #295/#302 to revive a small bounded batch.

Recommended first recovery batch:

- at most 3 dead jobs
- observe actual ProjectContext/Opportunity materialization
- use the owner GP2 trace inspector to identify where each exact revision reached
- stop if the first recovered job reveals a new real defect
- fix that defect narrowly before bulk recovery

---

## 9. Final GP2 acceptance sequence

Once the user has connected the AI/provider and CDP service, execute in this order.

### Phase 1 — readiness

1. Verify current `master`, production deployment, DB counts, runtime errors.
2. Run/inspect owner GP2 readiness.
3. Hosted inference must report an operational approved provider.
4. Test remote browser worker readiness.
5. Confirm private asset storage / exact-preview receipt readiness.
6. Run `npm run gp2:preflight` on current master.

### Phase 2 — recover existing real work

1. Use owner-safe recovery for a small batch.
2. Confirm a real ProjectContextSnapshot appears.
3. Confirm a real ContentOpportunity appears.
4. Use the exact-revision trace panel to follow the recovered event.
5. Confirm evidence/revision identities are correct.
6. Do not manually patch DB state if continuation fails.

### Phase 3 — live capture proof

1. Ensure active CaptureRecipe provisioning resolves correctly.
2. Test the browser worker against approved preview/demo target.
3. Capture a real PNG.
4. Confirm privacy check happens immediately before bytes.
5. Confirm private immutable raw AssetVersion.
6. Confirm quality state.
7. Render required derivative.
8. Confirm exact parent lineage.
9. Confirm exact media visibility in review.

### Phase 4 — negative/noise control

Exercise one real or explicit routine/dependency-only event.

Required proof:

- Signal may remain auditable
- cheap gate does not promote it merely because webhook arrived
- no high-priority opportunity is manufactured

Do not use the earlier failed-inference experiment as final proof.

### Phase 5 — controlled positive event

Only now:

1. Re-check PR #315 against current `master`.
2. Ensure behind master = 0.
3. Ensure diff remains exactly the two intended files.
4. Ensure CI green.
5. Ensure preview READY.
6. **Merge #315.**
7. Record the exact final merge SHA.
8. Trace that exact SHA through the owner GP2 inspector.
9. Confirm one canonical Signal/job chain.
10. Confirm exact evidence.
11. Confirm ranked Opportunity.
12. Choose offered angle or Something else.
13. Confirm NarrativeStrategy.
14. Confirm LinkedIn + X exact revisions.
15. Confirm automatic screenshot.
16. Confirm derivative.
17. Confirm exact review.
18. Perform owner approval/change/reject judgment as required.

### Phase 6 — close GP2

Update:

- `docs/acceptance/GOLDEN_PATH_2_OWNER_ACCEPTANCE.md`
- issue #161 only to the extent its definition is proven
- issue #163 only when real CDP screenshot vertical is proven
- issue #167 only when the entire real owner journey is proven

Then declare GP2 accepted.

Only after that start GP3.

---

## 10. Acceptance evidence that must be captured safely

For final GP2 closing evidence, preserve only safe identifiers/state:

- production Git SHA
- production deployment ID/state
- GitHub connection safe ID
- provider delivery/event safe reference
- canonical Signal ID
- exact immutable source revision
- ProjectContextSnapshot ID
- Opportunity ID
- owner angle decision
- NarrativeStrategy ID
- CaptureRecipe version
- CaptureJob ID/status
- raw Asset ID + AssetVersion ID
- derivative Asset ID + AssetVersion ID
- exact LinkedIn/X PlatformVariantRevision IDs
- critic/review state
- approval state
- CI/preflight/build state

Never include:

- tokens
- API keys
- webhook secrets
- cookies
- raw private repository bodies
- raw CDP endpoint credentials
- signed asset URLs
- private headers

---

## 11. Branch / repo hygiene

Branch inventory at handoff preparation:

| Branch | Status vs master | Action |
|---|---|---|
| `master` | canonical | keep |
| `feat/refine-workspace-loader-gate-c-20260915` | ahead 2 / behind 0 | **keep — PR #315 acceptance event** |
| `feat/editorial-execution-layer` | diverged, ahead 21 / behind 102 | **keep until explicitly reconciled** |
| `docs/gp2-ledger-current-20260919` | ahead 0 / behind 1 | cleanup candidate; merged purpose already on master |
| `feat/gp2-owner-trace-panel` | squash-merged via #313; branch diverged due squash history | cleanup candidate after confirming no unique desired content |
| `test/gp2-capture-retry-proof` | squash-merged via #314; branch diverged due squash history | cleanup candidate after confirming no unique desired content |

Do not delete `feat/editorial-execution-layer` casually. It contains unique historical work.

Do not delete or mutate the Gate-C branch while #315 is reserved.

The GitHub MCP connector used in this session does not expose a direct branch-delete action. If cleanup is needed, use an approved GitHub UI/action or a narrow one-shot cleanup workflow and remove that workflow after use, as done previously.

### PR hygiene

At handoff preparation the important open PR is:

- **#315** — reserved final positive GP2 acceptance event

Old #291 is closed and superseded. Do not refer to #291 as the live acceptance PR.

---

## 12. Files / surfaces the next chat should know

### Acceptance

- `docs/acceptance/GOLDEN_PATH_2_OWNER_ACCEPTANCE.md`

### GP2 readiness / inference

- `frontend/lib/server/gp2Readiness.mjs`
- shared hosted provider-selection implementation
- owner-safe GP2 recovery route/application

### Capture

- `frontend/lib/infrastructure/cdpCaptureWorkerAdapter.mjs`
- `frontend/lib/application/captureExecutionApplication.mjs`
- screenshot derivative application
- private asset storage application

### GP2 inspection

- owner-only read-only GP2 acceptance inspector from #307
- owner-facing GP2 revision trace panel on Connections from #313

### Deterministic GP2 gate

- `frontend/package.json`
- script: `gp2:preflight`

### Gate-C visual event

- `frontend/app/loading.js`
- `frontend/app/state.module.css`
- PR #315

---

## 13. Do-not-redo list

Unless fresh evidence proves a regression, do **not** restart work on:

- GitHub App connection architecture
- webhook secret authority
- exact source revision persistence
- SourceArtifact evidence model
- durable signal-opportunity job model
- duplicate/burst idempotency
- hosted provider selector architecture
- owner-safe job recovery architecture
- GitHub reconnect lifecycle
- stale revision guards
- exact media approval model
- private asset storage
- semantic screenshot crop planning
- CDP same-origin/privacy/secret safety architecture
- capture retry architecture
- GP2 read-only inspector
- owner-facing GP2 trace panel

The remaining work should increasingly be **live integration and acceptance**, not foundational rebuilding.

---

## 14. What not to do next

Do not:

- merge #315 before both external gates are ready
- replay all GitHub events
- recover all 24 jobs at once
- manually update dead jobs with SQL
- manually insert Context/Opportunity/media/review records
- force a screenshot into a non-visual story
- call deterministic tests “live acceptance”
- begin direct publication / GP3
- redesign the Studio globally
- build video/carousel/mobile flows
- create another AI routing layer
- weaken privacy/secret/CDP restrictions to satisfy a provider
- reconnect GitHub without evidence the current connection is broken

---

## 15. Definition of “GP2 code-ready” vs “GP2 accepted”

### Code-ready

SignalFlow is code-ready when:

- current master passes normal tests/build/audit
- `gp2:preflight` passes
- inference route is implemented safely
- recovery path is implemented safely
- capture path is implemented safely
- exact review path is implemented safely
- trace/inspection path exists

The repository is very close to / effectively at this state.

### Accepted

GP2 is accepted only when a **real authorized GitHub event** reaches:

```text
Signal
→ exact evidence
→ ProjectContext
→ Opportunity
→ owner decision
→ NarrativeStrategy
→ LinkedIn/X
→ real automatic screenshot
→ exact media-bound review
→ owner judgment
```

and the noise + recovery proofs are also satisfied with sanitized evidence.

That live path has **not yet completed**, primarily because hosted inference and remote CDP are still external gates.

---

## 16. Recommended first actions in the next chat

The next chat should begin with a short verification pass, not a new audit project:

```text
1. Read this file.
2. Read GOLDEN_PATH_2_OWNER_ACCEPTANCE.md.
3. Check latest master SHA.
4. Check production deployment READY.
5. Check runtime errors.
6. Check live Neon counts/job errors.
7. Check PR #315 still has exactly two files and is behind 0.
8. Run/check gp2:preflight.
9. Ask only whether the user has now connected the intended AI provider and CDP endpoint if that cannot be verified through available connectors.
10. If connected: start readiness → small recovery batch → trace.
11. If not connected: only work on a demonstrable remaining code defect; otherwise stop expanding GP2 and preserve the acceptance event.
```

The correct objective is no longer “build more architecture.”

The objective is:

> **arrive at a clean, observable, one-shot live GP2 acceptance run with no fabricated state and no unnecessary rebuilds.**

---

## 17. Current status summary

| Area | State |
|---|---|
| GP1 | ✅ Accepted |
| GitHub App authority | ✅ Live |
| Webhook ingestion | ✅ Live |
| Signal + immutable revision | ✅ Live |
| Bounded source artifacts | ✅ Live |
| Durable continuation jobs | ✅ Live |
| Duplicate/burst safety | ✅ Deterministic proof |
| Reconnect/revoke safety | ✅ Deterministic proof |
| Repository enrichment recovery | ✅ Deterministic proof |
| Hosted provider selector | ✅ Merged/deployed |
| Owner-safe recovery | ✅ Merged/deployed |
| ProjectContext from real GitHub continuation | ⛔ blocked upstream |
| ContentOpportunity from real GitHub continuation | ⛔ blocked upstream |
| Hosted inference | 🔴 external/live blocker — Gateway 403 unless direct provider becomes operational |
| CDP browser worker | 🔴 external/live configuration required |
| Screenshot safety/quality/derivatives | ✅ deterministic code proof |
| Real production PNG/Asset from CDP | ⛔ not yet live-proven |
| Exact media review architecture | ✅ deterministic code proof |
| Owner-facing revision trace | ✅ live product surface |
| PR #315 Gate-C event | 🟡 ready/reserved; DO NOT MERGE yet |
| GP2 | 🟡 code-ready / not accepted |
| GP3 | 🔴 later |

---

## 18. Final handoff instruction

Continue professionally from the **current live edge**.

Do not mistake open parent issues for missing architecture, and do not mistake deterministic proof for live acceptance.

The next major milestone is not another subsystem. It is:

```text
operational AI provider
+ operational CDP
+ bounded recovery of real jobs
+ exact #315 merge event
+ full revision trace
= GP2 owner acceptance
```

Once that is achieved, update the acceptance ledger, close only the issues whose Definitions of Done are actually proven, clean merged branches, and then move to GP3.
