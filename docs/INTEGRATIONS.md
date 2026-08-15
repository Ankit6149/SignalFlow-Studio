# SignalFlow Studio — Integration Architecture

> **Status:** integration design and current/future boundaries. For exact session capability, read `docs/CAPABILITY_MATRIX.md`.

SignalFlow integrates with external systems for **different reasons**. A major architecture rule is to keep those reasons separate instead of treating every integration as a generic connector.

## 1. Integration categories

```text
A. Signal / work-source integrations
   → tell SignalFlow what happened

B. Evidence / context integrations
   → provide bounded facts/source material

C. Capture / production integrations
   → create screenshots/recordings/derived media

D. Model / processor integrations
   → reason, write, classify, analyze, transcribe, edit/generate media, etc.

E. Destination integrations
   → publish approved content or provide manual handoff

F. Agent-control integrations (MCP)
   → let AI agents operate SignalFlow application services
```

One provider may participate in more than one category, but each capability must use the correct domain/application boundary.

## 2. Signal / work-source integrations

Purpose:

> **What happened that may be worth communicating?**

Examples:

- GitHub events;
- manual thoughts/topics;
- browser extension captures;
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

## 3. Manual/direct input is an integration path

SignalFlow must remain useful without any external source connection.

A user can create from:

- a thought;
- an opinion;
- a lesson;
- a research item;
- a launch/update;
- personal/professional context;
- a URL/document/image/recording;
- multiple photos/videos/files/links with a natural-language creative instruction;
- `Something else…` free-form intent.

Manual editorial signals and direct creative requests converge on canonical ContentPiece/Media/Review records. Direct Create is specified in issue #184 and the creative-media docs.

## 4. Evidence/context integrations

Purpose:

> **What evidence can support the selected story?**

Current/future evidence paths include:

- repository context;
- public URLs;
- uploaded text/code/documents;
- canonical Assets;
- extension-captured page context;
- screenshot/recording-derived analysis;
- future documents/workspace connectors.

Evidence must use canonical `Asset` / `SourceArtifact` / version/provenance contracts.

A source integration may notify SignalFlow that something changed, while a separate evidence service gathers the bounded facts necessary for generation.

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

Captured files become canonical Assets and then receive Media Intent/AssetRole/AssetUsePolicy when used for creative production. Capture does not imply public-use permission.

## 6. Automatic capture worker

Purpose:

> **Create repeatable campaign media without requiring the user to manually stage and record the product.**

This is separate from the browser extension and is one production method under the broader Media Intelligence system.

Target flow:

```text
MediaDecision / MediaRequirement
    ↓
MediaPlan chooses automatic product capture
    ↓
CaptureRecipe
    ↓
safe browser worker
    ↓
screenshot / screencast Assets
    ↓
MediaComposition / VideoEditPlan as required
```

Prefer safe demo fixtures and preview deployments. Trusted authenticated owner capture requires explicit scope and privacy controls.

See `docs/CAPTURE_AND_MEDIA_PRODUCTION.md` and issues #151–#165.

## 7. Media-intent and creative-production integration

Before a media provider/processor is used, SignalFlow must know:

- what each source Asset means in the current request;
- whether the asset may be inspected remotely;
- whether it may appear publicly;
- whether editing/compositing/generative use is allowed;
- whether rights/consent allow the operation;
- what output form the story actually needs.

Canonical flow:

```text
user instruction + assets
    ↓
MediaIntentResolution
    ↓
AssetRoleBinding + AssetUsePolicy
    ↓
MediaDecision
    ↓
MediaRequirement
    ↓
MediaPlan
    ↓
provider-neutral media task / deterministic processor / renderer
```

See:

- `docs/MEDIA_INTELLIGENCE_AND_CREATIVE_PRODUCTION.md`;
- `docs/CREATIVE_MEDIA_DOMAIN_CONTRACTS.md`;
- issues #179–#185.

## 8. Model integrations

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

The current adapters are implementation foundations, not the final inference architecture. Target provider-neutral routing is defined by `INFERENCE_AND_PRIVACY_ARCHITECTURE.md` and #170/#171.

### Target logical tasks

Text/reasoning examples:

- signal interpretation;
- opportunity judgment;
- narrative strategy;
- canonical writing;
- platform transformation;
- authenticity/evidence critics;
- editorial planning.

Media examples:

- media intent resolution;
- media-format recommendation;
- image understanding;
- image editing;
- image generation;
- image composition guidance;
- footage scene understanding;
- moment selection;
- video narrative planning;
- transcription;
- caption generation;
- visual quality critique.

Logical task contracts remain separate even if Personal Alpha initially reuses a small number of physical providers/models.

### Credential rules

- server-managed credentials remain server-side;
- request-scoped BYOK keys are never persisted in campaign/signal/media/memory records;
- local/custom endpoints are capability/permission-aware;
- provider/model configuration should become low-frequency Connections/Settings state rather than a mandatory campaign step for normal users;
- media providers receive only content permitted by ProcessingPolicy + AssetUsePolicy.

## 9. Processor integrations

Processors operate on canonical Assets/SourceArtifacts and return versioned derived results.

Potential processors:

- text/document extraction;
- OCR;
- transcription;
- thumbnail/frame extraction;
- visual analysis;
- background removal;
- crop/resize/reframe;
- image composition;
- video proxy generation;
- shot/scene segmentation;
- audio normalization;
- media metadata;
- optional embeddings;
- moderation/privacy helpers.

A processor must never be claimed as complete when no successful processor result exists.

Historical media keeps references to processor/version/source asset versions.

## 10. Image editing/generation integration rule

Do not model a provider as simply `supportsImages=true`.

Target capability classes may include:

```text
IMAGE_UNDERSTANDING
IMAGE_EDITING
IMAGE_GENERATION
IMAGE_COMPOSITING
BACKGROUND_REMOVAL
IMAGE_UPSCALE
IMAGE_RESTORATION
VISUAL_QUALITY_CRITIQUE
```

Prefer deterministic composition when preserving exact screenshots/product UI/typography. Use generative editing/generation only when the requested transformation requires it and policy permits it.

## 11. Carousel rendering integration

A carousel is a structured `CarouselCompositionPlan` with semantic slide roles and stable slide IDs.

AI may plan the sequence/copy/visual bindings. A deterministic renderer should own typography, spacing, brand treatment, output dimensions and final slide files.

Do not depend on image-generation models to render typography-heavy multi-slide sequences consistently.

## 12. Uploaded-footage editing integration

Creator footage is acquired differently from CaptureRecipe output but converges on the same media system.

```text
uploaded footage
→ transcription/scene understanding
→ VideoNarrative
→ VideoEditPlan
→ deterministic timeline renderer
→ MediaComposition revision
```

Common editing should be deterministic where possible: trim, cut, reorder, reframe, captions, overlays, simple transitions, audio treatment and encoding.

Generative video is optional later and is not required for routine footage editing.

## 13. Media rendering integration

SignalFlow renderers consume validated structured plans and canonical source Assets.

Relevant plan families include:

- `ImageCompositionPlan`;
- `CarouselCompositionPlan`;
- `VideoEditPlan`;
- existing semantic `MediaCompositionPlan` for product-demo motion.

Output bytes become immutable derived Assets; MediaComposition records own plan/render/provenance relationships.

Natural-language changes mutate structured plans and create new revisions rather than becoming the only editable source of truth.

## 14. Rights/identity/audio integration

Media integrations must preserve where relevant:

- rights status/source/license;
- generated-provider provenance;
- music/audio provenance;
- face/voice consent state;
- public-use restrictions.

Identity-sensitive operations such as face replacement, voice cloning or lip sync are separate high-risk capabilities, not generic editing.

Unknown rights or missing consent can block publication according to policy.

See #185.

## 15. Destination integrations

Purpose:

> **Execute the exact approved publication intent or provide a truthful manual handoff.**

Current direct connector code paths exist for:

- LinkedIn;
- X;
- Reddit.

Code presence is not production proof. Read `docs/CONNECTOR_READINESS.md` for verification requirements.

Other supported generation destinations remain manual review/copy/export/open-platform routes until a direct connector is implemented and verified.

## 16. Capability-based destination model

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
canPublishMultiImage
canApplyPlatformAudio
canReadOwnPosts
canReadAnalytics
provider-native scheduling capability if any
SignalFlow durable scheduling availability
safe unavailable reason
```

Different platforms legitimately support different capabilities.

A prepared media format may require a truthful manual-finalization handoff if the destination API cannot reproduce an in-app feature such as platform-library music.

## 17. Direct publication versus manual handoff

### Direct publication

Only successful when the destination API confirms the side effect.

### Manual handoff

SignalFlow prepares/copies/downloads/opens the destination workflow.

Manual handoff is useful and first-class, but it is **not direct publication success**.

## 18. Editorial scheduling versus destination scheduling

SignalFlow's editorial planner decides **what/when** should be communicated.

The durable publication system executes exact approved content/media at the agreed time.

A platform does not need a native scheduler for SignalFlow to schedule a durable job, but the connector must still be valid at execution time.

Browser timers are never the durable scheduling mechanism.

## 19. MCP integration

SignalFlow MCP is an AI-agent interface into canonical application services.

Current implemented MCP capabilities are narrower than the target product.

Future MCP tools may expose:

- list/create signals;
- inspect/select opportunities;
- create/read campaigns;
- inspect/request media work through canonical application services;
- inspect production jobs;
- inspect review/approval/publication state;
- request explicitly authorized actions.

MCP must not implement duplicate media editing/business rules or bypass AssetUsePolicy/ProcessingPolicy.

## 20. Webhooks and inbound external events

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

## 21. Integration security principles

- least privilege;
- server-side authorization;
- encrypted/secret-reference credentials;
- explicit data-transfer behavior;
- AssetUsePolicy + ProcessingPolicy before media AI/provider calls;
- no scraping private sessions to bypass official APIs;
- no rate-limit/authentication bypass;
- no hidden capture;
- no destructive overwrite of original media;
- no identity-sensitive face/voice transformation without explicit permission;
- no automatic publication of unapproved revisions;
- no platform success claim without platform confirmation;
- no private source/campaign/media content in logs/analytics by default.

## 22. Integration completion checklist

Before advertising an integration as production-ready, prove as relevant:

- connection/install flow;
- exact identity/scope;
- normal operation;
- expiry/revocation;
- permission denial;
- rate limiting;
- retries/idempotency;
- cancellation if applicable;
- worker restart/recovery;
- privacy/redaction;
- media role/use policy;
- rights/consent where applicable;
- data deletion/retention;
- capability discovery;
- exact revision/provenance;
- real credential-backed side effects for publishing;
- documentation matches actual behavior.

## 23. Architecture rule for new integrations

Before implementing a new provider, identify:

1. integration category;
2. canonical record it produces/consumes;
3. exact task/capability classes;
4. application service/port;
5. authorization/secret model;
6. privacy/AssetUsePolicy/rights behavior;
7. job requirements;
8. idempotency/provenance;
9. failure/recovery states;
10. capability fields;
11. retention/deletion;
12. exact owner golden path/direct-create journey it improves.

If those are unclear, do not add provider-specific code directly to UI components.
