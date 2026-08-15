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
- provider-neutral `InferenceTask` routing, privacy-aware selection, and per-task cost/metering;
- SignalFlow Managed inference plans;
- enforceable Standard/Confidential/Private Hybrid/Local Only processing modes;
- curated downloadable local intelligence packs;
- full ChatGPT/Claude/Codex/Gemini external-agent integrations over the target workflow;
- a `Today` decision inbox;
- production mobile application;
- paired Desktop Edge Agent;
- desktop application capture/recording;
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

## AI, inference, cost, and private processing

SignalFlow must not be tied to one AI provider or assume a free API is the production architecture.

The target Inference Fabric works like this:

```text
SignalFlow application asks for an InferenceTask
        ↓
required capability / output schema
        ↓
DataClassification + ProcessingPolicy
        ↓
quality + cost + latency + modality
        ↓
available provider/local capability
        ↓
selected permitted route
        ↓
structured result + usage/provenance
```

Target intelligence modes:

- **SignalFlow Managed** — SignalFlow chooses/pays for approved AI routes;
- **Bring Your Own Provider** — user supplies official API/provider billing;
- **Private Hybrid** — raw protected source is processed locally/private first and only minimized evidence may be sent remotely when policy permits;
- **Local Only** — protected inference remains on trusted device/private infrastructure;
- **Enterprise Private later** — customer-controlled inference infrastructure.

Important rules:

- cheap/deterministic/local processing should filter noise before strong models;
- a small local model is useful for classification, summaries, embeddings, privacy checks and preprocessing, but is not assumed to replace frontier reasoning;
- private repositories should use bounded relevant evidence, not whole-repository uploads by default;
- `LOCAL_ONLY` must fail closed rather than silently use a cloud provider;
- text, vision, image generation/editing and later video intelligence may use different specialist providers;
- free/testing endpoints are replaceable adapters, not the business model;
- provider/model settings should become low-frequency configuration rather than a campaign-time burden.

See [docs/INFERENCE_AND_PRIVACY_ARCHITECTURE.md](docs/INFERENCE_AND_PRIVACY_ARCHITECTURE.md) and [docs/INFERENCE_CLIENT_CAPABILITY_MATRIX.md](docs/INFERENCE_CLIENT_CAPABILITY_MATRIX.md).

## External AI assistants

Users may already work in ChatGPT, Claude, Codex, Gemini or other AI clients.

SignalFlow should support those products as **interfaces/controllers** where an official supported integration exists:

```text
external AI assistant
        ↓
MCP / supported app/API
        ↓
SignalFlow application services
```

That is different from SignalFlow's own inference backend.

Canonical rules:

- a consumer AI subscription is not automatically SignalFlow API credit;
- do not scrape browser sessions/cookies;
- do not reuse unsupported OAuth/CLI credentials;
- do not automate another consumer AI web UI as the hidden backend;
- optional officially supported local Codex/Claude Code-style adapters may later help with repository/evidence tasks through a paired Desktop Agent;
- unattended SignalFlow background work must still function without another AI app being open.

See [docs/AI_CLIENT_INTEGRATIONS.md](docs/AI_CLIENT_INTEGRATIONS.md).

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
- **Connections** — source + destination + AI provider/assistant connections;
- **Voice** — identity, perception, boundaries, learned preferences;
- **Settings** — provider/account/workspace/privacy/advanced configuration.

The current Source → Destinations → Review flow should eventually become the manual **Create** path rather than the permanent center of the whole product.

See [docs/PRODUCT_INFORMATION_ARCHITECTURE.md](docs/PRODUCT_INFORMATION_ARCHITECTURE.md).

## Web, phone, extension, and desktop edge

SignalFlow should remain one product with clients optimized for different contexts.

```text
Web
→ full workspace, planning, long review, library, settings

Mobile
→ Today, quick thought/voice/photo/share input, review, approval, Calendar, exceptions

Browser Extension
→ explicit user-initiated browser context/screenshots/recording

MCP/API
→ external agent control/query

Desktop Edge Agent
→ private/local repositories and files, local models, Private Hybrid, signed edge jobs, later desktop-app capture

Workers
→ durable source/inference/capture/render/publishing work
```

The phone should be a **judgment + quick-capture device**, not a duplicated full Studio. The extension must not become hidden browser surveillance. The future Desktop Agent should be a lightweight tray/menu-bar capability service, not a second full product UI.

See [docs/CLIENT_ECOSYSTEM_AND_EDGE_AGENT.md](docs/CLIENT_ECOSYSTEM_AND_EDGE_AGENT.md).

## Future desktop application capture

Web applications can be captured through URL/browser recipes. Desktop applications require a separate future path.

Target concept:

```text
DesktopCaptureRecipe
→ paired/authorized desktop device
→ allowed application/window
→ semantic accessibility/UI-automation actions where possible
→ screenshot/screencast
→ canonical Asset
→ normal media composition/review
```

No hidden continuous desktop recording, broad whole-disk control, or arbitrary application access.

Tracked separately in #177 so it does not block the browser-based Personal Alpha.

## Owner-first execution strategy

SignalFlow should prove the hard product loop before broad SaaS expansion.

Recommended vertical sequence:

0. thin provider-neutral inference/privacy boundary: #171/#172 essentials only;
1. manual thought → opportunity → authentic LinkedIn/X review loop;
2. GitHub work event → automatic signal/opportunity → same review loop;
3. automatic screenshot production;
4. automatic short product-demo production;
5. durable LinkedIn/X scheduling/publishing;
6. editorial continuity/cadence;
7. edit/rejection learning;
8. mobile low-attention companion as the owner loop proves valuable;
9. Private Hybrid/local intelligence/Desktop Agent where demand requires it;
10. visual destination and broader hosted SaaS/integration/team expansion.

Each gate should deliver a complete real user journey rather than a horizontal pile of infrastructure.

The thin #171/#172 prerequisite exists only to keep Golden Path #166 portable and safe; do not delay it on the full local-model/mobile/desktop roadmap.

See [docs/PERSONAL_ALPHA_EXECUTION.md](docs/PERSONAL_ALPHA_EXECUTION.md).

## Canonical documentation

Read these before changing product architecture:

1. [docs/PRODUCT_VISION.md](docs/PRODUCT_VISION.md) — what SignalFlow is and is not;
2. [docs/PERSONAL_ALPHA_EXECUTION.md](docs/PERSONAL_ALPHA_EXECUTION.md) — vertical execution gates;
3. [docs/CONTENT_INTELLIGENCE_ARCHITECTURE.md](docs/CONTENT_INTELLIGENCE_ARCHITECTURE.md) — Signals/Opportunities/Campaign/ContentPiece/Memory domain model;
4. [docs/IDENTITY_MEMORY_AND_AUTHENTICITY.md](docs/IDENTITY_MEMORY_AND_AUTHENTICITY.md) — personal voice, perception, boundaries, feedback learning;
5. [docs/INFERENCE_AND_PRIVACY_ARCHITECTURE.md](docs/INFERENCE_AND_PRIVACY_ARCHITECTURE.md) — provider-neutral AI, managed/BYOK/local/private modes, processing policy, cost routing;
6. [docs/AI_CLIENT_INTEGRATIONS.md](docs/AI_CLIENT_INTEGRATIONS.md) — external AI assistant/subscription boundaries and MCP/client architecture;
7. [docs/CLIENT_ECOSYSTEM_AND_EDGE_AGENT.md](docs/CLIENT_ECOSYSTEM_AND_EDGE_AGENT.md) — web/mobile/extension/desktop-edge responsibilities;
8. [docs/CAPTURE_AND_MEDIA_PRODUCTION.md](docs/CAPTURE_AND_MEDIA_PRODUCTION.md) — screenshot/screencast/motion production architecture;
9. [docs/EDITORIAL_CALENDAR_AND_PUBLISHING.md](docs/EDITORIAL_CALENDAR_AND_PUBLISHING.md) — cadence, calendar, approval and durable publishing;
10. [docs/PRODUCT_INFORMATION_ARCHITECTURE.md](docs/PRODUCT_INFORMATION_ARCHITECTURE.md) — decision-first application structure;
11. [docs/DOMAIN_ARCHITECTURE.md](docs/DOMAIN_ARCHITECTURE.md) — current domain/application/adapter boundaries;
12. [docs/SOURCE_ASSET_CONTRACT.md](docs/SOURCE_ASSET_CONTRACT.md) — source/asset truth;
13. [docs/CAPABILITY_MATRIX.md](docs/CAPABILITY_MATRIX.md) — what the current product can actually do;
14. [docs/INFERENCE_CLIENT_CAPABILITY_MATRIX.md](docs/INFERENCE_CLIENT_CAPABILITY_MATRIX.md) — current-vs-target inference/client truth;
15. [docs/CAMPAIGN_EDITING_AND_VERSIONING.md](docs/CAMPAIGN_EDITING_AND_VERSIONING.md) — current edit/version invariants;
16. [docs/CONNECTOR_READINESS.md](docs/CONNECTOR_READINESS.md) — connector verification truth;
17. [docs/PORTABLE_TRANSFER.md](docs/PORTABLE_TRANSFER.md) — explicit local transfer/recovery contract;
18. [AGENTS.md](AGENTS.md) — repository execution rules.

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

These current routes are provider foundations. The target #170/#171 Inference Fabric is not yet implemented: current code does not yet prove task-oriented provider-neutral routing, privacy-aware fallback, curated local packs, managed-plan metering, or specialized multimodal routing.

Initial Personal Alpha may reuse one strong provider/model behind separate task contracts and may use a low-cost/free testing route, but testing infrastructure must remain replaceable.

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
- automated capture-worker production;
- enforced DataClassification/ProcessingPolicy;
- Private Hybrid local/private source preprocessing.

See the capability/source/privacy docs and open issues for exact status.

## Current MCP role

The `mcp/` package remains useful as an **agent-control interface**.

The long-term architecture distinguishes:

- GitHub App/webhooks or other source connectors → ongoing event/signal ingestion;
- MCP → AI-agent commands/queries over SignalFlow's canonical application services;
- inference provider APIs/local runtimes → execution of SignalFlow `InferenceTask`s.

Do not make MCP the production event-ingestion mechanism merely because a GitHub MCP connection exists during development.

Do not treat an external assistant connected through MCP as permission to use that assistant's consumer subscription for unattended SignalFlow inference.

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

Long-running ingestion/inference/capture/render/publishing must not be designed around one Vercel request; those flows belong behind durable jobs/workers or an explicitly paired edge capability where policy requires it.

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
- Inference is task/provider-neutral and privacy-policy aware.
- Free/testing AI routes are replaceable adapters.
- Private repositories use minimum necessary evidence and enforceable processing policy.
- External AI assistants are optional clients, not a hidden free backend.
- Web/mobile/extension/desktop-edge remain one canonical product.
- Capture/media production should be repeatable and privacy-aware.
- Direct success is claimed only after the destination confirms it.
- Future capabilities are never documented as current capabilities without evidence.
- Build complete vertical user journeys before expanding breadth.

Start with [AGENTS.md](AGENTS.md) before making repository changes.
