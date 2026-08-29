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
| Browser-local explainable `FeedbackEvent` / StyleMemory learning + owner controls | Available browser-local; not cross-device | Available browser-local; not cross-device | Available browser-local | Available browser-local |
| Bounded StyleMemory consumption + exact draft memory provenance | Available when a permitted generation route is configured | Available when configured | Available when configured | Available when configured |
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
| Connected-source Postgres migration/repository code | Code present; no production database configured/verified | Code present; no production database configured/verified | Code present; deployment-specific configuration required | Code present; deployment-specific configuration required |
| Private production object storage (#72 Phase A) | Code foundation present; no hosted object store configured/verified | Code foundation present; deployment credentials/configuration still required | Browser/local blob storage remains the local path; hosted object storage not applicable | S3-compatible private adapter present; deployment credentials/configuration required |
| Durable background jobs (#73) | Domain/repository execution foundation present; no production worker/queue configured | Domain/repository execution foundation present; production worker/queue still requires deployment configuration | Foundation available for owner/local execution adapters; no claim of always-on background service | Foundation present; worker/queue deployment configuration required |
| Automatic browser screenshot worker (#162/#163 Phase A) | Code present but not anonymous-session available or live-CDP verified | Bounded CDP adapter + execution path implemented; requires configured worker endpoint and end-to-end deployment verification | Code present; requires an explicitly configured reachable CDP worker endpoint | Code present; requires configured CDP worker endpoint and worker deployment |
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
| GitHub App/webhook → ContentSignal ingestion | Implementation in progress: provider-neutral connection/event contracts, raw-body signature verification, durable Postgres repository/migration code, atomic external-event dedupe, and a Node webhook route are present; GitHub App install lifecycle, dedicated database migration/configuration, production secrets and real webhook acceptance are not yet complete | #161/#167/#71, `GITHUB_INTEGRATION_AND_MCP.md` |
| Explainable `ContentOpportunity` evaluation/ranking | Implemented for browser-local manual Signals, including persisted NarrativeMemory repetition assessment before high-confidence autopilot preparation; automatic multi-source intelligence remains planned | #156/#166 |
| Opportunity angle options + `Something else` | Implemented for persisted manual-Signal opportunities in `/plan`; selected angles can now continue into a persisted NarrativeStrategy | #156/#159/#166 |
| Persistent Identity/Perception/Voice/Boundary profiles | Implemented browser-local for explicit owner profiles + version history + LinkedIn/X expression + identity-context snapshots; hosted sync and automatic inference still planned | #153/#166 |
| Learned explainable StyleMemory | Implemented browser-local for normalized review-derived `FeedbackEvent` evidence, deterministic scoped hypotheses, Voice inspection/control (`Confirm`, `Edit`, `Not always`, `Forget`, reset), bounded generation/change-request retrieval, and exact safe `{styleMemoryId, updatedAt}` revision provenance. Hosted/cross-device identity-memory persistence and dedicated identity-memory export remain planned | #154/#166, `STYLE_MEMORY_IMPLEMENTATION.md` |
| Narrative/publication memory + semantic repetition | Implemented browser-local for exact owner-approved `prepared_internal` revisions with immutable provenance, hashed lexical signatures, deterministic repetition reporting, browser reopen persistence, and autopilot escalation to Plan on high repetition. `published_confirmed` truth still requires the durable publishing slice | #155/#166/#208 |
| NarrativeStrategy / ContentPiece / PlatformVariant domain | Implemented browser-local for the owner Golden Path, including explicit strategy approval and destination omission; hosted/team migration breadth remains planned | #157/#166 |
| Staged generation orchestration | Implemented browser-local for the owner-triggered high-confidence path: `opportunity_evaluation` → NarrativeMemory repetition assessment → deterministic confidence/escalation policy → provenance-tagged recommended angle → `narrative_strategy` → policy acceptance → destination-specific `platform_variant` writing → separate `evidence_critique` + `authenticity_critique` → Today exact human judgment. Bounded natural-language exact-revision change requests and bounded StyleMemory consumption are implemented; durable/background jobs and broader stages remain planned | #158/#166/#206/#208 |
| Authenticity quality critic | Implemented browser-local for the owner Golden Path against the exact destination-specific IdentityContextSnapshot used by the current revision; learned StyleMemory remains lower precedence than explicit identity/boundary context | #154/#158/#166 |
| Evidence/factual quality critic integrated with staged flow | Implemented browser-local for exact current LinkedIn/X revisions using the canonical source Signal/approved strategy/ContentPiece evidence contract; broader source processors remain planned | #158/#166 |
| Today decision inbox | Implemented browser-local as a derived exact-revision judgment queue over canonical Golden Path records; explicit owner-triggered high-confidence Signal→review-ready preparation is implemented, while automatic background/connected-source triggers remain planned | #159/#166/#204/#206 |
| Signals workspace | Implemented for browser-local manual intake/lifecycle + primary `Prepare for review` high-confidence orchestration + explicit `Find ideas` manual recovery; automatic connector/background ingestion still planned | #152/#159/#166/#206 |
| Plan/opportunity/campaign-planning workspace | Implemented browser-local through opportunity explanation, angle/custom-angle decision, persisted repetition explanation, reviewable/approvable NarrativeStrategy, canonical ContentPiece, immutable LinkedIn/X revision history, separate critics, immutable owner edits/regeneration, and exact per-revision approve/reject decisions | #156/#157/#158/#159/#166/#208 |
| CadencePolicy / editorial planning | Planned | #160 |
| Editorial calendar with intentionally empty slots | Planned | #160 |
| Provider-neutral InferenceTask/routing/policy fabric | Thin task/adapter + server privacy-route enforcement implemented for `opportunity_evaluation`, `narrative_strategy`, `platform_variant`, `evidence_critique`, `authenticity_critique`, and `platform_variant_revision`; full capability registry, metering, fallback and Private Hybrid remain planned | #170/#171/#172 |
| Curated local intelligence packs | Planned | #173 |
| External AI-assistant client integrations | Planned | #174 |
| Mobile low-attention companion | Planned | #175 |
| Paired Desktop Edge Agent | Planned | #176 |
| Desktop-application bounded capture | Future/planned | #177 |
| Media intent / AssetRole / AssetUsePolicy | Core domain/application foundation implemented for role/use/privacy/lineage policy; broader request-scoped UX, invalidation, provider-routing and full end-to-end enforcement remain open | #179, `CREATIVE_MEDIA_DOMAIN_CONTRACTS.md` |
| Explainable MediaDecision + expanded MediaRequirement | Core explainable MediaDecision/MediaRequirement foundation implemented, including `NONE`, separate `mediaKind`, existing-media preference and owner overrides; broader media planning/production integration remains open | #180 |
| Image understanding/editing/compositing/generation pipeline | Planned | #181 |
| Narrative-first deterministic carousel production | Planned | #182 |
| Uploaded-footage Reel/Short editing | Planned | #183 |
| Natural-language multimodal Direct Create | Planned | #184 |
| Media rights/consent/face/voice/audio trust layer | Planned | #185 |
| Automatic safe CaptureRecipe/browser worker | Versioned bounded CaptureRecipe/CaptureJob, durable execution foundation and CDP screenshot adapter implemented; live worker endpoint/deployment and credential-backed end-to-end capture verification remain required; screencast remains unavailable | #162/#163, `CAPTURE_AND_MEDIA_PRODUCTION.md` |
| Automatic campaign screenshot capture/derivatives | Phase A raw screenshot execution merged in #241: viewport/selector PNG, same-origin/privacy enforcement, private immutable Asset persistence and safe output provenance are implemented. Phase B quality/derivatives and Phase C exact review binding remain open; configured live end-to-end GP2 proof is not yet complete | #163/#167 |
| Automatic deterministic raw screencast | Planned | #164 |
| Motion composition / multi-aspect video render | Planned | #165 |
| Exact media revision approval/publication binding | Planned | #151/#163/#165/#168/#179–#185 |
| Owner Golden Path 1 manual thought → authentic approval | Implemented and accepted browser-local: manual Signal → Opportunity + NarrativeMemory repetition gate → confidence gates → provenance-tagged angle/strategy decisions → ContentPiece → immutable LinkedIn/X revisions → bounded StyleMemory generation context → separate evidence/authenticity checks → Today → exact owner correction/approve/reject → browser reopen. Exact approval creates `prepared_internal` NarrativeMemory; it does not claim publication. Sanitized acceptance evidence is recorded in `docs/acceptance/GOLDEN_PATH_1_OWNER_ACCEPTANCE.md`; #166 is closed. | #154/#166/#206/#208 |
| Owner Golden Path 2 GitHub event → opportunity + visual evidence | Implementation in progress: connected GitHub event → canonical Signal ingestion layers exist in code and the Phase-A bounded screenshot worker/private Asset path is merged. Production GitHub source installation/verification, durable deployment configuration, background Opportunity continuation, screenshot quality/derivatives, exact media review binding, and real positive/noise end-to-end evidence remain open | #161/#163/#167 |
| Owner Golden Path 3 approved revision → durable publish → memory | Planned; exact approval now creates truthful internal story memory, but durable publication confirmation remains unimplemented | #168/#208 |
| Performance analytics ingestion/learning | Future; not yet scoped as production capability | product vision/editorial docs |
| Unreviewed global autoposting | Not a Personal Alpha capability; future explicit scoped trust only | product vision |

## 5. Creative-media truth

The repository now contains real media-intent/use-policy, durable capture, private storage, and raw screenshot-execution foundations, but those foundations must not be confused with the complete creative-media production system.

The following remain incomplete and must not be claimed as broadly working merely because related domain/design or lower-level foundation exists:

- automatic interpretation of every uploaded image as reference/evidence/final/edit source across the full product;
- complete end-to-end `AssetUsePolicy` enforcement across every future media processor/provider/publication surface;
- image-generation or image-editing provider routing through the target Inference Fabric;
- deterministic carousel production;
- uploaded-footage automatic Reel/Short editing;
- semantic `VideoEditPlan` natural-language editing;
- rights/face/voice consent enforcement;
- multimodal Direct Create convergence;
- automatic media-format recommendation;
- screenshot quality/derivative generation and exact media-review binding beyond the Phase-A raw-capture foundation.

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

The owner-first browser-local path now implements manual `ContentSignal`, persisted `ContentOpportunity` evaluation/angle selection, explicit versioned Identity/Perception/Voice/Boundary context, review-derived `FeedbackEvent`/StyleMemory learning with owner controls, reviewable/approvable `NarrativeStrategy`, canonical `ContentPiece`/LinkedIn-X `PlatformVariant`, immutable generated/owner-edited/AI-revised `PlatformVariantRevision` history with safe StyleMemory provenance, separate evidence/authenticity critics, exact per-revision human approve/reject decisions, approval-derived `prepared_internal` NarrativeMemory, deterministic repetition assessment, and an explicit high-confidence `Prepare for review` orchestrator that safely composes those stages into the Today decision inbox while escalating high-repetition stories back to Plan.

Current staged inference task kinds are:

- `opportunity_evaluation`;
- `narrative_strategy`;
- `platform_variant`;
- `platform_variant_revision`;
- `evidence_critique`;
- `authenticity_critique`.

For the currently implemented stages, browser UI calls application services, application services construct task-oriented `InferenceTask` records, the browser inference adapter dispatches to task-specific server endpoints, and the server applies provider selection + privacy-route checks before physical model calls. Exact-revision evidence and authenticity critics are distinct inference stages; the review UI never calls providers directly. Platform writing and exact natural-language revision requests retrieve at most a bounded relevant StyleMemory snapshot through the application service; explicit Voice/Boundary context retains precedence.

The persisted editorial records remain provider-neutral. Provider/model/route details stay in inference provenance instead of becoming provider-shaped domain fields. Exact generated/AI-revised drafts record only safe StyleMemory ID/timestamp references rather than copying private feedback history.

GitHub connected-source code is present, but production automatic detection is not yet configured or verified: the GitHub App install lifecycle, dedicated durable database, deployment secrets and background Opportunity continuation remain open. Other connected-source/background triggers, confirmed publication memory, publishing, hosted StyleMemory/Identity synchronization, and broader hosted persistence remain target capabilities until their owning issues are complete. Browser-local NarrativeMemory now records exact approved internal story history without claiming publication, survives reopen, and feeds bounded repetition risk into the high-confidence autopilot gate. Explicit owner-triggered high-confidence Signal→review-ready orchestration escalates uncertain or repetitive work instead of guessing and never performs final content approval or publishing. The Today decision inbox remains a derived view over exact reviewed current revisions and does not create a second workflow state store.

The media/capture foundation now includes structured media intent/use policy, explainable MediaRequirement/MediaDecision contracts, durable job primitives, private content-addressed Asset storage, versioned bounded CaptureRecipe/CaptureJob records, and a CDP-backed raw screenshot execution adapter. Those are implementation foundations rather than proof that a production browser worker is currently configured for every deployment. GP2 still requires real GitHub source verification, a configured live capture target/worker, screenshot derivative quality, exact media-review binding, and positive/noise end-to-end evidence.

## 9. Runtime truth rules

- Configured is not the same thing as production verified.
- Provider code present is not the same thing as credentials available.
- Connector code present is not the same thing as working publication.
- Capture code present is not the same thing as a worker running.
- Documented architecture is not the same thing as shipped behavior.
- Session tooling availability is not the same thing as deployed product capability.
