# SignalFlow Studio — UX and Visual System

> **Status:** product UX direction. Current Source/Destinations/Review screens remain supported during migration, but the permanent Studio architecture is decision-first rather than a compose wizard.

## Experience goal

SignalFlow should feel like a **calm, capable creative operations room**: focused, trustworthy, readable and low-friction.

It should not feel like:

- a crowded analytics/admin dashboard;
- a multi-step AI prompt form;
- a social scheduler that the user must constantly feed;
- a developer console dominated by provider configuration;
- a template gallery that substitutes presets for identity.

The product should continuously reduce the user's attention burden while making important judgment explicit.

## Canonical UX lifecycle

```text
Today / Signals
     ↓
Opportunity recommendation
     ↓
angle choice or Something else
     ↓
Campaign / narrative plan
     ↓
production progress
     ↓
Review exact text/media revisions
     ↓
Approve / change / reject
     ↓
Calendar / durable publication
```

The existing Source → Destinations → Review flow becomes the manual `Create` journey during migration.

## Primary product surfaces

### Today

The default decision surface.

Prioritize:

- worthwhile opportunities;
- content/media needing approval;
- operational exceptions;
- compact coming-up editorial state.

Do not fill Today with low-value metrics or configuration cards.

### Signals

Shows what happened or what the user added before content exists.

Signals must expose source/provenance and allow ignore/snooze/use decisions.

### Plan

Shows ranked opportunities, angle options, custom `Something else`, campaign narrative, content-piece sequence, destination recommendations/exclusions and media requirements.

### Create

Manual intentional entry for a thought/topic/source when the user already knows they want to communicate something.

### Review

The content/media itself is the visual center.

### Calendar

Editorial sequence and publication state; empty slots are legitimate.

### Voice

Inspectable identity/perception/boundaries/platform preferences and later learned preferences.

## Decision architecture

Every important screen should make these clear without route-hopping:

1. **Subject** — what is being decided on?
2. **Evidence** — what does the user need to know?
3. **Choices** — what 2–4 actions are available now?
4. **Consequence** — what will change after the action?

Example opportunity card:

```text
Subject: Capture workflow merged
Evidence: meaningful UI change, fresh, visual proof available, similar story not recently posted
Choices: See ideas / Later / Ignore
Consequence: selecting opens narrative angles; Later snoozes; Ignore removes from recommendations
```

## Opportunity UX

A recommendation should explain:

- what happened/topic;
- why now;
- evidence quality;
- freshness;
- repetition/narrative note;
- recommended content forms/destinations;
- production effort where relevant.

Do not expose a mysterious score without explanation.

## Angle-selection UX

Offer 3–5 materially different narrative directions, not cosmetic tone variations.

Always include:

> **Something else…**

A user must be able to type their own direction without fighting the recommendation system.

## Platform-selection UX

The system should recommend platforms **after** it understands the story.

Show:

- recommended destinations and why;
- conditional destinations (`use if demo exists`);
- explicit exclusions/deferred destinations;
- user override.

Do not require the user to select all platforms before SignalFlow can reason about the content.

## Review UX

Review must support:

- direct text editing;
- natural-language change request;
- regenerate only the affected variant/part;
- media preview/replacement;
- source/evidence inspection;
- quality/authenticity warnings;
- revision/history comparison;
- exact approval state;
- target/schedule context when publication is ready.

Editing must never silently destroy a generated baseline/history or transfer approval to a new revision.

## Production progress UX

Replace generic full-screen waiting states with persistent stage progress when durable jobs exist.

Example:

```text
Strategy              Complete
Screenshots           Complete
Demo recording        Rendering
LinkedIn              Ready for review
X                     Ready for review
Instagram video       Waiting on render
```

Completed work remains accessible while other work continues/fails.

## Error/recovery UX

Errors should answer:

- what failed;
- what remains safe;
- whether retry is safe;
- what the user can do;
- whether another decision is required.

Examples:

- `Screenshot recipe no longer matches the preview. Your drafts are safe. Retry after updating the recipe or choose another asset.`
- `X authorization expired. The approved revision remains scheduled but cannot publish until you reconnect.`
- `This source changed after approval. Review the new evidence before publishing.`

Avoid raw provider/stack errors.

## Attention hierarchy

Use visual weight in this order:

1. blocking safety/publication exception;
2. explicit user judgment required;
3. high-value opportunity;
4. progress/status;
5. secondary help/configuration.

The interface should not visually treat twelve destinations, eight providers and every optional setting as equally important.

## Provider/configuration UX

For normal users:

- recommended/default route first;
- provider setup behind Connections/Settings/Advanced;
- one clear blocker when no route is usable;
- capability-aware explanation;
- no repeated API-key/model fields in every campaign when already configured.

Power users retain BYOK/local/custom routes without making them the normal creative workflow.

## Identity/Voice UX

The Voice surface should separate:

- Identity;
- Desired perception;
- Voice preferences;
- Platform overlays;
- Boundaries;
- Learned preferences.

Learned preferences must show confidence/evidence and allow confirm/edit/forget.

Avoid a UI that implies one `founder-style` dropdown fully represents the user.

## Calendar UX

The calendar must distinguish:

- open slot;
- opportunity suggested;
- planned piece;
- production in progress;
- needs approval;
- approved;
- scheduled;
- publishing;
- published;
- failed/unknown;
- intentionally skipped.

Blank does not equal broken.

Provide an accessible agenda/list representation in addition to any visual grid.

## Visual language

Preferred qualities:

- calm, warm/neutral canvas;
- strong readable work surfaces;
- restrained brand accents;
- hierarchy through spacing, typography and alignment;
- media-first preview when reviewing media content;
- dense enough for serious work without becoming cramped;
- little/no decorative animation in operational states.

Avoid:

- giant empty hero-like regions inside the product;
- many oversized marketing cards;
- dark selected cards everywhere;
- shimmer/pulse/floating panels competing with work;
- inconsistent hand-drawn/decorative typography for functional controls;
- tiny critical metadata;
- excessive nested borders and nested scroll areas.

## Type and density direction

Exact tokens belong to the design-system owner, but current operational principles remain:

- body/control copy must remain comfortably readable;
- metadata cannot become microscopic;
- section titles should not consume excessive vertical space;
- form/control heights remain touch/keyboard friendly;
- content editors/media previews receive the majority of working space;
- long drafts, long errors and long project/platform names must not break layout.

## Responsive behavior

### Wide desktop

Use multi-zone planning/review only when every zone retains a useful width.

### Laptop/tablet

Collapse supporting inspectors/model/configuration before squeezing primary content.

### Mobile

Prioritize:

- Today decisions;
- opportunity/angle selection;
- approve/reject/change request;
- media preview;
- schedule change;
- recovery actions.

Heavy production/configuration may use dedicated mobile routes/drawers rather than crushed desktop columns.

## Accessibility target

WCAG 2.2 AA for supported primary journeys.

Required direction:

- logical headings/landmarks;
- full keyboard operation;
- visible focus;
- state not conveyed only by color/position/animation;
- meaningful status announcements without spam;
- accessible dialogs/drawers/tabs/editors/uploads;
- non-drag alternatives;
- reduced motion;
- high/forced contrast consideration;
- 200%/400% zoom reflow;
- screen-reader-readable opportunity reasoning and publication state.

## Current workflow migration

Do not throw away working current behavior.

```text
Current Source inputs
    → become Create/manual source path

Current destination selection
    → becomes recommendations + user override after narrative planning

Current model setup
    → migrates toward Connections/Settings/Advanced

Current Review
    → evolves to ContentPiece/PlatformVariant + media-aware review
```

Current styles/components may remain while these contracts are introduced, but no new product architecture should assume the old three-stage compose flow is permanent.

## UX completion rule

A screen is not finished because it looks polished.

It is finished when the user can understand the decision, see the necessary evidence, act without hidden context, recover from failure, and complete the workflow across supported viewport/accessibility states.
