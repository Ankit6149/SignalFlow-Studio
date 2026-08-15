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
   → reason, write, classify, analyze, transcribe, etc.

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

## 7. Model integrations

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

### Future staged roles

The target architecture separates logical tasks such as:

- signal interpretation;
- opportunity judgment;
- narrative strategy;
- canonical writing;
- platform transformation;
- authenticity/evidence critics;
- visual direction;
- editorial planning.

Personal Alpha may reuse one strong physical model/provider for several roles. The role contracts remain separate so quality/cost can be optimized later.

### Credential rules

- server-managed credentials remain server-side;
- request-scoped BYOK keys are never persisted in campaign/signal/memory records;
- local/custom endpoints are capability/permission-aware;
- provider/model configuration should become low-frequency Connections/Settings state rather than a mandatory campaign step for normal users.

## 8. Processor integrations

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

## 9. Media rendering integration

SignalFlow's target motion renderer consumes a validated semantic `MediaCompositionPlan` and canonical source Assets.

The renderer should support repeatable brand components and aspect-ratio variants rather than generating arbitrary executable code from a model.

Output bytes become Assets; `MediaComposition` records own plan/render/provenance relationships.

## 10. Destination integrations

Purpose:

> **Execute the exact approved publication intent or provide a truthful manual handoff.**

Current direct connector code paths exist for:

- LinkedIn;
- X;
- Reddit.

Code presence is not production proof. Read `docs/CONNECTOR_READINESS.md` for verification requirements.

Other supported generation destinations remain manual review/copy/export/open-platform routes until a direct connector is implemented and verified.

## 11. Capability-based destination model

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

## 12. Direct publication versus manual handoff

### Direct publication

Only successful when the destination API confirms the side effect.

### Manual handoff

SignalFlow prepares/copies/downloads/opens the destination workflow.

Manual handoff is useful and first-class, but it is **not direct publication success**.

## 13. Editorial scheduling versus destination scheduling

SignalFlow's editorial planner decides **what/when** should be communicated.

The durable publication system executes exact approved content at the agreed time.

A platform does not need a native scheduler for SignalFlow to schedule a durable job, but the connector must still be valid at execution time.

Browser timers are never the durable scheduling mechanism.

## 14. MCP integration

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

## 15. Webhooks and inbound external events

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

## 16. Integration security principles

- least privilege;
- server-side authorization;
- encrypted/secret-reference credentials;
- explicit data-transfer behavior;
- no scraping private sessions to bypass official APIs;
- no rate-limit/authentication bypass;
- no hidden capture;
- no automatic publication of unapproved revisions;
- no platform success claim without platform confirmation;
- no private source/campaign content in logs/analytics by default.

## 17. Integration completion checklist

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
- data deletion/retention;
- capability discovery;
- real credential-backed side effects for publishing;
- documentation matches actual behavior.

## 18. Architecture rule for new integrations

Before implementing a new provider, identify:

1. integration category;
2. canonical record it produces/consumes;
3. application service/port;
4. authorization/secret model;
5. job requirements;
6. idempotency/provenance;
7. capability fields;
8. failure/recovery states;
9. data retention/privacy;
10. exact owner golden path it improves.

If those are unclear, do not add provider-specific code directly to UI components.
