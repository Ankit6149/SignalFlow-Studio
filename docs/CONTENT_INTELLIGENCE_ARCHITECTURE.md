# SignalFlow Studio — Content Intelligence Architecture

> **Status:** canonical target architecture for the product brain. Existing implementation remains authoritative for capabilities that are already shipped; this document defines the domain model and service boundaries new work must converge toward.

## 1. Why this architecture exists

The earlier SignalFlow flow treated a campaign-generation request as the main unit of work. That works for manual generation, but it cannot produce the intended low-attention experience because it has no durable representation for:

- things that happened before the user decides to create content;
- whether those things are worth talking about;
- the user's long-term narrative;
- ideas deferred for later;
- what has already been published;
- which media should be created and why;
- how an approved campaign should unfold across time;
- what SignalFlow should learn from user edits and rejections.

The new architecture makes these concepts first-class.

## 2. Canonical lifecycle

```text
Connected source / manual input
          ↓
     ContentSignal
          ↓
 Signal interpretation
          ↓
 ContentOpportunity
          ↓
   User judgment
          ↓
 NarrativeStrategy
          ↓
      Campaign
          ↓
   ContentPiece(s)
          ↓
 Evidence / Asset / Capture / MediaComposition
          ↓
 PlatformVariant(s)
          ↓
 DraftRevision(s)
          ↓
       Approval
          ↓
    CalendarEntry
          ↓
 PublicationRequest / PublicationJob
          ↓
     Publication
          ↓
 NarrativeMemory + FeedbackEvent + optional PerformanceSnapshot
```

Each stage must be independently inspectable, versioned where appropriate, and recoverable without recreating the entire pipeline.

## 3. Top-level hierarchy

```text
Workspace
 ├─ Users / Memberships
 ├─ IdentityProfiles
 ├─ Projects
 │   ├─ ProductKnowledge
 │   ├─ ProjectGuidance
 │   ├─ SourceConnections
 │   ├─ Assets
 │   └─ ContentSignals
 │
 ├─ ContentOpportunities
 ├─ Campaigns
 │   ├─ NarrativeStrategies
 │   ├─ ContentPieces
 │   │   ├─ PlatformVariants
 │   │   ├─ DraftRevisions
 │   │   └─ MediaCompositions
 │   ├─ Approvals
 │   └─ PublicationPlans
 │
 ├─ EditorialCalendar
 ├─ DestinationConnections
 ├─ NarrativeMemory
 ├─ StyleMemory
 ├─ FeedbackEvents
 ├─ Jobs
 └─ Usage / Audit / Notifications
```

A single-user local or owner deployment may have one implicit workspace and one user, but it must still use this identity model internally.

## 4. Core domain records

### 4.1 `ContentSignal`

Represents something that happened or something the user supplied that may become content.

Suggested fields:

```text
signalId
schemaVersion
workspaceId
projectId?                 # optional for personal/cross-project ideas
sourceType                 # github, manual, browser, document, url, release, future connector...
sourceConnectionId?
sourceArtifactIds[]
assetIds[]
externalEventRef?          # safe provider-specific immutable event reference
occurredAt
observedAt
headline
summary
signalKind                 # feature, bugfix, milestone, lesson, thought, research, launch, personal, etc.
importanceHints[]
privacyClassification
status                     # new, interpreted, ignored, archived
provenance
```

Rules:

- A signal is evidence/context, not generated copy.
- Duplicate external delivery must be idempotent.
- The same real-world event may create multiple observations but only one canonical signal per declared idempotency policy.
- Secrets/raw private payloads do not belong in the record.
- Ignoring a signal is a valid user decision and may inform future prioritization.

### 4.2 `ContentOpportunity`

Represents SignalFlow's judgment that one or more signals may be worth turning into communication.

Suggested fields:

```text
opportunityId
workspaceId
projectId?
signalIds[]
title
summary
whyNow
candidateAngles[]
candidateDestinations[]
recommendedMediaTypes[]
score
scoreBreakdown
confidence
noveltyAssessment
narrativeFit
repetitionRisk
evidenceReadiness
productionEffortEstimate
status              # proposed, shortlisted, selected, snoozed, rejected, expired, converted
createdAt
reviewedAt?
selectedAngleId?
userIntentOverride?
```

Opportunity scoring must be explainable enough for the UI to say **why** something was recommended or skipped.

### 4.3 `OpportunityScore`

Recommended dimensions:

- freshness;
- importance;
- novelty;
- evidence strength;
- narrative fit;
- audience relevance;
- visual/demo potential;
- platform fit;
- repetition penalty;
- timing/campaign conflict;
- production effort/cost;
- explicit user priority;
- safety/privacy constraints.

A score is not permission to publish.

### 4.4 `NarrativeStrategy`

Represents the chosen way to tell an opportunity before destination formatting.

Suggested fields:

```text
narrativeStrategyId
opportunityId
campaignId
coreIdea
reasonToTellNow
primaryAudience
readerTakeaway
openingApproach
storyArc
proofPoints[]
safeClaims[]
avoidClaims[]
requiredEvidence[]
mediaRequirements[]
platformRecommendations[]
platformExclusions[]
ctaIntent
identityProfileVersionId
narrativeMemorySnapshotId
createdAt
revision
```

This object must be separate from channel copy. A user should be able to change a LinkedIn hook without recomputing the strategic reason the campaign exists.

### 4.5 `Campaign`

The existing Campaign aggregate should evolve from a container for one generation response into a durable narrative container.

A campaign owns:

- selected opportunity/intent;
- narrative strategy;
- source/evidence snapshots;
- one or more content pieces;
- review/approval state;
- publication plan;
- narrative relationship to prior/future campaigns.

Campaign status should eventually distinguish states such as:

```text
idea
planning
producing
awaiting_review
changes_requested
approved
scheduled
partially_published
published
paused
archived
```

Do not collapse content-piece and publication status into one generic campaign flag.

### 4.6 `ContentPiece`

Represents one semantic communication unit within a campaign.

Examples:

- problem/reason story;
- short launch update;
- 20-second demo;
- engineering deep dive;
- carousel;
- release note;
- newsletter section;
- retrospective.

Suggested fields:

```text
contentPieceId
campaignId
role                 # announce, explain, demo, teach, follow_up, retrospective...
contentType           # text, thread, article, image, carousel, video, mixed
intent
canonicalOutline
requiredEvidence[]
assetRequirements[]
sequenceOrder?
plannedWindow?
status
```

A campaign may contain one content piece or many.

### 4.7 `PlatformVariant`

Represents the platform-native expression of a ContentPiece.

```text
platformVariantId
contentPieceId
destination
connectionCapabilitySnapshot?
format
platformIntent
constraints
currentDraftId
mediaBindingIds[]
status
```

A variant should exist only when a destination is appropriate. Do not create empty/forced variants for all destinations.

### 4.8 `DraftRevision`

The existing authoritative-draft principles remain valid.

Every revision should additionally record:

- parent content piece and platform variant;
- generation stage/version;
- identity-profile snapshot/version;
- source/evidence snapshot;
- generation provider/model metadata;
- user edits;
- approval relationship;
- media bindings relevant to the exact revision.

The **current edited revision is authoritative**. Generated history is not another active copy.

### 4.9 `EditorialCalendarEntry`

Represents editorial intent, not only a scheduler timestamp.

```text
calendarEntryId
workspaceId
campaignId?
contentPieceId?
platformVariantId?
entryType               # proposed_slot, planned_piece, approved_publication, event_marker
scheduledWindowStart?
scheduledWindowEnd?
exactPublishAt?
timezone
cadencePolicyId?
priority
reason
status
publicationRequestId?
```

An empty editorial slot may remain intentionally unfilled.

### 4.10 `PublicationRequest` / `Publication`

A publication request freezes the exact approved inputs intended for an external side effect.

It should reference:

- exact platform variant;
- exact draft revision;
- exact media composition/asset revisions;
- target connection/account/page/community;
- source freshness snapshot;
- approval snapshot;
- schedule/timezone;
- idempotency key.

`Publication` records confirmed external outcome separately from the request/job.

### 4.11 `FeedbackEvent`

Represents a user decision that may teach SignalFlow.

Examples:

```text
approved_unchanged
approved_after_edit
changes_requested
regenerated
rejected
dont_post_this
not_for_this_platform
too_personal
too_corporate
too_technical
too_generic
wrong_angle
manual_style_note
```

Suggested fields:

```text
feedbackEventId
workspaceId
userId
targetType
targetId
kind
structuredReason?
freeformReason?
beforeRevisionId?
afterRevisionId?
createdAt
learningEligibility
```

Not every feedback event should mutate long-term style memory immediately.

### 4.12 `NarrativeMemory`

Tracks what the audience has already been told.

Potential facts:

- topic;
- feature/claim;
- campaign angle;
- destination;
- publication date;
- evidence shown;
- promises made;
- limitations disclosed;
- follow-up hooks;
- audience segment.

Narrative memory is essential for repetition detection and sequence planning.

## 5. Signal sources versus destination connections

These are different concepts and must remain separate.

### Signal/source connections

Examples:

- GitHub App;
- browser extension;
- uploaded files;
- public URLs;
- manual text;
- future Notion/Linear/Jira/etc.

They produce evidence/signals.

### Destination connections

Examples:

- LinkedIn account/page;
- X account;
- Instagram professional account;
- Threads account;
- YouTube channel;
- TikTok account;
- Reddit account/community when permitted;
- owned blog/newsletter integration.

They execute publication or provide destination metadata/analytics.

A single generic `connection` boolean cannot represent both worlds.

## 6. GitHub integration model

GitHub is one high-value signal source.

### Production event path

```text
GitHub App / webhook
     ↓
Webhook boundary
     ↓
Normalize + authorize + deduplicate
     ↓
ContentSignal
     ↓
Signal interpretation
```

Useful events may include:

- pull request merged;
- release published;
- meaningful issue closed;
- selected push/change summaries;
- workflow/release milestones;
- repository metadata changes when relevant.

Do not automatically turn every commit into content.

### MCP path

MCP is an agent-control interface, not the event-ingestion system.

```text
AI agent
   ↓
SignalFlow MCP
   ↓
query signals / create manual signal / create campaign / inspect status / request permitted actions
```

GitHub App/webhooks and MCP may both exist, but they solve different problems.

## 7. Multi-stage orchestration

The current giant-generation-request pattern must gradually be replaced by explicit stages.

Recommended pipeline:

```text
1. ingest evidence
2. normalize / verify sources
3. interpret signals
4. score opportunities
5. wait for/select user direction when required
6. build narrative strategy
7. determine media requirements
8. produce/collect assets
9. create canonical content piece
10. transform into platform-native variants
11. run factual / duplication / authenticity / platform quality checks
12. present review
13. persist approval
14. create publication plan/jobs
15. confirm results
16. update narrative memory and eligible learning signals
```

Every stage should emit a validated result or an explicit failure/needs-review state.

## 8. AI role separation

Do not assume one model call should perform all work.

Useful logical roles:

| Role | Responsibility |
| --- | --- |
| Signal interpreter | summarize what changed and identify facts |
| Opportunity judge | rank whether/why to communicate |
| Narrative strategist | define angle/story sequence |
| Writer | produce canonical copy/outline |
| Platform transformer | adapt to destination culture/constraints |
| Authenticity critic | compare output against identity/memory |
| Evidence critic | flag unsupported claims |
| Visual director | decide screenshot/demo/media needs |
| Asset analyst | understand permitted processed media |
| Scheduler/planner | place content into editorial sequence |

Implementation may reuse the same provider/model for multiple roles initially, but the contracts must remain separate so cost/quality can be optimized later.

## 9. Regeneration boundaries

One major purpose of staged records is surgical regeneration.

Examples:

- “change the LinkedIn hook” → regenerate/edit only that platform revision;
- “use a different screenshot” → update media binding/composition without rewriting strategy;
- “make X less formal” → regenerate X only;
- “the entire angle is wrong” → create a new NarrativeStrategy revision and intentionally invalidate dependent work;
- “source changed materially” → mark dependent strategy/drafts stale and require deliberate adoption/regeneration.

No broad regeneration should silently destroy user-approved or manually edited work.

## 10. Opportunity lifecycle and user decisions

Recommended states:

```text
new
  ↓
proposed
  ├─→ ignored
  ├─→ snoozed
  ├─→ rejected
  └─→ shortlisted
          ↓
       selected
          ↓
       converted_to_campaign
```

The UI should preserve why an opportunity was rejected when the user chooses to provide that feedback.

## 11. "Something else" is a contract requirement

At any point where SignalFlow proposes a closed set of angles or topics, the user must have a free-form override.

Examples:

- proposed opportunity list → `Add something else`;
- angle selection → `Something else…`;
- destination plan → user may add/remove destinations;
- media plan → user may request another format;
- review → free-form change request.

Automation is there to reduce thinking burden, not to constrain expression.

## 12. Persistence and database direction

The cloud relational model should eventually support at least:

```text
users
workspaces
memberships
projects
identity_profiles
platform_voice_profiles
style_memories
content_signals
content_opportunities
opportunity_scores
campaigns
narrative_strategies
content_pieces
platform_variants
generation_runs
draft_revisions
assets
asset_derivatives
capture_recipes
media_compositions
approvals
calendar_entries
cadence_policies
connections
publication_requests
publication_jobs
publications
feedback_events
narrative_memory
performance_snapshots
jobs
usage_events
audit_events
notifications
```

The exact physical schema may normalize/merge records where appropriate, but these domain concepts must not disappear into arbitrary JSON blobs with no ownership or invariants.

## 13. Binary storage direction

Database records own metadata and relationships.

Object storage owns bytes such as:

- screenshots;
- recordings;
- generated video;
- audio;
- uploaded documents;
- thumbnails;
- derived crops;
- archive payloads where appropriate.

Domain records use storage IDs/references, never raw base64 video/image content as the long-term representation.

## 14. Durable jobs

The following must eventually be job-backed rather than tied to an open browser request:

- remote ingestion;
- large uploads;
- OCR/transcription/visual processing;
- opportunity analysis when run asynchronously;
- multi-destination generation;
- browser capture;
- video rendering;
- export packaging;
- scheduled/immediate publication;
- analytics synchronization;
- deletion/retention;
- backups/maintenance tasks.

Jobs must be idempotent, retry-safe, cancellable where meaningful, and recoverable after worker restart.

The existing job epic/issue remains the infrastructure foundation; this document defines the product work that consumes it.

## 15. Capability-driven behavior

Every source, model, capture, processor, renderer, and destination connection must expose truthful capability state.

Examples:

```text
GitHub source:
  eventIngestion: available/unavailable
  repositoryRead: available/unavailable

Capture worker:
  screenshots: available
  screencast: unavailable
  authenticatedRecipe: owner_only

Destination connection:
  publishText: available
  publishImage: available
  publishVideo: unavailable
  schedule: signalflow_job_supported
  analyticsRead: unavailable
```

The UI must not infer capabilities from a logo or `connected=true`.

## 16. Privacy and authorization

The content-intelligence layer may process highly sensitive work context.

Required principles:

- every record is workspace-scoped where applicable;
- authorization is server-side;
- provider/source/destination secrets are stored by secret reference, not campaign JSON;
- raw webhook payloads are retained only if deliberately required and bounded/redacted;
- user/private content is excluded from logs/analytics by default;
- capture is visible, deliberate, and target-scoped;
- generated recommendations never bypass publication approval;
- source evidence and user memory have explicit retention/deletion behavior.

## 17. Architecture rule for new features

Before adding a new feature, identify:

1. owning domain record;
2. command/query/application service;
3. authorization requirement;
4. capability requirement;
5. persistence port;
6. job/worker requirement;
7. source/evidence relationship;
8. approval side effect, if any;
9. failure and recovery state;
10. feedback/memory effect.

If a feature cannot be located in the lifecycle, it probably belongs outside the core product or needs a clearer contract first.
