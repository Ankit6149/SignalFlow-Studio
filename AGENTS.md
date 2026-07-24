# SignalFlow Studio Agent Guide

## Mission

SignalFlow Studio turns product evidence into a coherent, editable multi-channel campaign. The product must feel like a calm creative publishing room, not a project-management dashboard and not a fake autoposting demo.

## Read This First

1. `README.md`
2. `docs/STUDIO_UX_SYSTEM.md`
3. `docs/CONNECTOR_READINESS.md`
4. `docs/PRODUCT_GRADE_OPEN_SOURCE.md`
5. `SECURITY.md`

## Source of Truth

- Primary product UI: `frontend/app/page.js`
- Global styling: `frontend/app/globals.css`
- Latest Studio-specific styling: `frontend/app/studio-luxury.css`
- Generation: `frontend/app/api/launch_kit/route.js`
- Social status/OAuth: `frontend/app/api/social/` and `frontend/lib/social/`
- Publishing: `frontend/app/api/publish/route.js`
- Context extraction: `frontend/lib/context/`
- Package normalization: `frontend/lib/package/`

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

- Use `rem` for Studio spacing, typography, and control dimensions.
- Normal body text should be about `0.875rem`–`0.9375rem`.
- Supporting text should normally be at least `0.75rem`.
- Avoid 8–10px functional copy.
- Preserve the warm paper, obsidian, champagne, coral, and restrained sage system.
- Use editorial typography for identity, not for every workspace label.
- Common laptop widths should prioritize readability over keeping two cramped columns.
- Keep the compose flow source → destinations → generate.
- Keep review focused on one channel, with visible route, limits, and deliberate actions.
- Avoid neon, glass overload, heavy borders, and generic admin-dashboard patterns.

## Engineering Rules

- Never commit credentials.
- Never expose server secrets through `NEXT_PUBLIC_` variables.
- Preserve confirmed-only publish success.
- Fail with useful warnings and manual fallback instructions.
- Keep changes small and reviewable.
- Prefer platform APIs and browser-native capabilities; do not add Playwright for product workflows.
