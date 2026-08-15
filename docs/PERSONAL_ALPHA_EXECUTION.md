# SignalFlow Studio — Personal Alpha Execution Strategy

> **Status:** canonical execution strategy for proving the product before broad SaaS expansion. This document deliberately prioritizes complete vertical slices over infrastructure breadth.

## 1. Why Personal Alpha comes first

SignalFlow has a large possible surface:

- source integrations;
- AI providers;
- content strategy;
- identity memory;
- browser capture;
- media rendering;
- calendar planning;
- social connectors;
- cloud persistence;
- teams;
- billing;
- analytics.

Trying to productionize all of these simultaneously creates a high risk of building a sophisticated system that still does not remove the user's daily content burden.

The first goal is therefore:

> **Make SignalFlow genuinely useful for one demanding owner workflow, while keeping domain boundaries compatible with later multi-user SaaS.**

## 2. Personal Alpha product test

Personal Alpha is successful when the owner can spend several days working and then open SignalFlow to find useful, production-ready communication work waiting for judgment.

A successful experience looks like:

```text
SignalFlow found 7 developments.
3 look worth discussing.

1. Capture workflow completed
   Strong opportunity · demo can be generated automatically

2. Editor-state bug resolved
   Good technical lesson · X/Reddit candidate

3. Durable job architecture reworked
   Strong behind-the-scenes engineering story
```

The user chooses one opportunity, one angle, reviews the generated media/content, approves, and returns to work.

## 3. Personal Alpha scope

### Identity

- one owner/user;
- one default workspace;
- multiple projects/topics;
- one primary personal IdentityProfile;
- per-project product guidance;
- explicit boundaries;
- learned review preferences.

### Inputs/signals

Required:

- manual thought/topic;
- GitHub source events/context;
- product/deployed URL;
- file/text/image inputs;
- existing browser capture path where available.

Later:

- broader work/document integrations;
- Slack/Notion/Linear/Jira/design integrations;
- desktop/local application signals.

### Editorial intelligence

Required:

- ContentSignal records;
- opportunity scoring;
- shortlist of worthwhile ideas;
- 3–5 narrative-angle options;
- `Something else…` free-form override;
- destination recommendations/exclusions;
- repetition check against publication/narrative history.

### Production

Required:

- text generation through staged contracts;
- screenshots through safe automated browser capture;
- one deterministic short demo/screencast path;
- simple branded motion composition;
- 16:9 and 9:16 media variants;
- final media review.

### Destinations

Initial direct-publish target:

- LinkedIn;
- X;
- one visual/video destination only after media production is stable.

For every other destination, maintain a truthful manual export/open workflow until the direct connector passes real credential-backed acceptance.

### Review/approval

Required:

- exact current draft revision;
- exact media revision;
- user edit;
- free-form change request;
- approve;
- reject;
- remove destination;
- change schedule;
- approval invalidation on relevant edits.

### Calendar/publication

Required:

- simple cadence policies;
- recommended time/window;
- post now;
- schedule;
- durable job;
- cancellation/reschedule;
- confirmed/unknown/failure outcome;
- publication history.

## 4. Architecture rule: owner-first does not mean throwaway

Use stable IDs and workspace ownership from the beginning even if there is only one owner.

Minimum identity set:

```text
workspaceId
userId
projectId
identityProfileId
signalId
opportunityId
campaignId
narrativeStrategyId
contentPieceId
platformVariantId
draftId
revisionId
assetId
captureRecipeId
mediaCompositionId
approvalId
calendarEntryId
publicationRequestId
publicationId
jobId
```

This prevents a future SaaS migration from becoming a complete domain rewrite.

## 5. Execution gate philosophy

Do not complete broad layers horizontally.

Wrong pattern:

```text
build all database tables
build all UI
build all connectors
build all capture
build all analytics
then try the product
```

Preferred pattern:

```text
one user journey
    ↓
add only the infrastructure required to make it real
    ↓
verify end to end
    ↓
expand the next vertical slice
```

## 6. Gate 0 — Documentation and domain reset

Goal:

- canonical product vision documented;
- old package-generator framing removed from contributor guidance;
- Signals/Opportunities/Campaign/Memory model defined;
- issue roadmap updated;
- no implementation started from contradictory docs.

Exit criteria:

- README links to canonical product docs;
- AGENTS.md uses new lifecycle;
- roadmap prioritizes vertical slices;
- relevant epics reference the new content-intelligence layer;
- no issue tells contributors that Source → Destinations → Generate is the permanent product architecture.

## 7. Gate 1 — Owner memory and manual opportunity loop

Goal:

Prove the intelligence/review loop before automation from GitHub.

Vertical slice:

```text
Manual thought
   ↓
ContentSignal
   ↓
ContentOpportunity
   ↓
3–5 angles
   ↓
user selection
   ↓
NarrativeStrategy
   ↓
LinkedIn + X content pieces
   ↓
review/edit/approve
   ↓
NarrativeMemory updated
```

Required implementation areas:

- canonical records;
- local/store-backed repositories;
- identity profile v1;
- opportunity scoring v1;
- narrative planner;
- staged generation;
- authenticity critic v1;
- Today/Plan minimal surfaces;
- publication-memory record even if posting remains manual initially.

Why first:

If SignalFlow cannot produce low-edit authentic content from an explicit user thought, automatic work detection will only automate bad content.

## 8. Gate 2 — GitHub work-signal vertical slice

Goal:

Make real work create candidate content without manual campaign setup.

Vertical slice:

```text
meaningful GitHub event
   ↓
webhook/event ingestion
   ↓
ContentSignal
   ↓
repository/source evidence
   ↓
opportunity score
   ↓
Today recommendation
   ↓
angle selection
   ↓
existing Gate 1 campaign/review path
```

Required:

- GitHub App/webhook boundary;
- event normalization;
- workspace/project mapping;
- idempotency;
- signal classification;
- repository evidence references;
- noise filtering so every commit does not become an opportunity.

MCP remains an agent-control path, not a replacement for webhook/event ingestion.

## 9. Gate 3 — Automatic screenshot production

Goal:

The user does not manually capture product screenshots for a suitable campaign.

Vertical slice:

```text
NarrativeStrategy
   ↓
MediaRequirement: screenshot
   ↓
CaptureRecipe
   ↓
background capture job
   ↓
canonical screenshot Asset
   ↓
platform crop/derivative
   ↓
review together with text
```

Required:

- safe demo/preview capture environment;
- bounded capture recipes;
- browser worker;
- object storage or compatible owner storage;
- provenance;
- privacy checks;
- basic crop/resize derivatives.

## 10. Gate 4 — Automatic short demo production

Goal:

Produce a polished launch/demo clip without manual screen recording/editing.

Vertical slice:

```text
Campaign needs demo
   ↓
CaptureRecipe
   ↓
screencast
   ↓
MediaCompositionPlan
   ↓
brand intro + browser demo + callout + outro
   ↓
16:9 + 9:16 render
   ↓
review/approve exact media revision
```

Required:

- recording worker;
- deterministic motion composition;
- captions/callouts;
- render job;
- output storage;
- media approval and revision binding.

Do not build a general-purpose video editor in this gate.

## 11. Gate 5 — Durable publication and simple editorial calendar

Goal:

After approval, the owner no longer manually posts routine content.

Vertical slice:

```text
approved exact revision
   ↓
recommended schedule
   ↓
user approves schedule
   ↓
PublicationRequest
   ↓
durable job
   ↓
LinkedIn/X connector
   ↓
confirmed result
   ↓
publication + narrative memory
```

Required:

- durable job queue/worker adapter;
- exact revision freezing;
- verified target identity;
- real connector capability;
- idempotency;
- timezones;
- cancel/reschedule;
- unknown outcome handling;
- Today exception reporting.

## 12. Gate 6 — Editorial continuity

Goal:

SignalFlow begins deciding what should happen across a week/month rather than treating campaigns independently.

Required:

- CadencePolicy;
- calendar entries;
- campaign sequencing;
- empty-slot behavior;
- opportunity aging;
- repetition detection;
- pending/publication-aware planning;
- `what should come next?` recommendation.

Personal Alpha should now feel like an ongoing operating system rather than a campaign tool.

## 13. Gate 7 — Feedback learning

Goal:

Repeated user corrections stop recurring.

Required:

- FeedbackEvent;
- revision delta analysis;
- StyleMemoryHypothesis;
- confidence/evidence accumulation;
- Voice UI for inspect/confirm/edit/forget;
- use learned memory in generation;
- tests proving explicit boundaries outrank learned engagement signals.

## 14. Gate 8 — Visual destination expansion

Only after capture/media and text quality are reliable:

- add the first visual/video direct publication path;
- validate media upload/processing requirements;
- expand aspect ratio/composition variants;
- keep unsupported destinations manual-only.

## 15. Gate 9 — Hosted SaaS foundation

Only after Personal Alpha demonstrates repeated value should broad hosted product infrastructure become the dominant priority.

Includes:

- authentication;
- workspaces/memberships;
- production cloud database;
- object storage;
- tenant authorization;
- cross-device autosave;
- secrets;
- quotas;
- backups/restore;
- account/data controls;
- onboarding;
- managed generation route.

Existing cloud epics remain relevant, but their priority is gated by proven product demand from the owner-first loop.

## 16. Gate 10 — Broader integrations and teams

Potential expansions:

- Linear/Jira;
- Notion/docs;
- Slack/Teams;
- design systems;
- additional git providers;
- more social/owned destinations;
- collaboration/review roles;
- notifications;
- performance analytics;
- multi-brand workflows.

Do not implement these because they are possible. Implement them because a validated user workflow needs them.

## 17. First release metrics

Personal Alpha success should focus on user burden, not vanity metrics.

Useful measurements:

### Attention

- number of manual fields required before first useful recommendation;
- time/steps from opportunity to approval;
- number of times the user must leave SignalFlow to prepare media;
- number of manual publication operations after approval.

### Quality

- approval-without-edit rate;
- average revision count;
- repeated correction rate;
- rejected generic-language rate;
- destination-removal rate after recommendation;
- unsupported-claim rate.

### Reliability

- capture success rate;
- render success rate;
- publication confirmed/unknown/failure rate;
- duplicate-publication incidents (target: zero);
- job recovery after restart.

### Editorial usefulness

- recommended opportunities accepted;
- ignored/noise recommendations;
- repeated-topic detections;
- intentionally empty slots accepted by user.

## 18. Cost boundaries

Personal Alpha should avoid unnecessary managed cost.

Principles:

- use one strong reasoning/writing model initially rather than integrating every provider into every stage;
- use structured local relational data before adding specialized vector infrastructure;
- use deterministic capture/render before generative video;
- use bounded vision calls only when they provide real value;
- avoid processing every GitHub event with an expensive model;
- pre-filter obvious low-value events with deterministic rules;
- cache/version extracted evidence;
- use durable jobs so retries do not duplicate expensive work.

## 19. Owner data safety

The first user being the repository owner is not permission to skip security.

Personal Alpha may process:

- private product plans;
- unpublished features;
- screenshots;
- repository context;
- social credentials;
- identity preferences.

Required from early gates:

- secret references, not raw credentials in campaign records;
- redacted logs;
- target-scoped capture;
- explicit source/privacy state;
- no unapproved publish;
- safe deletion/export path for identity/memory data;
- truthful capability labels.

## 20. Definition of "ready for me"

SignalFlow is ready for serious owner use when this loop works repeatedly:

```text
I work
  ↓
SignalFlow finds or receives a worthwhile signal
  ↓
I select a direction with minimal thought
  ↓
SignalFlow builds the required content and simple media itself
  ↓
I review one coherent campaign
  ↓
I approve exact revisions
  ↓
SignalFlow schedules/publishes them reliably
  ↓
It remembers what happened and improves future recommendations
```

If the owner still routinely needs to record, edit, format, schedule, and manually publish after SignalFlow generates copy, the Personal Alpha has not achieved the product promise.

## 21. Execution rule

> **Do not close an issue because its isolated code exists. Close it when the vertical user journey it owns works truthfully end to end, with evidence and recovery states.**
