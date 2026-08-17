# Capability Matrix

SignalFlow Studio tracks capability truth in layers. A documented target is not the same thing as implemented code, configured infrastructure, current-session availability, or production verification.

## 1. Why this matrix exists

The product is intentionally moving from a campaign-generation workspace toward a content operating system. That transition creates a risk: future architecture can look like current capability if docs, UI, issues, and runtime contracts are not explicit about status.

This file is the compact implementation-truth index. The deeper product/architecture docs remain authoritative for target behavior.

## 2. Capability-state rule

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
| Explicit high-confidence `Prepare for review` → reviewed Today decision | Available when a permitted model route and explicit Voice are configured | Available when configured | Available when configured | Available when configured |
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
| Staged generation orchestration | Implemented browser-local for the owner-triggered high-confidence path: `opportunity_evaluation` → deterministic confidence/escalation policy → provenance-tagged recommended angle → `narrative_strategy` → policy acceptance → destination-specific `platform_variant` writing → separate `evidence_critique` + `authenticity_critique` → Today exact human judgment. Bounded natural-language exact-revision change requests are implemented; durable/background jobs and broader stages remain planned | #158/#166/#206 |
| Authenticity quality critic | Implemented browser-local for the owner Golden Path against the exact destination-specific IdentityContextSnapshot used by the current revision; broader automated learning remains planned | #158/#166 |
| Evidence/factual quality critic integrated with staged flow | Implemented browser-local for exact current LinkedIn/X revisions using the canonical source Signal/approved strategy/ContentPiece evidence contract; broader source processors remain planned | #158/#166 |
| Today decision inbox | Implemented browser-local as a derived exact-revision judgment queue over canonical Golden Path records; explicit owner-triggered high-confidence Signal→review-ready preparation is implemented, while automatic background/connected-source triggers remain planned | #159/#166/#204/#206 |
| Signals workspace | Implemented for browser-local manual intake/lifecycle + primary `Prepare for review` high-confidence orchestration + explicit `Find ideas` manual recovery; automatic connector/background ingestion still planned | #152/#159/#166/#206 |
| Plan/opportunity/campaign-planning workspace | Implemented browser-local through opportunity explanation, angle/custom-angle decision, reviewable/approvable NarrativeStrategy, canonical ContentPiece, immutable LinkedIn/X revision history, separate critics, immutable owner edits/regeneration, and exact per-revision approve/reject decisions | #156/#157/#158/#159/#166 |
| CadencePolicy / editorial planning | Planned | #160 |
| Editorial calendar with intentionally empty slots | Planned | #160 |
| Provider-neutral InferenceTask/routing/policy fabric | Thin task/adapter + server privacy-route enforcement implemented for `opportunity_evaluation`, `narrative_strategy`, `platform_variant`, `evidence_critique`, `authenticity_critique`, and `platform_variant_revision`; full capability registry, metering, fallback and Private Hybrid remain planned | #170/#171/#172 |
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
| Owner Golden Path 1 manual thought → authentic approval | Implemented for owner use through both the advanced/manual controls and the explicit high-confidence `Prepare for review` path: manual Signal → Opportunity/confidence gates → provenance-tagged angle/strategy decisions → ContentPiece → immutable LinkedIn/X revisions → separate evidence/authenticity checks → Today → exact owner approve/request-change/reject. Feedback/StyleMemory learning remains pending | #166/#206 |
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

capabilities.clients
  aiAssistants
  mobile
  desktopAgent

capabilities.media
  intent
  roles
  policy
  imageUnderstanding
  editing
  generation
  compositing
  carouselRendering
  videoEditing
  capture
  rightsConsent
```

Do not expose these target namespaces as `available: true` before their owning implementations and tests exist.

## 7. Current manual provider path

The current Studio flow supports a temporary manual provider path through configured server-side providers, temporary BYOK, compatible custom endpoints, and local adapters where transport allows them.

That remains useful during Personal Alpha implementation, but it is not the final provider architecture.

Target architecture is documented in:

- `INFERENCE_AND_PRIVACY_ARCHITECTURE.md`
- `AI_CLIENT_INTEGRATIONS.md`
- `INFERENCE_CLIENT_CAPABILITY_MATRIX.md`

## 8. Current content-intelligence implementation boundary

The owner-first browser-local path now implements manual `ContentSignal`, persisted `ContentOpportunity` evaluation/angle selection, explicit versioned Identity/Perception/Voice/Boundary context, reviewable/approvable `NarrativeStrategy`, canonical `ContentPiece`/LinkedIn-X `PlatformVariant`, immutable generated/owner-edited/AI-revised `PlatformVariantRevision` history, separate evidence/authenticity critics, exact per-revision human approve/reject decisions, and an explicit high-confidence `Prepare for review` orchestrator that safely composes those stages into the Today decision inbox.

Current staged inference task kinds are:

- `opportunity_evaluation`;
- `narrative_strategy`;
- `platform_variant`;
- `platform_variant_revision`;
- `evidence_critique`;
- `authenticity_critique`.

For the currently implemented stages, browser UI calls application services, application services construct task-oriented `InferenceTask` records, the browser inference adapter dispatches to task-specific server endpoints, and the server applies provider selection + privacy-route checks before physical model calls. Exact-revision evidence and authenticity critics are distinct inference stages; the review UI never calls providers directly.

The persisted editorial records remain provider-neutral. Provider/model/route details stay in inference provenance instead of becoming provider-shaped domain fields.

Automatic signal ingestion, connected-source/background triggers, memory-aware opportunity ranking, StyleMemory, NarrativeMemory, publishing and broader hosted persistence remain target capabilities until their owning issues are complete. Explicit owner-triggered high-confidence Signal→review-ready orchestration is implemented browser-local; it escalates uncertain work instead of guessing and never performs final content approval or publishing. The Today decision inbox remains a derived view over exact reviewed current revisions and does not create a second workflow state store.

## 9. Runtime truth rules

- Configured is not the same thing as production verified.
- Provider code present is not the same thing as credentials available.
- Connector code present is not the same thing as working publication.
- Capture code present is not the same thing as a worker running.
- Documented architecture is not the same thing as shipped behavior.
- Session tooling availability is not the same thing as deployed product capability.
