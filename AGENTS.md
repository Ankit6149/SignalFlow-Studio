# SignalFlow Studio Agent Guide

## Mission

SignalFlow Studio turns product evidence into a coherent, editable multi-channel campaign. The product must feel like a calm creative publishing room, not a project-management dashboard and not a fake autoposting demo.

## Read This First

1. `README.md`
2. `docs/APP_WORKSPACE_SYSTEM.md`
3. `docs/STUDIO_UX_SYSTEM.md`
4. `docs/CONNECTOR_READINESS.md`
5. `docs/PRODUCT_GRADE_OPEN_SOURCE.md`
6. `SECURITY.md`

## Source of Truth

- Primary product UI: `frontend/app/page.js`
- Landing/global styling: `frontend/app/globals.css`, `frontend/app/living-ui.css`, and `frontend/app/professional-polish.css`
- Studio, Library, Connections, and Settings styling: `frontend/app/app-workspace.css`
- Generation: `frontend/app/api/launch_kit/route.js`
- Social status/OAuth: `frontend/app/api/social/` and `frontend/lib/social/`
- Publishing: `frontend/app/api/publish/route.js`
- Context extraction: `frontend/lib/context/`
- Package normalization: `frontend/lib/package/`

Do not create another late-cascade application override stylesheet. All application selectors belong under `.app-shell` in `app-workspace.css`.

## Required Verification

```bash
cd frontend
npm install
npm run build
```

Do not report completion when the build fails. Do not claim a social connector is production-complete without real credentials, authorization, posting, refresh, expiry, rejection, and rate-limit verification.

## Product Truth Boundaries

- Direct official connector paths: LinkedIn, X, Reddit
- Other destinations: review/copy/export/open-platform only
- Saved campaigns: current browser local storage
- OAuth sessions: encrypted HTTP-only cookies
- Uploaded text/code: browser-extracted within current limits
- Images/video: metadata references in the main route, not automatic visual understanding
- No automatic publish without explicit approval

## UX Rules

- Use `rem` for application spacing, typography, and control dimensions.
- Normal body text should be about `0.875rem`–`0.9375rem`.
- Supporting text should normally be at least `0.75rem`.
- Avoid 8–10px functional copy.
- Keep the application centered with visible viewport gutters.
- Use white working surfaces on a quiet off-white canvas with restrained neutral borders and small muted-gold accents.
- Do not use black selected cards, floating command bars, card lifting, shimmer, or pulse effects inside `.app-shell`.
- Use editorial typography selectively for identity and section emphasis, not every workspace label.
- Common laptop widths should prioritize readability over keeping two cramped columns.
- Keep the compose flow source → destinations → generate.
- Keep review focused on one channel, with visible route, limits, and deliberate actions.
- Avoid neon, glass overload, heavy gradients, and generic admin-dashboard patterns.

## Engineering Rules

- Never commit credentials.
- Never expose server secrets through `NEXT_PUBLIC_` variables.
- Preserve confirmed-only publish success.
- Fail with useful warnings and manual fallback instructions.
- Keep changes small and reviewable.
- Prefer platform APIs and browser-native capabilities; do not add Playwright for product workflows.
