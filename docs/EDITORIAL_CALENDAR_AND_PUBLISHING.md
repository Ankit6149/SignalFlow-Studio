# SignalFlow Studio — Editorial Calendar and Publishing

> **Status:** canonical target design for planning, scheduling, approval, destination capability, and publication history. Current connector truth remains governed by the capability matrix and connector-readiness documentation.

## 1. Why scheduling alone is not enough

A scheduler answers:

> **When should this already-created post be sent?**

SignalFlow's intended product must also answer:

> **What should be communicated next, why now, on which destination, and should anything be posted at all?**

These are different systems.

### Publication Scheduler

Executes a known, approved content piece at a known time.

### Editorial Planner

Organizes the user's broader communication over time.

The Editorial Planner is a product-intelligence function. The Publication Scheduler is a durable side-effect execution system.

## 2. Editorial planning lifecycle

```text
Content opportunities
      ↓
Campaign priorities
      ↓
Cadence policies + launch windows + user constraints
      ↓
Editorial plan
      ↓
Proposed calendar entries
      ↓
Content production / review
      ↓
Exact approved publication requests
      ↓
Durable scheduled/immediate jobs
      ↓
Confirmed publications
      ↓
Narrative memory / later performance context
```

## 3. `CadencePolicy`

Cadence is a target/constraint policy, not an order to manufacture filler.

Suggested fields:

```text
cadencePolicyId
workspaceId
projectId?
destination?
policyScope                 # workspace, project, destination, campaign
activeFrom?
activeUntil?
timezone
preferredDays[]
preferredTimeWindows[]
minimumGapHours?
targetMinPerPeriod?
targetMaxPerPeriod?
period                      # day/week/month
allowedContentKinds[]
preferredThemes[]
blockedThemes[]
weekendPolicy?
launchOverridePolicy?
emptySlotPolicy             # leave_empty, suggest_evergreen, ask_user
priority
```

Examples:

```text
LinkedIn
- target 2–3 worthwhile pieces/week
- minimum gap 36 hours
- preferred: building, lessons, thoughtful observations
- empty slot: leave empty

X
- target 3–6 useful updates/week
- smaller build signals acceptable

Reddit
- no target frequency
- only publish when community value is clear

YouTube
- high-value demo roughly every 2–4 weeks
```

## 4. `EditorialCalendarEntry`

A calendar entry may represent intent before a final post exists.

Suggested entry types:

```text
proposed_slot
planned_content_piece
production_due
review_due
approved_publication
launch_window
external_event
manual_block
```

Suggested fields:

```text
calendarEntryId
workspaceId
projectId?
campaignId?
contentPieceId?
platformVariantId?
entryType
plannedWindowStart?
plannedWindowEnd?
exactPublishAt?
timezone
reason
priority
cadencePolicyId?
status
publicationRequestId?
```

## 5. An empty calendar slot is valid

If the Editorial Brain has no opportunity that passes the threshold, the system should say:

> **No worthwhile post recommended for this slot.**

Do not fill the slot with generic tips merely to satisfy cadence.

This is a central product quality rule.

## 6. Sequencing campaigns

Campaign pieces should be sequenced based on narrative purpose.

Example:

```text
Campaign: Capture automation

Day 1 — LinkedIn
Role: Why the problem matters

Day 3 — X
Role: Short visual demonstration

Day 6 — Reddit (optional)
Role: Technical implementation/trade-off

Day 12 — YouTube
Role: Deeper walkthrough

Day 20 — LinkedIn
Role: Retrospective / what changed after use
```

The planner should avoid publishing all platform variants simultaneously by default unless a launch explicitly requires coordinated timing.

## 7. Calendar context the planner should consider

- recent publications;
- pending scheduled posts;
- campaign priority;
- launch date/window;
- destination cadence;
- topic repetition;
- audience overlap;
- user-defined blackout periods;
- content readiness;
- media readiness;
- approval state;
- connector capability;
- timezone;
- user manual commitments/events;
- future analytics signals where available.

## 8. Opportunity aging

Opportunities may become stale.

Suggested states:

```text
fresh
still_relevant
evergreen
expiring
expired
```

The planner should not schedule a “just shipped” story three weeks later without changing its framing.

When an opportunity ages, SignalFlow may transform the angle:

```text
"We just shipped X"
    ↓ later
"What we learned after shipping X"
```

but only if the evidence supports the new story.

## 9. Publication request is immutable intent

Once the user approves a publication, create a `PublicationRequest` that binds the exact intended side effect.

It should include:

```text
publicationRequestId
workspaceId
campaignId
contentPieceId
platformVariantId
draftRevisionId
mediaCompositionRevisionIds[]
connectionId
targetIdentityId
mode                         # immediate | scheduled
scheduledAt?
timezone
approvalId
sourceFreshnessSnapshotId
connectorCapabilitySnapshot
idempotencyKey
createdBy
createdAt
status
```

Editing the draft/media after this point must not silently alter the scheduled request.

The product should either:

- preserve the scheduled approved revision; or
- require an explicit **update scheduled publication to the new revision** action that creates/updates intent according to policy.

## 10. Publication state model

Recommended statuses:

```text
awaiting_confirmation
scheduled
queued
publishing
published
failed
rejected
unknown
cancel_requested
cancelled
superseded
```

### `unknown` is important

If the external provider times out after possibly accepting a request, SignalFlow must not guess whether the publication succeeded.

It should preserve `unknown` and reconcile where the destination API supports it.

## 11. Idempotency

Repeated delivery must never create duplicate external posts for one publication intent.

Use stable idempotency semantics across:

- UI retries;
- API retries;
- job redelivery;
- worker crash/restart;
- connector timeout;
- deployment restart.

The job system and connector adapter both participate in this guarantee.

## 12. Approval requirements

By default, a publishable item requires:

- current source/evidence according to policy;
- exact draft revision approved;
- exact required media revision approved;
- no unresolved blocking quality/privacy issue;
- destination target verified and authorized;
- connector capability available;
- required platform fields valid;
- schedule valid;
- quota/usage policy permits execution.

A campaign-level “approved” badge must never become permission to publish arbitrary later edits.

## 13. Destination capability model

A connection is not merely `connected=true`.

Each destination/target should expose a versioned capability snapshot.

Example:

```text
ConnectionCapability
  provider
  connectionId
  targetIdentity
  verifiedAt
  expiresAt?
  grantedScopes[]
  canPublishText
  canPublishImage
  canPublishVideo
  canPublishCarousel
  canScheduleViaProvider
  canReadOwnPosts
  canReadAnalytics
  maxMediaRules
  status
  safeReason
```

SignalFlow may implement scheduling itself even if the platform does not expose native scheduling, but execution still depends on a valid connector at run time.

## 14. Connector adapter boundary

Recommended normalized interface concepts:

```text
getConnectionStatus()
getCapabilities()
listTargets()
validatePublication()
publish()
reconcileUnknown()
refreshAuthorization()
revoke()
readPublicationStatus?()
readAnalytics?()
```

Each platform adapter may implement only the capabilities its official API and granted authorization support.

Do not fake parity across platforms.

## 15. Direct publication versus manual handoff

SignalFlow supports two truthful modes.

### Direct publication

External API confirms the side effect.

### Manual handoff

SignalFlow provides the exact approved text/media and opens/exports the destination workflow.

Manual handoff must never be recorded as `published` unless the user or a later verified observation explicitly records the publication.

## 16. Scheduling UX

The user should not need to micromanage timestamps for normal operation.

When the Editorial Planner recommends a time, the review surface can present:

```text
Recommended
Tue 6:30 PM · LinkedIn
Reason: avoids overlap with Thursday's demo and fits your current cadence.

[Approve schedule] [Change time] [Post now]
```

The user can always override.

## 17. Bulk campaign approval

A user may want to approve an entire campaign in one review session.

Safe bulk approval can mean:

- approve exact current revision of each listed content piece;
- approve exact media revisions;
- approve proposed schedule for each;
- create immutable publication requests.

If any content changes later, only affected publication requests require reapproval/update.

## 18. "Approve campaign" must be precise

The UI may present a convenient top-level action, but internally it should mean:

> approve this listed set of exact content/media revisions and this publication plan.

It must not mean:

> trust SignalFlow to modify and publish whatever it wants later.

## 19. Timezones and daylight saving

Every scheduled publication needs:

- explicit timezone;
- stored instant/time semantics;
- DST-aware validation;
- display in the user's chosen timezone;
- rescheduling behavior when timezone changes.

Do not depend on a browser timer.

## 20. Cancellation and rescheduling

The durable job system should support:

### Before execution

- cancel safely;
- reschedule;
- replace the scheduled revision deliberately;
- switch target if the user explicitly chooses another authorized target.

### During/after execution

Once an external side effect may have begun, cancellation cannot be assumed to undo it.

The state may become `unknown` or `published`; any delete/unpublish operation is a separate explicit action if the platform supports it.

## 21. Publication history

Every confirmed publication should become durable narrative history.

Store at least:

```text
publicationId
publicationRequestId
platform
target identity
draftRevisionId
media revisions
publishedAt
external reference/permalink when safe
confirmed provider response metadata
campaign/content piece relationship
```

The publication record feeds NarrativeMemory.

## 22. Performance ingestion

Later, where official APIs and user authorization permit it, SignalFlow may ingest performance snapshots.

Potential metrics:

- impressions/reach;
- reactions/likes;
- comments;
- shares/reposts;
- clicks;
- video views/watch time/completion;
- follower/profile actions;
- destination-specific equivalents.

Performance data should be timestamped snapshots with provider provenance, not silently overwritten totals.

## 23. Performance learning guardrails

Performance may influence recommendations such as:

- prefer demos over static cards for a specific project;
- shorten intro length;
- post technical material where it receives useful discussion;
- avoid overusing a topic.

It may not override:

- user privacy boundaries;
- factual accuracy;
- approval requirements;
- explicit identity preferences;
- safety/platform rules.

## 24. Manual content and external topics

Editorial planning must work even when no connected work source generated the topic.

A manual signal can be scheduled/sequenced exactly like a GitHub-derived opportunity.

Examples:

- a thought the user wrote today;
- a research paper they want to discuss next week;
- a personal career update;
- a planned launch;
- an evergreen educational idea;
- a response to an industry development;
- "Something else" entered manually.

## 25. Calendar product surface

The calendar should communicate both editorial intent and execution state.

Example states visible in the UI:

```text
Open editorial slot
Opportunity suggested
Production in progress
Needs approval
Approved
Scheduled
Publishing
Published
Failed / attention required
Skipped intentionally
```

Calendar cards should link back to the exact opportunity/campaign/content piece rather than duplicating editing UI.

## 26. Today surface relationship

The default `Today` experience should summarize decisions, not become another full scheduler.

Examples:

- 3 opportunities worth reviewing;
- 2 content pieces need approval;
- 1 scheduled post has a connector problem;
- tomorrow's slot is empty but no worthwhile content is recommended;
- one campaign has completed media rendering.

The user can resolve most actions from the decision surface and return to work.

## 27. Personal Alpha publishing scope

The first owner-first release should use a deliberately small destination set and prove the full loop.

Recommended initial goal:

- LinkedIn;
- X;
- one visual/video destination after media production is ready;
- reliable manual handoff for destinations without verified direct publication.

Do not block Personal Alpha on twelve production-grade connectors.

## 28. Publication definition of done

A direct connector is not done because OAuth redirects successfully.

For every advertised direct publishing capability, prove:

- developer application/configuration is valid;
- exact required scopes/products are granted;
- target identity is displayed to the user;
- token refresh/expiry/revocation is handled;
- validation matches real platform requirements;
- a real publication succeeds;
- retry cannot duplicate it;
- permission/rate-limit/rejection states are handled;
- unknown outcomes are reconciled where possible;
- no secrets leak into client storage/logs;
- cancellation/rescheduling semantics are tested;
- documentation and capability flags match evidence.

## 29. Core editorial principle

> **The calendar is allowed to be empty.**

SignalFlow succeeds by helping the user communicate worthwhile things with low effort, not by maximizing the count of posts generated or scheduled.
