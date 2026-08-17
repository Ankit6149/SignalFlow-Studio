# SignalFlow Studio — Capability Matrix

> **Purpose:** this document states what the current deployment/session can actually use. It intentionally distinguishes **target product architecture** from **implemented capability**.

SignalFlow is one product with hosted/local/self-hosted deployment profiles. Clients must read `GET /api/capabilities` and resource-specific state instead of inferring availability from documentation, hostname, visible UI, installed dependencies, or future roadmap records.

Capability documents must not contain raw credentials, OAuth tokens, captured page content, prompts, drafts, signed private URLs, identity-profile content, private asset bytes, or private media transcripts.

## 1. Contract

- Schema: `frontend/lib/capabilities/capabilityContract.mjs`
- Current implemented schema version: `1`
- Endpoint: `GET /api/capabilities`
- Consumers: Studio web client, browser-extension handshake, MCP server, and future workers/clients
- Cache policy: `no-store`
- Compatibility: clients ignore unknown future fields but fail closed when known required fields are missing/invalid

## 2. Core truth rule

A feature may be:

```text
documented as target architecture
        ≠
domain contract implemented
        ≠
infrastructure configured
        ≠
available to this session
        ≠
credential-backed production verified capability
```

UI/public claims use the last applicable truthful state, not the most optimistic one.

## 3. Current truthful capability matrix

| Capability | Hosted anonymous | Hosted owner | Local | Self-hosted |
| --- | --- | --- | --- | --- |
| Versioned browser-local Campaign save | Available | Available | Available | Available |
| Legacy browser-library migration | Available | Available | Available | Available |
| Authoritative edited draft + generated baseline/history | Available | Available | Available | Available |
| Edit-safe per-channel/full regeneration policy | Available | Available | Available | Available |
| Versioned approval/current revision rules | Available | Available | Available | Available |
| Canonical Asset / SourceArtifact / AssetProcessing contract | Available | Available | Available | Available |
| Browser-local manual `ContentSignal` intake/lifecycle | Available | Available | Available | Available |
| Browser-local manual-Signal `ContentOpportunity` + angle decision | Available when a permitted model route is configured | Available when configured | Available when configured | Available when configured |
| Browser-local explicit Identity/Perception/Voice/Boundary profiles | Available | Available | Available | Available |
| Browser-local NarrativeStrategy/ContentPiece/LinkedIn-X PlatformVariant planning | Available when a permitted model route is configured | Available when configured | Available when configured | Available when configured |
| Generated read-only LinkedIn/X `PlatformVariantRevision` | Available when a permitted model route is configured | Available when configured | Available when configured | Available when configured |
| Hardened remote URL evidence fetch (#127) | Not implemented | Not implemented | Not implemented | Not implemented |
| Complete source-health diagnostics (#128) | Not implemented | Not implemented | Not implemented | Not implemented |
| Remote evidence revalidation/version adoption (#129) | Not implemented | Not implemented | Not implemented | Not implemented |
| Retention/deletion background enforcement | Not implemented | Not implemented | Not implemented | Not implemented |
| Portable `.signalflow.json` browser prepare/download | Available | Available | Available | Available |
| Validated browser import Skip/Copy/Replace + rollback reports | Available | Available | Available | Available |
| Production hosted workspace transfer destination | Not implemented | Not implemented | Not applicable | Not implemented |
| Silent cross-deployment synchronization | Not implemented | Not implemented | Not applicable | Not implemented |
| Authoritative Markdown / JSON export | Available | Available | Available | Available |
| ZIP compatibility API | Owner-only route; not primary product surface | Owner-only route | Owner-operated | Owner-operated |
| Hosted account/workspace system | Not implemented | Not implemented | Not applicable | Not implemented |
| Production cloud campaign/intelligence database | Not implemented | Not implemented | Not applicable | Not implemented |
| Private production object storage | Not implemented | Not implemented | Not applicable | Not implemented |
| Durable background jobs (#73) | Not implemented | Not implemented | Not implemented | Not implemented |
| Cloud autosave/cross-device sync | Not implemented | Not implemented | Not applicable | Not implemented |
| Collaboration/team review | Not implemented | Not implemented | Not applicable | Not implemented |
| Temporary BYOK cloud provider | Available for declared providers | Available | Available | Available |
| Server-managed provider credentials | Unavailable | Available when configured | Available when configured | Available when configured |
| Custom OpenAI-compatible gateway | Unavailable | Available | Available | Available |
| Ollama / LM Studio | Unavailable | Available only with reachable trusted URL | Available | Available |
| Public link context | Available within current implementation boundaries | Available | Available | Available |
| Public GitHub repository URL context | Available | Available | Available | Available |
| Trusted local filesystem repository | Unavailable | Unavailable on public hosting | Opt-in through `SIGNALFLOW_ALLOW_LOCAL_REPO=true` | Opt-in through `SIGNALFLOW_ALLOW_LOCAL_REPO=true` |
| Manual copy/export/open handoff | Available | Available | Available | Available |
| Official connector administration | Unavailable | Available when configured | Available when configured | Available when configured |
| LinkedIn/X/Reddit connector code paths | Code present; session/config dependent | Code present; config dependent | Code present; config dependent | Code present; config dependent |
| Production-verified connector status | Requires real credential/account verification | Requires real verification | Requires real verification | Requires real verification |
| Durable scheduled publishing (#103) | Not implemented | Not implemented | Not implemented | Not implemented |
| MCP current supported workflow | Unavailable to anonymous hosted session | Available with explicit access context | Available | Available |
| Extension capability handshake | Available | Available | Available | Available |
| Acknowledged extension ingestion | Not implemented | Not implemented | Not implemented | Not implemented |
| Extension screenshot/recording ingestion | Not implemented | Not implemented | Not implemented | Not implemented |
| Billing/usage quota enforcement | Not implemented | Not implemented | Not implemented | Not implemented |

## 4. Target content-operating-system capabilities — currently planned unless stated otherwise

These rows exist so clients/docs/agents do not confuse the new architecture with shipped functionality.

| Target capability | Current status | Owning issues/docs |
| --- | --- | --- |
| Canonical `ContentSignal` persistence/manual intake | Implemented browser-local; hosted persistence/automatic ingestion still planned | #152, `CONTENT_SIGNAL_IMPLEMENTATION.md` |
| GitHub App/webhook → ContentSignal ingestion | Planned | #161, `GITHUB_INTEGRATION_AND_MCP.md` |
| Explainable `ContentOpportunity` evaluation/ranking | Implemented for browser-local manual Signals; automatic multi-source intelligence and memory-aware ranking still planned | #156/#166 |
| Opportunity angle options + `Something else` | Implemented for persisted manual-Signal opportunities in `/plan`; selected angles can now continue into a persisted NarrativeStrategy | #156/#159/#166 |
| Persistent Identity/Perception/Voice/Boundary profiles | Implemented browser-local for explicit owner profiles + version history + LinkedIn/X expression + identity-context snapshots; hosted sync and automatic inference still planned | #153/#166 |
| Learned explainable StyleMemory | Planned | #154 |
| Narrative/publication memory + semantic repetition | Planned | #155 |
| NarrativeStrategy / ContentPiece / PlatformVariant domain | Implemented browser-local for the owner Golden Path, including explicit strategy approval and destination omission; hosted/team migration breadth remains planned | #157/#166 |
| Staged generation orchestration | Partially implemented: `opportunity_evaluation` → `narrative_strategy` → destination-specific `platform_variant` writing → separate `evidence_critique` + `authenticity_critique` → exact human review/approval; bounded natural-language exact-revision change requests are implemented; durable jobs and broader stages remain planned | #158/#166 |
| Authenticity quality critic | Implemented browser-local for the owner Golden Path against the exact destination-specific IdentityContextSnapshot used by the current revision; broader automated learning remains planned | #158/#166 |
| Evidence/factual quality critic integrated with staged flow | Implemented browser-local for exact current LinkedIn/X revisions using the canonical source Signal/approved strategy/ContentPiece evidence contract; broader source processors remain planned | #158/#166 |
| Today decision inbox | Planned | #159 |
| Signals workspace | Implemented for browser-local manual intake/lifecycle + explicit `Find ideas`; automatic connector ingestion still planned | #152/#159/#166 |
| Plan/opportunity/campaign-planning workspace | Implemented browser-local through opportunity explanation, angle/custom-angle decision, reviewable/approvable NarrativeStrategy, canonical ContentPiece, immutable LinkedIn/X revision history, separate critics, immutable owner edits/regeneration, and exact per-revision approve/reject decisions | #156/#157/#158/#159/#166 |
| CadencePolicy / editorial planning | Planned | #160 |
| Editorial calendar with intentionally empty slots | Planned | #160 |
| Provider-neutral InferenceTask/routing/policy fabric | Thin task/adapter + server privacy-route enforcement implemented for `opportunity_evaluation`, `narrative_strategy`, `platform_variant`, `evidence_critique`, , `authenticity_critique`, and `platform_variant_revision`; full capability registry, metering, fallback and Private Hybrid remain planned | #170/#171/#172 |
| Curated local intelligence packs | Planned | #173 |
| External AI-assistant client integrations | Planned | #174 |
| Mobile low-attention companion | Planned | #175 |
| Paired Desktop Edge Agent | Planned | #176 |
| Desktop-application bounded capture | Future/planned | #177 |
| Media intent / AssetRole / AssetUsePolicy | Planned | #179, `CREATIVE_MEDIA_DOMAIN_CONTRACTS.md` |
| Explainable MediaDecision + expanded MediaRequirement | Planned | #180 |
| Image understanding/editing/compositing/generation pipeline | Planned | #181 |
| Narrative-first deterministic carousel production | Planned | #182 |
| Uploaded-footage Reel/Short editing | Planned | #183 |
| Natural-language multimodal Direct Create | Planned | #184 |
| Media rights/consent/face/voice/audio trust layer | Planned | #185 |
| Automatic safe CaptureRecipe/browser worker | Planned | #162 |
| Automatic campaign screenshot capture/derivatives | Planned | #163 |
| Automatic deterministic raw screencast | Planned | #164 |
| Motion composition / multi-aspect video render | Planned | #165 |
| Exact media revision approval/publication binding | Planned | #151/#165/#168/#179–#185 |
| Owner Golden Path 1 manual thought → authentic approval | In progress: implemented through manual Signal → Opportunity/angle → explicit Voice → approved NarrativeStrategy → ContentPiece → immutable LinkedIn/X revisions → separate evidence/authenticity checks → immutable owner edit/regenerate → exact revision approve/reject; bounded natural-language exact-revision change requests are implemented; feedback/StyleMemory learning remains pending | #166 |
| Owner Golden Path 2 GitHub event → opportunity + visual evidence | Planned | #167 |
| Owner Golden Path 3 approved revision → durable publish → memory | Planned | #168 |
| Performance analytics ingestion/learning | Future; not yet scoped as production capability | product vision/editorial docs |
| Unreviewed global autoposting | Not a Personal Alpha capability; future explicit scoped trust only | product vision |

## 5. Creative-media truth

The repository now documents a broad media-intelligence/creative-production target, but none of the following should be claimed as working merely because the domain/design exists:

- automatic interpretation of whether an uploaded image is reference/evidence/final/edit source;
- enforceable `AssetUsePolicy`;
- image-generation or image-editing provider routing through the target Inference Fabric;
- deterministic carousel production;
- uploaded-footage automatic Reel/Short editing;
- semantic `VideoEditPlan` natural-language editing;
- rights/face/voice consent enforcement;
- multimodal Direct Create convergence;
- automatic media-format recommendation.

Current file upload/generation/media-plan fields do not prove these capabilities.

A prompt-generated image/video idea is not an image/video production system.

A list of proposed carousel slides is not a carousel renderer.

An uploaded video file is not an automatic video editor.

A model/provider that accepts images is not sufficient evidence of safe `IMAGE_EDITING`, `IMAGE_GENERATION`, or `IMAGE_COMPOSITING` capability.

## 6. Target capability namespace direction

When these capabilities are implemented, the server capability contract should evolve through a versioned schema rather than UI assumptions.

Illustrative target grouping only:

```text
capabilities.contentIntelligence
  signals
  opportunities
  narrativePlanning
  identityMemory
  narrativeMemory

capabilities.inference
  providerNeutralTasks
  managed
  bringYourOwnProvider
  privateHybrid
  localOnly

capabilities.media
  intentResolution
  assetUsePolicy
  imageUnderstanding
  imageEditing
  imageGeneration
  imageComposition
  carouselPlanning
  carouselRendering
  videoUnderstanding
  videoEditing
  transcription
  videoRendering
  supportedAspectRatios

capabilities.production
  captureWorker
  screenshots
  screencast
  mediaRenderer

capabilities.editorial
  cadencePlanning
  calendar
  scheduling

capabilities.sources.github
  eventIngestion
  repositoryEvidence

capabilities.destinations.<provider>
  available
  verifiedTarget
  publishText
  publishImage
  publishVideo
  publishCarousel
  analyticsRead
```

Do not add these fields to the public contract until their schema/implementation issue owns them and compatibility tests exist.

## 7. Canonical source/media capability

Current source contracts can represent Asset/SourceArtifact/AssetProcessing records, but a canonical record does not prove:

- remote fetch safety;
- extraction success;
- OCR;
- transcription;
- visual analysis;
- durable upload;
- deletion/retention enforcement;
- extension acknowledgement;
- automatic capture-worker production;
- media intent/use-policy enforcement;
- image editing/generation;
- carousel/video editing.

Those states remain explicit per artifact/processing/capability.

Public links must fail closed as *verified usable evidence* where #127's hardened fetch boundary is required but not implemented.

## 8. Content-intelligence truth

The owner-first browser-local path now implements manual `ContentSignal`, persisted `ContentOpportunity` evaluation/angle selection, explicit versioned Identity/Perception/Voice/Boundary context, reviewable/approvable `NarrativeStrategy`, canonical `ContentPiece`/LinkedIn-X `PlatformVariant`, immutable generated/owner-edited/AI-revised `PlatformVariantRevision` history, separate evidence/authenticity critics, and exact per-revision human approve/reject decisions.

Automatic signal ingestion, connected-source intelligence, memory-aware opportunity ranking, StyleMemory, NarrativeMemory, Today, publishing and broader hosted persistence remain target capabilities until their owning issues are complete.

Examples:

- a saved manual ContentSignal is real persisted evidence and can now be evaluated into a persisted manual-source ContentOpportunity, but it is **not** automatic work-event detection;
- an ad-hoc model-generated `strategy` object is **not** equivalent to the implemented persisted/revisioned NarrativeStrategy contract;
- a shallow `founder-style` tone field is **not** Identity; the explicit versioned Identity/Perception/Voice/Boundary records are the current implemented owner model;
- a generated `PlatformVariantRevision` is **not approved content** merely because it exists; approval is a separate exact-revision decision that is invalidated for the current path when a newer edit/requested revision/regeneration becomes current;
- campaign history is useful but is **not** NarrativeMemory until public-story semantics are implemented;
- a prompt-generated media shot list is **not** automatic capture/media production;
- a client-side schedule callback is **not** durable editorial/publication scheduling.

## 9. Capture/production truth

### Browser extension

User-initiated extension capture is a separate capability family from automatic campaign capture.

### Automatic capture worker

The product may report this available only when:

- worker/infrastructure is configured;
- a supported CaptureRecipe can execute;
- target/environment authorization is valid;
- output storage is available;
- durable job/progress behavior is functional.

Installing browser automation dependencies alone is not capability evidence.

### Media renderer

May report available only when a validated structured media plan can produce persisted output Assets through the render pipeline.

A prompt containing `videoTimeline` is not a renderer.

### Creative media

May report image/carousel/video-edit capability only when the specific capability has:

- provider/processor/renderer implementation;
- AssetUsePolicy/ProcessingPolicy enforcement;
- source/derived lineage;
- persistent job/result state where needed;
- reviewable exact revisions;
- truthful failure handling.

Do not collapse all media capability into `supportsImages` or `supportsVideo`.

## 10. Editorial planning truth

The product distinguishes:

- editorial recommendation/planning;
- media recommendation/production;
- durable publication scheduling;
- destination provider capability.

A Calendar UI alone is not durable scheduling.

A schedule is real only when server/job persistence survives browser closure/restart and execution semantics are defined.

## 11. Destination connector truth

A connector's state is richer than `connected`.

Current/future connector capability should distinguish:

- configured;
- authorized;
- verified target identity;
- scopes/products;
- expiry/revocation;
- text/image/video/carousel/multi-image capabilities;
- platform-audio capability/handoff;
- direct publish verified/unverified;
- manual-only fallback;
- provider errors/rate limits.

Publishing success is recorded only after destination confirmation.

Read `docs/CONNECTOR_READINESS.md`.

## 12. Portable transfer capability

Current portable transfer remains explicit browser ownership/recovery, not silent cloud sync.

As new identity/signal/memory/calendar/media records ship, portable ownership must be extended deliberately through new archive schema versions/compatibility rules before the product claims those records are included.

No new user-owned state should be silently left out of export forever merely because it was introduced after archive schema v1.

## 13. Campaign data rules

Current rules remain:

- current edited draft is authoritative;
- generated output is baseline/history;
- temporary provider keys/runtime browser objects are excluded;
- campaigns have stable IDs/source snapshots/generation runs;
- Markdown/JSON are deterministic projections;
- browser/memory/store-backed adapters share contracts.

The implemented Golden Path ContentPiece/PlatformVariant revision model and future legacy/media migrations must preserve these invariants.

Original user media must remain immutable when the new media architecture is implemented; edits and renders become derived revisions with full lineage.

## 14. Session/permission rules

- Public hosted deployment without valid owner/member auth reports the appropriate restricted role.
- Owner/local/self-hosted capabilities remain permission/configuration-aware.
- Local filesystem access remains explicit opt-in.
- UI may hide irrelevant controls, but server/application authorization remains the security boundary.
- `configured` and `available` are separate.
- Resource-specific capability may be unavailable even when the provider itself is connected.
- Media capability also depends on AssetUsePolicy/ProcessingPolicy/rights, not only provider availability.

## 15. Adding a capability

1. Define the owning domain/application service.
2. Define current/future deployment profiles and authorization.
3. Define privacy/media-use/rights policy where relevant.
4. Add server-owned versioned capability field/schema.
5. Add fail-closed client parsing.
6. Implement infrastructure behind a port.
7. Add capability fixtures for supported profiles/roles.
8. Add relevant migration/serialization/security/job/retry tests.
9. Add real credential-backed evidence for external side effects.
10. Update web/MCP/extension/mobile/worker/public docs.
11. Only then advertise the capability.

## 16. Capability principle

> **Documentation may describe where SignalFlow is going. Only verified implementation determines what SignalFlow can say it does today.**
