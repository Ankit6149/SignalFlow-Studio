# SignalFlow Studio — Capability Matrix

> **Purpose:** this document states what the current deployment/session can actually use. It intentionally distinguishes **target product architecture** from **implemented capability**.

SignalFlow is one product with hosted/local/self-hosted deployment profiles. Clients must read `GET /api/capabilities` and resource-specific state instead of inferring availability from documentation, hostname, visible UI, installed dependencies, or future roadmap records.

## 1. Contract

- Schema: `frontend/lib/capabilities/capabilityContract.mjs`
- Current implemented schema version: `1`
- Endpoint: `GET /api/capabilities`
- Consumers: Studio web client, browser-extension handshake, MCP server, and future workers/clients
- Cache policy: `no-store`
- Compatibility: clients ignore unknown future fields but fail closed when known required fields are missing/invalid

Capability documents must not contain raw credentials, OAuth tokens, captured page content, prompts, drafts, signed private URLs, identity-profile content, or private asset bytes.

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
credential-backed production verified
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
| Canonical `ContentSignal` persistence/manual intake | Planned | #152, `CONTENT_INTELLIGENCE_ARCHITECTURE.md` |
| GitHub App/webhook → ContentSignal ingestion | Planned | #161, `GITHUB_INTEGRATION_AND_MCP.md` |
| Explainable `ContentOpportunity` scoring/ranking | Planned | #156 |
| Opportunity angle options + `Something else` | Planned | #156/#159 |
| Persistent Identity/Perception/Voice/Boundary profiles | Planned | #153 |
| Learned explainable StyleMemory | Planned | #154 |
| Narrative/publication memory + semantic repetition | Planned | #155 |
| NarrativeStrategy / ContentPiece / PlatformVariant domain | Planned | #157 |
| Staged generation orchestration | Planned | #158 |
| Authenticity quality critic | Planned | #158 |
| Evidence/factual quality critic integrated with staged flow | Planned | #158 |
| Today decision inbox | Planned | #159 |
| Signals workspace | Planned | #159 |
| Plan/opportunity/campaign-planning workspace | Planned | #159 |
| CadencePolicy / editorial planning | Planned | #160 |
| Editorial calendar with intentionally empty slots | Planned | #160 |
| Automatic safe CaptureRecipe/browser worker | Planned | #162 |
| Automatic campaign screenshot capture/derivatives | Planned | #163 |
| Automatic deterministic raw screencast | Planned | #164 |
| Motion composition / multi-aspect video render | Planned | #165 |
| Exact media revision approval/publication binding | Planned | #151/#165/#168 |
| Owner Golden Path 1 manual thought → authentic approval | Planned | #166 |
| Owner Golden Path 2 GitHub event → opportunity + visual evidence | Planned | #167 |
| Owner Golden Path 3 approved revision → durable publish → memory | Planned | #168 |
| Performance analytics ingestion/learning | Future; not yet scoped as production capability | product vision/editorial docs |
| Unreviewed global autoposting | Not a Personal Alpha capability; future explicit scoped trust only | product vision |

## 5. Target capability namespace direction

When these capabilities are implemented, the server capability contract should evolve through a versioned schema rather than UI assumptions.

Illustrative target grouping only:

```text
capabilities.contentIntelligence
  signals
  opportunities
  narrativePlanning
  identityMemory
  narrativeMemory

capabilities.production
  captureWorker
  screenshots
  screencast
  mediaRenderer
  supportedAspectRatios

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
  analyticsRead
```

Do not add these fields to the public contract until their schema/implementation issue owns them and compatibility tests exist.

## 6. Canonical source capability

Current source contracts can represent Asset/SourceArtifact/AssetProcessing records, but a canonical record does not prove:

- remote fetch safety;
- extraction success;
- OCR;
- transcription;
- visual analysis;
- durable upload;
- deletion/retention enforcement;
- extension acknowledgement;
- automatic capture-worker production.

Those states remain explicit per artifact/processing/capability.

Public links must fail closed as *verified usable evidence* where #127's hardened fetch boundary is required but not implemented.

## 7. Content-intelligence truth

The new docs define Signals/Opportunities/Identity/Memory as target product records, but none may be presented in the live UI as persistent working intelligence until their issue is implemented.

Examples:

- a one-off model-generated `strategy` object is **not** a persistent ContentOpportunity system;
- a `founder-style` tone field is **not** an IdentityProfile;
- campaign history is useful but is **not** NarrativeMemory until public-story semantics are implemented;
- a prompt-generated media shot list is **not** automatic capture/media production;
- a client-side schedule callback is **not** durable editorial/publication scheduling.

## 8. Capture/production truth

### Browser extension

User-initiated extension capture is a separate capability family from automatic campaign capture.

### Automatic capture worker

The product may report this available only when:

- worker/infrastructure is configured;
- a supported CaptureRecipe can execute;
- target/environment authorization is valid;
- output storage is available;
- durable job/progress behavior is functional.

Installing Playwright/browser dependencies alone is not capability evidence.

### Media renderer

May report available only when a validated MediaCompositionPlan can produce persisted output Assets through the render pipeline.

A prompt containing `videoTimeline` is not a renderer.

## 9. Editorial planning truth

The product distinguishes:

- editorial recommendation/planning;
- durable publication scheduling;
- destination provider capability.

A Calendar UI alone is not durable scheduling.

A schedule is real only when server/job persistence survives browser closure/restart and execution semantics are defined.

## 10. Destination connector truth

A connector's state is richer than `connected`.

Current/future connector capability should distinguish:

- configured;
- authorized;
- verified target identity;
- scopes/products;
- expiry/revocation;
- text/image/video capabilities;
- direct publish verified/unverified;
- manual-only fallback;
- provider errors/rate limits.

Publishing success is recorded only after destination confirmation.

Read `docs/CONNECTOR_READINESS.md`.

## 11. Portable transfer capability

Current portable transfer remains explicit browser ownership/recovery, not silent cloud sync.

As new identity/signal/memory/calendar/media records ship, portable ownership must be extended deliberately through new archive schema versions/compatibility rules before the product claims those records are included.

No new user-owned state should be silently left out of export forever merely because it was introduced after archive schema v1.

## 12. Campaign data rules

Current rules remain:

- current edited draft is authoritative;
- generated output is baseline/history;
- temporary provider keys/runtime browser objects are excluded;
- campaigns have stable IDs/source snapshots/generation runs;
- Markdown/JSON are deterministic projections;
- browser/memory/store-backed adapters share contracts.

Target ContentPiece/PlatformVariant migration must preserve these invariants.

## 13. Session/permission rules

- Public hosted deployment without valid owner/member auth reports the appropriate restricted role.
- Owner/local/self-hosted capabilities remain permission/configuration-aware.
- Local filesystem access remains explicit opt-in.
- UI may hide irrelevant controls, but server/application authorization remains the security boundary.
- `configured` and `available` are separate.
- Resource-specific capability may be unavailable even when the provider itself is connected.

## 14. Adding a capability

1. Define the owning domain/application service.
2. Define current/future deployment profiles and authorization.
3. Add server-owned versioned capability field/schema.
4. Add fail-closed client parsing.
5. Implement infrastructure behind a port.
6. Add capability fixtures for supported profiles/roles.
7. Add relevant migration/serialization/security/job/retry tests.
8. Add real credential-backed evidence for external side effects.
9. Update web/MCP/extension/worker/public docs.
10. Only then advertise the capability.

## 15. Capability principle

> **Documentation may describe where SignalFlow is going. Only verified implementation determines what SignalFlow can say it does today.**
