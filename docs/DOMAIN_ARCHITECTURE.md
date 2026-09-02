# SignalFlow Studio — Domain Architecture

> **Synchronized:** 2 September 2026.
>
> This file describes the architectural dependency boundaries currently used by the accepted/active Golden Paths. Product target breadth continues in the canonical architecture documents; current execution status is in `CURRENT_EXECUTION_STATE.md`.

## 1. Dependency direction

SignalFlow uses one canonical domain/application system with multiple adapters/clients.

```text
UI / Next routes / MCP / extension / webhook / workers / future mobile/edge
                                  ↓
                         application services
                                  ↓
                      domain records + ports
                                  ↑
 browser / memory / Postgres / object storage / provider / connector / renderer adapters
```

Do not place canonical business rules only in React components, route handlers, worker adapters or connector code.

Do not create a second hosted/local planning, review or media domain merely because persistence/runtime differs.

## 2. Content intelligence records

Primary canonical records include:

- `ContentSignal` — something that happened/supplied evidence;
- `ContentOpportunity` — editorial judgment candidate;
- `NarrativeStrategy` — owner-selected narrative direction + constraints;
- `ContentPiece` — canonical story/content intent;
- planned platform variant — destination intent/status;
- `PlatformVariantRevision` — immutable exact output revision;
- `PlatformVariantReview` — exact evidence/authenticity review;
- `PlatformVariantApproval` — exact owner judgment.

Future/partial records include FeedbackEvent/StyleMemory/NarrativeMemory and editorial/publication records.

Keep these concepts separate. Do not collapse Signal → Opportunity → generated copy into one blob.

## 3. Identity context

Explicit owner identity/profile state includes versions/snapshots for downstream exact context.

Rules:

- explicit owner identity/boundaries outrank learned preferences;
- exact downstream generation/review can reference immutable context snapshot;
- StyleMemory and NarrativeMemory are separate;
- automatic learning remains broader than the accepted GP1 foundation.

## 4. Source/evidence architecture

Canonical source/evidence records include SourceConnection, SourceArtifact, ProjectContextSnapshot and ContentSignal provenance.

### Exact GitHub revision

- merged PR → `merge_commit_sha`;
- mutable release ref → non-promotional until exact resolution;
- missing immutable source revision → auditable/non-promotional.

### Evidence continuation

```text
ContentSignal exact sourceRevision
→ repository/source adapter refresh at exact revision
→ bounded immutable SourceArtifact state
→ ProjectContextSnapshot
→ ContentOpportunity references exact snapshot
→ NarrativeStrategy resolves same exact snapshot
```

Mismatch/failure blocks/retries before opportunity inference.

### Prompt minimization

Exact provenance identities need not become model text. Private repository owner/name and opaque SourceArtifact IDs are excluded where they are not semantically needed; canonical minimized ProjectContext carries safe useful synthesis.

## 5. Persistence split without domain split

### Browser/local compatibility/GP1

Browser adapters remain valid for accepted manual Personal Alpha paths and portable/local workflows.

They are adapters, not a separate domain model.

### Hosted GP2

Postgres adapters persist hosted source/opportunity/planning/review/media state.

Hosted UI/routes must not treat localStorage as canonical for these records.

PR #258 explicitly keeps browser-local and hosted Today/revision storage separate while projecting both through shared decision logic.

### Rule

Never point a browser-local revision-history repository at hosted canonical records just to simplify UI.

Use explicit adapters and merge/project results at application boundaries.

## 6. Today architecture

Today is a derived owner-decision surface, not a second workflow database.

It projects current canonical state:

- ranked Opportunities requiring owner angle judgment;
- exact reviewed PlatformVariant revisions requiring final owner judgment;
- later GP3 publication exceptions.

Important rules:

- do not persist duplicate `Today decision` domain truth when it can be reconstructed;
- hosted unavailability must not become false `ALL CLEAR`;
- Today does not auto-select an owner angle;
- only final judgment-ready revision is projected;
- PR #259 adds required-media suppression for final review decisions.

## 7. Generation/revision architecture

Generation creates immutable PlatformVariantRevision children.

Revision operations:

- initial generation;
- regeneration;
- owner edit;
- targeted AI change;
- media rebound;
- restore historical composite.

Rules:

- current revision identity is explicit;
- stale mutation fails before creating unseen child;
- history is append-only/immutable;
- exact review/approval references exact revision;
- media rebound preserves text;
- text edit preserves exact media unless changed separately.

## 8. Automatic exact-review preparation — PR #259

Unmerged exact candidate: `6df646f76151e6544dbd506eb7e41909b83cb8cd`.

New application service:

`exactReviewPreparationApplication`

Responsibilities:

- decide whether current exact revision is ready for review;
- defer when required non-text media is pending;
- reuse current exact review when valid;
- invoke existing review application when needed;
- convert critic failure into bounded recoverable result;
- prepare all relevant current revisions for a ContentPiece without duplicating business rules.

It does not replace `PlatformReviewApplication`; it orchestrates/reuses it.

## 9. Required-media architecture

Required media is a NarrativeStrategy constraint, not a UI decoration.

Current defense-in-depth target on #259:

- preparation: defer exact review;
- Today: suppress incomplete decision;
- hosted approval: reject `required_media_pending`.

This ensures direct API/stale/historical state cannot bypass the strategy.

## 10. Media/capture records

Current screenshot vertical uses canonical records/services such as:

- MediaRequirement / media policy records;
- CaptureRecipe;
- CaptureJob;
- durable job;
- Asset / AssetVersion;
- ScreenshotQualityReview;
- ImageDerivativePlan;
- AssetLineage;
- PlatformVariantRevision media bindings.

Capture/media processing stays behind application/adapter boundaries.

Do not create a “screenshot-only revision model” separate from PlatformVariantRevision.

## 11. Capture execution architecture

```text
exact current revision
→ resolve active recipe/checkpoint
→ create/reuse exact CaptureJob + durable job
→ claim exact job ID
→ bounded worker execution
→ private immutable capture AssetVersion
→ quality/privacy review
→ deterministic derivative
→ lineage
→ media rebound revision
```

Adapter responsibilities include CDP protocol, object storage and image processing. Domain/application rules decide allowed state transitions/identities.

## 12. Exact private media visibility

Private Asset bytes remain server-owned.

Hosted preview service verifies workspace/exact AssetVersion and streams private bytes; server issues short-lived signed visibility receipt after serving exact bytes.

Approval application boundary receives/validates exact visible media identity proof before exact approval.

Do not store permanent public URLs as canonical private media identity.

## 13. Owner/auth architecture

Hosted owner access is a shared server policy, not route-specific behavior.

- explicit hosted/Vercel requires owner lock;
- hosted missing lock fails closed;
- local/self-hosted may intentionally operate unlocked;
- owner failures private/no-store;
- supported anonymous/BYOK routes remain explicitly non-owner.

All owner-only routes reuse the shared policy.

## 14. Durable jobs

Durable jobs model background execution/retry, not product state itself.

Rules:

- stable job identity/idempotency;
- leases/heartbeats/retry/cancel;
- exact request-scoped capture can use `claimById`;
- worker-loop scheduling can use `claimNext`;
- request-scoped capture cannot accidentally claim a different queued job;
- external side-effect jobs must support at-most-once intent semantics at the application level.

## 15. Publication architecture — GP3 target

Later:

```text
exact approvals
→ Calendar/Editorial intent
→ immutable PublicationRequest
→ durable publication job
→ verified connector adapter
→ confirmed / failed / rejected / unknown
→ Publication record
→ confirmed-public NarrativeMemory
```

Do not start broad GP3 implementation before GP2 acceptance.

`unknown` is a first-class external result; adapter timeout is not proof that publication failed.

## 16. Client architecture

- Web: primary full owner workspace.
- MCP/API: external agent query/control.
- Browser extension: explicit browser context/capture.
- Future mobile: judgment/quick capture/approval/calendar exceptions.
- Future Desktop Edge Agent: private local repos/files/models/desktop capture.
- Workers: durable background execution.

All clients use canonical application services; none owns a separate product model.

## 17. Migration/compatibility rule

The older campaign/source-destination review workflow remains a compatibility/manual Create path during migration.

Do not destroy working edit/version/export behavior until canonical Signals/Opportunities/Plan/Create paths safely replace the corresponding owner jobs.

## 18. Current next architectural slice

After #259 merges, add an application-level preparation orchestrator over existing services:

```text
approved strategy
→ generation application
→ required-media/capture application
→ exact-review preparation application
→ Today projection
```

Do not implement this by adding `useEffect` chains in React that become the workflow engine. UI may initiate/observe application orchestration, but durable/current-state decisions belong in application/domain/repository layers.

Required semantics:

- idempotent resume;
- partial destination success preserved;
- exact-current checks;
- required vs optional media distinction;
- capture/review bounded recovery;
- refresh/reopen reconstructability.

## 19. Architectural completion rule

A new adapter or domain record is not a completed product capability.

For GP2, completion requires real authorized source → exact evidence → automatic preparation → exact owner judgment with recovery evidence.
