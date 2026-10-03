# SignalFlow Studio

SignalFlow Studio is an **approval-first content operating system** for turning meaningful work into evidence-backed communication without making content operations the user's primary job.

The intended product loop is:

```text
work / thought / connected source
→ ContentSignal
→ worthwhile ContentOpportunity
→ owner angle judgment
→ NarrativeStrategy
→ ContentPiece
→ evidence + media when justified
→ destination-specific PlatformVariant revisions
→ exact review / change / approval
→ durable publication later
→ NarrativeMemory + feedback learning
```

> **The user's job is judgment. SignalFlow's job is the work between what happened and that judgment.**

SignalFlow is not intended to be an unattended autoposting bot, a generic prompt wrapper, or a dashboard that forces users to manufacture content inputs.

## Current truth

This repository contains both a working owner-first product and target architecture that is still being built. Do not treat a roadmap document, adapter, route, or database table as proof that a full user journey is production-accepted.

The truth order is:

```text
live runtime
→ deployed production
→ master
→ acceptance evidence
→ capability/execution docs
→ roadmap/README
→ historical notes
```

### Accepted / implemented owner foundation

Current code includes:

- browser-local manual `ContentSignal` intake and lifecycle;
- explainable `ContentOpportunity` evaluation and angle selection, including `Something else`;
- versioned Identity, Desired Perception, Voice, Boundary and platform-expression profiles;
- explainable browser-local StyleMemory controls;
- browser-local NarrativeMemory for approved internal story history and repetition checks;
- `NarrativeStrategy`, `ContentPiece`, `PlatformVariant`, and immutable `PlatformVariantRevision` records;
- staged destination generation with separate evidence/authenticity checks;
- exact revision edit/regenerate/approve/reject semantics;
- Today / Signals / Plan owner surfaces;
- stable browser-local Campaign save/reopen with edit-safe history;
- deterministic Markdown/JSON export and portable browser transfer;
- real configured model-provider routes;
- owner-scoped hosted Postgres composition for connected-source, content-intelligence, planning, review and opportunity-job records when configured;
- private hosted Asset persistence through the configured storage composition;
- a bounded screenshot/capture foundation with exact Asset/review binding code;
- MCP tools that reuse canonical SignalFlow services for validation, strategy, destination generate/retry/edit, review retrieval, deterministic export, and trackable campaign start/status/cancel;
- connector code paths for LinkedIn, X and Reddit where the exact deployment/account/scopes are genuinely configured.

Golden Path 1 is accepted for its Personal Alpha definition.

### Active acceptance gate

Golden Path 2 remains **not yet accepted end to end**.

The closing journey is:

```text
real GitHub work
→ verified connected-source event
→ canonical ContentSignal at exact revision
→ bounded repository evidence + ProjectContext
→ worthwhile ContentOpportunity
→ owner angle judgment
→ NarrativeStrategy
→ exact LinkedIn/X revisions
→ automatic screenshot when justified
→ private immutable Asset / derivative
→ exact text + media review
→ owner decision
```

A separate low-value/noise event must prove that receiving a webhook does not automatically create a high-priority content opportunity.

See:

- `docs/CURRENT_EXECUTION_STATE.md`
- `docs/acceptance/GOLDEN_PATH_2_OWNER_ACCEPTANCE.md`
- issues #161, #163 and #167

### Not yet production-complete

Do not claim these as finished product capabilities until their acceptance gates close:

- Golden Path 2 end-to-end owner acceptance;
- Golden Path 3 durable scheduled/immediate publication and confirmed-public memory;
- general hosted Campaign autosave or cross-device Campaign sync;
- multi-user collaboration/workspaces;
- always-on durable workers for the complete pipeline;
- broad automatic screenshot/screencast/media production;
- deterministic carousel and creator-video production;
- generalized media-intent/rights/consent enforcement;
- universal destination publishing;
- broad credential-backed connector coverage;
- mobile and Desktop Edge Agent products;
- billing/quotas as a finished commercial system;
- unreviewed global autoposting.

Target architecture is a build contract, not a capability claim.

## Product model

### Signals

A `ContentSignal` is evidence or context that might be worth communicating.

Examples include:

- meaningful GitHub work;
- a product/release milestone;
- a manual thought or lesson;
- a document, link, screenshot or recording;
- a future authorized connected source.

Not every Signal deserves a post.

### Opportunities

A `ContentOpportunity` explains whether a Signal appears worth discussing and why. The system may recommend silence, deferral, or another angle.

### Strategy and content pieces

`NarrativeStrategy` defines the story direction before destination copy. A `ContentPiece` owns the communication unit, while `PlatformVariant` and immutable revisions adapt it to destinations that actually fit.

Platform omission is valid.

### Review and approval

Approval is bound to the exact visible revision.

Editing or regenerating an approved revision invalidates the relevant approval. External publication must never silently substitute a newer revision for one the owner approved.

### Media

Upload does not equal permission to publish.

The target media system distinguishes evidence, references, final candidates, edit/composite sources, footage, private assets and derived outputs. Real product evidence is preferred over synthetic decoration for factual product claims.

## Current persistence model

SignalFlow currently uses more than one persistence scope, intentionally:

- manual Campaigns remain browser-local;
- portions of the accepted owner memory path remain browser-local;
- configured hosted owner flows use durable Postgres-backed records for connected sources, ContentSignals, ProjectContext, Opportunities, identity/planning/review continuity and opportunity-job state;
- private hosted Asset storage can use the configured Postgres/S3-compatible composition;
- generic cloud Campaign autosave, cross-device Campaign synchronization and collaboration are not implied by those hosted record families.

Use `GET /api/capabilities` for runtime/session truth and `docs/CAPABILITY_MATRIX.md` for the implementation matrix.

## MCP

The `mcp/` package is an **agent-control interface**, not a second SignalFlow product implementation.

Current tools include:

- capability discovery;
- provider status/testing;
- shared campaign/source validation;
- canonical hosted strategy planning;
- destination generation, retry and exact-revision editing;
- hosted review-bundle retrieval;
- deterministic Markdown/JSON export;
- trackable campaign start/status/cancel;
- compatibility campaign creation.

MCP reuses canonical application/API contracts. It must not invent parallel Campaign, planning, approval, export or publishing state.

GitHub App/webhooks remain the source-event architecture for ongoing GitHub observation; MCP does not replace durable source ingestion.

## Architecture

Dependency direction:

```text
UI / API routes / MCP / extension / future clients / workers
                           ↓
                  application services
                           ↓
                    domain contracts
                           ↑
 browser / Postgres / provider / connector / capture / storage adapters
```

Business rules belong in domain/application layers, not React components, route handlers or MCP-specific copies.

Production application:

```text
frontend/
  app/              Next.js routes and UI composition
  lib/
    domain/
    application/
    infrastructure/
    server/
  db/
  tests/

mcp/                agent-control interface
extension/          experimental browser client
signalflow/         retained repository/media utilities
docs/               product, architecture, operations and acceptance truth
```

Experimental/noncanonical runtimes are being reconciled under repository hygiene issue #340 and must not be assumed to be supported production services merely because code exists.

## Deployment profiles

SignalFlow supports different capability profiles:

- **Hosted** — public web deployment with owner/session-gated capabilities;
- **Local** — browser/local workflows and reachable local provider endpoints;
- **Self-hosted** — operator-controlled deployment with explicitly configured capabilities.

Capabilities are declared by the runtime contract, not inferred from hostname.

## Model routes

Current provider adapters include:

- Gemini;
- OpenAI;
- Claude;
- OpenRouter;
- Groq;
- custom OpenAI-compatible endpoints;
- Ollama;
- LM Studio.

Availability depends on deployment/session configuration and privacy policy.

Temporary personal provider keys are request-scoped and excluded from canonical Campaign saves/exports.

## Quick start

Requirements:

- Node.js 22;
- npm;
- Python 3.10 only for the retained Python utility/test surface;
- a real supported provider route for real generation.

```bash
cd frontend
npm ci
npm run dev
```

Open `http://localhost:3000`.

Copy `frontend/.env.example` to `frontend/.env.local` and configure only the capabilities you intend to use. Never commit credentials or expose server secrets with `NEXT_PUBLIC_`.

## Verification

Frontend:

```bash
cd frontend
npm ci
npm test
npm run gp2:preflight
npm audit --package-lock-only --omit=dev --audit-level=high
npm run build
npm run audit:function-traces
npm run audit:public-metadata
```

MCP:

```bash
cd mcp
npm test
```

Python utilities/tests:

```bash
python -m pip install -r requirements.txt
python -m pip install pytest
pytest -q
```

A green build does not by itself prove an external capability. Credential-backed connectors, hosted inference, capture, publication and other side-effecting paths require the acceptance evidence owned by their issues.

## Canonical docs

Read these before changing product architecture:

1. `AGENTS.md` — repository execution rules.
2. `docs/CURRENT_EXECUTION_STATE.md` — current gate, PRs, blockers and production relationship.
3. `docs/CAPABILITY_MATRIX.md` — exact implementation/deployment capability truth.
4. `docs/PRODUCT_VISION.md` — product definition and principles.
5. `docs/PERSONAL_ALPHA_EXECUTION.md` — owner-first execution direction.
6. `docs/CONTENT_INTELLIGENCE_ARCHITECTURE.md` — Signals/Opportunities/strategy/content/memory.
7. `docs/IDENTITY_MEMORY_AND_AUTHENTICITY.md` — identity, boundaries and learning.
8. `docs/CAPTURE_AND_MEDIA_PRODUCTION.md` — bounded capture/media production.
9. `docs/EDITORIAL_CALENDAR_AND_PUBLISHING.md` — future durable editorial/publication model.
10. `docs/DOMAIN_ARCHITECTURE.md` — current dependency and adapter boundaries.

Historical handoff notes are not execution authority.

## Core rules

- Build vertical owner journeys before horizontal breadth.
- Not every Signal deserves content.
- Not every destination deserves a variant.
- Empty editorial space is valid.
- Identity and explicit boundaries outrank engagement optimization.
- Real evidence outranks synthetic decoration for factual claims.
- Original media is immutable; edits create derived revisions.
- Approved text/media revisions are exact, not “latest”.
- External success is claimed only after the destination confirms it.
- Future architecture must never be presented as current capability without evidence.

## Contributing

Start with `AGENTS.md`, `CONTRIBUTING.md`, the current execution state and the owning issue before changing behavior.

Do not open a new architectural track when an existing issue already owns the problem.

## Support

If SignalFlow is useful, the repository's GitHub Sponsor button can be used to support continued development and infrastructure. Sponsorship is optional and does not affect repository access.
