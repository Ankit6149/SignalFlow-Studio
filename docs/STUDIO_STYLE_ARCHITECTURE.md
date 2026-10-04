# SignalFlow Studio style architecture

The Studio previously loaded several generations of global CSS at the same time. Each generation redefined shell, panel, button, grid, action-bar, and responsive selectors. That made the final interface depend on import order and caused unrelated feature work to break existing screens.

A second source of layout drift was an appended “focused wizard” block inside `app-workspace.css`. It globally capped headings, workflow rails, grids, and action bars at 64rem even when Source, Destinations, or Review intentionally requested a wider workspace. That block has been removed; stage composition now belongs only to `studio-product.css`.

This document defines the production cascade and the ownership boundary for every active stylesheet.

## Approved production order

`frontend/app/layout.js` must import styles in this order:

1. `globals.css` — reset/tokens, root viewport containment, scrollbar behavior, shared primitives, and typography.
2. `app-workspace.css` — the authoritative Studio shell, navigation, page frames, panels, controls, cards, feedback, secondary pages, and shared responsive behavior.
3. `studio-product.css` — the authoritative three-stage Source, Destinations, and Review composition.
4. `responsive-studio.css` — bounded responsive Studio/content behavior still awaiting consolidation into owning layers. Header/navigation responsive authority has moved into `app-workspace.css`.
5. `studio-decision-flow.css` — stage-specific decision-flow layout still awaiting consolidation into owning layers.

Review freshness/source-change, campaign status, draft status, and version-history appearance no longer participate in the root cascade; they are owned by `frontend/components/ReviewStage.module.css`. Canonical SourceArtifact usability/version state appearance is owned by `frontend/components/SourceStage.module.css`. Regeneration-dialog appearance is owned by `frontend/components/RegenerationDialog.module.css`.

Legal routes do not participate in this global cascade. Terms and Privacy share the scoped `frontend/app/legal.module.css` module.

The order is enforced by `frontend/tests/styleCascade.test.mjs`.

## Retired layers

The following historical visual systems were removed after their legitimate public rules were migrated into `public-surfaces.css`:

- `living-ui.css`
- `living-ui-tuning.css`
- `professional-polish.css`
- `connector.css` (folded into scoped `app-workspace.css` authority)
- `ui-containment.css` (folded into `globals.css` root/reset authority)
- `public-surfaces.css` (legal rules moved into `legal.module.css`; unused legacy skip-link rules removed)
- `campaign-freshness.css` (Review freshness appearance moved into `ReviewStage.module.css`; unused stale connection-badge rule removed)
- `campaign-versioning.css` (Source state moved into `SourceStage.module.css`, Review state/version history moved into `ReviewStage.module.css`, and regeneration-dialog styling moved into `RegenerationDialog.module.css`)

They must not be recreated or restored. Git history remains the source for archaeology.

## Where new styles belong

### Public and legal pages

Landing layout remains component-scoped in `LandingPage.module.css`. Terms and Privacy share `legal.module.css`. Public/legal rules must not contain `.app-shell` selectors or redefine Studio controls.

Root overflow, scrollbar behavior, and global page-gutter tokens belong in `globals.css`; do not recreate separate public or containment override layers.

### Shared Studio components

Put reusable product rules in `app-workspace.css`. Examples include:

- application header and navigation;
- page width and spacing;
- buttons and form controls;
- panels, cards, status messages, and empty states;
- library, connection, and settings layouts;
- shared breakpoints and accessibility states.

All product selectors must begin with `.app-shell` so they cannot mutate the public landing page or legal routes.

### Source, Destinations, and Review layout

Put stage-specific composition in `studio-product.css`. This file can arrange existing components, but it should not redefine the base appearance of buttons, fields, panels, or status components.

Stage-specific width or max-width rules must not be appended to `app-workspace.css`. In particular, do not reintroduce a global 64rem cap on `.studio-heading`, `.studio-flow`, `.studio-grid`, or `.studio-actionbar`.

### Feature-state extensions

Prefer component-scoped modules for feature-state appearance when the state belongs to one surface, as with Review freshness/versioning and Source canonical-state presentation. A root feature stylesheet is justified only when the same state genuinely spans multiple independently owned surfaces.

Any remaining feature stylesheet must:
- describe one capability such as version history;
- remain scoped below `.app-shell`;
- avoid redefining shared component foundations;
- include tests for its state behavior.

## Prohibited patterns

Do not add another global `polish`, `tuning`, `refresh`, or `final` stylesheet. Improve the owning layer instead.

Do not:

- restyle Studio selectors from public/legal modules or unscoped global reset rules;
- use `!important` to win cascade conflicts;
- redefine the same component in multiple active files;
- place unscoped `body`, `html`, or `:root` rules in Studio layers;
- fix desktop overflow by hiding content globally;
- introduce a new breakpoint without checking the existing responsive contract.

## Review checklist

For every UI change:

1. identify the owning layer before writing CSS;
2. confirm the component is not already defined elsewhere;
3. test source, destination, and review stages;
4. check 1440 px, 1024 px, 768 px, and 390 px widths;
5. verify keyboard focus and reduced-motion behavior;
6. run `npm --prefix frontend test`;
7. run `npm --prefix frontend build`;
8. review the Vercel preview before merging visual claims.

A successful build proves compilation, not visual correctness. When preview infrastructure is externally rate-limited, mergeable architecture work may land only with the visual issue left open and the missing evidence recorded explicitly.
