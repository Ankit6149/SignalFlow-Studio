# SignalFlow Studio

SignalFlow Studio is a review-first, local-first campaign workspace. Give it a product brief, public links, repository context, and text or code files; it creates one coherent campaign with editable drafts for twelve destinations.

The product is designed for founders, builders, maintainers, creators, and small teams that want a clear path from evidence to publishable content without hiding important decisions behind fake automation.

## Current Product Flow

1. Add a campaign name, source brief, audience, public links, repository, and optional files.
2. Select destinations across social, community, video, and owned channels.
3. Generate with the deterministic local template or a configured/BYOK model route.
4. Review and edit each channel in the Studio workspace.
5. Save locally, export Markdown/JSON, copy and open a platform, or publish through a configured official connector.

## Twelve Destinations

- Social: LinkedIn, X, Instagram, Facebook, Threads
- Community: Reddit, Hacker News
- Video: YouTube, TikTok
- Owned: Newsletter, Blog, Release notes

LinkedIn, X, and Reddit have official OAuth connector paths. Every other destination uses an explicit review, copy, export, and open-platform handoff.

## What Works Today

- Browser-based campaign composition and review
- Public link and public GitHub repository context extraction
- Browser extraction for supported text, Markdown, JSON, CSV, and code files
- Honest image/video asset references without pretending visual analysis occurred
- Deterministic no-key campaign generation
- Gemini, OpenAI, Claude, Groq, Ollama, LM Studio, and custom compatible model routes
- Automatic fallback generation when a provider route fails
- Editable drafts and platform character guidance
- Browser-local campaign library
- Markdown and JSON export
- Official connector architecture for LinkedIn, X, and Reddit
- Manual handoff flows for the remaining destinations
- Public Privacy, Terms, sitemap, structured data, `llms.txt`, and `llms-full.txt` surfaces

## Connector Completion Is Deliberately Explicit

Connector code existing is not the same as a connector being production-proven. A connector is complete only after all of these are true:

- Platform developer application created
- Production client ID and secret configured
- Canonical callback URL approved
- Required scopes approved
- A real account authorizes successfully
- A real test post is confirmed by the platform API
- Refresh and expired-session behavior is verified
- Rejection, permission, and rate-limit behavior is verified

See [docs/CONNECTOR_READINESS.md](docs/CONNECTOR_READINESS.md) for the exact checklist and current truth boundaries.

## Quick Start

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

Build verification:

```bash
cd frontend
npm run build
```

## Vercel

Use these settings:

```text
Root Directory: frontend
Framework Preset: Next.js
Install Command: npm install
Build Command: npm run build
Output Directory: .next
```

Copy `frontend/.env.example` to `.env.local` for local configuration. Never commit real secrets and never prefix server credentials with `NEXT_PUBLIC_`.

For a protected personal deployment:

```text
SIGNALFLOW_ACCESS_KEY=use-a-long-private-value
SIGNALFLOW_PUBLIC_HOSTED=true
NEXTAUTH_URL=https://your-canonical-domain.example
```

## Repository Map

- `frontend/app/page.js` — primary Studio, Library, Connections, and Settings experience
- `frontend/app/*.css` — visual system and responsive workspace layers
- `frontend/app/api/launch_kit/` — campaign generation route
- `frontend/app/api/social/` — OAuth status, connect, callback, and disconnect routes
- `frontend/app/api/publish/` — confirmed-only publishing route
- `frontend/lib/context/` — repository, URL, and file context extraction
- `frontend/lib/ai/` — model adapters and routing
- `frontend/lib/social/` — connector configuration, token storage, and providers
- `frontend/lib/package/` — campaign package normalization
- `extension/` — browser capture companion
- `docs/` — product, architecture, discoverability, UX, and connector documentation

## Agent and MCP Handoff

Start with [AGENTS.md](AGENTS.md). It gives coding agents the product truth, architecture map, build command, UX rules, and connector limitations.

For read-only GitHub MCP access, see [docs/GITHUB_MCP_READ_ONLY.md](docs/GITHUB_MCP_READ_ONLY.md). Repository files can document the required permissions and reading order, but an external coding client must still authorize its own GitHub MCP connection.

## Product Principles

- Review before publish
- Truthful connector and success states
- Useful without an API key
- Local-first by default
- No credential harvesting or platform bypasses
- Luxurious, creative, calm workspace rather than a crowded dashboard
- Advanced controls remain available without blocking the first successful run

Security and ethics: see [SECURITY.md](SECURITY.md).
