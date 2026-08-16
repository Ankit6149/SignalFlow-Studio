# SignalFlow Studio

SignalFlow Studio is evolving into a **content operating system for people who want to stay focused on their real work instead of continuously deciding what to post, recording/editing media, adapting the same idea for every platform, and managing a publishing calendar by hand**.

The intended experience is:

```text
Work normally or tell SignalFlow directly what you want to create
    ↓
SignalFlow notices useful signals or accepts a manual thought/topic/assets
    ↓
SignalFlow recommends what may be worth talking about and why
    ↓
You choose an angle or write "Something else"
    ↓
SignalFlow decides whether the story needs no media, existing media, edits, a carousel, a demo, or a video
    ↓
SignalFlow gathers evidence and creates/edits/composes the required text and media
    ↓
SignalFlow adapts the story only to destinations that genuinely fit
    ↓
You review, edit, reject, or approve exact revisions
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
>
> **Media principle:** First understand what supplied media means and what the user allows. Then decide what the story needs. Only then choose how to produce it.

## Product direction versus current implementation

This repository contains a working review-first campaign foundation and a larger target product architecture.

Documentation must keep those two truths separate.

### Current implemented foundation

The current product can:

- accept a campaign/source brief;
- ingest supported public links and GitHub repository context within current safety/implementation limits;
- accept supported browser file inputs and canonical source/asset records;
- capture, edit, ignore, snooze, archive, restore, and recover browser-local manual `ContentSignal` records at `/signals` without first creating a Campaign or invoking AI;
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

- automatic ContentSignal ingestion from connected work events and persistent ContentOpportunity intelligence;
- automatic opportunity recommendations from connected work events;
- long-lived identity/style/narrative learning;
- a `Today` decision inbox;
- editorial cadence planning;
- provider-neutral Inference Fabric/Private Hybrid/local intelligence;
- automatic media-intent/AssetRole/AssetUsePolicy interpretation;
- automatic media-format recommendation;
- image editing/generation/compositing through the target media architecture;
- deterministic carousel production;
- uploaded-footage Reel/Short editing;
- multimodal natural-language Direct Create convergence;
- media rights/face/voice/audio trust enforcement;
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

The old conceptual center—`brief → destinations → generate package`—is now only one compatibility/manual path.

The canonical lifecycle is:

```text
Signals or Direct Create request
  ↓
Opportunities / explicit creative intent
  ↓
Narrative / Campaign Plan
  ↓
Media Intent + Media Decision
  ↓
Evidence + Media Production
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

## Signals

A `ContentSignal` is something that happened or something the user supplied that *might* be worth communicating.

Examples:

- a meaningful GitHub release/merge/milestone;
- a deployed product change;
- a browser capture;
- a document, link, screenshot, recording, research note, or changelog;
- a manual thought, lesson, opinion, question, launch, personal update, or external topic;
- future connected work sources when explicitly authorized.

GitHub is one high-value source. SignalFlow is **not a GitHub-only content product**.

## Opportunities

The Editorial Brain ranks whether a signal is worth discussing based on freshness, importance, novelty, evidence, narrative fit, audience relevance, repetition risk, visual potential, timing, platform fit, and user boundaries.

It may legitimately conclude **do not post**.

## Direct Create

Sometimes the user already knows what they want.

Examples:

- "Make a Reel from these clips."
- "Turn this document into a carousel."
- "Post about XYZ; these images are only references."
- "Combine these screenshots into one launch image."
- "Use this photo but remove the background."
- "Write about this topic and decide whether it needs media."

Direct Create is not a separate product. Natural-language intent plus photos/videos/files/links should converge on the same canonical ContentPiece, MediaRequirement, MediaPlan, revision, review and approval architecture used by automatically discovered opportunities.

See `docs/MEDIA_INTELLIGENCE_AND_CREATIVE_PRODUCTION.md` and issue #184.

## Campaigns

A campaign is a narrative, not a container that must produce twelve simultaneous posts.

One campaign may intentionally sequence:

- a LinkedIn reason/story;
- an X demo;
- a later technical discussion;
- an Instagram carousel or Reel;
- a YouTube walkthrough;
- a retrospective weeks later.

Some destinations should receive nothing when the story does not fit them.

## Media intelligence

SignalFlow must understand that an uploaded image/video can be:

- reference only;
- style reference;
- evidence;
- a final candidate;
- an edit source;
- a composite source;
- raw footage;
- brand/audio material;
- private content that must never be published.

Upload does not equal permission to publish.

The target media flow is:

```text
user instruction + assets + narrative
    ↓
MediaIntentResolution
    ↓
AssetRoleBinding + AssetUsePolicy
    ↓
MediaDecision
    ↓
none / reuse / edit / composite / generate / carousel / capture / video edit
    ↓
MediaRequirement
    ↓
MediaPlan
    ↓
immutable derived Asset / MediaComposition revisions
    ↓
privacy + rights + quality + authenticity review
    ↓
exact approval
```

Original user media remains immutable. Edits and renders become derived revisions with full lineage.

See:

- `docs/MEDIA_INTELLIGENCE_AND_CREATIVE_PRODUCTION.md`;
- `docs/CREATIVE_MEDIA_DOMAIN_CONTRACTS.md`;
- issues #179–#185.

## Image production

SignalFlow should distinguish:

- image understanding;
- deterministic crop/resize/layout/composition;
- background removal/restoration/upscale;
- generative image editing;
- new image generation;
- visual quality critique.

Use deterministic composition when preserving exact screenshots/product UI/typography. Use generative editing/generation only where the requested transformation requires it and policy allows it.

Real evidence should be preferred over synthetic decoration when making factual/product claims.

## Carousels

A carousel is a sequential narrative, not merely `images[]`.

Target slide roles include hook, problem, insight, process, screenshot, diagram, comparison, metric, quote, list, timeline, code, closing and CTA.

AI should plan meaning/sequence/visual bindings; deterministic renderers should own typography, spacing, brand consistency and output dimensions.

Slide-level edits should be surgical rather than regenerating the entire carousel.

See issue #182.

## Uploaded-footage video production

SignalFlow should eventually handle the common creator workflow:

```text
raw uploaded clips
→ transcription/scene understanding
→ strong-moment selection
→ VideoNarrative
→ VideoEditPlan
→ deterministic trim/cut/reframe/caption/audio/overlay render
→ exact video revision review
```

The target is useful basic creator automation—Reels/Shorts and common social edits—not a Premiere/DaVinci replacement.

See issue #183.

## Automatic capture and product demos

For real product demonstrations, SignalFlow should prefer safe repeatable capture instead of asking the user to record routine flows manually.

```text
MediaRequirement
    ↓
CaptureRecipe
    ↓
bounded browser/edge capture
    ↓
canonical screenshot/screencast Asset
    ↓
structured composition/edit plan
    ↓
platform derivatives
```

Automatic capture remains bounded, authorized and privacy-aware. Browser CaptureRecipe is documented separately from future desktop-app capture.

See `docs/CAPTURE_AND_MEDIA_PRODUCTION.md`.

## Approval

SignalFlow targets **approval-first automation**.

The owner-first goal is:

1. SignalFlow may observe, suggest, produce, prepare, edit and schedule;
2. the user approves the exact current text/media revisions;
3. publication executes only those approved revisions;
4. edits after approval invalidate/update publication intent according to explicit policy.

Approval never binds "latest" media implicitly.

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

Media follows the same boundary principle. Explicit restrictions such as "do not alter my face", "reference only", or "do not publish this screenshot" outrank visual optimization.

Identity and explicit boundaries outrank engagement optimization.

See `docs/IDENTITY_MEMORY_AND_AUTHENTICITY.md`.

## Inference architecture

SignalFlow should not be tied to one provider, testing quota, consumer subscription or device.

Application code requests task-oriented capabilities through a provider-neutral Inference Fabric.

Target modes:

```text
SignalFlow Managed
Bring Your Own Provider
Private Hybrid
Local Only
Enterprise Private later
```

Media tasks such as image understanding/editing/generation or footage understanding must use the same privacy/capability-aware routing rather than bypassing the inference architecture.

External assistants such as ChatGPT/Claude/Codex/Gemini may operate SignalFlow through supported MCP/app/API interfaces; they are not assumed to be free interchangeable backend API credits.

See:

- `docs/INFERENCE_AND_PRIVACY_ARCHITECTURE.md`;
- `docs/AI_CLIENT_INTEGRATIONS.md`;
- `docs/CLIENT_ECOSYSTEM_AND_EDGE_AGENT.md`.

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

See `docs/EDITORIAL_CALENDAR_AND_PUBLISHING.md`.

## Client ecosystem

The intended product is one canonical application with multiple purpose-specific clients:

- **Web** — full workspace/planning/review/configuration;
- **Mobile** — judgment, quick capture/share, review/approval, calendar and exceptions;
- **Browser extension** — deliberate browser context/capture;
- **MCP/API** — external AI-agent control/query;
- **Desktop Edge Agent** — private repos/files, local models, Private Hybrid, signed edge jobs and later desktop capture;
- **Workers** — durable background inference/capture/render/publishing.

These clients must share application/domain rules instead of implementing separate products.

## Target product navigation

The intended long-term workspace is decision-first:

- **Today** — what needs judgment now;
- **Signals** — what SignalFlow noticed or the user added;
- **Plan** — opportunities and campaign narratives;
- **Calendar** — editorial sequence/publication state;
- **Create** — natural-language intentional creation with optional photos/videos/files/links/capture;
- **Assets** — evidence, originals, references, captures, derived/rendered media;
- **Library** — campaign/publication history;
- **Connections** — source + destination + AI connections;
- **Voice** — identity, perception, boundaries, learned preferences;
- **Settings** — provider/account/workspace/privacy/advanced configuration.

The current Source → Destinations → Review flow should eventually become a compatibility/manual Create path rather than the permanent center of the whole product.

## Owner-first execution strategy

SignalFlow should prove the hard product loop before broad SaaS expansion.

A final execution phase plan will be decided separately; the architectural ordering currently implies:

1. provider-neutral/privacy-safe inference foundation thin enough for the first Golden Path;
2. manual thought → opportunity → authentic text review;
3. media intent/use-policy when attachments are present;
4. real GitHub signal → opportunity → evidence;
5. automatic screenshot/product-demo proof;
6. deterministic carousel/static composition proofs;
7. uploaded-footage short-video proof;
8. durable publishing/memory/learning;
9. hosted/mobile/edge breadth as each vertical path requires it.

Do not interpret this section as a finalized execution schedule; implementation phases will be decided after architecture discussion is complete.

## Canonical documentation

Read these before changing product architecture:

1. `docs/PRODUCT_VISION.md` — what SignalFlow is and is not;
2. `docs/CONTENT_INTELLIGENCE_ARCHITECTURE.md` — Signals/Opportunities/Campaign/ContentPiece/Memory domain;
3. `docs/IDENTITY_MEMORY_AND_AUTHENTICITY.md` — personal voice, perception, boundaries, feedback learning;
4. `docs/INFERENCE_AND_PRIVACY_ARCHITECTURE.md` — provider-neutral inference, BYOP/local/private routing;
5. `docs/AI_CLIENT_INTEGRATIONS.md` — ChatGPT/Claude/Codex/Gemini/agent integration boundaries;
6. `docs/CLIENT_ECOSYSTEM_AND_EDGE_AGENT.md` — web/mobile/extension/desktop/worker responsibilities;
7. `docs/MEDIA_INTELLIGENCE_AND_CREATIVE_PRODUCTION.md` — media intent, decisions, image/carousel/video production;
8. `docs/CREATIVE_MEDIA_DOMAIN_CONTRACTS.md` — media domain records/invariants/application boundaries;
9. `docs/CAPTURE_AND_MEDIA_PRODUCTION.md` — safe automatic product capture and deterministic demos;
10. `docs/EDITORIAL_CALENDAR_AND_PUBLISHING.md` — cadence, calendar, approval and durable publishing;
11. `docs/PRODUCT_INFORMATION_ARCHITECTURE.md` — decision-first application structure;
12. `docs/PERSONAL_ALPHA_EXECUTION.md` — existing owner-first vertical execution guidance, to be refined during execution planning;
13. `docs/DOMAIN_ARCHITECTURE.md` — current domain/application/adapter boundaries;
14. `docs/SOURCE_ASSET_CONTRACT.md` — source/asset truth;
15. `docs/CAPABILITY_MATRIX.md` — what the current product can actually do;
16. `docs/CAMPAIGN_EDITING_AND_VERSIONING.md` — current edit/version invariants;
17. `docs/CONNECTOR_READINESS.md` — connector verification truth;
18. `docs/PORTABLE_TRANSFER.md` — explicit local transfer/recovery contract;
19. `AGENTS.md` — repository execution rules.

## Current destination set

Current campaign generation recognizes:

- Social: LinkedIn, X, Instagram, Facebook, Threads
- Community: Reddit, Hacker News
- Video: YouTube, TikTok
- Owned: Newsletter, Blog, Release notes

Generation support does **not** imply direct publishing or rich-media support.

Current direct connector code paths exist for LinkedIn, X, and Reddit, but a connector is production-ready only after real credential/account/scopes/publish/retry/expiry/rate-limit verification. Media publication capability must additionally verify image/video/carousel/multi-image/platform-audio behavior as applicable.

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

A route is usable only when current capability state reports it available for the deployment/session.

The target Inference Fabric may reuse one strong provider/model initially but must preserve separate task contracts and privacy/capability routing.

## Current persistence truth

Today:

- saved campaigns are browser-local;
- manual ContentSignal history is also browser-local under the versioned signal repository and survives refresh/reopen;
- ContentSignal history is not yet part of the portable campaign archive or cloud sync;
- there is no production cloud campaign database/account workspace/cross-device sync yet;
- canonical Campaign, Asset, SourceArtifact, AssetProcessing and transfer contracts exist;
- browser portable archive/import/export exists;
- production hosted object storage and durable background job infrastructure are not yet implemented;
- target media-intent/image/carousel/video-edit records are documented but not yet implemented.

Future cloud persistence must implement application/domain ports rather than placing database/object-store/media-provider logic directly into React components.

## Current source and asset truth

Implemented foundations include canonical versioned Asset/SourceArtifact/AssetProcessing records and browser-side handling for supported inputs.

Still incomplete/planned include:

- hardened remote URL ingestion across all source paths;
- full source-health diagnostics;
- remote evidence version/revalidation;
- OCR/transcription/visual-analysis processors;
- durable cloud asset storage;
- acknowledged full extension screenshot/recording ingestion;
- media role/use-policy/rights contracts;
- image edit/generation/composition;
- carousel rendering;
- uploaded-footage editing;
- automated capture-worker production.

See the capability/source/media docs and open issues for exact status.

## Current MCP role

The `mcp/` package remains useful as an **agent-control interface**.

The long-term architecture distinguishes:

- GitHub App/webhooks or other source connectors → ongoing event/signal ingestion;
- MCP → AI-agent commands/queries over SignalFlow's canonical application services.

MCP must not bypass media-use/privacy/approval rules.

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

A feature is not complete because it compiles. Its domain contract, authorization, failure/recovery behavior, truthful capability state, UX, accessibility, migration/rollback, security, provenance and end-to-end user journey must pass the acceptance criteria owned by its issue.

## Vercel

Current frontend deployment configuration:

```text
Root Directory: frontend
Framework Preset: Next.js
Install Command: npm install
Build Command: npm run build
Output Directory: .next
```

Long-running ingestion/inference/capture/image-edit/video/render/publishing must not be designed around one Vercel request; those flows belong behind durable jobs/workers or authorized edge execution as appropriate.

## Core product principles

- User judgment remains the publication authority.
- SignalFlow reduces attention burden instead of adding configuration burden.
- Anything can become a manual signal or direct creative input; GitHub is only one source.
- Not every signal deserves content.
- Not every content piece needs media.
- Not every campaign belongs on every platform.
- Not every destination needs the same media.
- Not every calendar slot must be filled.
- Upload does not equal permission to publish.
- Original source media is immutable; edits create derived revisions.
- Reference/evidence/private media cannot silently become public output.
- Real evidence is preferred over synthetic decoration for factual/product claims.
- AI directs semantic choices; deterministic systems perform repeatable transforms/renders where possible.
- Natural-language edits should mutate structured plans rather than erase editable state.
- Identity, asset restrictions and explicit boundaries outrank engagement optimization.
- Source evidence remains traceable.
- Approved/manual edits are never silently overwritten.
- Exact approved text/media revisions are bound to publication intent.
- Capture/media production should be repeatable and privacy/rights-aware.
- Direct success is claimed only after the destination confirms it.
- Future capabilities are never documented as current capabilities without evidence.
- Build complete vertical user journeys before expanding breadth.

Start with `AGENTS.md` before making repository changes.
