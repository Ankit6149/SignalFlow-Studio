# SignalFlow Studio

SignalFlow Studio is an open-source, review-first campaign workspace. It turns product notes, public links, repository context, and supported text/code files into editable drafts for twelve destinations while keeping generation, review, export, and publishing states explicit.

The active product **requires a real model provider**. Retired template, offline, prompt-only, and automatic fallback generation are rejected rather than presented as real campaign output.

## Current product flow

1. Add a campaign name, source brief, audience, public links, repository, and optional supported files.
2. Select destinations across social, community, video, and owned channels.
3. Choose an available model route for the current deployment/session.
4. Generate a staged campaign and destination-specific drafts.
5. Review and edit one authoritative current draft per channel.
6. Save in the current browser, export deterministic Markdown/JSON, copy/open a destination, or publish through a genuinely configured official connector.

## Destinations

- Social: LinkedIn, X, Instagram, Facebook, Threads
- Community: Reddit, Hacker News
- Video: YouTube, TikTok
- Owned: Newsletter, Blog, Release notes

LinkedIn, X, and Reddit have official OAuth connector code paths. Every other destination currently uses an explicit review, copy, export, and open-platform handoff.

## Generation routes

Supported adapters:

- Gemini
- OpenAI
- Claude
- OpenRouter
- Groq
- Custom OpenAI-compatible endpoint
- Ollama
- LM Studio

A route is usable only when `GET /api/capabilities` reports it available for the current deployment and session.

- Hosted non-owner sessions can use supported temporary personal keys where the provider allows them.
- Server-configured credentials and owner tools remain owner-only on protected/public hosted deployments.
- Custom, Ollama, and LM Studio routes are owner/trusted-local capabilities. Hosted local-model use requires a reachable trusted base URL.
- Temporary keys are request-scoped and excluded from saved campaigns.

## Storage and authoritative drafts

- Saved campaigns are browser-local in the current product. There is no cloud campaign database, cross-device sync, collaboration, or account workspace yet.
- Saved records use a versioned Campaign domain contract.
- Each channel has one authoritative current draft.
- Original generated text is optional revision history, never another active draft.
- Legacy browser-library records are migrated into the canonical contract when read.
- Clearing browser site data can remove the local library; export important campaigns first.

Markdown and JSON exports are projected from the same canonical Campaign snapshot. They include campaign/source/generation IDs, provider/model, snapshot timestamp, warnings, quality states, and the authoritative current drafts. Identical campaign state produces deterministic output.

## Deployment capability contract

`GET /api/capabilities` is the server-owned source of truth for hosted, local, and self-hosted profiles. It describes current-session permissions and availability for models, persistence, repositories, exports, connectors, MCP, extension capture, quotas, and owner tools.

Clients fail closed when a known capability is missing or discovery fails. “Configured” and “available to this session” are separate states.

See [docs/CAPABILITY_MATRIX.md](docs/CAPABILITY_MATRIX.md).

## Browser extension status

The extension is an experimental capture client. It can perform a versioned capability handshake with an open Studio tab.

**Acknowledged extension ingestion is not implemented yet.** The Send action remains disabled, and dispatching a tab message or DOM event is not reported as durable delivery. Screenshot, recording, review, upload queue, and store-release work remain tracked separately.

## MCP status

The `mcp/` package exposes:

- deployment capability discovery;
- provider status;
- provider connection testing;
- campaign creation through the canonical generation API.

MCP requires an explicitly configured SignalFlow base URL and any required workspace/provider credentials in the MCP environment. Secrets are not accepted from model-authored tool arguments unless the server route intentionally supports a temporary request key.

## Publishing truth

Direct publishing code exists for LinkedIn, X, and Reddit, but code presence is not production proof. A connector is complete only after:

- developer application and production credentials are configured;
- canonical callback URL and required products/scopes are approved;
- a real account authorizes;
- a real publish succeeds and is confirmed by the destination API;
- refresh, expiry, rejection, permission, and rate-limit behavior are verified.

SignalFlow reports direct success only after the destination API confirms it. No campaign is silently published.

See [docs/CONNECTOR_READINESS.md](docs/CONNECTOR_READINESS.md).

## Source handling boundaries

Implemented:

- written campaign brief and audience;
- public link extraction with bounded failure handling;
- public GitHub repository context;
- opt-in trusted local repository context on eligible local/self-hosted deployments;
- browser extraction for supported text, Markdown, CSV, JSON, and code files;
- image/video file metadata and user descriptions as planning references.

Not implemented in the active campaign route:

- automatic visual understanding of uploaded image/video content;
- durable cloud asset storage;
- extension screenshot/recording ingestion;
- background generation jobs.

## Quick start

Requirements:

- Node.js 22 (the CI version)
- npm
- Python 3.10 only for the retained Python test suite
- at least one real model provider route

```bash
cd frontend
npm ci
npm run dev
```

Open `http://localhost:3000`.

Copy `frontend/.env.example` to `frontend/.env.local` and configure the chosen provider. Never commit credentials or prefix server secrets with `NEXT_PUBLIC_`.

Protected hosted deployment example:

```text
SIGNALFLOW_ACCESS_KEY=use-a-long-private-value
SIGNALFLOW_PUBLIC_HOSTED=true
NEXTAUTH_URL=https://your-canonical-domain.example
```

## Verification

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

A change is not complete when only compilation succeeds. Relevant contract, regression, security, migration, and user-flow evidence must pass.

## Vercel

```text
Root Directory: frontend
Framework Preset: Next.js
Install Command: npm install
Build Command: npm run build
Output Directory: .next
```

## Repository map

- `frontend/app/page.js` — current Studio, Library, Connections, and Settings UI
- `frontend/app/api/capabilities/` — deployment/session capability document
- `frontend/app/api/launch_kit/` — canonical campaign generation route
- `frontend/app/api/social/` — OAuth status/connect/callback/disconnect routes
- `frontend/app/api/publish/` — confirmed-only publishing route
- `frontend/lib/domain/` — versioned records, invariants, serialization, and ports
- `frontend/lib/application/` — shared campaign use cases and composition roots
- `frontend/lib/infrastructure/` — browser, memory, and injected-store adapters
- `frontend/lib/export/campaignExport.mjs` — authoritative deterministic export projector
- `frontend/lib/context/` — repository, URL, and file context extraction
- `frontend/lib/ai/` — provider adapters, policy, and staged generation
- `frontend/lib/social/` — connector configuration, encrypted session handling, and providers
- `extension/` — experimental browser capture companion
- `mcp/` — supported MCP server package
- `docs/DOMAIN_ARCHITECTURE.md` — canonical domain/application/adapter boundaries
- `docs/CAPABILITY_MATRIX.md` — current deployment truth

## Product principles

- Review before publish
- One authoritative current draft per channel
- Real model routes only; no fake fallback output
- Browser-local and self-hostable today, cloud-ready through adapters
- Truthful capability, connector, extension, and success states
- No credential harvesting or platform bypasses
- Calm creative workspace rather than a crowded dashboard

Start with [AGENTS.md](AGENTS.md) before making repository changes. Security and ethics guidance is in [SECURITY.md](SECURITY.md).
