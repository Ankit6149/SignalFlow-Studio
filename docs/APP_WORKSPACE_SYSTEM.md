# SignalFlow Studio — Application Workspace System

> **Status:** current styling/layout ownership plus target workspace migration rules. The current Source/Destinations/Review surfaces remain implementation reality, but they are no longer the permanent information architecture.

## 1. Product workspace direction

SignalFlow's target application is a **calm decision room for content operations**.

The long-term product center is:

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

The current Source → Destinations → Review workflow should evolve into the manual **Create** + Review path while `Today`, `Signals`, and `Plan` become the default content-intelligence surfaces.

Read `docs/PRODUCT_INFORMATION_ARCHITECTURE.md` before restructuring routes or navigation.

## 2. Current stylesheet sources of truth

Until a deliberate UI architecture migration replaces them:

`frontend/app/app-workspace.css` owns the shared application product layer for:

- current application shell/navigation;
- Studio page frames, panels, controls and feedback;
- Library;
- Connections;
- Settings;
- shared product responsive behavior.

`frontend/app/studio-product.css` owns the current composition of Source, Destinations and Review stages.

Both are scoped under `.app-shell`.

Do not add another late global “polish” stylesheet to simulate the target product architecture. New target surfaces should reuse/extend shared primitives or intentionally introduce scoped owners through the relevant UI issue.

## 3. Current layout rules

For current routes, preserve the existing tested intent unless an owning issue deliberately changes it:

- standard application width: `min(76rem, 88vw)`;
- expanded current Source/Destinations width: up to `88rem` with fluid gutters;
- current Review width: `min(86rem, 90vw)`;
- tablet/mobile collapse into readable single-column arrangements;
- model routing must not squeeze the primary workspace;
- actions stay reachable and do not cover editable content;
- no generic shared rule may arbitrarily cap all workflow surfaces at 64rem.

These values are implementation constraints, not permanent design tokens for every future route.

## 4. Target route responsibilities

### Today

Decision-only operational home:

- worthwhile opportunities;
- content/media needing approval;
- publication/capture/render exceptions;
- compact coming-up editorial state.

Avoid filling Today with analytics, settings, or low-value status cards.

### Signals

Evidence/events/thoughts before content creation:

- new/used/ignored/snoozed signals;
- source/provenance;
- opportunity relationships;
- manual signal intake.

### Plan

Editorial intelligence:

- ranked opportunities;
- angle selection;
- `Something else…` free-form path;
- campaign/narrative plan;
- destination recommendations/exclusions;
- media requirements.

### Calendar

Editorial sequence + execution status, including intentionally empty slots.

### Create

Manual intentional entry using the current source/campaign foundations during migration.

### Assets

Reusable source/capture/rendered media, processing, provenance and dependencies.

### Library

Campaign/publication/history and NarrativeMemory entry points.

### Connections

Separate:

- source connections;
- destination connections;
- model/processor configuration.

### Voice

Identity, perception, explicit boundaries, platform overlays, and later learned preferences.

### Settings

Low-frequency operational/account/workspace/privacy/provider configuration.

## 5. Shell architecture direction

#91 owns the global shell implementation.

The target shell must support:

- workspace identity/context;
- project/campaign deep links where relevant;
- primary navigation above;
- create/manual signal action;
- account/status/help;
- active background-job indicators without overwhelming the workspace;
- permission/deployment capability awareness;
- mobile drawer/collapsed behavior;
- unsaved/active-job navigation policy.

Do not duplicate shell/navigation controls inside individual route components.

## 6. Attention hierarchy

Across target surfaces, prioritize:

1. safety/publication problem requiring action;
2. approval/judgment required;
3. high-value opportunity;
4. production/progress state;
5. low-frequency configuration/help.

Model/provider details should not visually outrank the story or approval decision when a valid default route exists.

## 7. Visual direction

The existing calm workspace intent remains useful:

- quiet off-white/calm canvas;
- clear working surfaces;
- neutral borders;
- restrained accent color;
- low/no decorative motion in dense workflows;
- readable operational typography;
- strong hierarchy through spacing/alignment rather than many oversized cards.

Avoid:

- generic analytics-dashboard density;
- giant marketing cards inside the application;
- selected-state black slabs used everywhere;
- shimmer/pulse/floating UI competing with review;
- tiny metadata used for critical status;
- decorative handwritten typography replacing readable functional text;
- large fixed command bars covering content.

## 8. Content-specific layout behavior

### Opportunity/Today cards

Cards should be compact enough for ranking/decision comparison but provide:

- what happened;
- why now;
- project/topic;
- evidence/repetition status;
- clear next action.

Avoid card layouts where decorative summaries consume an entire viewport per opportunity.

### Campaign planning

Narrative plan should keep:

- strategy/content-piece sequence;
- destination recommendations/exclusions;
- media requirements;
- evidence/identity constraints;
- user decision actions

in one understandable workspace without forcing route-hopping to gather evidence.

### Review

Review remains content-centered:

- destination/content navigation;
- main editor/media preview;
- contextual inspector;
- exact revision/status;
- approval/change actions;
- schedule/target information where relevant.

### Production progress

Display persistent job progress by stage/content piece rather than one generic full-screen spinner when durable job architecture is available.

## 9. Responsive intent

Target product behavior should be content-driven, not merely breakpoint-driven.

### Desktop

- multi-zone review/planning where width permits;
- efficient opportunity lists;
- visible context without squeezing editor/media below useful size.

### Tablet

- inspectors/panels become collapsible/drawers;
- primary decision/content remains central.

### Mobile

Must support at least:

- opportunity selection;
- `Something else` entry;
- approve/reject/change request;
- media preview;
- schedule change;
- publication/capture failure recovery.

Heavy composition editing may remain desktop-oriented, but core judgment cannot be desktop-only.

## 10. Zoom/accessibility

For current and future product routes:

- no horizontal document overflow at supported narrow widths/zoom;
- logical headings/landmarks;
- visible keyboard focus;
- status not color-only;
- dialog/drawer focus containment/restoration;
- no drag-only actions;
- calendar requires accessible agenda/list representation;
- media review should expose captions/transcripts/metadata where available;
- 200%/400% zoom reflow without losing critical actions.

## 11. Style ownership during migration

1. Fix the authoritative stylesheet/component owner rather than stacking global overrides.
2. Keep target route styles scoped under the application shell.
3. New shared tokens/primitives should be owned by #90/design-system work.
4. Current Source/Destinations/Review styles may remain isolated while those surfaces become the Create path.
5. Do not rename/restructure CSS solely to match future docs unless the UI migration issue owns the change.
6. Any new route must include deterministic visual fixtures before broad rollout.

## 12. Visual verification

UI work is not complete based on build success.

Relevant routes should be rendered/inspected at representative sizes such as:

- ~1440 px desktop;
- ~1024 px laptop/tablet landscape;
- ~768 px tablet;
- ~390 px mobile;
- 200%/400% zoom-equivalent states where required.

Stress fixtures should include long project names, many opportunities, long errors, large drafts/media, empty/loading/offline/permission states, and background job failures.

## 13. Migration rule

Do not delete a working current workflow before its replacement path can complete the same user outcome.

Recommended migration:

```text
Current manual Create/Review remains stable
    ↓
add canonical Signals/Opportunities domain
    ↓
add Today/Signals/Plan surfaces
    ↓
Campaign accepts opportunity/narrative input
    ↓
move provider config out of normal flow
    ↓
Review evolves to ContentPiece/media revisions
    ↓
add Calendar after durable publication state exists
```

## 14. Workspace principle

> **The default workspace should tell the user what requires judgment, not ask them to begin filling a form.**
