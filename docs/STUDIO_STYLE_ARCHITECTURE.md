# SignalFlow Studio style architecture

The Studio previously loaded several generations of global CSS at the same time. Each generation redefined shell, panel, button, grid, action-bar, and responsive selectors. That made the final interface depend on import order and caused unrelated feature work to break existing screens.

This document defines the production cascade and the ownership boundary for every active stylesheet.

## Approved production order

`frontend/app/layout.js` must import styles in this order:

1. `globals.css` — resets, shared primitives, typography, and the public landing page.
2. `connector.css` — narrowly scoped connector and authentication surfaces.
3. `ui-containment.css` — root viewport containment, scrollbar behavior, and public landing-page bounds only.
4. `app-workspace.css` — the authoritative Studio shell, navigation, page frames, panels, controls, cards, feedback, secondary pages, and shared responsive behavior.
5. `studio-product.css` — the authoritative three-stage Source, Destinations, and Review composition.
6. `campaign-freshness.css` — freshness-only states and source-change feedback.
7. `campaign-versioning.css` — version-history and restore-only states.

The order is enforced by `frontend/tests/styleCascade.test.mjs`.

## Retired layers

The following files are historical visual systems and must not be imported by the application:

- `living-ui.css`
- `living-ui-tuning.css`
- `professional-polish.css`

They may remain temporarily for archaeology while dependent selectors are audited, but they are not production sources of truth and should be deleted after the final reference check.

## Where new styles belong

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

### Feature-state extensions

A feature stylesheet is allowed only when it is narrow and state-oriented. It must:

- describe one capability such as freshness or version history;
- remain scoped below `.app-shell`;
- avoid redefining shared component foundations;
- load after the workflow layer;
- include tests for its state behavior.

## Prohibited patterns

Do not add another global `polish`, `tuning`, `refresh`, or `final` stylesheet. Improve the owning layer instead.

Do not:

- restyle Studio selectors from `ui-containment.css`;
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
8. review the Vercel preview before merging.

A successful build proves compilation, not visual correctness. The preview review remains required for layout changes.
