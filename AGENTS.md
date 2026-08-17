# SignalFlow Studio Agent Guide

## Mission

SignalFlow Studio is becoming a **content operating system that lets people stay focused on their real work while SignalFlow handles the burden between what happened, what is worth communicating, what media it needs, and how the approved result reaches the right destination**.

The intended product is not a generic post generator, a prompt wrapper, a social scheduler that must be manually filled, a professional creative-suite replacement, or a dashboard full of model controls.

The target lifecycle is:

```text
Work / manual thought / connected source / Direct Create request
        ↓
ContentSignal / explicit creative intent
        ↓
ContentOpportunity / ContentPiece direction
        ↓
NarrativeStrategy
        ↓
MediaIntentResolution + MediaDecision
        ↓
Evidence + MediaRequirement + MediaPlan
        ↓
text + image / carousel / capture / video production as required
        ↓
PlatformVariant(s)
        ↓
Review / exact text+media approval
        ↓
Editorial Calendar / PublicationRequest
        ↓
Durable Publication
        ↓
NarrativeMemory + eligible Feedback learning
```

> **The user's job is judgment. SignalFlow's job is everything between the work and that judgment.**

The currently implemented manual campaign flow remains a valid foundation and should evolve into the **Create** path. Do not mistake the current UI architecture for the permanent product architecture.

## Read this first

Before changing product behavior, read in this order:

1. `docs/PRODUCT_VISION.md`
2. `docs/PERSONAL_ALPHA_EXECUTION.md`
3. `docs/CONTENT_INTELLIGENCE_ARCHITECTURE.md`
4. `docs/IDENTITY_MEMORY_AND_AUTHENTICITY.md`
5. `docs/INFERENCE_AND_PRIVACY_ARCHITECTURE.md`
6. `docs/AI_CLIENT_INTEGRATIONS.md`
7. `docs/CLIENT_ECOSYSTEM_AND_EDGE_AGENT.md`
8. `docs/MEDIA_INTELLIGENCE_AND_CREATIVE_PRODUCTION.md`
9. `docs/CREATIVE_MEDIA_DOMAIN_CONTRACTS.md`
10. `docs/CAPTURE_AND_MEDIA_PRODUCTION.md`
11. `docs/EDITORIAL_CALENDAR_AND_PUBLISHING.md`
12. `docs/PRODUCT_INFORMATION_ARCHITECTURE.md`
13. `docs/CAPABILITY_MATRIX.md`
14. `docs/INFERENCE_CLIENT_CAPABILITY_MATRIX.md`
15. `docs/DOMAIN_ARCHITECTURE.md`
16. `docs/SOURCE_ASSET_CONTRACT.md`
17. `docs/CAMPAIGN_EDITING_AND_VERSIONING.md`
18. `docs/PORTABLE_TRANSFER.md`
19. `docs/CONNECTOR_READINESS.md`
20. `SECURITY.md`

When target architecture and current capability truth differ, **the capability matrix/current code determine what may be claimed as implemented**, while canonical product docs determine the direction new work must follow.

## Product source of truth

### Target product direction

- `docs/PRODUCT_VISION.md` — canonical product definition and principles.
- `docs/CONTENT_INTELLIGENCE_ARCHITECTURE.md` — Signals/Opportunities/Campaign/ContentPiece/Memory domain.
- `docs/IDENTITY_MEMORY_AND_AUTHENTICITY.md` — identity, perception, boundaries, feedback learning and narrative memory.
- `docs/INFERENCE_AND_PRIVACY_ARCHITECTURE.md` — provider-neutral AI tasks, managed/BYOK/local/private modes, cost routing, data classification and processing policy.
- `docs/AI_CLIENT_INTEGRATIONS.md` — ChatGPT/Claude/Codex/Gemini/other agent boundaries; external assistants as clients rather than a hidden subscription backend.
- `docs/CLIENT_ECOSYSTEM_AND_EDGE_AGENT.md` — Web/Mobile/Extension/MCP/Workers/Desktop Agent responsibilities and future desktop-app capture.
- `docs/MEDIA_INTELLIGENCE_AND_CREATIVE_PRODUCTION.md` — media intent, media format decisions, image editing/generation/composition, carousels, creator footage and Direct Create.
- `docs/CREATIVE_MEDIA_DOMAIN_CONTRACTS.md` — MediaIntent/AssetRole/AssetUsePolicy/MediaDecision/MediaPlan/Image/Carousel/Video contracts and invariants.
- `docs/CAPTURE_AND_MEDIA_PRODUCTION.md` — safe automatic screenshot/screencast/product-demo production.
- `docs/EDITORIAL_CALENDAR_AND_PUBLISHING.md` — cadence/calendar/publication model.
- `docs/PRODUCT_INFORMATION_ARCHITECTURE.md` — decision-first application structure.
- `docs/PERSONAL_ALPHA_EXECUTION.md` — existing owner-first vertical guidance; detailed execution phases may be refined separately with the product owner.

### Current implementation truth

- Product capability discovery: `frontend/app/api/capabilities/route.js`
- Domain schema/serialization: `frontend/lib/domain/contracts.mjs`
- Campaign aggregate/migration: `frontend/lib/domain/campaign.mjs`
- Edit-safe reducer: `frontend/lib/studio/campaignState.mjs`
- Campaign/channel/action state selectors: `frontend/lib/studio/campaignStatus.mjs`
- Regeneration policies: `frontend/lib/studio/regenerationPolicy.mjs`
- Application use cases: `frontend/lib/application/`
- Infrastructure adapters: `frontend/lib/infrastructure/`
- Canonical source graph: `frontend/lib/domain/sourceArtifacts.mjs`
- Implemented manual ContentSignal domain/application: `frontend/lib/domain/contentSignals.mjs`, `frontend/lib/application/contentSignalApplication.mjs`, and `docs/CONTENT_SIGNAL_IMPLEMENTATION.md`
- Implemented manual-Signal opportunity slice: `frontend/lib/domain/contentOpportunities.mjs`, `frontend/lib/application/contentOpportunityApplication.mjs`, `frontend/lib/inference/inferenceTasks.mjs`, and `/plan`; do not confuse this with complete #156/#166 or NarrativeMemory.
- Transfer: `frontend/lib/transfer/`
- Authoritative export: `frontend/lib/export/campaignExport.mjs`
- Current primary UI: `frontend/app/page.js`
- Current generation API: `frontend/app/api/launch_kit/route.js`
- Provider policy/adapters: `frontend/lib/ai/`
- Social OAuth/status: `frontend/app/api/social/` and `frontend/lib/social/`
- Confirmed-only publishing: `frontend/app/api/publish/route.js`
- Context extraction: `frontend/lib/context/`
- Browser extension: `extension/`
- MCP server: `mcp/`

## Current product truth boundaries

Do not claim target architecture as shipped functionality.

Currently implemented foundations include:

- real model-provider generation routes;
- stable browser-local campaign identity;
- authoritative current drafts;
- edit-safe regeneration/history rules;
- approval invalidation on edits;
- deterministic Markdown/JSON export;
- canonical Asset/SourceArtifact/AssetProcessing records;
- browser-local manual ContentSignal intake and lifecycle at `/signals`;
- portable browser archive/import/export;
- capability discovery;
- current MCP operations;
- connector code paths for LinkedIn, X and Reddit where configured.

Currently **not** complete production capabilities include:

- automatic ContentSignal ingestion and persistent ContentOpportunity intelligence;
- automatic work-event opportunity recommendations;
- identity/style/narrative learning;
- provider-neutral `InferenceTask` routing/metering;
- enforceable DataClassification/ProcessingPolicy across inference;
- SignalFlow Managed inference plans;
- curated downloadable local intelligence packs;
- Private Hybrid/Local Only end-to-end processing;
- ChatGPT/Claude/Codex/Gemini client integrations over the target canonical workflow;
- Today/Signals/Plan/Calendar target navigation;
- production mobile application;
- paired Desktop Edge Agent;
- desktop application capture;
- media-intent / AssetRole / AssetUsePolicy automation;
- automatic media-format recommendation;
- image editing/generation/composition through the target media contracts;
- deterministic carousel production;
- uploaded-footage Reel/Short editing;
- multimodal Direct Create convergence;
- media rights/face/voice/audio trust enforcement;
- cloud account workspace/database/object storage;
- durable full-pipeline background jobs;
- automatic browser capture worker;
- deterministic product-demo rendering;
- production scheduled publication jobs;
- broad verified social connector coverage;
- analytics/performance learning;
- unreviewed global autoposting.

The README and capability matrices must remain truthful while these are built.

## Canonical architecture direction

Dependency direction remains:

```text
UI / routes / MCP / extension / mobile / desktop agent / webhook / workers
                              ↓
                     application services
                              ↓
                    domain contracts + ports
                              ↑
 browser / memory / cloud / provider / local / connector / processor / renderer / worker adapters
```

Target records must follow this direction, including:

- `ContentSignal`, `ContentOpportunity`, `NarrativeStrategy`, `ContentPiece`, `PlatformVariant`;
- `FeedbackEvent`, `StyleMemory`, `NarrativeMemory`;
- `InferenceTask`, `InferenceRoute`, `ProcessingPolicy`, `DataClassification`;
- `MediaIntentResolution`, `AssetRoleBinding`, `AssetUsePolicy`;
- `MediaDecision`, `MediaRequirement`, `MediaPlan`;
- `ImageCompositionPlan`, `CarouselCompositionPlan`, `VideoNarrative`, `VideoEditPlan`;
- `CaptureRecipe`, `MediaComposition`, `MediaApproval`;
- `CadencePolicy`, `EditorialCalendarEntry`, `PublicationRequest`;
- `PairedDevice` and edge-job records.

## Product-domain rules

### Signals

- A signal is evidence/context, not generated copy.
- GitHub is one source, not the whole product.
- Manual thoughts/topics and `Something else…` must remain first-class.
- Do not turn every commit/event into an opportunity.
- Event ingestion must be authorized, idempotent and provenance-preserving.

### Opportunities

- Opportunity scoring must be explainable.
- The system may recommend **do not post**.
- Repetition, evidence, narrative fit, timing and user boundaries matter.
- A proposed angle list must allow a free-form override.

### Direct Create

- Direct Create is the manual intentional entry for users who already know approximately what they want.
- Begin from natural-language intent plus optional photos/videos/files/links/capture, not a giant content-type/model/platform form.
- Direct Create and automatically discovered opportunities must converge on the same ContentPiece/Media/Review/Approval domain.
- Important inferred media intent should be visible/correctable; high-risk ambiguity must fail safely.

### Campaigns/content pieces

- A campaign is a narrative container and may contain multiple content pieces over time.
- Do not force all supported destinations into every campaign.
- Platform absence is a valid recommendation.
- Narrative strategy must remain separate from destination copy.

### Identity/authenticity

- Do not solve identity with only a tone preset.
- Explicit boundaries outrank engagement optimization.
- Learned preferences require evidence and should be inspectable/correctable.
- Approval/edit/rejection events may inform memory but must not silently create irreversible personality rules.
- Narrative memory (what was said) is separate from style memory (how the user prefers to communicate).

### Inference/provider architecture

- Product code requests intelligence by `InferenceTask`, not by hard-coded provider/model.
- A free/testing provider is an adapter, never the business model or domain architecture.
- BYOK, SignalFlow Managed, local/private and future enterprise inference share application task contracts.
- Cheap/deterministic/local processing should remove noise before expensive reasoning where appropriate.
- Strong reasoning should be spent on high-value decisions rather than every raw event.
- Text, vision, image editing/generation, audio/video understanding and media direction may use different specialized providers.
- Provider fallback must re-check capability, quality, budget and policy. Never silently lower privacy.
- Consumer AI subscriptions are not generic API credits unless a provider officially supports the exact integration model.
- Never scrape another AI product's web session/cookies or reuse unsupported OAuth/CLI credentials.
- External AI assistants may operate SignalFlow through MCP/API; they are not a substitute for unattended background inference.

### Data classification/privacy routing

- Protected source/media data must have DataClassification/ProcessingPolicy before remote inference where required.
- `LOCAL_ONLY` fails closed when only remote inference is available.
- Private repositories use bounded relevant evidence; do not upload entire repositories by default.
- `PRIVATE_HYBRID` can keep raw protected evidence local/private and send minimized structured evidence remotely only when policy permits.
- Secret material should not become normal model input.
- Local CLI execution does not automatically mean local data processing; model-route policy reflects where content actually goes.

### Client ecosystem

- Web is the full workspace.
- Mobile is primarily judgment + quick capture/share + approval + calendar/exception handling.
- Browser Extension is explicit user-initiated browser context/capture, not hidden browsing surveillance.
- Structured source integrations should handle passive service events whenever possible.
- Desktop Agent owns trusted local/private capabilities such as local repositories/files/models, Private Hybrid, optional official local-agent adapters, and later desktop capture.
- Workers own durable asynchronous execution.
- All clients call the same application services and canonical records.
- A stale client cannot approve an unseen newer text/media revision.

### Media intent and asset use

- Upload does not equal permission to publish.
- MIME type does not define intent.
- Assets may be reference-only, style reference, evidence, final candidate, edit/composite source, footage, brand/audio material, capture output or derived output.
- `AssetRoleBinding` is request/content-piece scoped; `AssetUsePolicy` is a separate permission boundary.
- Reference-only/evidence-only/private assets cannot silently become final publication media.
- Original user media is immutable. Every edit/composite/render creates derived lineage.
- Media-use rules compose with ProcessingPolicy/DataClassification; the most restrictive applicable rule wins.

### Media decisions

- Not every story needs media; `NONE` is a successful `MediaDecision`.
- Not every destination needs the same media or any variant.
- Existing real evidence/reusable assets should be considered before new generation.
- Explicit user media instructions outrank recommendation unless safety/privacy/rights block them.
- Media recommendations should be explainable without storing/revealing hidden model chain-of-thought.

### Image production

- Do not model image AI as one boolean capability.
- Distinguish image understanding, editing, generation, compositing, background removal, upscale/restoration, OCR/layout direction and visual critique.
- Prefer deterministic composition for exact product screenshots, typography, cards, comparisons and brand layouts.
- Generative editing/generation is optional and must preserve provenance/policy.
- Do not generatively alter factual product evidence while representing it as exact unchanged UI unless explicitly allowed and clearly treated as illustrative.

### Carousels

- A carousel is a sequential narrative, not only `images[]`.
- Store stable slide IDs, semantic roles, content, source/evidence bindings and layout primitives.
- AI may plan meaning/sequence; deterministic rendering should own typography/spacing/brand dimensions.
- Natural-language edits should be surgical: revise/reorder/rebind the affected slide rather than regenerate everything without need.
- Final publication binds the exact approved rendered carousel revision.

### Creator footage/video editing

- User-uploaded footage and CaptureRecipe footage use different acquisition paths but converge on canonical Assets/MediaPlans/MediaComposition.
- Separate `VideoNarrative` (meaning) from `VideoEditPlan` (timeline mechanics).
- Routine trims/cuts/reorder/reframe/captions/overlays/simple transitions/audio treatment/encoding should be deterministic where possible.
- Natural-language changes mutate structured edit plans.
- Do not build a Premiere/DaVinci replacement as the initial creator-video goal.
- Generative video is optional later, not required for ordinary footage editing or real product demos.

### Rights, consent, face/voice/audio

- Uploaded media does not automatically have unrestricted rights.
- Preserve relevant rights/source/license/generated provenance.
- Treat material face modification/replacement, voice cloning, lip sync and avatar generation as higher-risk explicit capabilities, not generic "improve" operations.
- Do not silently add unknown copyrighted music.
- Rights/consent/privacy blockers can prevent media approval/publication.

### Capture/media

- AI should direct media; deterministic capture/composition is preferred for repeatable product demos.
- Bounded CaptureRecipes are preferred over random agent clicking.
- Automated capture must be authorized/target-scoped/privacy-aware.
- Raw captures and rendered derivatives require canonical Asset provenance.
- Long media operations belong behind durable jobs/workers.
- Browser capture, uploaded footage and later desktop capture must reuse the same Asset/revision/approval substrate.

### Editorial calendar

- Cadence is a target/constraint policy, not a recurring content factory.
- An empty slot is valid.
- Campaign pieces should be sequenced intentionally rather than published everywhere simultaneously by default.
- The calendar is editorial state plus execution state, not only timestamps.

### Publishing

- Publishing remains an external reputational side effect.
- Publication intent binds exact draft/media output versions, target identity, approval, source state and idempotency key.
- A publication job must never resolve `latest media` at execution time.
- `connected=true` is insufficient; connectors expose verified capabilities/scopes/targets including media types.
- Manual copy/export/finalization is not direct publication success.
- `unknown` external outcomes remain unknown until reconciled.
- No unapproved revised content/media may replace an approved scheduled revision silently.

## Existing editing/versioning rules that remain mandatory

- Never replace an edited draft silently.
- Full regeneration with edited drafts requires deliberate policy.
- Per-channel regeneration mutates only the requested channel.
- Failed/invalid regeneration leaves current work intact.
- Editing clears approval for the affected exact revision.
- Save updates the current stable ID; Save as copy allocates a new ID.
- Current edited revision is authoritative.
- Restore remains reversible where current versioning supports it.
- The same principles extend to image/carousel/video plan revisions: change only dependent work, preserve history, and invalidate approval when the approved output materially changes.

## Infrastructure rules

- React components/domain modules do not own database/object-store/queue/provider/connector/media SDK clients.
- Persisted/protocol-crossing records require stable IDs and schema versions.
- Secrets are referenced by secure IDs/adapters, never embedded in campaign/signal/media/memory records.
- Runtime `File`, `Blob`, Request/Response and SDK objects do not cross domain boundaries.
- Browser/local/cloud/mobile/desktop-edge/worker implementations sit behind ports/application services.
- Long-running inference/capture/image/video/render/publication work must not depend on one browser tab/serverless request.
- Jobs are idempotent/retry-safe and expose persistent progress/failure/cancellation where relevant.
- Binary media belongs in blob/object storage; relational/domain records own metadata/relationships/plans/provenance.
- Device/edge jobs require explicit device identity, authorization, expiry, replay protection and idempotency.
- Do not create a separate Asset store, job engine, approval model or provenance model for creator-media features.

## GitHub integration rule

Do not use GitHub MCP as the sole production source-event architecture.

```text
GitHub App/webhooks
    → ongoing authorized work-event/signal ingestion

SignalFlow MCP
    → AI-agent commands and queries over SignalFlow application services
```

Both may coexist.

## AI client integration rule

Keep provider inference and assistant connectivity separate:

```text
SignalFlow Inference Fabric
    → official provider API / local runtime

External AI assistant
    → MCP / supported app/API
    → SignalFlow application services
```

`ChatGPT connected`, `Claude connected`, or `Codex installed` does **not** mean SignalFlow may use that consumer subscription as an unattended backend.

## Architecture sequencing rule

Prefer complete owner journeys over horizontal infrastructure breadth.

Current docs/issues contain dependency guidance, but **do not treat it as the final execution plan**. Detailed phases, stack/provider choices, parallelization, infrastructure rollout and cost plan are to be agreed separately with the product owner before broad implementation.

Important dependency constraints already decided:

- land only the thin #171/#172 inference/privacy boundary needed to avoid hard-wiring the first Golden Path;
- do not block the first text/editorial Golden Path on the entire local/mobile/desktop/creative-media roadmap;
- when media is attached, #179 role/use-policy must prevent unsafe assumptions;
- reuse canonical Asset/job/revision/approval architecture across image/carousel/capture/video features;
- build complete vertical outcomes rather than closing infrastructure-only fragments as finished product features.

## UX rules

- Default product home should eventually be `Today`: decisions/exceptions requiring attention.
- `Create` is the manual/direct entry path.
- Direct Create should accept natural language plus photos/videos/files/links/capture without forcing content-type/provider forms first.
- Provider/model configuration belongs behind Connections/Settings/Advanced for normal users.
- Normal users should eventually choose a simple AI/privacy mode rather than repeatedly choosing model IDs.
- Distinguish `AI provider` from `AI assistant` in Connections/Settings.
- Do not require platform selection before SignalFlow can recommend where a story fits.
- Keep `Something else…` available where options are proposed.
- Media interpretations such as final/reference/evidence/edit/combine/do-not-publish should be visible/correctable when material.
- Review prioritizes exact content/media and the user decision, not infrastructure status.
- Review must expose exact image/carousel/video revision and privacy/rights blockers.
- Persistent state cannot rely only on toasts.
- Mobile should support capture/share/approval/reject/change/schedule recovery without duplicating the whole desktop Studio.
- Lock-screen notifications avoid private content by default.
- WCAG 2.2 AA is the target for supported primary workflows.
- Avoid cramped dashboards, oversized marketing cards, tiny functional text, nested scroll traps and floating bars that cover content.

## Styling architecture

Current implementation styling rules remain until UI architecture work deliberately replaces them:

- scope application styles under `.app-shell`;
- improve authoritative style owners rather than adding late global override layers;
- test responsive/zoom behavior;
- preserve readable forms/editors;
- do not interpret current Source/Destinations/Review layout as permanent navigation architecture.

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

Feature-specific work additionally requires the evidence defined by its issue: contract, migration, authorization, visual, accessibility, worker recovery, inference-route/privacy-policy, AssetUsePolicy/rights, media-lineage, render/revision, device/edge, connector credentials or other relevant gates.

## Completion rules

Never close an implementation issue merely because code exists, a file rendered once, or the build is green.

Close only when:

- the vertical user outcome is real;
- acceptance criteria pass;
- current and target docs remain consistent;
- capability flags are truthful;
- failure/recovery/cancellation states work where relevant;
- no approved/manual work is lost;
- originals/provenance/permissions are preserved;
- relevant security/privacy/rights boundaries are tested;
- external side effects are credential-backed where claimed;
- provider/inference/media routes are verified where claimed;
- exact text/media revision approval is preserved;
- screenshots/rendered/browser evidence is attached for visual/capture work;
- documentation names anything still incomplete.

## Final product rule

> **Reduce the amount of content work the user has to think about. Do not automate the production of noise.**
