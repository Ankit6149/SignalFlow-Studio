# SignalFlow Studio — Canonical Product Vision

> **Status:** canonical product direction. This document defines what SignalFlow is becoming. It does not claim that every capability described here is already implemented.

## 1. Product definition

SignalFlow Studio is a **content operating system for people whose real work should remain their primary focus**.

It is not fundamentally a post generator, a prompt wrapper, a generic social scheduler, or a dashboard that asks the user to become a content strategist. Its purpose is to absorb the operational burden between **doing meaningful work** and **communicating that work well**.

The intended loop is:

```text
Work normally
    ↓
SignalFlow notices useful signals
    ↓
SignalFlow decides what may be worth talking about
    ↓
User chooses or supplies the direction
    ↓
SignalFlow gathers evidence and creates the required media
    ↓
SignalFlow builds native content for the destinations that actually fit
    ↓
User reviews, changes, rejects, or approves
    ↓
SignalFlow schedules/publishes the exact approved revisions
    ↓
SignalFlow remembers what was said and learns from the user's decisions
    ↓
The user returns to their real work
```

The product must optimize for **minimum user attention spent on content operations without surrendering judgment or authenticity**.

## 2. Core promise

The long-term promise is:

> **Keep building. SignalFlow handles the work between what happened and what should be communicated. You make the final judgment.**

A user should not routinely need to decide:

- what to post today;
- whether a small change is worth a post;
- which platform should receive a story;
- how the same story should change across platforms;
- what was already said recently;
- which screenshot best explains a change;
- whether a short demo would be better than a static image;
- how to screen-record a product cleanly;
- how to add an intro, logo transition, subtitles, callouts, outro, crop variants, or social-safe dimensions;
- which time should be used merely because a calendar has an empty slot;
- whether a campaign is repeating an earlier claim;
- how to preserve a consistent personal voice without copy-pasting a generic brand prompt.

Those are SignalFlow problems.

The user's primary responsibilities should be:

1. **judgment** — is this worth saying?
2. **selection** — which angle feels right?
3. **correction** — what should change?
4. **approval** — may this exact revision be published?

## 3. The fundamental product shift

The previous product model was approximately:

```text
brief + repository/files/links
    ↓
select destinations
    ↓
generate a posting package
    ↓
review/export/publish
```

That remains a useful manual capability, but it is no longer the primary conceptual model.

The canonical product model is now:

```text
Signals
  ↓
Opportunities
  ↓
Narrative / Campaign Plan
  ↓
Evidence + Capture + Media Production
  ↓
Canonical Content Pieces
  ↓
Platform-native Variants
  ↓
Review / Approval
  ↓
Editorial Calendar
  ↓
Scheduled / Immediate Publication
  ↓
Narrative Memory + Feedback Learning
```

This shift is architectural. New features must be evaluated against this model rather than extending a large campaign-generation form.

## 4. SignalFlow's five product layers

### 4.1 Signal Engine

The Signal Engine answers:

> **What happened that might be worth communicating?**

Signals may come from anywhere the user deliberately connects or supplies. GitHub is one useful source, not the definition of the product.

Examples:

- GitHub pull requests, commits, releases, issues, milestones, workflow outcomes;
- deployed product changes;
- browser captures;
- documents, notes, changelogs, research, screenshots, recordings, URLs;
- a manual thought, observation, lesson, opinion, question, life event, or idea;
- a relevant industry event or research item the user deliberately adds;
- future integrations such as Linear, Jira, Notion, Slack, design tools, or other systems when explicitly connected.

A signal is **not a post**. It is evidence that something happened.

### 4.2 Editorial Brain

The Editorial Brain answers:

> **Is this worth talking about, why, through which angle, on which destination, and when?**

It must consider:

- freshness;
- importance;
- novelty;
- evidence quality;
- visual/demo potential;
- audience relevance;
- alignment with the user's longer-term public narrative;
- whether the topic was already discussed;
- current campaign priorities;
- platform fit;
- production cost/effort;
- cadence and timing;
- user boundaries and preferences.

It may conclude **do not post**. SignalFlow must never create filler merely to satisfy an arbitrary posting frequency.

### 4.3 Identity and Memory

The Identity/Memory layer answers:

> **How should this person or project be represented, what has already been said, and what has the user taught SignalFlow through previous decisions?**

It stores versioned, explainable memory for:

- identity and worldview;
- desired audience perception;
- communication preferences;
- platform-specific expression;
- boundaries and topics to avoid;
- approved historical examples;
- edit/rejection/approval patterns;
- publication history;
- campaign narrative history;
- claims/features previously discussed;
- follow-up opportunities.

This layer is the main defense against generic, technically correct but inauthentic AI copy.

### 4.4 Production Engine

The Production Engine answers:

> **What evidence and media are needed to tell this story properly, and can SignalFlow create them without interrupting the user?**

It may create or orchestrate:

- text drafts;
- code/product screenshots;
- browser walkthrough captures;
- screen recordings;
- product demo clips;
- visual cards;
- carousels;
- subtitles;
- voice-over scripts;
- motion compositions;
- multi-aspect-ratio exports;
- thumbnails;
- alt text;
- owned-channel long-form content.

The preferred architecture uses deterministic capture and motion composition for repeatability, with generative media as an optional tool rather than the foundation.

### 4.5 Distribution Engine

The Distribution Engine answers:

> **What exact approved revision should go to which verified destination, at what time, and what actually happened?**

It owns:

- account/target capability discovery;
- immediate publication;
- scheduled publication;
- idempotency;
- cancellation/rescheduling;
- confirmation of exact draft/media revisions;
- truthful external success/unknown/failure states;
- publication history;
- later performance ingestion where officially available.

No external side effect may silently occur from an unapproved revision.

## 5. Human attention budget

SignalFlow should minimize configuration and maximize useful decisions.

A normal flow should feel closer to:

```text
SignalFlow: "I found 3 things worth considering."
            ↓
User selects one
            ↓
SignalFlow: "Here are 3–5 ways to tell it."
            ↓
User selects one or writes "Something else"
            ↓
SignalFlow creates evidence/media/content
            ↓
User approves or requests a change
            ↓
SignalFlow schedules/publishes
```

The product should not force the user to repeatedly choose model IDs, provider endpoints, hashtags, aspect ratios, technical capture settings, or channel formatting rules when reasonable saved defaults and capabilities exist.

Advanced configuration must exist for power users, but it is not the normal path.

## 6. Manual input remains first-class

Automation must never make SignalFlow GitHub-only or product-update-only.

The user must always be able to add:

- a thought;
- a personal observation;
- a technical lesson;
- a research idea;
- a question;
- an opinion;
- a launch;
- a life/career update;
- an external topic;
- a document or URL;
- **Something else…** as free-form intent.

Manual and automatically discovered signals enter the same opportunity and campaign system. This keeps the product useful for builders, creators, researchers, professionals, founders, teams, and anyone whose content originates from real work or thought.

## 7. Native platform behavior, including intentional absence

SignalFlow must not treat omnichannel duplication as success.

For every opportunity it should decide:

- which destinations genuinely fit;
- what form each destination should receive;
- whether the topic should skip a destination entirely.

Examples:

- a visual feature launch may suit LinkedIn, X, Instagram, and YouTube but not Reddit;
- a detailed engineering trade-off may suit X, Reddit, Hacker News, blog, and newsletter but not Instagram;
- a personal observation may deserve only LinkedIn or Threads;
- a release note may belong in an owned channel without becoming a social campaign.

**Not posting is a valid platform decision.**

## 8. Campaigns are narratives, not twelve-post containers

A Campaign represents a coherent narrative objective and may contain multiple content pieces over time.

Example:

```text
Campaign: Automated capture pipeline

Core idea:
Building should produce the raw material for communication without forcing the builder to stop and manufacture content.

Pieces:
1. LinkedIn — problem/reason story
2. X — short product demo
3. Instagram — visual demo clip
4. Reddit — technical architecture discussion (only if useful)
5. YouTube — deeper walkthrough later
6. LinkedIn — retrospective after real use
```

The calendar should sequence these pieces rather than publish every variant simultaneously.

## 9. Editorial cadence is a policy, not a recurring content factory

SignalFlow may support user preferences such as daily, alternate-day, weekly, weekend, launch-window, or custom cadence, but recurring settings are **availability/intent policies**, not orders to generate filler.

Example:

```text
LinkedIn
- target: 2–3 worthwhile posts/week
- preferred gap: 36+ hours
- themes: building, engineering lessons, thoughtful observations

X
- target: 3–6 useful updates/week
- smaller development signals acceptable

Reddit
- no frequency target
- only when a discussion is genuinely useful

YouTube
- approximately one high-value demo every 2–4 weeks
```

If nothing meets the threshold, the slot remains empty.

## 10. Identity must outrank engagement optimization

Performance data may improve recommendations, but it must never override explicit identity or boundary preferences.

Example:

- a personal/vulnerable post performs well;
- the user consistently removes personal details from future drafts;
- SignalFlow must learn the user's privacy boundary rather than maximize engagement by becoming more personal.

Priority order:

```text
Safety / permission
    > explicit user boundaries
    > approved identity / perception intent
    > factual truth / evidence
    > editorial quality
    > performance optimization
```

## 11. Approval and trust levels

Publishing is a reputational side effect. Trust should be explicit.

| Level | SignalFlow behavior |
| --- | --- |
| 0 — Observe | detect signals only |
| 1 — Suggest | propose opportunities/angles |
| 2 — Produce | generate drafts/assets |
| 3 — Prepare | prepare schedule/publication after approval |
| 4 — Publish approved | publish only the exact approved revision |
| 5 — Scoped autopilot | future opt-in for explicitly allowed low-risk categories only |

The owner-first product target is **Level 4**: SignalFlow may do almost everything, but the user retains the final judgment.

## 12. Golden Path 01 — work to approved post

The first product slice that should prove the vision:

```text
Meaningful work event or manual signal
    ↓
SignalFlow creates ContentSignal
    ↓
Editorial Brain ranks it as worthwhile
    ↓
User sees 3–5 narrative options
    ↓
User selects one
    ↓
SignalFlow gathers repository/product/context evidence
    ↓
SignalFlow captures useful screenshots if needed
    ↓
SignalFlow generates native LinkedIn + X pieces (initial target)
    ↓
Authenticity/quality review
    ↓
User edits or approves
    ↓
Publication plan
    ↓
Durable scheduled/immediate job
    ↓
Confirmed publication
    ↓
Narrative memory updated
```

## 13. Golden Path 02 — work to produced demo video

The second proof slice:

```text
Opportunity selected
    ↓
Editorial strategy determines a visual demo is useful
    ↓
CaptureRecipe selected/generated from safe actions
    ↓
Browser capture worker produces deterministic recording/screenshots
    ↓
Motion composition plan generated
    ↓
Deterministic renderer produces social-ready video variants
    ↓
User reviews final output
    ↓
Exact media + text revision approved
    ↓
Scheduled/published
```

This is how SignalFlow removes the need to manually screen-record and repeatedly hire/edit simple launch media.

## 14. Product surface direction

The long-term application should prioritize **decisions**, not configuration pages.

Primary navigation direction:

- **Today** — items requiring user judgment now;
- **Signals** — what SignalFlow noticed or what the user added;
- **Plan** — opportunities and campaign narratives;
- **Calendar** — editorial sequence and publication state;
- **Create** — intentional/manual campaign entry;
- **Assets** — captured/uploaded/derived media and evidence;
- **Library** — published/history/archive;
- **Connections** — source and destination integrations;
- **Voice** — identity, perception, learned style and boundaries;
- **Settings** — providers, account/workspace, advanced policies.

`Create` remains important but stops being the entire product.

## 15. Owner-first, SaaS-ready strategy

SignalFlow should first become genuinely useful for one demanding owner workflow before broad SaaS expansion.

### Personal Alpha

- one owner identity;
- multiple projects/topics;
- GitHub + manual inputs + URLs/files/browser captures;
- persistent identity/narrative memory;
- opportunity recommendations;
- a small set of high-value publishing destinations;
- automated screenshot/demo production;
- approval-first scheduling/publishing.

### Architecture from day one

Even with one owner, use stable identifiers and proper boundaries:

```text
workspaceId
userId
projectId
signalId
opportunityId
campaignId
contentPieceId
draftId
revisionId
assetId
compositionId
publicationId
```

This allows later multi-user SaaS without treating the Personal Alpha as throwaway code.

## 16. What not to build first

Do not allow the vision to expand into unrelated product categories before the golden paths work.

Avoid initially:

- a Premiere-class video editor;
- a Canva replacement;
- dozens of social networks;
- engagement dashboards full of vanity metrics;
- full enterprise collaboration before single-user usefulness;
- custom queue infrastructure when a replaceable managed adapter can prove the model;
- a proprietary vector database as a prerequisite;
- expensive model fine-tuning before structured memory proves insufficient;
- unreviewed global autoposting;
- random AI navigation of authenticated production accounts;
- recurring filler content generated merely because a calendar slot exists.

## 17. Decision rules for contributors and agents

Before implementing a feature, answer:

1. Which user decision or burden does this remove?
2. Which canonical stage owns it: Signal, Opportunity, Campaign, Production, Approval, Calendar/Publication, or Memory?
3. Which durable record represents it?
4. Does it preserve source evidence and user approval?
5. Can it be regenerated independently without destroying unrelated work?
6. Does it reduce or increase routine user attention?
7. Does it improve authenticity or merely add another tone/template control?
8. Does it rely on truthful platform/provider capability detection?
9. Can it fail without losing approved/edited work?
10. Is the feature necessary for a golden path, or is it premature breadth?

If those questions cannot be answered, implementation should stop until the product contract is clear.

## 18. Relationship to current implementation

The existing review-first campaign system remains valuable infrastructure:

- stable campaign identity;
- edit-safe draft handling;
- source freshness;
- authoritative current drafts;
- approvals;
- deterministic exports;
- provider adapters;
- canonical source/asset contracts;
- capability discovery;
- MCP direction;
- connector/publishing foundations.

These should be extended into the operating-system model rather than discarded.

However, current implementation truth must remain explicit. Documentation describing future Signals, Opportunities, memory, capture workers, media rendering, cloud persistence, jobs, or broader connectors must be labelled **planned** until implementation and evidence exist.

## 19. Canonical principle

> **SignalFlow should consume the evidence created by work, not require the user to stop working and manufacture content inputs.**

And:

> **The user's job is judgment. SignalFlow's job is everything between the work and that judgment.**
