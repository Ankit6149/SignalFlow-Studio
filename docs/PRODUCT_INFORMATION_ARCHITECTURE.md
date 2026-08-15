# SignalFlow Studio — Product Information Architecture

> **Status:** canonical target UX/information architecture. Existing screens remain implementation truth until they are replaced. This document defines the future product structure so UI work does not continue extending the old campaign wizard as the center of the product.

## 1. UX goal

SignalFlow should feel like a **calm decision room for content operations**.

It should not feel like:

- a marketing dashboard;
- a project-management suite;
- a seven-step content wizard;
- an AI playground full of provider controls;
- a social scheduler that asks the user to manually fill a calendar;
- a video editor the user has to operate for every post.

The user's normal experience should answer four questions quickly:

1. What deserves my attention?
2. What does SignalFlow recommend?
3. What exactly will be published?
4. What decision do I need to make?

## 2. Primary information architecture

Target navigation:

```text
Today
Signals
Plan
Calendar
Create
Assets
Library
Connections
Voice
Settings
```

The exact labels may evolve during UI design, but the responsibilities must remain separated.

## 3. `Today`

`Today` should become the default operational home.

Purpose:

> Show only the decisions and exceptions that require the user's attention now.

Possible sections:

### Worth considering

Ranked opportunities SignalFlow detected or that became relevant.

Each card should answer:

- what happened;
- why it may be worth talking about;
- which project/topic it belongs to;
- evidence readiness;
- suggested formats/destinations;
- urgency/freshness;
- action: `See ideas`, `Later`, `Ignore`.

### Needs approval

Content/media that is ready for user judgment.

Show:

- campaign/content piece;
- destination;
- short preview;
- blocking warnings if any;
- planned publish time;
- `Review` action.

### Attention required

Operational exceptions:

- expired/revoked destination connection;
- failed render;
- stale source after approval;
- unknown publication result;
- failed scheduled job;
- privacy warning.

### Coming up

A compact editorial preview, not a full calendar.

Example:

```text
Tue — SignalFlow · builder story · approved
Thu — open editorial slot · no recommendation yet
Sat — personal / evergreen window
```

## 4. `Signals`

Purpose:

> Show what SignalFlow noticed and what the user deliberately added.

Primary groups/filters:

- New;
- Interpreted;
- Used in opportunity/campaign;
- Ignored;
- Snoozed;
- Source type;
- Project;
- Date;
- Privacy level.

Signal detail should show:

- normalized summary;
- source/provenance;
- evidence links/assets;
- why it was or was not considered important;
- opportunities created from it;
- user actions.

Primary actions:

- `Find ideas`;
- `Create campaign`;
- `Ignore`;
- `Snooze`;
- `Attach to project`;
- `Add context`.

## 5. `Plan`

Purpose:

> Convert signals/ideas into intentional narratives and campaigns.

This area contains:

- opportunity inbox;
- shortlisted ideas;
- campaign plans;
- campaign sequence;
- deferred/evergreen ideas.

### Opportunity interaction

A strong opportunity card should expose:

```text
Title
Why now
Evidence strength
Novelty/repetition note
Suggested angle families
Suggested destinations
Suggested media
Production effort
```

The user chooses an opportunity, then sees 3–5 narrative directions plus:

> **Something else…**

### Campaign plan

Before full production, present:

- core idea;
- audience takeaway;
- proposed story arc;
- content pieces;
- destination recommendations/exclusions;
- media requirements;
- tentative sequence/timing;
- factual/identity constraints.

The user can approve the plan or change the narrative before expensive media work begins.

## 6. `Calendar`

Purpose:

> Show editorial sequence and publication execution over time.

The calendar must distinguish:

- proposed opportunity;
- planned content;
- production in progress;
- needs approval;
- approved;
- scheduled;
- publishing;
- published;
- failed;
- intentionally empty slot.

Views may include:

- week;
- month;
- agenda;
- campaign sequence;
- destination filter;
- project filter.

Do not turn every blank day into a warning.

## 7. `Create`

Purpose:

> Manual intentional entry when the user already knows what they want to discuss.

This remains first-class.

Input options:

- free-form thought/topic;
- URL;
- repository/source context;
- files;
- images;
- browser/extension assets;
- existing signal;
- existing asset;
- planned launch/event.

The create surface should ask as little as possible before showing useful direction.

Recommended progression:

```text
What do you want to talk about?
     ↓
Optional evidence/context
     ↓
SignalFlow proposes angles / content forms
     ↓
User chooses
     ↓
Campaign plan
```

Do not force provider selection or all destination choices before the user understands the story.

## 8. `Assets`

Purpose:

> Manage evidence and media independent of one campaign.

Contains:

- inbox from browser extension/capture workers;
- uploads;
- screenshots;
- recordings;
- derived crops;
- rendered videos;
- thumbnails;
- transcripts/OCR;
- reusable brand assets;
- processing states;
- usage relationships.

Important actions:

- preview;
- attach/reuse;
- rename/describe/tag;
- retry processing;
- derive crop/variant;
- redact where supported;
- inspect provenance;
- delete/archive with dependency explanation.

## 9. `Library`

Purpose:

> Historical record of campaigns/content/publications and reusable finished work.

Filters:

- project;
- campaign;
- destination;
- published/scheduled/draft;
- date;
- topic;
- content type;
- performance later.

The Library is also an entry point to NarrativeMemory:

- what was said;
- where;
- when;
- which media was used;
- what follow-up remains possible.

## 10. `Connections`

Separate connection categories visibly.

### Sources

Examples:

- GitHub;
- browser extension;
- future work/document connectors.

Show:

- what SignalFlow may read/receive;
- workspace/project scope;
- event/capture capabilities;
- last successful sync/event;
- permission/expiry state.

### Destinations

Examples:

- LinkedIn;
- X;
- YouTube;
- other supported official destinations.

Show:

- exact account/page/channel/community identity;
- scopes;
- content-type capabilities;
- expiry/verification;
- direct-publish versus manual-only status.

### Models/processors

Provider routing belongs here or Settings/Advanced, not in the center of every campaign.

## 11. `Voice`

Purpose:

> Let the user understand and control how SignalFlow represents them.

Sections:

### Identity

- core context;
- recurring interests/beliefs;
- desired depth/confidence;
- examples.

### Perception

- how the user wants to be understood;
- qualities to signal/avoid;
- current public narrative.

### Voice

- explicit writing preferences;
- vocabulary/formatting preferences;
- approved examples.

### Platform behavior

- LinkedIn overlay;
- X overlay;
- Reddit overlay;
- etc.

### Boundaries

- topics/claims/styles never to use;
- privacy restrictions;
- project/time-specific exclusions.

### Learned preferences

Explainable memories with:

- hypothesis;
- confidence;
- evidence examples;
- `Confirm`, `Edit`, `Forget`.

## 12. `Settings`

Keep low-frequency operational configuration away from the creative flow.

Potential groups:

- account;
- workspace;
- data/privacy;
- default timezone;
- cadence policies;
- notifications;
- model/provider routing;
- object/storage/export settings where relevant;
- self-hosted/local advanced controls;
- usage/quota;
- sessions/security;
- experimental capabilities.

## 13. Opportunity selection flow

Recommended decision flow:

```text
Opportunity
  ↓
"Why is this worth talking about?"
  ↓
Choose angle:
  1. problem/reason
  2. design decision
  3. technical breakdown
  4. visual before/after
  5. short demo
  6. something else
  ↓
SignalFlow recommends destinations and media
  ↓
Campaign plan review
```

The user should not need to choose platforms before the system has a reasoned recommendation.

## 14. Review surface

Review remains one of the most important product surfaces.

Target zones on desktop:

```text
Campaign/content navigation
      |
      |  Main editor / media preview
      |
      |  Context inspector
```

The inspector may contain:

- why this piece exists;
- source/evidence references;
- identity/voice notes that mattered;
- platform constraints;
- quality issues;
- revision history;
- approval status;
- planned schedule;
- exact target connection.

Primary review actions:

```text
Approve
Request changes
Edit directly
Regenerate this part
Reject / remove from campaign
Change schedule
```

Publishing should remain a deliberate secondary action unless the publication schedule is already part of the approval decision.

## 15. Change-request UX

Users should be able to write natural corrections:

- “make this less formal”;
- “don't make it sound like a launch”;
- “use the second screenshot”;
- “remove the personal part”;
- “make the video 10 seconds shorter”;
- “skip Reddit”;
- “post this next week instead.”

The system should translate the request into the narrowest affected stage.

## 16. Production progress UX

Media/generation work can continue asynchronously.

Users need persistent, truthful progress such as:

```text
Campaign: Capture workflow

Strategy            Complete
Screenshots          Complete
Demo recording       Rendering
LinkedIn draft       Ready for review
X draft              Ready for review
Instagram clip       Waiting on render
```

Completed items should remain reviewable even if another job fails.

## 17. Attention hierarchy

SignalFlow should visually prioritize:

1. blocked publication/safety issue;
2. item needing explicit user judgment;
3. opportunity recommendation;
4. progress/state;
5. low-frequency configuration/help.

Provider/model controls should not outrank the user's content decision.

## 18. First-run experience

The hosted owner-first experience should quickly teach the loop.

Potential first-run sequence:

1. choose/create project or personal workspace context;
2. connect GitHub or skip;
3. add one manual thought or existing product URL;
4. set a lightweight identity/perception preference;
5. SignalFlow creates first opportunity/angles;
6. user chooses an angle;
7. generate one small campaign;
8. show review/approval;
9. optionally connect one destination.

The user should see the operating model before encountering advanced infrastructure setup.

## 19. Responsive behavior

Decision surfaces must remain usable on mobile even if heavy production/editing is better on desktop.

### Mobile priority

- approve/reject;
- opportunity selection;
- change request;
- schedule adjustment;
- publication problem recovery;
- concise draft/media preview.

### Desktop priority

- deeper editing;
- campaign planning;
- asset comparison;
- media inspection;
- calendar management;
- settings/connections.

No critical approval should be impossible on mobile merely because the desktop editor uses side panels.

## 20. Accessibility

Target WCAG 2.2 AA for primary workflows.

Important requirements:

- all decision cards keyboard reachable;
- status never color-only;
- progress announced without spam;
- editor/media controls labelled;
- dialogs/drawers trap and restore focus correctly;
- no drag-only action;
- captions/transcripts available for media review where possible;
- calendar has a non-grid accessible agenda representation;
- 200%/400% zoom reflow;
- long content does not create horizontal page scroll.

## 21. Visual direction

The existing calm creative-workspace principle remains useful.

Prefer:

- quiet surfaces;
- strong hierarchy;
- readable typography;
- enough density for serious work;
- restrained brand accents;
- clear state labels;
- media given visual priority when reviewing media-first content.

Avoid:

- generic analytics-dashboard density;
- oversized marketing cards inside the app;
- decorative effects that compete with review decisions;
- floating controls that obscure content;
- repeated provider badges/technical jargon;
- tiny status text;
- visually equal weighting for every possible action.

## 22. UI fixture requirements

Future UI work should include deterministic fixtures for:

- zero signals;
- many signals;
- one strong opportunity;
- no worthwhile opportunity;
- opportunity with insufficient evidence;
- manual "Something else" input;
- campaign with text only;
- campaign with media production;
- partial render failure;
- needs approval;
- approved/scheduled;
- publication unknown/failure;
- identity boundary conflict;
- stale source after approval;
- empty calendar slot;
- long draft;
- many assets;
- mobile decision review.

## 23. Migration from the current UI

The current Source → Destinations → Review flow should not be deleted before the new lifecycle exists.

Instead:

1. keep it as the manual `Create` path;
2. split domain/application logic out of monolithic UI components;
3. add Signals/Opportunities/Today above it;
4. make campaign creation accept an Opportunity/NarrativeStrategy as well as manual source input;
5. move provider configuration into Connections/Settings/Advanced;
6. add Calendar after durable publication records/jobs exist;
7. evolve Review to understand ContentPieces and media revisions.

This avoids a destructive rewrite while still changing the center of gravity.

## 24. Product UX principle

> **The default screen should tell the user what requires judgment, not ask them to start filling a form.**
