# SignalFlow Studio — ContentSignal Implementation Contract

> **Synchronized:** 2 September 2026.
>
> Manual ContentSignal intake is accepted as part of GP1. GitHub connected-source ingestion/evidence infrastructure is substantially implemented, but real hosted GP2 owner acceptance remains incomplete. Do not collapse those states.

## 1. Domain boundary

A `ContentSignal` records something that happened or something the owner supplied that *might* become worthwhile communication.

It is not:

- generated copy;
- a ContentOpportunity;
- a NarrativeStrategy;
- a Campaign/ContentPiece;
- publication intent.

Creating a signal does not itself mean `post`.

## 2. First-class source types

Manual owner input remains first-class:

- thought;
- lesson;
- opinion;
- question;
- release/launch/milestone context;
- personal/career update;
- research/external topic;
- other explicit signal kinds.

GitHub is one connected source, not the definition of SignalFlow.

Future sources should normalize into the same signal/application contracts rather than creating connector-specific content engines.

## 3. Manual GP1 implementation

Manual signals are accepted in the GP1 owner vertical.

The owner can create and manage signal lifecycle in `/signals`, including current supported metadata/project/privacy/lifecycle operations. Browser-local persistence remains a real adapter for the manual Personal Alpha path rather than disposable UI state.

Manual signal → opportunity → owner angle → planning/review is accepted in GP1.

## 4. Canonical record/provenance

A signal uses stable canonical identity and provenance, including as applicable:

- `signalId`;
- workspace/project identity;
- source type / source connection identity;
- canonical SourceArtifact/Asset references;
- safe external event reference;
- occurred/observed timestamps;
- headline/summary/kind;
- importance/privacy/boundary metadata;
- lifecycle/snooze state;
- provenance;
- optional immutable `sourceRevision` for connected-source exact evidence.

### Schema compatibility rule

`sourceRevision` is additive/optional and remains compatible with the existing ContentSignal schema version. Do **not** bump the schema merely because this optional exact-revision field exists.

## 5. GitHub exact source-revision contract

### Merged PR

Canonical exact revision is GitHub `merge_commit_sha`.

Never substitute PR head SHA as merge evidence.

### Release

A release may promote only when the supported target is already an immutable Git SHA.

A mutable branch/tag/ref target may remain auditable but is **non-promotional** until exact immutable resolution is explicitly implemented/proven.

### Missing exact revision

The signal may persist for audit/history, but exact-evidence opportunity inference does not proceed as though freshness is known.

## 6. External event idempotency

Connected ingestion must use stable external-delivery/event identity so duplicate delivery does not create duplicate signal/editorial chains.

Repository port/application boundaries include external-event lookup/insert-if-absent semantics.

Real duplicate-delivery acceptance remains part of GP2 owner acceptance and must not be marked complete solely from unit/adapter coverage.

## 7. Webhook trust boundary

For provider events:

```text
raw provider delivery
→ signature verification
→ source-connection/resource authority
→ supported event normalization
→ exact source revision extraction
→ canonical ContentSignal insert/reuse
→ noise/promotion decision
```

Never normalize unverified raw provider payload into trusted canonical state merely because the shape matches.

MCP remains a separate agent-control/query interface; it is not production webhook transport.

## 8. Noise/promotion boundary

Not every signal deserves opportunity reasoning.

A routine dependency/trivial event may remain auditable while staying non-promotional.

The connected source path must reuse the canonical ContentOpportunity intelligence rather than hard-coding GitHub-specific destinations/posts.

Acceptance requires both:

- a meaningful real event that becomes a useful opportunity;
- a low-value/noise event that does not become manufactured content/media.

## 9. Exact evidence continuation

For a promotable connected GitHub signal:

```text
ContentSignal.sourceRevision
→ durable opportunity job
→ refresh/reuse bounded repository evidence at exact revision
→ verify ProjectContextSnapshot revision
→ opportunity inference
→ persist exact projectContextSnapshotId
```

Failure/mismatch blocks/retries before inference. Never silently evaluate against unrelated latest repository context.

## 10. Privacy minimization

Exact provenance does not require leaking every identifier to the model.

For private source planning/inference:

- reuse canonical minimized ProjectContext synthesis;
- preserve safe claims/architecture/constraints/uncertainties;
- omit private repository owner/name when not semantically needed;
- omit opaque SourceArtifact IDs when not semantically needed;
- retain exact identities in canonical records/fingerprints/task provenance;
- never put access tokens/webhook secrets/credentials into normal model input.

## 11. Current GP2 source status

Merged work through PR #258 includes substantial connected-source substrate:

- GitHub connection/runtime boundaries;
- owner-safe readiness + hosted owner policy;
- exact source revision rules;
- exact evidence refresh before opportunity inference;
- durable hosted opportunity/planning/review continuation;
- ranked opportunities in Today;
- hosted exact review decisions in Today.

This does **not** mean #161/#167 are owner-accepted.

Real production acceptance still requires a live authorized App install/repository selection and real meaningful/noise webhook proof.

## 12. Active downstream PR #259

#259 does not change ContentSignal schema/normalization. It changes downstream review preparation after planning/generation.

Exact head: `6df646f76151e6544dbd506eb7e41909b83cb8cd`.

CI #877 fully green; final exact-head Vercel preview not executed due account-level build-rate gating; remains unmerged.

Do not modify signal contracts merely to solve #259 release gating.

## 13. Current next vertical

After #259 merge, the next GP2 gap is downstream of ContentSignal:

```text
approved NarrativeStrategy
→ automatic destination generation
→ automatic required screenshot
→ automatic exact review
→ Today
→ owner judgment
```

After that, perform the real connected-source owner acceptance from GitHub event through final judgment.

## 14. Acceptance/closing rule

Keep #161/#167 open until real hosted evidence proves:

- verified GitHub authority;
- signature verification;
- exact source revision;
- exactly one signal under duplicate delivery;
- meaningful/noise separation;
- exact evidence continuity;
- durable continuation through owner judgment;
- refresh/retry recovery.

Record sanitized evidence in `acceptance/GOLDEN_PATH_2_OWNER_ACCEPTANCE.md`.
