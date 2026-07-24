from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content.strip() + "\n", encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    target = ROOT / path
    content = target.read_text(encoding="utf-8")
    if old not in content:
        raise RuntimeError(f"Expected snippet not found in {path}: {old[:120]!r}")
    target.write_text(content.replace(old, new, 1), encoding="utf-8")


write(
    "README.md",
    r'''
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
''',
)

write(
    "AGENTS.md",
    r'''
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
''',
)

write(
    ".github/copilot-instructions.md",
    r'''
Read `AGENTS.md` before changing SignalFlow Studio. Preserve review-first publishing, truthful connector states, local-first storage, and the warm luxurious creative direction. Use `rem` for Studio UI dimensions, avoid tiny functional text, run `cd frontend && npm run build`, and never claim a connector is complete without live external verification.
''',
)

write(
    "docs/STUDIO_UX_SYSTEM.md",
    r'''
# Studio UX and Visual System

## Experience Goal

The Studio should feel like a luxurious creative writing room: calm, rich, focused, and confident. It should not feel like a crowded admin dashboard. The landing page can be expressive; the workspace must be denser, clearer, and more operational.

## Workflow Architecture

### Compose

1. **Source** — campaign name, source brief, links, repository, files, optional audience/model controls.
2. **Destinations** — grouped Social, Community, Video, and Owned channels.
3. **Generate** — a single visible command with a concise readiness summary.

### Review

- A destination rail switches between generated outputs.
- The editor is the visual centre.
- A side inspector shows route, character guidance, connector state, and source facts.
- Save, copy, open, export, and publish actions stay deliberate and consistently placed.
- The original brief is available by returning to Compose, not permanently occupying half of the review screen.

## `rem` Type Scale

| Role | Size |
|---|---:|
| Metadata | `0.75rem` |
| Supporting copy | `0.8125rem` |
| Body and controls | `0.875rem`–`0.9375rem` |
| Section title | `1.125rem`–`1.375rem` |
| Workspace title | `clamp(2rem, 3.2vw, 3.25rem)` |

Functional copy should not fall below `0.75rem` except decorative marks with an accessible label.

## Density

- Header target: `4rem`
- Standard field target: about `2.875rem`
- Standard button target: `2.75rem`
- Panel padding: `1.25rem`–`1.5rem`
- Panel radius: `1.125rem`–`1.375rem`
- Main textarea default: `9rem`–`10rem`, user-resizable

## Responsive Intent

- Above `86rem`: balanced two-column compose layout.
- At or below `86rem`: single-column compose layout for common laptops and high display scaling.
- Review uses a three-zone workspace on wide screens and collapses to two/one zones progressively.
- At low viewport height, reduce decorative vertical space before reducing readable text.

## Visual Language

- Warm paper canvas
- Obsidian command surfaces
- Champagne as the main highlight
- Coral for directional links and warnings
- Sage for confirmed states
- Soft shadows, subtle gradients, and tonal borders
- Playfair Display for selective identity moments
- DM Sans/Manrope for operational UI

## Interaction Principles

- Avoid nested vertical scroll areas when the page can scroll naturally.
- Do not permanently overlay a large command bar on laptop content.
- Make the current stage and next action obvious.
- Keep advanced model/provider settings collapsed by default.
- Use truthful language: configured, connected, expired, needs live test, manual handoff.
''',
)

write(
    "docs/CONNECTOR_READINESS.md",
    r'''
# Official Connector Readiness

SignalFlow Studio implements official connector paths for LinkedIn, X, and Reddit. Implementation, configuration, authorization, and production verification are separate states.

## Definition of Done

A connector is production-complete only after:

1. Developer application exists.
2. Production client ID and secret are configured server-side.
3. Canonical callback URL is registered exactly.
4. Required scopes/products are approved.
5. A real account completes OAuth.
6. A real approved test post receives platform confirmation.
7. Access-token expiry and refresh behavior are verified.
8. Missing permission, revoked token, invalid content, and rate-limit responses are verified.
9. The UI reports truthful failure and provides a manual fallback.

## Canonical Environment

```text
NEXTAUTH_URL=https://signal-flow-studio.vercel.app
SIGNALFLOW_ACCESS_KEY=<private owner key>
SIGNALFLOW_PUBLIC_HOSTED=true
SOCIAL_ENCRYPTION_KEY=<independent long random value>
```

### LinkedIn

```text
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
LINKEDIN_API_VERSION=202607
Callback: https://signal-flow-studio.vercel.app/api/social/callback/linkedin
Scopes: openid profile w_member_social
Products: Sign In with LinkedIn using OpenID Connect; Share on LinkedIn
```

### X

```text
X_CLIENT_ID=
X_CLIENT_SECRET=
Callback: https://signal-flow-studio.vercel.app/api/social/callback/x
Scopes: tweet.read tweet.write users.read offline.access
Authentication: OAuth 2.0 Authorization Code with PKCE
```

### Reddit

```text
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=
Callback: https://signal-flow-studio.vercel.app/api/social/callback/reddit
Scopes: identity submit read
Application type: web app
```

## Live Verification Protocol

Use a dedicated test account and clearly disposable test content.

### Authorization

- Connect from the owner-only Connections page.
- Confirm the returned profile belongs to the intended account.
- Verify the callback uses the canonical production origin.
- Confirm raw tokens never appear in browser JavaScript or logs.

### Publish

- Generate a short, non-sensitive draft.
- Review and explicitly approve it.
- Publish one post.
- Confirm SignalFlow only reports success after the platform response.
- Open the returned post URL and verify the content.
- Delete the test post from the platform when finished.

### Expiry and Refresh

- Test a session without a refresh token and verify reconnect guidance.
- Test an expired session with a refresh token and verify renewal.
- Revoke authorization at the platform and verify the next publish fails safely.
- Confirm refreshed token data is written back only to the encrypted HTTP-only cookie.

### Rejection and Rate Limit

Verify that the UI distinguishes:

- `401`: expired or revoked authorization
- `403`: missing product/scope/permission
- `404`: endpoint/resource mismatch
- `409`/`422`: content or platform validation rejection
- `429`: rate limited, including `Retry-After` when supplied
- `5xx`: platform temporary failure

Every failure should preserve the draft and offer copy/manual publication.

## Current Status

- Code path: implemented for LinkedIn, X, Reddit
- Credential configuration: deployment-dependent
- Approved callbacks/scopes: platform-dashboard dependent
- Live account authorization: requires owner action
- Real post verification: requires owner action
- Expiry/refresh verification: requires live connected sessions
- Rejection/rate-limit handling: normalized in code; external responses still require live verification

Never replace these distinctions with a single "connected" or "done" claim.
''',
)

write(
    "docs/GITHUB_MCP_READ_ONLY.md",
    r'''
# GitHub MCP Read-Only Access

The repository is public, and a GitHub-connected coding client can use it as a read-only source of truth. Repository files cannot silently authorize an external client; the client must connect its own GitHub MCP integration.

## Minimum Permissions

For a fine-grained GitHub token or GitHub App connection, limit access to this repository and prefer:

- Repository metadata: read-only
- Contents: read-only
- Pull requests: read-only, optional
- Issues: read-only, optional
- Actions: read-only only when build logs are needed

Do not grant Administration, Secrets, Environments, Deployments write, Actions write, or Contents write for a reading agent.

Never put a token in this repository, an agent prompt, `.env.example`, screenshots, or documentation.

## Reading Order for an Agent

1. `AGENTS.md`
2. `README.md`
3. `docs/STUDIO_UX_SYSTEM.md`
4. `docs/CONNECTOR_READINESS.md`
5. `frontend/app/page.js`
6. `frontend/app/studio-luxury.css`
7. `frontend/app/api/launch_kit/route.js`
8. `frontend/app/api/social/` and `frontend/lib/social/`
9. `SECURITY.md`

## Suggested Agent Instruction

```text
Use GitHub MCP in read-only mode for Ankit6149/SignalFlow-Studio. Read AGENTS.md and the linked product documents first. Treat master as the source of truth. Do not modify files, create branches, open pull requests, change settings, or access secrets. Report architecture, current capabilities, limitations, and relevant file paths with evidence.
```

## What Read-Only MCP Solves

- Accurate repository navigation
- Current architecture and implementation context
- File-backed product truth
- Reduced dependence on very long prompts
- Easier handoff between Codex, Claude, Gemini/Antigravity, or another coding client

It does not provide deployment credentials, social developer applications, OAuth approval, or permission to publish.
''',
)

write(
    "frontend/app/studio-luxury.css",
    r'''
/* Studio-specific professional UX layer. Uses rem units and intentionally overrides older pixel-heavy workspace rules. */

:root {
  --sf-space-1: 0.25rem;
  --sf-space-2: 0.5rem;
  --sf-space-3: 0.75rem;
  --sf-space-4: 1rem;
  --sf-space-5: 1.25rem;
  --sf-space-6: 1.5rem;
  --sf-space-8: 2rem;
  --sf-space-10: 2.5rem;
  --sf-type-meta: 0.75rem;
  --sf-type-support: 0.8125rem;
  --sf-type-body: 0.9375rem;
  --sf-type-section: 1.125rem;
  --sf-control: 2.875rem;
  --sf-header: 4rem;
  --sf-panel-radius: 1.25rem;
  --sf-workspace-shadow: 0 1.5rem 4rem rgba(17, 17, 15, 0.075);
}

.app-shell {
  background:
    radial-gradient(circle at 8% 12%, rgba(216, 189, 124, 0.13), transparent 24rem),
    radial-gradient(circle at 92% 28%, rgba(201, 120, 93, 0.08), transparent 26rem),
    var(--paper);
}

.app-header {
  height: var(--sf-header);
  padding: 0 clamp(1rem, 2.5vw, 2rem);
  box-shadow: 0 0.65rem 2.1rem rgba(17, 17, 15, 0.11);
}

.app-nav button {
  min-width: 5rem;
  padding: 0.55rem 0.9rem;
  font-size: var(--sf-type-support);
}

.app-header__status {
  font-size: var(--sf-type-meta);
}

.studio-page,
.secondary-page {
  width: min(92rem, calc(100% - 2.5rem));
  padding: 2.25rem 0 6.5rem;
}

.studio-heading,
.secondary-heading {
  align-items: flex-start;
  margin-bottom: 1.5rem;
}

.studio-heading > div,
.secondary-heading > div {
  max-width: 52rem;
}

.studio-heading h1,
.secondary-heading h1 {
  max-width: 48rem;
  font-size: clamp(2.1rem, 3.35vw, 3.25rem);
  line-height: 1.02;
}

.studio-heading p:last-child,
.secondary-heading p:last-child {
  max-width: 44rem;
  margin-top: 0.85rem;
  font-size: var(--sf-type-body);
  line-height: 1.6;
}

.studio-heading .eyebrow,
.secondary-heading .eyebrow {
  margin-bottom: 0.9rem;
  font-size: var(--sf-type-meta);
}

.studio-flow {
  margin-bottom: 1rem;
  padding: 0.45rem;
  border: 0.0625rem solid rgba(23, 23, 20, 0.11);
  border-radius: 1.125rem;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.4rem;
  background: rgba(255, 253, 248, 0.58);
  box-shadow: 0 1rem 2.5rem rgba(17, 17, 15, 0.035);
  backdrop-filter: blur(1rem);
}

.studio-flow button {
  min-width: 0;
  min-height: 3.25rem;
  padding: 0.65rem 0.9rem;
  border: 0;
  border-radius: 0.85rem;
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 0.75rem;
  text-align: left;
  background: transparent;
  color: rgba(23, 23, 20, 0.56);
  cursor: pointer;
}

.studio-flow button:hover,
.studio-flow button.is-active {
  background: var(--white);
  color: var(--ink);
  box-shadow: 0 0.75rem 2rem rgba(17, 17, 15, 0.065);
}

.studio-flow__index {
  width: 1.9rem;
  height: 1.9rem;
  border: 0.0625rem solid rgba(23, 23, 20, 0.14);
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: var(--coral);
  font-family: "Playfair Display", serif;
  font-size: 0.8rem;
  font-style: italic;
}

.studio-flow strong,
.studio-flow small {
  display: block;
}

.studio-flow strong {
  font-size: var(--sf-type-support);
}

.studio-flow small {
  margin-top: 0.15rem;
  color: rgba(23, 23, 20, 0.48);
  font-size: var(--sf-type-meta);
}

.studio-grid {
  grid-template-columns: minmax(0, 1.08fr) minmax(24rem, 0.92fr);
  gap: 1rem;
}

.panel {
  border-color: rgba(23, 23, 20, 0.12);
  border-radius: var(--sf-panel-radius);
  background:
    linear-gradient(145deg, rgba(255, 253, 248, 0.92), rgba(247, 242, 232, 0.78));
  box-shadow: var(--sf-workspace-shadow);
}

.composer-panel,
.output-panel {
  padding: var(--sf-space-6);
}

.panel-kicker {
  margin-bottom: 1.25rem;
  gap: 0.65rem;
  font-size: var(--sf-type-meta);
  letter-spacing: 0.12em;
}

.panel-kicker > span {
  width: 2rem;
  height: 2rem;
  font-size: 0.85rem;
}

.panel-kicker b {
  color: rgba(23, 23, 20, 0.65);
  font-family: "Manrope", sans-serif;
  font-size: var(--sf-type-meta);
}

.panel-kicker--with-actions button {
  padding: 0.45rem 0.75rem;
  font-size: var(--sf-type-meta);
}

.field {
  gap: 0.55rem;
  margin-bottom: 1rem;
}

.field > span {
  font-size: var(--sf-type-support);
  line-height: 1.35;
}

.field input,
.field textarea,
.field select,
.settings-form input {
  min-height: var(--sf-control);
  border-radius: 0.8rem;
  padding: 0.78rem 0.9rem;
  font-size: var(--sf-type-body);
}

.field textarea {
  min-height: 9.5rem;
  line-height: 1.6;
}

.field .compact-textarea {
  min-height: 5.25rem;
}

.field small {
  font-size: var(--sf-type-meta);
}

.source-grid {
  gap: 0.85rem;
}

.upload-zone {
  min-height: 4.75rem;
  padding: 0.9rem;
  border-radius: 0.9rem;
  gap: 0.8rem;
}

.upload-zone__icon {
  width: 2.5rem;
  height: 2.5rem;
  font-size: 1.1rem;
}

.upload-zone strong {
  font-size: var(--sf-type-support);
}

.upload-zone span,
.text-button,
.file-chip {
  font-size: var(--sf-type-meta);
}

.advanced-toggle {
  margin-top: 1.25rem;
  padding: 1rem 0 0.25rem;
  font-size: var(--sf-type-support);
}

.advanced-panel {
  margin-top: 0.8rem;
  padding: 1rem;
  border: 0.0625rem solid rgba(23, 23, 20, 0.08);
  border-radius: 1rem;
}

.channel-groups {
  display: grid;
  gap: 1rem;
}

.channel-group {
  padding-top: 0.95rem;
  border-top: 0.0625rem solid rgba(23, 23, 20, 0.1);
}

.channel-group:first-child {
  padding-top: 0;
  border-top: 0;
}

.channel-group__header {
  margin-bottom: 0.65rem;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
}

.channel-group__header strong,
.channel-group__header small {
  display: block;
}

.channel-group__header strong {
  font-family: "Manrope", sans-serif;
  font-size: var(--sf-type-support);
}

.channel-group__header small,
.channel-group__header > span {
  margin-top: 0.18rem;
  color: rgba(23, 23, 20, 0.46);
  font-size: var(--sf-type-meta);
}

.channel-picker {
  max-height: none;
  padding-right: 0;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.55rem;
  overflow: visible;
}

.channel-option {
  min-height: 4.25rem;
  padding: 0.7rem;
  border-radius: 0.85rem;
  gap: 0.65rem;
}

.channel-option__mark {
  width: 2.25rem;
  height: 2.25rem;
}

.channel-option strong {
  font-size: var(--sf-type-support);
}

.channel-option small {
  margin-top: 0.18rem;
  font-size: var(--sf-type-meta);
  line-height: 1.35;
}

.output-empty {
  min-height: auto;
  padding: 1.25rem 0 0;
  align-items: stretch;
  text-align: left;
}

.compose-readiness {
  padding: 1.1rem;
  border: 0.0625rem solid rgba(23, 23, 20, 0.1);
  border-radius: 1rem;
  background:
    radial-gradient(circle at 88% 12%, rgba(216, 189, 124, 0.2), transparent 11rem),
    rgba(255, 255, 255, 0.48);
}

.compose-readiness__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.compose-readiness__top span {
  color: var(--coral);
  font-size: var(--sf-type-meta);
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.compose-readiness__top b {
  padding: 0.35rem 0.55rem;
  border-radius: 999rem;
  background: rgba(139, 90, 34, 0.1);
  color: var(--warning);
  font-size: var(--sf-type-meta);
}

.compose-readiness__top b.is-ready {
  background: rgba(49, 95, 72, 0.1);
  color: var(--success);
}

.compose-readiness h3 {
  margin: 0.75rem 0 0;
  font-family: "Playfair Display", serif;
  font-size: 1.65rem;
  font-weight: 500;
}

.compose-readiness > p {
  margin: 0.5rem 0 0;
  color: rgba(23, 23, 20, 0.56);
  font-size: var(--sf-type-support);
  line-height: 1.6;
}

.compose-readiness__metrics {
  margin-top: 1rem;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.55rem;
}

.compose-readiness__metrics div {
  min-width: 0;
  padding: 0.75rem;
  border-radius: 0.8rem;
  background: rgba(243, 239, 229, 0.72);
}

.compose-readiness__metrics strong,
.compose-readiness__metrics span {
  display: block;
}

.compose-readiness__metrics strong {
  font-family: "Playfair Display", serif;
  font-size: 1.15rem;
  font-weight: 500;
}

.compose-readiness__metrics span {
  margin-top: 0.18rem;
  color: rgba(23, 23, 20, 0.48);
  font-size: var(--sf-type-meta);
}

.studio-actionbar {
  position: sticky;
  left: auto;
  bottom: 1rem;
  transform: none;
  width: min(58rem, 100%);
  min-height: 4rem;
  margin: 1rem auto 0;
  padding: 0.55rem 0.65rem 0.55rem 1rem;
  border-radius: 1.15rem;
}

.studio-actionbar > div {
  gap: 0.7rem;
  font-size: var(--sf-type-meta);
}

.studio-actionbar .button {
  min-height: 2.9rem;
  padding-inline: 1.25rem;
  font-size: var(--sf-type-support);
}

.studio-grid--review {
  grid-template-columns: minmax(0, 1fr);
}

.studio-grid--review .composer-panel {
  display: none;
}

.studio-grid--review .output-panel {
  padding: 1.25rem;
}

.studio-grid--review .channel-groups,
.studio-grid--review > .output-panel > .panel-kicker {
  display: none;
}

.review-workspace {
  margin-top: 0;
  display: grid;
  grid-template-columns: 13rem minmax(0, 1fr) 17rem;
  gap: 1rem;
  align-items: start;
}

.review-tabs {
  grid-column: 1;
  grid-row: 1 / span 8;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  overflow: visible;
}

.review-tabs button {
  width: 100%;
  min-height: 2.8rem;
  padding: 0.55rem 0.7rem;
  justify-content: flex-start;
  border-radius: 0.75rem;
  font-size: var(--sf-type-support);
}

.review-tabs button span {
  width: 1.75rem;
  height: 1.75rem;
}

.review-nav {
  grid-column: 2;
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
}

.review-nav button {
  min-height: 2.5rem;
  padding: 0 0.85rem;
  border: 0.0625rem solid var(--line);
  border-radius: 999rem;
  background: rgba(255, 255, 255, 0.58);
  font-size: var(--sf-type-meta);
  font-weight: 800;
  cursor: pointer;
}

.native-preview {
  grid-column: 2;
  margin-top: 0;
  border-radius: 1rem;
}

.native-preview header {
  padding: 0.95rem;
}

.native-preview header strong {
  font-size: var(--sf-type-support);
}

.native-preview header div:nth-child(2) span,
.connection-badge,
.native-preview footer,
.character-guide {
  font-size: var(--sf-type-meta);
}

.native-preview textarea {
  min-height: 25rem;
  padding: 1.25rem;
  font-size: var(--sf-type-body);
  line-height: 1.72;
}

.review-inspector {
  grid-column: 3;
  grid-row: 1 / span 3;
  padding: 1rem;
  border: 0.0625rem solid rgba(23, 23, 20, 0.11);
  border-radius: 1rem;
  background: rgba(255, 253, 248, 0.75);
  position: sticky;
  top: calc(var(--sf-header) + 1rem);
}

.review-inspector__eyebrow {
  color: var(--coral);
  font-size: var(--sf-type-meta);
  font-weight: 800;
  letter-spacing: 0.11em;
  text-transform: uppercase;
}

.review-inspector h3 {
  margin: 0.55rem 0 0.85rem;
  font-family: "Playfair Display", serif;
  font-size: 1.55rem;
  font-weight: 500;
}

.review-inspector dl {
  margin: 0;
  display: grid;
  gap: 0.75rem;
}

.review-inspector dl div {
  padding-top: 0.7rem;
  border-top: 0.0625rem solid rgba(23, 23, 20, 0.09);
}

.review-inspector dt,
.review-inspector dd {
  margin: 0;
}

.review-inspector dt {
  color: rgba(23, 23, 20, 0.46);
  font-size: var(--sf-type-meta);
}

.review-inspector dd {
  margin-top: 0.2rem;
  font-size: var(--sf-type-support);
  line-height: 1.45;
}

.review-actions {
  grid-column: 2;
  margin-top: 0;
}

.review-actions .button {
  min-height: 2.75rem;
  font-size: var(--sf-type-support);
}

.review-workspace > .publishing-route-link,
.review-workspace > .route-note,
.review-workspace > .export-row {
  grid-column: 3;
}

.publishing-route-link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: var(--sf-type-meta);
  line-height: 1.45;
}

.publishing-route-link svg {
  width: 1rem;
}

.route-note summary,
.route-note ul,
.export-row strong,
.export-row span,
.export-row button {
  font-size: var(--sf-type-meta);
}

.connector-readiness {
  margin: 1rem 0;
  padding: 1rem;
  border: 0.0625rem solid rgba(23, 23, 20, 0.11);
  border-radius: 1.125rem;
  background: linear-gradient(135deg, rgba(255, 253, 248, 0.85), rgba(232, 225, 211, 0.62));
}

.connector-readiness__heading {
  margin-bottom: 0.8rem;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
}

.connector-readiness__heading h2 {
  margin: 0;
  font-family: "Playfair Display", serif;
  font-size: 1.55rem;
  font-weight: 500;
}

.connector-readiness__heading p {
  max-width: 38rem;
  margin: 0;
  color: rgba(23, 23, 20, 0.52);
  font-size: var(--sf-type-support);
}

.connector-readiness__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.65rem;
}

.connector-readiness__card {
  padding: 0.9rem;
  border: 0.0625rem solid rgba(23, 23, 20, 0.1);
  border-radius: 0.9rem;
  background: rgba(255, 255, 255, 0.5);
}

.connector-readiness__card header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.connector-readiness__card h3 {
  margin: 0;
  font-size: var(--sf-type-support);
}

.readiness-state {
  padding: 0.3rem 0.5rem;
  border-radius: 999rem;
  background: rgba(139, 90, 34, 0.1);
  color: var(--warning);
  font-size: var(--sf-type-meta);
  font-weight: 800;
}

.readiness-state.is-ready {
  background: rgba(49, 95, 72, 0.1);
  color: var(--success);
}

.connector-readiness__card ul {
  margin: 0.75rem 0 0;
  padding: 0;
  display: grid;
  gap: 0.45rem;
  list-style: none;
}

.connector-readiness__card li {
  color: rgba(23, 23, 20, 0.57);
  font-size: var(--sf-type-meta);
  line-height: 1.45;
}

.connector-readiness__card code {
  font-size: 0.7rem;
  overflow-wrap: anywhere;
}

@media (max-width: 86rem) {
  .studio-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .output-panel {
    min-height: auto;
  }

  .studio-heading h1,
  .secondary-heading h1 {
    font-size: clamp(2rem, 4vw, 2.75rem);
  }
}

@media (max-width: 72rem) {
  .review-workspace {
    grid-template-columns: 10.5rem minmax(0, 1fr);
  }

  .review-inspector,
  .review-workspace > .publishing-route-link,
  .review-workspace > .route-note,
  .review-workspace > .export-row {
    grid-column: 2;
    position: static;
  }

  .connector-readiness__grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 48rem) {
  :root {
    --sf-header: 4.5rem;
  }

  .studio-page,
  .secondary-page {
    width: min(100% - 1.25rem, 92rem);
    padding-top: 1.5rem;
  }

  .studio-flow {
    grid-template-columns: 1fr;
  }

  .studio-flow small {
    display: none;
  }

  .composer-panel,
  .output-panel,
  .studio-grid--review .output-panel {
    padding: 1rem;
  }

  .source-grid,
  .channel-picker,
  .compose-readiness__metrics {
    grid-template-columns: 1fr;
  }

  .review-workspace {
    grid-template-columns: minmax(0, 1fr);
  }

  .review-tabs {
    grid-column: 1;
    grid-row: auto;
    flex-direction: row;
    overflow-x: auto;
    padding-bottom: 0.45rem;
  }

  .review-tabs button {
    width: auto;
    flex: 0 0 auto;
  }

  .review-nav,
  .native-preview,
  .review-inspector,
  .review-actions,
  .review-workspace > .publishing-route-link,
  .review-workspace > .route-note,
  .review-workspace > .export-row {
    grid-column: 1;
  }

  .native-preview textarea {
    min-height: 21rem;
  }

  .studio-actionbar {
    bottom: 0.5rem;
    padding: 0.5rem;
  }
}

@media (max-height: 50rem) and (min-width: 48.01rem) {
  :root {
    --sf-header: 3.75rem;
  }

  .studio-page,
  .secondary-page {
    padding-top: 1.5rem;
  }

  .studio-heading,
  .secondary-heading {
    margin-bottom: 1rem;
  }

  .studio-heading h1,
  .secondary-heading h1 {
    font-size: clamp(1.9rem, 3vw, 2.6rem);
  }

  .field textarea {
    min-height: 8rem;
  }

  .studio-actionbar {
    bottom: 0.5rem;
  }
}
''',
)

replace_once(
    "frontend/app/layout.js",
    'import "../app/professional-polish.css";\n',
    'import "../app/professional-polish.css";\nimport "../app/studio-luxury.css";\n',
)

replace_once(
    "frontend/app/page.js",
    'const DEFAULT_CHANNELS = ["linkedin", "x", "instagram", "reddit", "newsletter"];\n',
    '''const DEFAULT_CHANNELS = ["linkedin", "x", "instagram", "reddit", "newsletter"];

const CHANNEL_GROUPS = [
  {
    id: "social",
    label: "Social",
    description: "Daily feeds and professional networks",
    channels: ["linkedin", "x", "instagram", "facebook", "threads"],
  },
  {
    id: "community",
    label: "Community",
    description: "Conversation-led technical communities",
    channels: ["reddit", "hackernews"],
  },
  {
    id: "video",
    label: "Video",
    description: "Titles, hooks, descriptions, and direction",
    channels: ["youtube", "tiktok"],
  },
  {
    id: "owned",
    label: "Owned",
    description: "Long-form channels you control",
    channels: ["newsletter", "blog", "release_notes"],
  },
];
''',
)

replace_once(
    "frontend/app/page.js",
    '  const isOverLimit = Boolean(activeMeta.limit && currentPost.length > activeMeta.limit);\n',
    '''  const isOverLimit = Boolean(activeMeta.limit && currentPost.length > activeMeta.limit);
  const sourceSignals = [
    form.notes.trim(),
    form.links.trim(),
    form.repo.trim(),
    ...documentText,
  ].filter(Boolean).length;
  const composeReady = sourceSignals > 0 && channels.length > 0;
  const connectedOfficialCount = Array.from(OFFICIAL_CONNECTORS).filter(
    (id) => connections[id]?.connected && !connections[id]?.expired,
  ).length;
  const reviewIndex = Math.max(0, channels.indexOf(activeChannel));
''',
)

replace_once(
    "frontend/app/page.js",
    '''  function selectAllChannels() {
    setChannels(CHANNELS.map((channel) => channel.id));
  }
''',
    '''  function selectAllChannels() {
    setChannels(CHANNELS.map((channel) => channel.id));
  }

  function moveReviewChannel(direction) {
    if (!channels.length) return;
    const nextIndex = (reviewIndex + direction + channels.length) % channels.length;
    setActiveChannel(channels[nextIndex]);
  }
''',
)

replace_once(
    "frontend/app/page.js",
    '<main className="studio-page" id="workspace-content">',
    '<main className="studio-page" id="workspace-content" data-stage={stage}>',
)

replace_once(
    "frontend/app/page.js",
    '''          </header>

          <div className={`studio-grid ${stage === "review" ? "studio-grid--review" : ""}`}>
            <section className="panel composer-panel">''',
    '''          </header>

          <nav className="studio-flow" aria-label="Campaign creation steps">
            <button
              type="button"
              className={stage === "compose" ? "is-active" : ""}
              onClick={() => document.getElementById("campaign-source")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            >
              <span className="studio-flow__index">01</span>
              <span><strong>Source</strong><small>Bring the facts and proof</small></span>
            </button>
            <button
              type="button"
              className={stage === "compose" ? "is-active" : ""}
              onClick={() => document.getElementById("campaign-destinations")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            >
              <span className="studio-flow__index">02</span>
              <span><strong>Destinations</strong><small>Choose where the story travels</small></span>
            </button>
            <button
              type="button"
              className={stage === "review" ? "is-active" : ""}
              onClick={() => document.getElementById("campaign-command")?.scrollIntoView({ behavior: "smooth", block: "end" })}
            >
              <span className="studio-flow__index">03</span>
              <span><strong>{stage === "review" ? "Review" : "Generate"}</strong><small>{stage === "review" ? "Shape and route every draft" : "Build the campaign package"}</small></span>
            </button>
          </nav>

          <div className={`studio-grid ${stage === "review" ? "studio-grid--review" : ""}`}>
            <section className="panel composer-panel" id="campaign-source">''',
)

replace_once(
    "frontend/app/page.js",
    '<section className="panel output-panel">\n              <div className="panel-kicker panel-kicker--with-actions">',
    '<section className="panel output-panel" id="campaign-destinations">\n              <div className="panel-kicker panel-kicker--with-actions">',
)

old_picker = '''              <div className="channel-picker">
                {CHANNELS.map((channel) => {
                  const selected = channels.includes(channel.id);
                  return (
                    <button
                      key={channel.id}
                      className={selected ? "channel-option is-selected" : "channel-option"}
                      onClick={() => toggleChannel(channel.id)}
                      aria-pressed={selected}
                    >
                      <span className="channel-option__mark">
                        <PlatformIcon platform={channel.id} size={18} branded={!selected} />
                      </span>
                      <span>
                        <strong>{channel.label}</strong>
                        <small>{channel.tone}</small>
                      </span>
                      <i>{selected ? "✓" : "+"}</i>
                    </button>
                  );
                })}
              </div>'''

new_picker = '''              <div className="channel-groups">
                {CHANNEL_GROUPS.map((group) => {
                  const groupChannels = group.channels.map(channelMeta);
                  const selectedCount = groupChannels.filter((channel) => channels.includes(channel.id)).length;
                  return (
                    <section className="channel-group" key={group.id} aria-labelledby={`channel-group-${group.id}`}>
                      <header className="channel-group__header">
                        <div>
                          <strong id={`channel-group-${group.id}`}>{group.label}</strong>
                          <small>{group.description}</small>
                        </div>
                        <span>{selectedCount}/{groupChannels.length} selected</span>
                      </header>
                      <div className="channel-picker">
                        {groupChannels.map((channel) => {
                          const selected = channels.includes(channel.id);
                          return (
                            <button
                              key={channel.id}
                              className={selected ? "channel-option is-selected" : "channel-option"}
                              onClick={() => toggleChannel(channel.id)}
                              aria-pressed={selected}
                            >
                              <span className="channel-option__mark">
                                <PlatformIcon platform={channel.id} size={18} branded={!selected} />
                              </span>
                              <span>
                                <strong>{channel.label}</strong>
                                <small>{channel.tone}</small>
                              </span>
                              <i>{selected ? "✓" : "+"}</i>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </div>'''
replace_once("frontend/app/page.js", old_picker, new_picker)

old_empty = '''                <div className="output-empty">
                  <div className="output-empty__art">
                    <div className="ghost-post ghost-post--one">
                      <span />
                      <i />
                      <i />
                      <i />
                    </div>
                    <div className="ghost-post ghost-post--two">
                      <span />
                      <i />
                      <i />
                    </div>
                    <div className="ghost-post ghost-post--three">
                      <span />
                      <i />
                      <i />
                      <i />
                    </div>
                  </div>
                  <h3>Your campaign will appear here.</h3>
                  <p>
                    SignalFlow creates editable drafts, platform guidance, media direction, warnings,
                    and export files from the same brief.
                  </p>
                </div>'''

new_empty = '''                <div className="output-empty">
                  <div className="compose-readiness">
                    <div className="compose-readiness__top">
                      <div>
                        <span>Campaign readiness</span>
                        <h3>{composeReady ? "Ready to shape the campaign." : "Bring one strong source signal."}</h3>
                      </div>
                      <b className={composeReady ? "is-ready" : ""}>{composeReady ? "Ready" : "Needs source"}</b>
                    </div>
                    <p>
                      {composeReady
                        ? "SignalFlow has enough context to build editable drafts. You remain in control of every output and publishing step."
                        : "Add a brief, public link, repository, or extractable text file. Keep the first run simple; advanced model controls can stay closed."}
                    </p>
                    <div className="compose-readiness__metrics">
                      <div><strong>{sourceSignals}</strong><span>source signals</span></div>
                      <div><strong>{channels.length}</strong><span>destinations</span></div>
                      <div><strong>{provider.label}</strong><span>generation route</span></div>
                    </div>
                  </div>
                </div>'''
replace_once("frontend/app/page.js", old_empty, new_empty)

replace_once(
    "frontend/app/page.js",
    '''                  </div>

                  <div className={`native-preview native-preview--${activeChannel}`}>''',
    '''                  </div>

                  <div className="review-nav" aria-label="Move between campaign drafts">
                    <button type="button" onClick={() => moveReviewChannel(-1)}>← Previous</button>
                    <button type="button" onClick={() => moveReviewChannel(1)}>Next →</button>
                  </div>

                  <div className={`native-preview native-preview--${activeChannel}`}>''',
)

replace_once(
    "frontend/app/page.js",
    '''                  </div>

                  <div className="review-actions">''',
    '''                  </div>

                  <aside className="review-inspector" aria-label={`${activeMeta.label} draft guidance`}>
                    <div className="review-inspector__eyebrow">Channel intelligence</div>
                    <h3>{activeMeta.label}</h3>
                    <dl>
                      <div><dt>Voice</dt><dd>{activeMeta.tone}</dd></div>
                      <div><dt>Route</dt><dd>{canPublishCurrent ? "Connected official API" : OFFICIAL_CONNECTORS.has(activeChannel) ? "Official connector available; manual handoff remains available" : "Review, copy, export, and open-platform handoff"}</dd></div>
                      <div><dt>Length</dt><dd>{activeMeta.limit ? `${currentPost.length.toLocaleString()} of ${activeMeta.limit.toLocaleString()} characters` : `${currentPost.length.toLocaleString()} characters; no fixed guide`}</dd></div>
                      <div><dt>Campaign context</dt><dd>{sourceSignals} source signal{sourceSignals === 1 ? "" : "s"}, {files.length} attached file{files.length === 1 ? "" : "s"}</dd></div>
                    </dl>
                  </aside>

                  <div className="review-actions">''',
)

replace_once(
    "frontend/app/page.js",
    '<div className="studio-actionbar">',
    '<div className="studio-actionbar" id="campaign-command">',
)

replace_once(
    "frontend/app/page.js",
    '''              <span>{channels.length} destinations</span>
              <i />
              <span>{selectedDirectCount} direct-ready</span>
              <i />
              <span>{provider.label}</span>
              <i />
              <span>{files.length} file{files.length === 1 ? "" : "s"}</span>''',
    '''              <span>{sourceSignals} source signal{sourceSignals === 1 ? "" : "s"}</span>
              <i />
              <span>{channels.length} destinations</span>
              <i />
              <span>{connectedOfficialCount}/{selectedDirectCount} selected connectors live</span>
              <i />
              <span>{provider.label}</span>''',
)

replace_once(
    "frontend/app/page.js",
    '''          </section>

          <div className="connections-grid">''',
    '''          </section>

          <section className="connector-readiness" aria-labelledby="connector-readiness-title">
            <div className="connector-readiness__heading">
              <div>
                <h2 id="connector-readiness-title">Official connector readiness</h2>
                <p>Implementation, deployment credentials, account authorization, and live post verification are separate gates.</p>
              </div>
            </div>
            <div className="connector-readiness__grid">
              {Array.from(OFFICIAL_CONNECTORS).map((platformId) => {
                const status = connections[platformId] || {};
                const ready = Boolean(status.configured && status.connected && !status.expired);
                return (
                  <article key={platformId} className="connector-readiness__card">
                    <header>
                      <h3>{channelMeta(platformId).label}</h3>
                      <span className={`readiness-state ${ready ? "is-ready" : ""}`}>{ready ? "Authorized" : status.configured ? "Needs authorization" : "Needs credentials"}</span>
                    </header>
                    <ul>
                      <li>Credentials: {status.configured ? "configured" : "missing in deployment"}</li>
                      <li>Authorization: {status.expired ? "expired" : status.connected ? "active" : "not completed"}</li>
                      <li>Refresh: {status.hasRefreshToken ? "available" : "not yet verified"}</li>
                      <li>Live post test: {status.readiness?.publishTest === "verified" ? "verified" : "required"}</li>
                      {status.callbackUrl && <li>Callback: <code>{status.callbackUrl}</code></li>}
                      {status.scopes?.length > 0 && <li>Scopes: {status.scopes.join(" · ")}</li>}
                    </ul>
                  </article>
                );
              })}
            </div>
          </section>

          <div className="connections-grid">''',
)

write(
    "frontend/lib/social/socialErrors.js",
    r'''
function cleanPlatformBody(raw) {
  const text = String(raw || "").trim();
  if (!text) return "";
  try {
    const parsed = JSON.parse(text);
    return parsed.error_description || parsed.detail || parsed.message || parsed.title || text;
  } catch {
    return text;
  }
}

export async function createSocialApiError(response, platform, action) {
  const raw = await response.text().catch(() => "");
  const detail = cleanPlatformBody(raw);
  const retryAfter = response.headers.get("retry-after");
  let message;

  switch (response.status) {
    case 401:
      message = `${platform} authorization expired or was revoked. Reconnect the account and try again.`;
      break;
    case 403:
      message = `${platform} rejected ${action} because the connected app or account is missing a required permission or product approval.`;
      break;
    case 404:
      message = `${platform} could not find the requested publishing resource. Verify the API version and account configuration.`;
      break;
    case 409:
    case 422:
      message = `${platform} rejected the content or request format.`;
      break;
    case 429:
      message = `${platform} rate limit reached.${retryAfter ? ` Retry after ${retryAfter} seconds.` : " Try again later."}`;
      break;
    default:
      message = response.status >= 500
        ? `${platform} is temporarily unavailable while attempting ${action}.`
        : `${platform} ${action} failed with status ${response.status}.`;
  }

  if (detail) message += ` ${detail.slice(0, 500)}`;
  const error = new Error(message);
  error.status = response.status;
  error.platform = platform;
  error.action = action;
  error.retryAfter = retryAfter || null;
  return error;
}
''',
)

replace_once(
    "frontend/lib/social/socialProviders.js",
    'import { isTokenExpired, updateTokenSession } from "./tokenStore.js";\n',
    'import { isTokenExpired, updateTokenSession } from "./tokenStore.js";\nimport { createSocialApiError } from "./socialErrors.js";\n',
)

for old, new in [
    ('if (!response.ok) throw new Error(`LinkedIn token refresh failed (${response.status})`);', 'if (!response.ok) throw await createSocialApiError(response, "LinkedIn", "token refresh");'),
    ('if (!response.ok) throw new Error(`X token refresh failed (${response.status})`);', 'if (!response.ok) throw await createSocialApiError(response, "X", "token refresh");'),
    ('if (!response.ok) throw new Error(`Reddit token refresh failed (${response.status})`);', 'if (!response.ok) throw await createSocialApiError(response, "Reddit", "token refresh");'),
]:
    replace_once("frontend/lib/social/socialProviders.js", old, new)

replace_once(
    "frontend/lib/social/socialProviders.js",
    '''  if (!profileResponse.ok) {
    const errorText = await profileResponse.text();
    throw new Error(`LinkedIn profile fetch failed: ${errorText}`);
  }''',
    '''  if (!profileResponse.ok) {
    throw await createSocialApiError(profileResponse, "LinkedIn", "profile lookup");
  }''',
)

replace_once(
    "frontend/lib/social/socialProviders.js",
    '''  if (!postResponse.ok) {
    const errorText = await postResponse.text();
    throw new Error(`LinkedIn post failed (${postResponse.status}): ${errorText}`);
  }''',
    '''  if (!postResponse.ok) {
    throw await createSocialApiError(postResponse, "LinkedIn", "publishing");
  }''',
)

replace_once(
    "frontend/lib/social/socialProviders.js",
    '''    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`X post failed (${response.status}): ${errorText}`);
    }''',
    '''    if (!response.ok) {
      throw await createSocialApiError(response, "X", "publishing");
    }''',
)

replace_once(
    "frontend/lib/social/socialProviders.js",
    '''    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`X thread failed at post ${index + 1} (${response.status}): ${errorText}`);
    }''',
    '''    if (!response.ok) {
      const error = await createSocialApiError(response, "X", `publishing thread post ${index + 1}`);
      throw error;
    }''',
)

replace_once(
    "frontend/lib/social/socialProviders.js",
    '''  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Reddit submit failed (${response.status}): ${errorText}`);
  }''',
    '''  if (!response.ok) {
    throw await createSocialApiError(response, "Reddit", "publishing");
  }''',
)

replace_once(
    "frontend/lib/social/socialConfig.js",
    '''export function getAllPlatformStatus() {
  const status = {};
  for (const [key, platform] of Object.entries(SOCIAL_PLATFORMS)) {
    status[key] = {
      id: platform.id,
      label: platform.label,
      icon: platform.icon,
      color: platform.color,
      configured: isPlatformConfigured(key),
      postMaxLength: platform.postMaxLength,
      supportsMedia: platform.supportsMedia,
      setupUrl: platform.setupUrl,
      setupSteps: platform.setupSteps.map((step) =>
        step.replace("{callbackUrl}", getCallbackUrl(key)),
      ),
    };
  }
  return status;
}''',
    '''export function getAllPlatformStatus() {
  const status = {};
  for (const [key, platform] of Object.entries(SOCIAL_PLATFORMS)) {
    const configured = isPlatformConfigured(key);
    const callbackUrl = getCallbackUrl(key);
    status[key] = {
      id: platform.id,
      label: platform.label,
      icon: platform.icon,
      color: platform.color,
      configured,
      callbackUrl,
      scopes: [...platform.scopes],
      postMaxLength: platform.postMaxLength,
      supportsMedia: platform.supportsMedia,
      setupUrl: platform.setupUrl,
      setupSteps: platform.setupSteps.map((step) =>
        step.replace("{callbackUrl}", callbackUrl),
      ),
      readiness: {
        implementation: "ready",
        credentials: configured ? "ready" : "missing",
        callback: configured ? "needs_platform_confirmation" : "blocked",
        authorization: "pending",
        publishTest: "required",
        refreshTest: "required",
        rejectionTest: "required",
      },
    };
  }
  return status;
}''',
)

replace_once(
    "frontend/app/api/social/status/route.js",
    '''        hasRefreshToken: connection.hasRefreshToken || false,
      };''',
    '''        hasRefreshToken: connection.hasRefreshToken || false,
        readiness: {
          ...config.readiness,
          authorization: connection.expired
            ? "expired"
            : connection.connected
              ? "ready"
              : "pending",
          refreshTest: connection.hasRefreshToken ? "available_for_live_test" : "required",
          publishTest: "required",
          rejectionTest: "required",
        },
      };''',
)

write(
    "frontend/.env.example",
    r'''
# ═══════════════════════════════════════════════════
# SignalFlow Studio — safe environment configuration
# ═══════════════════════════════════════════════════
# 1. Never prefix provider secrets or OAuth credentials with NEXT_PUBLIC_.
# 2. Never commit .env.local or real credentials.
# 3. Keep public hosted instances owner-locked.

# App security and canonical origin
SIGNALFLOW_ACCESS_KEY=
SIGNALFLOW_PUBLIC_HOSTED=true
NEXTAUTH_URL=https://signal-flow-studio.vercel.app
SOCIAL_ENCRYPTION_KEY=

# AI model providers (owner/private deployments)
OPENAI_API_KEY=
GEMINI_API_KEY=
GROQ_API_KEY=
OPENROUTER_API_KEY=
ANTHROPIC_API_KEY=

# LinkedIn
# Callback: ${NEXTAUTH_URL}/api/social/callback/linkedin
# Scopes/products: openid, profile, w_member_social; OIDC Sign In; Share on LinkedIn
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
LINKEDIN_API_VERSION=202607

# X OAuth 2.0 with PKCE
# Callback: ${NEXTAUTH_URL}/api/social/callback/x
# Scopes: tweet.read, tweet.write, users.read, offline.access
X_CLIENT_ID=
X_CLIENT_SECRET=

# Reddit web app
# Callback: ${NEXTAUTH_URL}/api/social/callback/reddit
# Scopes: identity, submit, read
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=
''',
)

print("SignalFlow Studio professionalization payload applied.")
