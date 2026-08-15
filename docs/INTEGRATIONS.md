# SignalFlow Studio — Integration Architecture

> **Status:** integration design and current/future boundaries. For exact session capability, read `docs/CAPABILITY_MATRIX.md` and `docs/INFERENCE_CLIENT_CAPABILITY_MATRIX.md`.

SignalFlow integrates with external systems for **different reasons**. A major architecture rule is to keep those reasons separate instead of treating every integration as a generic connector.

## 1. Integration categories

```text
A. Signal / work-source integrations
   → tell SignalFlow what happened

B. Evidence / context integrations
   → provide bounded facts/source material

C. Capture / production integrations
   → create screenshots/recordings/derived media

D. Inference / model / processor integrations
   → reason, write, classify, analyze, transcribe, generate/edit media, etc.

E. Destination integrations
   → publish approved content or provide manual handoff

F. Agent-control integrations (MCP / supported AI-client interfaces)
   → let AI agents operate SignalFlow application services

G. Edge/device integrations
   → mobile capture/approval and future private desktop/local processing
```

One provider may participate in more than one category, but each capability must use the correct domain/application boundary.

## 2. Signal / work-source integrations

Purpose:

> **What happened that may be worth communicating?**

Examples:

- GitHub events;
- manual thoughts/topics;
- browser extension captures;
- mobile share-sheet/voice/photo/manual input when implemented;
- future Linear/Jira/Notion/document/workspace integrations;
- future other Git providers;
- user-added research/external topics.

These integrations normalize into `ContentSignal` and canonical source/evidence records.

They do **not** create social posts directly.

### GitHub

Target production architecture:

```text
GitHub App/webhook
    ↓
verified/authorized event
    ↓
ContentSignal
    ↓
ContentOpportunity evaluation
```

See `docs/GITHUB_INTEGRATION_AND_MCP.md` and issue #161.

## 3. Manual input is an integration path

SignalFlow must remain useful without any external source connection.

A user can always create a signal from:

- a thought;
- an opinion;
- a lesson;
- a research item;
- a launch/update;
- personal/professional context;
- a URL/document/image/recording;
- `Something else…` free-form intent.

Manual and connected signals use the same opportunity/campaign architecture.

## 4. Evidence/context integrations

Purpose:

> **What evidence can support the selected story?**

Current/future evidence paths include:

- repository context;
- public URLs;
- uploaded text/code/documents;
- canonical Assets;
- extension-captured page context;
- mobile-supplied links/images/files/video when implemented;
- desktop/private source evidence when implemented;
- screenshot/recording-derived analysis;
- future documents/workspace connectors.

Evidence must use canonical `Asset` / `SourceArtifact` / version/provenance contracts.

A source integration may notify SignalFlow that something changed, while a separate evidence service gathers the bounded facts necessary for generation.

Example:

```text
GitHub webhook says PR #42 merged
        ↓
ContentSignal
        ↓
user selects opportunity
        ↓
repository evidence service extracts only relevant change context
        ↓
immutable SourceArtifact/source snapshot
```

For confidential/private sources, evidence retrieval must also obey DataClassification/ProcessingPolicy as #172 lands.

## 5. Browser extension

The browser extension is primarily a **user-initiated source/capture client**.

Target capabilities include:

- page title/URL/selected text/note;
- screenshots;
- selected region/full page where safe;
- tab/window/screen recording;
- review/redaction before upload;
- project/campaign/inbox destination;
- offline queue;
- durable acknowledgement.

It must never become hidden continuous browsing-history collection or recording.

The extension and the automatic capture worker both create canonical Assets/SourceArtifacts, but their provenance differs.

Structured service integrations should handle passive work events where possible; the extension fills explicit browser-context gaps.

## 6. Automatic capture worker

Purpose:

> **Create repeatable campaign media without requiring the user to manually stage and record the product.**

This is separate from the browser extension.

Target flow:

```text
Campaign MediaRequirement
    ↓
CaptureRecipe
    ↓
safe browser worker
    ↓
screenshot / screencast Assets
    ↓
MediaComposition
```

Prefer safe demo fixtures and preview deployments. Trusted authenticated owner capture requires explicit scope and privacy controls.

See `docs/CAPTURE_AND_MEDIA_PRODUCTION.md` and issues #151–#165.

## 7. Inference/model integrations

Current provider adapters include:

- Gemini;
- OpenAI;
- Claude;
- OpenRouter;
- Groq;
- Custom OpenAI-compatible endpoints;
- Ollama;
- LM Studio.

Current generation requires a real usable model route. Retired fake/template fallback output must not be reintroduced.

### Target Inference Fabric

The target architecture no longer treats provider/model selection as the application-level AI contract.

Instead:

```text
Application requests InferenceTask
        ↓
InferenceRequirement
        ↓
DataClassification + ProcessingPolicy
        ↓
ProviderCapability / LocalCapability
        ↓
quality + cost + latency + availability
        ↓
permitted InferenceRoute
```

See `docs/INFERENCE_AND_PRIVACY_ARCHITECTURE.md` and #170/#171.

### Official inference modes

Target modes:

```text
SignalFlow Managed
Bring Your Own Provider
Private Hybrid
Local Only
Enterprise Private later
```

These modes change who pays/where data is processed, not the canonical product-domain task.

### Future staged roles

The target architecture separates logical tasks such as:

- signal interpretation;
- opportunity judgment;
- narrative strategy;
- canonical writing;
- platform transformation;
- authenticity/evidence critics;
- visual/image understanding;
- image generation/editing where required;
- media requirement direction;
- audio/video understanding where required;
- editorial planning.

Personal Alpha may reuse one strong physical model/provider for several roles. The role contracts remain separate so quality/cost can be optimized later.

### Cost-routing principle

Do not run expensive reasoning for every raw source event.

Prefer:

```text
raw events
→ deterministic dedupe/filter
→ cheap/local classification
→ bounded candidate set
→ strong reasoning only for plausible opportunities
```

### Credential rules

- server-managed credentials remain server-side;
- request-scoped BYOK keys are never persisted in campaign/signal/memory records;
- persisted provider credentials use secure secret references;
- local/custom endpoints are capability/permission-aware;
- provider/model configuration should become low-frequency Connections/Settings state rather than a mandatory campaign step for normal users.

### Free/testing-provider rule

Free/promotional routes may be used during development/Personal Alpha, but they are replaceable adapters. SignalFlow's architecture/pricing must not assume a free quota remains available.

## 8. Privacy-aware inference integration

A private repository/source connection is not automatically a privacy guarantee.

Target processing classes include:

```text
PUBLIC
INTERNAL
CONFIDENTIAL
HIGHLY_CONFIDENTIAL
SECRET
LOCAL_ONLY
```

Processing policy may select Standard, Confidential, Private Hybrid, Local Only, or later enterprise-private behavior.

Example Private Hybrid:

```text
private source
→ trusted local/private preprocessing
→ secret/privacy scan
→ minimal structured evidence
→ approved remote reasoning if policy permits
```

Rules:

- do not upload entire private repositories by default;
- secret material should not become normal model input;
- `LOCAL_ONLY` must fail closed when only remote routes are available;
- provider fallback cannot silently lower privacy;
- logs/analytics must not contain private source/prompt content by default.

See #172 and `docs/INFERENCE_AND_PRIVACY_ARCHITECTURE.md`.

## 9. Local intelligence integrations

Current local/custom model endpoints remain useful foundations, but the target local experience is a curated capability registry rather than a random model marketplace.

Future #173 may support:

- device capability assessment;
- curated local model/runtime packs;
- signed/checksummed downloads;
- explicit task capability classes;
- local/private preprocessing;
- advanced custom endpoint configuration.

A local model should be used for the tasks it can perform reliably; it is not assumed to replace strong reasoning.

## 10. Processor integrations

Processors operate on canonical Assets/SourceArtifacts and return versioned derived results.

Potential processors:

- text/document extraction;
- OCR;
- transcription;
- thumbnail/frame extraction;
- visual analysis;
- media metadata;
- optional embeddings;
- future moderation/privacy helpers.

A processor must never be claimed as complete when no successful processor result exists.

Historical campaigns keep references to the processor/version that produced their evidence.

## 11. Media rendering integration

SignalFlow's target motion renderer consumes a validated semantic `MediaCompositionPlan` and canonical source Assets.

The renderer should support repeatable brand components and aspect-ratio variants rather than generating arbitrary executable code from a model.

Output bytes become Assets; `MediaComposition` records own plan/render/provenance relationships.

AI-assisted media tasks such as image understanding/edit planning/generation or video/clip understanding should route through the Inference Fabric rather than being hard-coded into the renderer.

## 12. Destination integrations

Purpose:

> **Execute the exact approved publication intent or provide a truthful manual handoff.**

Current direct connector code paths exist for:

- LinkedIn;
- X;
- Reddit.

Code presence is not production proof. Read `docs/CONNECTOR_READINESS.md` for verification requirements.

Other supported generation destinations remain manual review/copy/export/open-platform routes until a direct connector is implemented and verified.

## 13. Capability-based destination model

Do not model a destination connection as only:

```text
connected: true
```

The target connection capability should expose information such as:

```text
provider
verified target identity
scopes/products
expiry/status
canPublishText
canPublishImage
canPublishVideo
canPublishCarousel
canReadOwnPosts
canReadAnalytics
provider-native scheduling capability if any
SignalFlow durable scheduling availability
safe unavailable reason
```

Different platforms legitimately support different capabilities.

## 14. Direct publication versus manual handoff

### Direct publication

Only successful when the destination API confirms the side effect.

### Manual handoff

SignalFlow prepares/copies/downloads/opens the destination workflow.

Manual handoff is useful and first-class, but it is **not direct publication success**.

## 15. Editorial scheduling versus destination scheduling

SignalFlow's editorial planner decides **what/when** should be communicated.

The durable publication system executes exact approved content at the agreed time.

A platform does not need a native scheduler for SignalFlow to schedule a durable job, but the connector must still be valid at execution time.

Browser/mobile timers are never the durable scheduling mechanism.

## 16. External AI client integrations

External AI products may become clients/controllers of SignalFlow through official supported interfaces.

Target shape:

```text
ChatGPT / Claude / Codex / Gemini / another agent
        ↓
MCP / supported app/API interface
        ↓
SignalFlow application services
```

They may eventually:

- list/explain opportunities;
- select/customize an angle;
- create/read plans;
- inspect review state;
- request targeted changes;
- inspect Calendar/capabilities;
- perform only explicitly authorized high-risk actions.

This is separate from inference routing.

### Consumer subscription rule

Do not assume a paid ChatGPT/Claude/Gemini/etc. consumer subscription can be used as generic SignalFlow API credit.

Never:

- scrape web sessions/cookies;
- reuse unsupported OAuth tokens;
- extract unsupported CLI credentials;
- automate consumer web UI as the hidden backend;
- promise unattended background inference from another product's subscription.

See `docs/AI_CLIENT_INTEGRATIONS.md` and #174.

## 17. MCP integration

SignalFlow MCP is an AI-agent interface into canonical application services.

Current implemented MCP capabilities are narrower than the target product.

Future MCP tools may expose:

- list/create signals;
- inspect/select opportunities;
- create/read campaigns;
- inspect production jobs;
- inspect review/approval/publication state;
- request explicitly authorized actions.

MCP must not implement duplicate business rules or become the background GitHub event transport.

## 18. Mobile integration surface

A future mobile application (#175) is a client of the same canonical system.

Target responsibilities:

- Today/notifications;
- quick manual thoughts/voice notes;
- camera/photo input;
- share-sheet links/files/images/video;
- review/approval/change requests;
- Calendar/publication exceptions.

The phone does not own provider rules, durable scheduling, heavy media rendering, or a duplicate Campaign domain.

## 19. Desktop Edge Agent integration

A future paired Desktop Agent (#176) handles trusted local/private capabilities:

- local/private repositories;
- explicitly authorized local files;
- local model runtimes;
- Private Hybrid preprocessing;
- optional officially supported local AI-agent adapters;
- signed edge jobs;
- later desktop-app capture (#177).

The desktop agent is a capability service, not a second full Studio.

See `docs/CLIENT_ECOSYSTEM_AND_EDGE_AGENT.md`.

## 20. Desktop application capture — later

Desktop app capture is distinct from browser URL/DOM capture.

Target flow:

```text
DesktopCaptureRecipe
→ paired/authorized device
→ allowed application/window
→ semantic OS accessibility/UI automation actions where available
→ screenshot/screencast
→ canonical Asset
→ MediaComposition
```

No hidden continuous desktop recording or arbitrary whole-disk/app automation.

Owner: #177.

## 21. Webhooks and inbound external events

Every inbound event integration must define:

- provider signature/authentication;
- workspace/project mapping;
- replay/idempotency protection;
- event version/normalization;
- allowed metadata/content;
- rate/burst control;
- background enrichment boundary;
- safe logs/correlation IDs;
- disconnect/revocation behavior.

Raw provider payloads and secrets must not become generic domain records.

## 22. Integration security principles

- least privilege;
- server-side authorization;
- encrypted/secret-reference credentials;
- explicit data-transfer behavior;
- enforceable DataClassification/ProcessingPolicy;
- no scraping private sessions to bypass official APIs;
- no rate-limit/authentication bypass;
- no hidden capture;
- no broad browser-history surveillance;
- no arbitrary whole-disk desktop access;
- no automatic publication of unapproved revisions;
- no platform success claim without platform confirmation;
- no private source/campaign/identity content in logs/analytics by default;
- signed/replay-protected device jobs where edge clients are used.

## 23. Integration completion checklist

Before advertising an integration as production-ready, prove as relevant:

- connection/install/pairing flow;
- exact identity/scope;
- normal operation;
- expiry/revocation;
- permission denial;
- rate limiting;
- retries/idempotency;
- cancellation if applicable;
- worker/device restart/recovery;
- privacy/redaction/processing policy;
- data deletion/retention;
- capability discovery;
- real credential-backed side effects for publishing;
- documentation matches actual behavior.

For inference routes also prove:

- task capability;
- data-policy class;
- structured output validity;
- cost/usage accounting;
- fallback behavior;
- quality floor.

## 24. Architecture rule for new integrations

Before implementing a new provider/client/integration, identify:

1. integration category;
2. canonical record it produces/consumes;
3. application service/port;
4. authorization/secret/device model;
5. data classification/processing policy;
6. job requirements;
7. idempotency/provenance;
8. capability fields;
9. failure/recovery states;
10. data retention/privacy;
11. cost/usage where inference is involved;
12. exact owner golden path it improves.

If those are unclear, do not add provider-specific code directly to UI components.
