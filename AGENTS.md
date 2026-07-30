# SignalFlow Studio Agent Guide

## Mission

SignalFlow Studio turns product evidence into a coherent, editable multi-channel campaign. It must feel like a calm creative publishing room, not a project-management dashboard and not a fake autoposting demo.

The active product requires a real model route. Template, offline, prompt-only, and automatic fallback campaign generation are retired and must not be reintroduced through UI, API, MCP, tests, or documentation.

## Read this first

1. `README.md`
2. `docs/CAPABILITY_MATRIX.md`
3. `docs/DOMAIN_ARCHITECTURE.md`
4. `docs/CAMPAIGN_EDITING_AND_VERSIONING.md`
5. `docs/CAMPAIGN_SCHEMA_MIGRATION.md`
6. `docs/APP_WORKSPACE_SYSTEM.md`
7. `docs/STUDIO_UX_SYSTEM.md`
8. `docs/CONNECTOR_READINESS.md`
9. `docs/PRODUCT_GRADE_OPEN_SOURCE.md`
10. `SECURITY.md`

## Source of truth

- Product capability discovery: `frontend/app/api/capabilities/route.js`
- Domain records and portable serialization: `frontend/lib/domain/contracts.mjs`
- Campaign aggregate and migration: `frontend/lib/domain/campaign.mjs`
- Edit-safe reducer and editor revisions: `frontend/lib/studio/campaignState.mjs`
- Campaign/channel/action state selectors: `frontend/lib/studio/campaignStatus.mjs`
- Regeneration policies: `frontend/lib/studio/regenerationPolicy.mjs`
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
- Current edited draft content is authoritative. Each channel also keeps one generated baseline and optional revision history.
- A campaign title is never identity. Create/update/copy/read/delete operations use a stable `campaignId` allocated by the ID service.
- Persisted and protocol-crossing records require stable IDs and schema versions.
- Compatibility readers migrate into canonical records; they do not create another business-logic path.
- Cloud/database/object-store/queue work must implement existing ports and pass the same adapter contract suites.

## Campaign editing rules

- Never replace an edited draft silently.
- Full regeneration with edited drafts requires a deliberate policy: regenerate unedited only, archive and regenerate all, or cancel.
- Per-channel regeneration mutates only the requested channel.
- Failed or invalid regeneration must leave current drafts unchanged.
- Editing clears approval. Approval applies to the current revision.
- Copy, export, and publishing availability must come from shared selectors and show an actionable blocked reason.
- Save updates the current campaign ID. Save as copy must allocate a new ID and preserve the original.
- Restoring an archived version first archives the current version, keeping restore reversible.

Do not create another late-cascade application override stylesheet. Application selectors belong under `.app-shell`; campaign status/version rules are currently isolated in `campaign-versioning.css` until the styling architecture issue replaces these layers deliberately.

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
- Stable IDs, duplicate-title coexistence, save changes, save as copy, edit-safe regeneration, approvals, and local version archives are implemented.
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
- Keep review focused on one channel, with visible route, status, limits, versions, and deliberate actions.
- Persistent state must not rely only on temporary toasts.
- Dialogs must support keyboard cancellation and visible focus; statuses must have screen-reader text.
- Avoid neon, glass overload, heavy gradients, and generic admin-dashboard patterns.

## Engineering rules

- Never commit credentials.
- Never expose server secrets through `NEXT_PUBLIC_` variables.
- Preserve confirmed-only publish success.
- Fail with useful warnings and truthful manual alternatives.
- Update README, agent guidance, architecture/capability docs, and public AI-context files whenever product truth changes.
- Keep changes reviewable and issues open when acceptance criteria are only partially complete.
- Prefer platform APIs and browser-native capabilities; do not add Playwright for product workflows.
