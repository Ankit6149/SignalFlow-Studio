# SignalFlow Application Workspace System

The public landing page and the Studio product intentionally use different visual behavior, but they share one controlled stylesheet cascade.

## Sources of truth

`frontend/app/app-workspace.css` is the authoritative shared product layer for:

- the application shell and navigation;
- Studio page frames, panels, controls, and feedback;
- Library;
- Connections;
- Settings;
- shared product responsive behavior.

`frontend/app/studio-product.css` owns only the composition of the Source, Destinations, and Review stages.

Both files are scoped under `.app-shell`. Do not add product selectors to `globals.css` or `ui-containment.css`, and do not create new global tuning or polish stylesheets. The complete cascade contract is documented in `docs/STUDIO_STYLE_ARCHITECTURE.md` and enforced by `frontend/tests/styleCascade.test.mjs`.

## Layout

- Standard application width: `min(76rem, 88vw)`.
- Expanded Source and Destinations width: up to `88rem` with fluid gutters.
- Review width: `min(86rem, 90vw)`.
- Tablet and mobile layouts collapse to one readable column.
- Model routing becomes non-sticky before it can reduce the main workspace.
- Action controls remain in normal document flow and never cover editable content.

## Visual direction

- Quiet off-white canvas.
- White working surfaces.
- Neutral grey borders.
- Small muted-gold accents.
- Low radius and restrained shadow.
- No selected black cards.
- No card lifting, shimmer, pulsing, or floating command bars.
- Functional text normally remains between `0.75rem` and `0.9375rem`.
- Decorative typography cannot replace readable form and navigation typography.

## Workspace structure

Source uses a primary brief column with a supporting-evidence column on wide screens and a single reading order on smaller screens.

Destinations groups channels by publishing context and keeps model readiness beside the selection surface only while enough width exists.

Review keeps the destination rail, editor, inspector, actions, warnings, version state, and export controls in one consistent workspace without overlapping the editor.

## Rules for future changes

1. Scope every application selector under `.app-shell`.
2. Keep the landing experience untouched unless a task explicitly targets it.
3. Improve the owning stylesheet instead of adding another override layer.
4. Avoid fixed-position workflow controls.
5. Test at approximately 1440 px, 1024 px, 768 px, and 390 px widths.
6. Prefer whitespace, alignment, and typography over gradients and decorative cards.
7. Preserve readable drafts and forms before adding visual density.
8. Keep feature-specific styles narrow and load them after the workflow layer.
9. Run the style-cascade test before every UI merge.
