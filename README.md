# SignalFlow Studio

SignalFlow Studio is evolving into a **content operating system for people who want to stay focused on their real work instead of continuously deciding what to post, recording/editing media, adapting the same idea for every platform, and managing a publishing calendar by hand**.

The intended experience is:

```text
Work normally
    ↓
SignalFlow notices useful signals or accepts a manual thought/topic
    ↓
SignalFlow recommends what may be worth talking about and why
    ↓
You choose an angle or write "Something else"
    ↓
SignalFlow gathers evidence and creates the required text/screenshots/demo media
    ↓
SignalFlow adapts the story only to destinations that genuinely fit
    ↓
You review, edit, reject, or approve
    ↓
SignalFlow schedules/publishes the exact approved revisions
    ↓
SignalFlow remembers what was said and learns from your decisions
    ↓
You return to your work
```

> **Product principle:** SignalFlow should consume the evidence created by work, not require the user to stop working and manufacture content inputs.
>
> **Attention principle:** The user's job is judgment. SignalFlow's job is everything between the work and that judgment.

## Product direction versus current implementation

This repository contains a working review-first campaign foundation and a larger target product architecture.

Documentation must keep those two truths separate:

### Current implemented foundation

The current product can:

- accept a campaign/source brief;
- ingest supported public links and GitHub repository context within current safety/implementation limits;
- accept supported browser file inputs and canonical source/asset records;
- use real configured model-provider routes;
- generate destination-specific campaign drafts;
- preserve stable campaign IDs and edit-safe draft history;
- keep one authoritative current draft per destination;
- invalidate approval after relevant edits;
- save browser-local campaigns;
- export deterministic Markdown/JSON;
- prepare/validate portable browser archives;
- expose capability discovery;
- use the existing MCP package for supported operations;
- expose official OAuth/publishing code paths for LinkedIn, X, and Reddit where genuinely configured and verified.

### Not yet implemented as production capabilities

The repository must **not** claim the following are already available until their issues and acceptance evidence are complete:

- persistent ContentSignal/ContentOpportunity intelligence;
- automatic opportunity recommendations from connected work events;
- long-lived identity/style/narrative learning;
- a `Today` decision inbox;
- editorial cadence planning;
- automatic browser screenshot/demo capture workers;
- deterministic motion-video rendering;
- durable background jobs for the full pipeline;
- hosted cloud database/object storage/account workspaces;
- cross-device sync/collaboration;
- production-ready scheduled publishing;
- broad production-grade social connectors beyond verified capabilities;
- automatic analytics/performance learning;
- unreviewed global autoposting.

Future architecture in `docs/` is a build contract, **not a capability claim**.

## Canonical product model

The old conceptual center—`brief → destinations → generate package`—is now only the **manual Create path**.

The canonical lifecycle is:

```text
Signals
  ↓
Opportunities
  ↓
Narrative / Campaign Plan
  ↓
Evidence + Capture + Media Production
  ↓
Content Pieces
  ↓
Platform-native Variants
  ↓
Review / Approval
  ↓
Editorial Calendar
  ↓
Scheduled / Immediate Publication
  ↓
Narrative Memory + Feedback Learning
```

### Signals

A `ContentSignal` is something that happened or something the user supplied that *might* be worth communicating.

Examples:

- a meaningful GitHub release/merge/milestone;
- a deployed product change;
- a browser capture;
- a document, link, screenshot, recording, research note, or changelog;
- a manual thought, lesson, opinion, question, launch, personal update, or external topic;
- future connected work sources when explicitly authorized.

GitHub is one high-value source. SignalFlow is **not a GitHub-only content product**.

### Opportunities

The Editorial Brain ranks whether a signal is worth discussing based on freshness, importance, novelty, evidence, narrative fit, audience relevance, repetition risk, visual potential, timing, platform fit, and user boundaries.

It may legitimately conclude **do not post**.

### Campaigns

A campaign is a narrative, not a container that must produce twelve simultaneous posts.

One campaign may intentionally sequence:

- a LinkedIn reason/story;
- an X demo;
- a later technical discussion;
- a YouTube walkthrough;
- a retrospective weeks later.

Some destinations should receive nothing when the story does not fit them.

### Approval

SignalFlow targets **approval-first automation**.

The owner-first goal is:

1. SignalFlow may observe, suggest, produce, prepare, and schedule;
2. the user approves the exact current text/media revisions;
3. publication executes only those approved revisions;
4. edits after approval invalidate/update publication intent according to explicit policy.

## Authenticity and identity

A small tone dropdown cannot represent a person.

The target identity system separates:

- **Identity** — who the user is and what matters to them;
- **Desired perception** — how they want an audience to understand them;
- **Voice** — how they naturally communicate;
- **Boundaries** — what SignalFlow must not say/show/do;
- **Platform overlays** — how the same person adapts to different destinations;
- **Style memory** — preferences learned from repeated approved edits/rejections;
- **Narrative memory** — what the audience has already been told.

Approvals, edits, regenerations, rejections, and explicit feedback become explainable `FeedbackEvent` evidence. The system should accumulate confidence before turning repeated behavior into long-term learned preferences.

Identity and explicit boundaries outrank engagement optimization.

See [docs/IDENTITY_MEMORY_AND_AUTHENTICITY.md](docs/IDENTITY_MEMORY_AND_AUTHENTICITY.md).

## Capture and media production

SignalFlow's target production engine removes routine manual media work.

The desired pipeline is:

```text
Narrative requires a visual/demo
    ↓
MediaRequirement
    ↓
existing asset or safe CaptureRecipe
    ↓
background browser screenshot/screencast job
    ↓
canonical Asset + provenance
    ↓
MediaCompositionPlan
    ↓
deterministic motion renderer
    ↓
16:9 / 9:16 / other required variants
    ↓
privacy + quality review
    ↓
exact media revision approval
```

AI should primarily **direct** media—what to show, sequence, crop, caption, and emphasize. Deterministic software should perform repeatable capture, typography, brand motion, transitions, subtitles, resizing, and encoding when possible.

SignalFlow should not become a Premiere or Canva replacement before this automated production loop works.

See [docs/CAPTURE_AND_MEDIA_PRODUCTION.md](docs/CAPTURE_AND_MEDIA_PRODUCTION.md).

## Editorial calendar and publication

SignalFlow distinguishes:

- **Editorial planning** — what should be communicated next and when;
- **Publication scheduling** — executing a known approved revision at a known time.

Cadence policies are targets/constraints, not recurring spam commands.

An empty slot may remain empty when no opportunity is worthwhile.

The publishing system must use durable, idempotent publication requests/jobs that bind:

- exact draft revision;
- exact media revisions;
- verified destination target;
- approval snapshot;
- source freshness;
- schedule/timezone;
- connector capability;
- idempotency key.

See [docs/EDITORIAL_CALENDAR_AND_PUBLISHING.md](docs/EDITORIAL_CALENDAR_AND_PUBLISHING.md).

## Target product navigation

The intended long-term workspace is decision-first:

- **Today** — what needs judgment now;
- **Signals** — what SignalFlow noticed or the user added;
- **Plan** — opportunities and campaign narratives;
- **Calendar** — editorial sequence/publication state;
- **Create** — manual intentional entry;
- **Assets** — evidence, captures, derived/rendered media;
- **Library** — campaign/publication history;
- **Connections** — source + destination connections;
- **Voice** — identity, perception, boundaries, learned preferences;
- **Settings** — provider/account/workspace/advanced configuration.

The current Source → Destinations → Review flow should eventually become the manual **Create** path rather than the permanent center of the whole product.

See [docs/PRODUCT_INFORMATION_ARCHITECTURE.md](docs/PRODUCT_INFORMATION_ARCHITECTURE.md).

## Owner-first execution strategy

SignalFlow should prove the hard product loop before broad SaaS expansion.

Recommended vertical sequence:

1. manual thought → opportunity → authentic LinkedIn/X review loop;
2. GitHub work event → automatic signal/opportunity → same review loop;
3. automatic screenshot production;
4. automatic short product-demo production;
5. durable LinkedIn/X scheduling/publishing;
6. editorial continuity/cadence;
7. edit/rejection learning;
8. visual destination expansion;
9. broad hosted SaaS foundation;
10. broader integrations/teams/analytics.

Each gate should deliver a complete real user journey rather than a horizontal pile of infrastructure.

See [docs/PERSONAL_ALPHA_EXECUTION.md](docs/PERSONAL_ALPHA_EXECUTION.md).

## Canonical documentation

Read these before changing product architecture:

1. [docs/PRODUCT_VISION.md](docs/PRODUCT_VISION.md) — what SignalFlow is and is not;
2. [docs/CONTENT_INTELLIGENCE_ARCHITECTURE.md](docs/CONTENT_INTELLIGENCE_ARCHITECTURE.md) — Signals/Opportunities/Campaign/ContentPiece/Memory domain model;
3. [docs/IDENTITY_MEMORY_AND_AUTHENTICITY.md](docs/IDENTITY_MEMORY_AND_AUTHENTICITY.md) — personal voice, perception, boundaries, feedback learning;
4. [docs/CAPTURE_AND_MEDIA_PRODUCTION.md](docs/CAPTURE_AND_MEDIA_PRODUCTION.md) — screenshot/screencast/motion production architecture;
5. [docs/EDITORIAL_CALENDAR_AND_PUBLISHING.md](docs/EDITORIAL_CALENDAR_AND_PUBLISHING.md) — cadence, calendar, approval and durable publishing;
6. [docs/PRODUCT_INFORMATION_ARCHITECTURE.md](docs/PRODUCT_INFORMATION_ARCHITECTURE.md) — decision-first application structure;
7. [docs/PERSONAL_ALPHA_EXECUTION.md](docs/PERSONAL_ALPHA_EXECUTION.md) — vertical execution gates;
8. [docs/DOMAIN_ARCHITECTURE.md](docs/DOMAIN_ARCHITECTURE.md) — current domain/application/adapter boundaries;
9. [docs/SOURCE_ASSET_CONTRACT.md](docs/SOURCE_ASSET_CONTRACT.md) — source/asset truth;
10. [docs/CAPABILITY_MATRIX.md](docs/CAPABILITY_MATRIX.md) — what the current product can actually do;
11. [docs/CAMPAIGN_EDITING_AND_VERSIONING.md](docs/CAMPAIGN_EDITING_AND_VERSIONING.md) — current edit/version invariants;
12. [docs/CONNECTOR_READINESS.md](docs/CONNECTOR_READINESS.md) — connector verification truth;
13. [docs/PORTABLE_TRANSFER.md](docs/PORTABLE_TRANSFER.md) — explicit local transfer/recovery contract;
14. [AGENTS.md](AGENTS.md) — repository execution rules.

## Current destination set

Current campaign generation recognizes:

- Social: LinkedIn, X, Instagram, Facebook, Threads
- Community: Reddit, Hacker News
- Video: YouTube, TikTok
- Owned: Newsletter, Blog, Release notes

Generation support does **not** imply direct publishing support.

Current direct connector code paths exist for LinkedIn, X, and Reddit, but a connector is production-ready only after real credential/account/scopes/publish/retry/expiry/rate-limit verification. Other destinations remain review/copy/export/open-platform workflows until their connectors are explicitly implemented and verified.

## Current model routes

Current provider adapters include:

- Gemini;
- OpenAI;
- Claude;
- OpenRouter;
- Groq;
- Custom OpenAI-compatible endpoint;
- Ollama;
- LM Studio.

A route is usable only when `GET /api/capabilities` reports it available for the current deployment/session.

The future staged architecture may use different logical AI roles, but initial implementation may reuse one strong provider/model behind separate contracts.

## Current persistence truth

Today:

- saved campaigns are browser-local;
- there is no production cloud campaign database/account workspace/cross-device sync yet;
- canonical Campaign, Asset, SourceArtifact, AssetProcessing and transfer contracts exist;
- browser portable archive/import/export exists;
- production hosted object storage and durable background job infrastructure are not yet implemented.

Future cloud persistence must implement the same application/domain ports rather than placing database/object-store logic directly into React components.

## Current source and asset truth

Implemented foundations include canonical versioned Asset/SourceArtifact/AssetProcessing records and browser-side handling for supported inputs.

Still incomplete/planned:

- hardened remote URL ingestion across all source paths;
- full source-health diagnostics;
- remote evidence version/revalidation;
- OCR/transcription/visual-analysis processors;
- durable cloud asset storage;
- acknowledged full extension screenshot/recording ingestion;
- automated capture-worker production.

See the capability/source docs and open issues for exact status.

## Current MCP role

The `mcp/` package remains useful as an **agent-control interface**.

The long-term architecture distinguishes:

- GitHub App/webhooks or other source connectors → ongoing event/signal ingestion;
- MCP → AI-agent commands/queries over SignalFlow's canonical application services.

Do not make MCP the production event-ingestion mechanism merely because a GitHub MCP connection exists during development.

## Quick start

Requirements:

- Node.js 22 (CI version);
- npm;
- Python 3.10 only for the retained Python compatibility suite;
- at least one real model provider route for real campaign generation.

```bash
cd frontend
npm ci
npm run dev
```

Open `http://localhost:3000`.

Copy `frontend/.env.example` to `frontend/.env.local` and configure the chosen provider. Never commit credentials or prefix server secrets with `NEXT_PUBLIC_`.

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

A feature is not complete because it compiles. Its domain contract, authorization, failure/recovery behavior, truthful capability state, UX, accessibility, migration/rollback, security, and end-to-end user journey must pass the acceptance criteria owned by its issue.

## Vercel

Current frontend deployment configuration:

```text
Root Directory: frontend
Framework Preset: Next.js
Install Command: npm install
Build Command: npm run build
Output Directory: .next
```

Long-running ingestion/capture/render/publishing must not be designed around one Vercel request; those flows belong behind durable jobs/workers.

## Core product principles

- User judgment remains the publication authority.
- SignalFlow reduces attention burden instead of adding configuration burden.
- Anything can become a manual signal; GitHub is only one source.
- Not every signal deserves content.
- Not every campaign belongs on every platform.
- Not every calendar slot must be filled.
- Identity and explicit boundaries outrank engagement optimization.
- Source evidence remains traceable.
- Approved/manual edits are never silently overwritten.
- Exact approved revisions are bound to publication intent.
- Capture/media production should be repeatable and privacy-aware.
- Direct success is claimed only after the destination confirms it.
- Future capabilities are never documented as current capabilities without evidence.
- Build complete vertical user journeys before expanding breadth.

Start with [AGENTS.md](AGENTS.md) before making repository changes.
