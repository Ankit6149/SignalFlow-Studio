# SignalFlow Studio Agent Guide

## Mission

SignalFlow Studio turns product evidence into a coherent, editable multi-channel campaign. It must feel like a calm creative publishing room, not a project-management dashboard and not a fake autoposting demo.

The active product requires a real model route. Template, offline, prompt-only, and automatic fallback campaign generation are retired and must not be reintroduced through UI, API, MCP, tests, or documentation.

## Read this first

1. `README.md`
2. `docs/CAPABILITY_MATRIX.md`
3. `docs/DOMAIN_ARCHITECTURE.md`
4. `docs/APP_WORKSPACE_SYSTEM.md`
5. `docs/STUDIO_UX_SYSTEM.md`
6. `docs/CONNECTOR_READINESS.md`
7. `docs/PRODUCT_GRADE_OPEN_SOURCE.md`
8. `SECURITY.md`

## Source of truth

- Product capability discovery: `frontend/app/api/capabilities/route.js`
- Domain records and portable serialization: `frontend/lib/domain/contracts.mjs`
- Campaign aggregate and migration: `frontend/lib/domain/campaign.mjs`
- Application use cases: `frontend/lib/application/`
- Infrastructure adapters: `frontend/lib/infrastructure/`
- Authoritative export projection: `frontend/lib/export/campaignExport.mjs`
- Primary product UI: `frontend/app/page.js`
- Generation API: `frontend/app/api/launch_kit/route.js`
- Provider policy/adapters: `frontend/lib/ai/`
- Social status/OAuth: `frontend/app/api/social/` and `frontend/lib/social/`
- Confirmed-only publishing: `frontend/app/api/publish/route.js`
- Context extraction: `frontend/lib/context/`
- Browser extension: `extension/`
- MCP server: `mcp/`

## Architecture rules

Dependency direction:

```text
UI / routes / MCP / extension receiver
                ↓
       application services
                ↓
      domain contracts + ports
                ↑
 browser / memory / cloud adapters
```

- React components and routes must not import infrastructure adapters directly.
- Domain modules must remain framework-independent and cannot contain browser `File` objects, database clients, provider keys, OAuth secrets, Request/Response objects, or SDK clients.
- Current edited draft content is authoritative. Generated copy is optional revision history.
- Persisted and protocol-crossing records require stable IDs and schema versions.
- Compatibility readers migrate into canonical records; they do not create another business-logic path.
- Cloud/database/object-store/queue work must implement existing ports and pass the same adapter contract suites.

Do not create another late-cascade application override stylesheet. Application selectors belong under `.app-shell` in `app-workspace.css` until the styling architecture issue replaces that layer deliberately.

## Required verification

Frontend:

```bash
cd frontend
npm ci
npm test
npm audit --omit=dev --audit-level=high
npm run build
```

MCP:

```bash
cd mcp
npm test
```

Python compatibility suite:

```bash
python -m pip install -r requirements.txt
python -m pip install pytest
pytest -q
```

Do not report completion when a required gate fails. Do not claim a social connector is production-complete without real credentials, authorization, posting, refresh, expiry, rejection, permission, and rate-limit verification.

## Product truth boundaries

- Real model provider required for campaign generation.
- Direct official connector code paths: LinkedIn, X, Reddit.
- Other destinations: review/copy/export/open-platform only.
- Saved campaigns: versioned browser-local Campaign records in the current product.
- Cloud database, account workspaces, collaboration, sync, object storage, durable jobs, and quotas: not implemented.
- OAuth sessions: encrypted HTTP-only cookies.
- Uploaded text/code: browser-extracted within current limits.
- Images/video: metadata references in the main route, not automatic visual understanding.
- Extension capability handshake: implemented.
- Acknowledged extension ingestion, screenshots, and recordings: not implemented.
- No automatic publish without explicit approval and destination API confirmation.

## UX rules

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

## Engineering rules

- Never commit credentials.
- Never expose server secrets through `NEXT_PUBLIC_` variables.
- Preserve confirmed-only publish success.
- Fail with useful warnings and truthful manual alternatives.
- Update README, agent guidance, architecture/capability docs, and public AI-context files whenever product truth changes.
- Keep changes reviewable and issues open when acceptance criteria are only partially complete.
- Prefer platform APIs and browser-native capabilities; do not add Playwright for product workflows.
