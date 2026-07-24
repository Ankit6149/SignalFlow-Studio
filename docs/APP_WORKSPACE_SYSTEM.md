# SignalFlow Application Workspace System

The landing page and the authenticated/local application intentionally use different visual behaviour.

## Source of truth

`frontend/app/app-workspace.css` is the only visual source of truth for:

- Studio
- Library
- Connections
- Settings

It is scoped under `.app-shell` and loaded after the landing-page styles. Do not add new application selectors to `globals.css`, `living-ui.css`, `living-ui-tuning.css`, or `professional-polish.css`.

## Layout

- Standard application width: `min(76rem, 88vw)`
- Review width: `min(86rem, 90vw)`
- Mobile/tablet gutters: explicit `3rem`, `2rem`, and `1.5rem` reductions
- Two-column Compose only above `96rem`
- Three-column Review only above `96rem`

## Visual direction

- Quiet off-white canvas
- White working surface
- Neutral grey borders
- Small muted-gold accents
- Low radius and almost no shadow
- No selected black cards
- No card lifting, shimmer, pulsing, or floating command bars
- Normal functional text between `0.75rem` and `0.9375rem`

## Workspace structure

Compose is rendered as one continuous surface. Source and Destinations are separated internally rather than appearing as independent dashboard cards. The command footer visually connects to the same surface.

Review keeps the destination rail, editor, inspector, actions, warnings, and export controls in one consistent workspace.

## Rules for future changes

1. Scope every application selector under `.app-shell`.
2. Keep the landing experience untouched unless a task explicitly targets it.
3. Do not add another application override stylesheet.
4. Avoid fixed-position workflow controls.
5. Test at approximately 1366px, 1024px, 768px, and 390px widths.
6. Prefer whitespace, alignment, and typography over gradients and decorative cards.
7. Preserve readable drafts and forms before adding visual density.
