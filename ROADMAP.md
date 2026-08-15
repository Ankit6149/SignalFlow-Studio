# SignalFlow Studio Roadmap

> **Status:** canonical execution roadmap. For the full product definition read `docs/PRODUCT_VISION.md`. For exact current implementation capability read `docs/CAPABILITY_MATRIX.md`.

SignalFlow Studio is evolving from a review-first campaign generator into a **content operating system that minimizes the amount of content work a person has to think about**.

The target is not “generate more posts.” The target is:

> **Do meaningful work → SignalFlow identifies worthwhile communication opportunities → SignalFlow produces the required content/media → the user makes the judgment → SignalFlow handles the approved distribution and remembers what happened.**

## Product promise

```text
Work / manual thought / connected source
        ↓
Signal
        ↓
Opportunity
        ↓
Angle / narrative decision
        ↓
Campaign + ContentPieces
        ↓
Evidence / automatic capture / media production
        ↓
Platform-native variants
        ↓
Review / exact revision approval
        ↓
Editorial calendar / durable publication
        ↓
Narrative memory / feedback learning
```

The user should spend attention on **selection, correction, and approval**, not routine production mechanics.

## Current foundation — preserve and extend

The repository already contains useful foundations that are not being discarded:

- stable campaign identity and browser-local persistence;
- authoritative current drafts and edit-safe regeneration;
- source freshness/versioning foundations;
- canonical Asset/SourceArtifact/AssetProcessing contracts;
- provider adapters and real-model policy;
- deterministic exports and portable browser transfer;
- capability discovery;
- MCP package;
- extension direction;
- connector/publishing foundations;
- architecture, security, cloud, QA, accessibility and durable-job backlog.

The roadmap reset changes **what these foundations are building toward**.

## New canonical product epics

- #150 — **Content intelligence, identity, editorial automation, and low-attention publishing**
- #151 — **Automated product capture, screencasts, motion composition, and reviewable media**

These sit above and integrate the existing infrastructure/product epics rather than replacing them.

## Existing supporting epics

- #55 — architecture and deployment profiles
- #56 — beginner-first hosted experience
- #57 — cloud data platform and background processing
- #58 — user-initiated browser extension/capture pipeline
- #59 — canonical assets, processing, provenance and reuse
- #60 — campaign/editor/versioning
- #61 — generation/provider quality and cost control
- #62 — UI/UX, responsiveness and accessibility
- #63 — review, connectors and publishing
- #64 — security/privacy/tenant isolation
- #65 — contributor/architecture quality
- #66 — QA/observability/release/rollback

The parent epics must be interpreted through the new product lifecycle.

# Execution model

## Rule 1 — Build vertical owner journeys, not horizontal piles

Avoid this pattern:

```text
finish every database table
finish every UI route
finish every connector
finish every capture feature
then attempt the actual product
```

Prefer:

```text
choose one owner journey
    ↓
implement only the domain/infrastructure/UI required to make it real
    ↓
prove failure/recovery and user value end to end
    ↓
expand the next vertical slice
```

## Rule 2 — Current manual creation remains available during migration

The existing Source → Destinations → Review flow should evolve into the manual **Create** path.

Do not destroy functioning campaign/edit/version behavior before the new Signals/Opportunities lifecycle can replace it safely.

## Rule 3 — Do not confuse future architecture with shipped capability

The product docs describe the target system. `GET /api/capabilities`, current code, credential-backed tests, and `docs/CAPABILITY_MATRIX.md` determine what may be advertised as available today.

# Personal Alpha gates

## Gate 0 — Product/documentation reset

Goal: remove contradictory product assumptions before implementation continues.

Required:

- canonical product vision;
- content-intelligence architecture;
- identity/authenticity model;
- capture/media architecture;
- editorial calendar/publishing architecture;
- decision-first information architecture;
- owner-first execution strategy;
- README/AGENTS/ROADMAP aligned;
- existing epics updated;
- obsolete integration guidance removed/replaced.

This gate is documentation/issue work only and must not claim new product functionality.

---

## Gate 1 — Manual thought → authentic approved content

### Product proof

#166 — **Golden Path 1: Manual thought → opportunity → authentic LinkedIn/X approval with narrative memory**

### Required product-brain work

- #152 — canonical `ContentSignal` and manual-signal intake
- #153 — identity, perception, voice, boundaries and platform expression
- #155 — narrative memory and semantic repetition detection
- #156 — explainable opportunity scoring/ranking/angles
- #157 — NarrativeStrategy, ContentPiece and PlatformVariant contracts
- #158 — staged generation and authenticity/evidence quality gates
- #159 — Today, Signals and Plan decision-first UI

### Supporting existing work

- #60 campaign/versioning invariants
- #61 generation reliability/provider contracts
- #62 UI/accessibility foundations
- #128 source-health diagnostics where relevant

### Exit condition

The owner can type one real thought, select/customize one of several useful angles, receive native LinkedIn/X content that respects identity and narrative history, edit/request changes surgically, approve exact revisions, leave/reopen the product, and lose nothing.

Direct publication is not required to prove this first intelligence loop.

---

## Gate 2 — Meaningful GitHub work becomes an opportunity automatically

### Product proof

#167 — **Golden Path 2: GitHub work event → ranked opportunity → automatic evidence/media-ready campaign**

### Required work

- #161 — GitHub App/webhook ingestion into canonical ContentSignals
- #127 — hardened remote source boundary where required
- #129 — immutable evidence versions/revalidation where required
- #156 — opportunity ranking/noise handling
- #162 — CaptureRecipe/safe browser-worker foundation
- #163 — automated campaign-ready screenshots

### Integration rule

```text
GitHub App/webhooks → ongoing event/signal ingestion
SignalFlow MCP       → AI-agent commands/queries
```

MCP is not the production webhook transport.

### Exit condition

The owner performs real GitHub work, later opens SignalFlow, and finds a genuinely useful opportunity waiting—while low-value/noise events are not automatically promoted. For a visual proof case, SignalFlow captures the required screenshot itself.

---

## Gate 3 — Automatic product demo production

### Required work

- #151 — media-production epic
- #162 — safe CaptureRecipe/browser worker
- #163 — screenshot derivatives
- #164 — deterministic raw campaign screencasts
- #165 — versioned motion composition and multi-aspect rendering
- #72 — object storage/resumable uploads when hosted
- #73 — durable jobs
- #87/#88/#89 — asset library/processing/hash/retention

### Exit condition

A campaign can request a visual demo; SignalFlow safely records the product through a bounded recipe, creates a polished branded short video with callouts/captions/intro/outro, produces at least 16:9 and 9:16 variants, and presents the exact media revisions for approval.

The owner does **not** manually screen-record/edit this proof.

---

## Gate 4 — Editorial continuity and durable publication

### Product proof

#168 — **Golden Path 3: Approved text/media → editorial schedule → durable publish → narrative memory**

### Required work

- #160 — cadence policies/editorial planning/empty-slot behavior
- #73 — durable jobs
- #102 — verified connector identity/scopes/capabilities
- #103 — idempotent immediate/scheduled publication jobs
- #155 — narrative memory
- #63 — approval/publishing policy

### Core rules

- an empty calendar slot is valid;
- cadence is a target/constraint, not a filler generator;
- publication freezes exact text/media revisions;
- browser timers do not schedule external side effects;
- duplicate job/request delivery creates at most one external publication;
- `unknown` remains truthful when external outcome cannot be confirmed;
- only confirmed publication becomes strong public NarrativeMemory.

### Exit condition

The owner approves content/media once, accepts or changes the suggested schedule, closes SignalFlow, and the durable job publishes the exact approved content to a verified target. Normal success requires no further attention; exceptions return to Today.

---

## Gate 5 — Learn repeated user preferences

### Required work

- #154 — FeedbackEvent + explainable style-memory learning
- #153 — explicit profile precedence
- #155 — narrative memory
- #158 — authenticity critic integration

### Exit condition

Repeated corrections stop recurring. Learned preferences are inspectable, evidence-backed and removable. Explicit user boundaries always outrank learned/engagement patterns.

---

## Gate 6 — Hosted owner reliability

Once the owner loop proves repeated value, make it durable across devices/services.

Required foundations include:

- #70 authentication/workspace selection
- #71 production relational schema/repository layer
- #72 object storage/resumable uploads
- #73 durable background jobs
- #74 autosave/cross-device conflict recovery
- #104 centralized authorization/tenant isolation
- #105 secret management/privacy/retention/redacted observability
- #107 migrations/backups/restore/disaster recovery
- #106 usage/quota ledger

These must support the **new records** as well as current Campaign/Asset structures: IdentityProfiles, ContentSignals, ContentOpportunities, NarrativeStrategies, ContentPieces, PlatformVariants, StyleMemory, NarrativeMemory, CalendarEntries, CaptureRecipes, MediaCompositions and PublicationRequests.

---

## Gate 7 — Destination and source expansion

Only after the core loop is reliable:

Potential destination/source expansion:

- additional verified social/video connectors;
- blog/newsletter integrations;
- browser extension full acknowledged capture;
- Linear/Jira/Notion/workspace integrations;
- other Git providers;
- design/document sources;
- additional media processors.

Every integration must normalize into existing source/signal or destination/publication contracts. Do not create connector-specific product architecture.

---

## Gate 8 — SaaS/team expansion

Only after owner value is proven repeatedly:

- multi-user workspaces;
- members/roles/invitations;
- review requests/comments/activity;
- managed generation/default routing;
- billing/plan UX after metering is trustworthy;
- account data export/deletion;
- broader onboarding;
- collaboration notifications.

Existing #56/#57/#63/#64 epics continue to own these concerns.

---

## Gate 9 — Performance-informed editorial learning

Where official APIs and user authorization permit:

- ingest performance snapshots;
- compare formats/topics/timing carefully;
- recommend useful patterns;
- improve media/sequence suggestions.

Performance data is advisory.

It must never silently override:

- safety;
- privacy;
- explicit identity/boundaries;
- factual evidence;
- approval policy.

# Product brain issue map

| Issue | Responsibility |
| --- | --- |
| #150 | product-brain epic |
| #152 | ContentSignal/manual input |
| #153 | identity/perception/voice/boundaries |
| #154 | feedback/style-memory learning |
| #155 | narrative/publication memory |
| #156 | opportunity scoring/angles/destination recommendations |
| #157 | narrative strategy/content pieces/platform variants |
| #158 | staged generation + quality critics |
| #159 | Today/Signals/Plan UX |
| #160 | editorial cadence/calendar |
| #161 | GitHub event signals |
| #166 | Golden Path 1 |
| #167 | Golden Path 2 |
| #168 | Golden Path 3 |

# Media-production issue map

| Issue | Responsibility |
| --- | --- |
| #151 | media-production epic |
| #162 | safe CaptureRecipe/browser worker |
| #163 | automatic screenshots/derivatives |
| #164 | raw deterministic screencasts |
| #165 | motion composition/multi-aspect rendering |

# Existing source/asset foundation

Important existing work remains necessary:

- #86 canonical source/asset contract foundation
- #127 hardened URL fetch/SSRF boundary
- #128 source health/ingestion diagnostics
- #129 immutable remote evidence versions
- #78–#85 extension permission/pairing/capture/review/queue/release
- #87 asset library
- #88 OCR/transcription/analysis/processing adapters
- #89 hashing/duplicate/retention/deletion

# Existing generation/reliability foundation

Continue/reinterpret under staged orchestration:

- #27 bounded concurrency
- #28 strategy quality validation
- #29 per-channel failure recovery
- #31 cross-channel duplicate detection
- #32 needs-review state
- #33 safe provider errors
- #34 request/context/cost controls
- #35/#36 MCP workflow/non-blocking behavior
- #73 durable jobs
- #75 managed-generation/default routing
- #94 persistent generation progress/recovery
- #106 usage/quota ledger

# Existing UI foundation

UI work must support both current manual Create/Review and target decision-first navigation:

- #90 design tokens/primitives
- #91 app shell/navigation
- #92 current/manual source-workspace layout
- #93 current/manual destination/model layout
- #95 review editor/inspector/action hierarchy
- #96 secondary route layout
- #97 responsive/reflow/zoom
- #98 accessibility
- #99 visual regression/stress fixtures
- #137 current Studio workspace repair
- #159 target Today/Signals/Plan product center

# Existing publication foundation

- #100 workspace roles later
- #101 comments/version-specific review later
- #102 verified connection identity/scopes/capabilities
- #103 idempotent immediate/scheduled publication jobs
- #47 permission-aware readiness
- #48 review-first hierarchy
- #160 editorial planning
- #168 owner publication golden path

# What not to build first

Do not let the roadmap expand into adjacent tools before the golden paths work.

Avoid initially:

- a Premiere/After Effects replacement;
- a Canva replacement;
- dozens of social networks;
- generic analytics dashboards;
- full enterprise collaboration before owner usefulness;
- custom queue infrastructure merely for ownership/control;
- proprietary vector infrastructure as a prerequisite;
- model fine-tuning before structured memory proves insufficient;
- unrestricted AI browsing of authenticated production accounts;
- unreviewed global autoposting;
- recurring filler content generated because the calendar is empty.

# Issue quality standard

Every implementation issue should state, where relevant:

- exact user burden/outcome;
- owning domain record/application service;
- source/evidence relationships;
- identity/narrative implications;
- UI states/responsive/accessibility;
- authorization/privacy/security;
- capability/deployment implications;
- job/idempotency/retry/cancel behavior;
- migration/compatibility;
- test/evidence requirements;
- definition of done that requires a real vertical result.

# Completion standard

No issue closes because code compiles or a component exists.

A feature is complete only when:

- its acceptance criteria pass;
- the relevant user journey works end to end;
- edited/approved work survives failure/recovery;
- current capability claims remain truthful;
- authorization/privacy boundaries hold;
- relevant responsive/accessibility requirements pass;
- required external side effects are credential-backed and confirmed;
- migration/rollback/recovery is handled;
- documentation is current;
- sanitized verification evidence is attached.

## Final roadmap rule

> **Reduce the amount of content work the user has to think about. Do not automate the production of noise.**
