# SignalFlow Studio — Inference and Privacy Architecture

> **Status:** canonical target architecture. This document defines how SignalFlow should obtain, route, meter, and protect AI inference across managed cloud providers, user-owned APIs, local models, private hybrid processing, and future self-hosted deployments. It does not claim every route described here is implemented today.

## 1. Why this architecture exists

SignalFlow is not a single-prompt application. The product may eventually perform many classes of intelligence:

- filter noisy work events;
- summarize source evidence;
- classify whether a change is meaningful;
- rank content opportunities;
- decide whether something should not be posted;
- build a narrative strategy;
- adapt one story to different destinations;
- preserve personal identity and boundaries;
- inspect screenshots/images;
- decide whether a visual, carousel, demo, or video is needed;
- critique factual support;
- critique authenticity;
- select evidence;
- propose editorial timing;
- generate or edit text, images, and media plans;
- later incorporate performance signals without allowing them to override explicit identity.

These tasks have different requirements. Some are cheap and deterministic. Some are privacy-sensitive. Some need vision. Some need a strong reasoning model. Some can run locally. Some must run in the cloud because they need to happen while the user's devices are offline.

Therefore SignalFlow must not be architected around:

- one provider;
- one free API;
- one model family;
- one consumer subscription;
- one laptop-local model;
- one giant campaign prompt;
- one assumption about where user data is allowed to go.

The core architectural rule is:

> **SignalFlow requests intelligence by task and policy. A routing layer chooses the best permitted execution route.**

## 2. Separate three questions

Every inference operation must answer three independent questions:

### 2.1 What intelligence is required?

Examples:

- classification;
- extraction;
- summarization;
- embeddings;
- strong reasoning;
- writing;
- critique;
- vision;
- image generation/editing;
- media direction;
- structured planning.

### 2.2 Where is the data allowed to be processed?

Examples:

- any approved managed provider;
- only approved commercial providers;
- only a user-selected provider;
- local preprocessing + remote sanitized summary;
- local/private-network only;
- future enterprise/customer-controlled infrastructure.

### 2.3 Who pays for the inference?

Examples:

- SignalFlow managed plan;
- user API key/BYOK;
- user's local compute;
- customer-owned enterprise inference;
- temporary developer/testing provider.

Do not collapse these three questions into a single `provider` field.

## 3. Official intelligence modes

SignalFlow should support four primary modes and one later enterprise extension.

### 3.1 `SIGNALFLOW_MANAGED`

SignalFlow chooses and pays for an allowed provider/model according to task, policy, quality, latency, and cost.

Target experience:

```text
User signs in
→ connects sources
→ SignalFlow works
```

The user should not need to understand API keys or model identifiers.

This mode is required for a mainstream hosted product because durable background work must continue when the user's laptop is closed.

### 3.2 `BRING_YOUR_OWN_PROVIDER`

The user supplies a supported provider connection.

Potential adapters include:

- OpenAI API;
- Anthropic API;
- Gemini API / Vertex where appropriate;
- OpenRouter;
- NVIDIA/test endpoints where useful;
- custom OpenAI-compatible endpoint;
- local OpenAI-compatible endpoint;
- future supported providers.

The application still requests `InferenceTask`; only the route/billing owner changes.

BYOK is especially useful for:

- Personal Alpha;
- technical early adopters;
- users already paying for API usage;
- users who want explicit provider choice;
- reducing SignalFlow's early inference cost.

It should not remain mandatory for ordinary users forever.

### 3.3 `PRIVATE_HYBRID`

Raw sensitive evidence remains on a trusted local device/private environment whenever possible.

Example:

```text
private repository diff
    ↓
local deterministic filtering
    ↓
local summarization/classification
    ↓
secret/privacy scan
    ↓
minimal structured evidence
    ↓
approved remote reasoning provider
```

The remote provider receives only the evidence required for the editorial decision rather than an entire repository.

Private Hybrid is a product feature, not merely a cost optimization.

### 3.4 `LOCAL_ONLY`

All protected inference stays on the user's device or explicitly trusted private infrastructure.

Appropriate uses:

- highly confidential source analysis;
- source filtering;
- embeddings;
- summarization;
- some rewriting/classification;
- private project work where remote inference is prohibited.

SignalFlow must be truthful about reduced quality/capability when a local model cannot perform a task reliably.

If a requested task requires a capability unavailable locally, the system must block or ask for a policy change. It must not silently send the evidence to a cloud provider.

### 3.5 `ENTERPRISE_PRIVATE` — later

Customer-controlled inference through options such as:

- private cloud deployment;
- customer VPC;
- self-hosted model runtime;
- approved enterprise model gateway;
- on-prem/private-network workers.

The same application/domain task contracts should be reused.

## 4. Canonical inference records

### 4.1 `InferenceTask`

Represents the product-level intelligence request.

Suggested fields:

```text
inferenceTaskId
workspaceId
projectId?
actorId / systemActor
purpose
kind
inputReferenceIds[]
requiredCapabilities[]
requiredOutputSchema
qualityClass
latencyClass
privacyClass
processingPolicyId
budgetPolicyId?
requestedAt
status
```

Example `kind` values:

```text
signal_noise_filter
signal_classification
evidence_extraction
repository_summary
opportunity_evaluation
narrative_strategy
content_piece_generation
platform_transformation
authenticity_critique
claim_evidence_critique
repetition_analysis
image_understanding
visual_selection
image_edit_plan
image_generation
media_requirement_planning
video_edit_plan
calendar_reasoning
```

The application asks for these capabilities. It does not ask for `gpt-X` or `claude-X` directly.

### 4.2 `InferenceRequirement`

Defines execution requirements such as:

```text
requiresVision
requiresImageGeneration
requiresImageEditing
requiresLongContext
requiresToolUse
requiresStructuredOutput
requiresStreaming
requiresDeterministicSeed?
minimumQualityClass
maximumLatencyClass
maximumCostClass
```

### 4.3 `ProviderCapability`

A provider/model route should advertise current capabilities rather than being treated as generically available.

Suggested fields:

```text
providerId
modelId
routeType
supportsText
supportsVision
supportsImageGeneration
supportsImageEditing
supportsAudio
supportsVideoUnderstanding
supportsStructuredOutput
supportsToolUse
contextLimit
maxOutput
qualityClass
costClass
latencyClass
dataPolicyClassesAllowed[]
availability
lastVerifiedAt
```

### 4.4 `InferenceRoute`

Records the chosen route for a task.

```text
inferenceRouteId
inferenceTaskId
providerConnectionId / localCapabilityId
providerId
modelId
routeType
selectionReason
privacyDecision
costDecision
fallbackOrder[]
createdAt
```

### 4.5 `InferenceResultProvenance`

Every result used for a later product decision should remain explainable.

```text
resultId
inferenceTaskId
routeId
provider/model or local runtime
inputReferenceIds[]
outputSchemaVersion
createdAt
usageEventId?
policySnapshotId
```

Do not store raw secrets or unnecessary full prompts merely for provenance.

## 5. Data classification

Every source/evidence object crossing an inference boundary should have a classification.

Suggested classes:

### `PUBLIC`

Information already intentionally public.

Examples:

- public marketing site;
- public repository;
- published social post;
- public article explicitly added by the user.

### `INTERNAL`

Non-public but ordinary workspace information.

Examples:

- unpublished campaign drafts;
- personal notes;
- internal product planning.

### `CONFIDENTIAL`

Sensitive work information.

Examples:

- private repository source;
- client/internal documents;
- unreleased product details;
- internal screenshots;
- private research.

### `HIGHLY_CONFIDENTIAL`

Information whose disclosure could cause significant harm.

Examples:

- regulated/customer-sensitive material;
- security-sensitive architecture;
- protected business secrets;
- contractual confidentiality material.

### `SECRET`

Credentials/keys/tokens/private secrets.

These should generally not be inference inputs at all.

### `LOCAL_ONLY`

Explicit policy requiring processing to remain on trusted device/private infrastructure.

Classification can be inherited from source and tightened by user/project/workspace policy.

## 6. Processing policies

A `ProcessingPolicy` converts classification into enforceable routing rules.

Example policies:

### Standard

- approved managed commercial providers allowed;
- BYOK allowed;
- source minimization still required;
- no secrets.

### Confidential

- only explicitly approved provider classes;
- bounded evidence extraction before remote call;
- no entire-repository upload by default;
- private logging disabled/redacted;
- explicit storage/retention policy.

### Private Hybrid

- raw source analysis local;
- remote provider receives structured sanitized evidence only;
- user may inspect what leaves the device;
- failure closed if local preprocessing unavailable.

### Local Only

- remote provider routes prohibited;
- local/private-runtime capability required;
- task blocked if unavailable;
- no automatic policy downgrade.

## 7. Policy enforcement must be technical

This is not enough:

```text
Privacy policy says we respect private repositories.
```

The architecture must enforce:

```text
Evidence classification: LOCAL_ONLY
Inference route: remote provider
        ↓
PolicyEngine
        ↓
DENY
```

A route that violates policy must never be attempted.

## 8. Minimum necessary evidence

SignalFlow must avoid sending large amounts of source context merely because modern models accept it.

Preferred pattern:

```text
source event
    ↓
identify changed/relevant area
    ↓
bounded source retrieval
    ↓
deterministic/local extraction
    ↓
secret/privacy scan
    ↓
structured evidence
    ↓
strong model only if needed
```

Anti-pattern:

```text
clone private repository
→ upload everything
→ ask model what matters
```

Benefits of evidence minimization:

- less confidentiality exposure;
- lower inference cost;
- better model signal-to-noise;
- faster processing;
- easier provenance;
- easier deletion/retention.

## 9. Cost-aware task routing

Not every event deserves a frontier-model call.

Example pipeline:

```text
100 source events
    ↓
deterministic duplicate/noise filters
    ↓
local/cheap classification
    ↓
15 plausible signals
    ↓
cheap evidence summaries
    ↓
4 strong candidates
    ↓
strong editorial reasoning
    ↓
2 useful opportunities
```

### Tasks usually suitable for deterministic/cheap/local processing

- hashing/deduplication;
- event normalization;
- simple significance rules;
- file-path/category classification;
- basic summaries;
- entity/feature extraction;
- embeddings;
- secret-pattern scanning;
- content-length/platform-limit validation;
- similarity pre-filtering.

### Tasks more likely to require strong reasoning

- whether an event is actually worth public attention;
- choosing a narrative angle;
- reconciling identity with topic/platform;
- deciding whether a story is repetitive but still has a valid follow-up;
- complex long-form writing;
- authenticity critique;
- evidence/claim reasoning;
- deciding what media best explains the story.

## 10. Free/testing providers

SignalFlow may use free or promotional routes during development/Personal Alpha, including NVIDIA or other provider programs, but the architecture must treat them as replaceable adapters.

Rules:

- no business model depends on a free quota remaining available;
- test provider failure must not change domain contracts;
- confidential data may only use a provider when the current processing policy explicitly permits it;
- production capability claims require real verification, not a provider existing in code.

## 11. BYOK and provider secret handling

Provider credentials are secrets.

Requirements:

- never stored in campaign JSON;
- never logged;
- never returned to clients after secure persistence;
- stored by secret reference when persistence is supported;
- temporary keys remain request/session scoped where applicable;
- user can revoke/replace/test connection;
- capability state is separate from credential existence;
- provider failure preserves existing edited/approved work.

## 12. Managed inference

The mainstream hosted product eventually requires managed inference because SignalFlow is expected to work asynchronously.

Examples:

- a source webhook arrives overnight;
- editorial opportunity scoring runs while the user is offline;
- capture/media jobs continue after browser closure;
- scheduled content needs revalidation;
- the phone should show ready decisions later.

Therefore SignalFlow cannot require a user's interactive ChatGPT/Claude/CLI session for normal background operation.

Managed inference should support:

- per-workspace usage budgets;
- task-level metering;
- provider/model failover where policy permits;
- cost ceilings;
- rate limiting;
- quality floors;
- graceful degradation;
- transparent unavailable state.

## 13. Local intelligence registry

SignalFlow should not expose an uncontrolled model-download marketplace to normal users.

Instead provide a curated `LocalCapabilityRegistry`.

A local model/runtime manifest may include:

```text
localModelId
version
runtime
source
license
architecture
quantization
downloadSize
minimumRAM
recommendedRAM
minimumGPU?
recommendedGPU?
contextLimit
capabilities[]
qualityClass
supportedPlatforms[]
checksum
signature
```

The product can then say:

```text
Private Intelligence Pack

✓ signal classification
✓ summarization
✓ private-repository preprocessing
✓ embeddings
✓ secret/privacy prechecks
△ lightweight rewriting
✕ advanced campaign reasoning
✕ high-quality multimodal strategy
```

The user should not need to understand GGUF quantization names to use normal local mode.

Advanced users may connect custom local endpoints separately.

## 14. Device capability assessment

Before offering a model download/runtime, SignalFlow should assess the device:

- OS/architecture;
- RAM;
- GPU/accelerator availability;
- available storage;
- runtime support;
- battery/power considerations on mobile;
- estimated model capability class.

The product should recommend a suitable pack or say local inference is not suitable.

Do not download multi-gigabyte models automatically without explicit consent.

## 15. Mobile local intelligence

The phone application may use local/on-device intelligence for lightweight private tasks where supported:

- voice-note preprocessing;
- classification;
- short summarization;
- extracting a topic from a share-sheet item;
- privacy screening;
- embeddings;
- quick image metadata/understanding where appropriate.

The phone should not be required to perform the hardest editorial reasoning or video rendering.

Heavy tasks remain cloud/desktop/private-worker responsibilities depending on policy.

## 16. Consumer AI subscriptions are not generic API credits

Architectural rule:

> **Do not assume that because a user pays for ChatGPT, Claude, Gemini, or another consumer product, SignalFlow can use that subscription as an API backend.**

Provider subscriptions, APIs, CLIs, agent products, and developer platforms have separate authentication, billing, usage, data-policy, and integration rules.

SignalFlow must use only official supported integration mechanisms.

Never:

- scrape browser sessions;
- steal/copy OAuth tokens from another product;
- automate a consumer web UI as the hidden inference backend;
- reuse another CLI's credentials in an unsupported way;
- promise unlimited inference from a user's subscription.

## 17. Optional local subscription-agent adapters

Some developer-oriented AI agents may support authenticated local/programmatic use through official tools.

Potential future role:

```text
SignalFlow Desktop Agent
        ↓
official local agent adapter
        ↓
repository understanding / engineering evidence
        ↓
structured result returned to SignalFlow
```

Useful tasks may include:

- repository analysis;
- feature/change explanation;
- technical evidence extraction;
- local engineering context.

Rules:

- optional power-user feature;
- never the only backend;
- official supported auth only;
- privacy/data policy shown clearly;
- capability is device/session dependent;
- cloud background operation cannot depend on it.

## 18. AI client integrations are separate from inference

Another AI product may act as a **client of SignalFlow** through MCP/app integrations.

Example:

```text
ChatGPT / Claude / Codex / Gemini / another agent
        ↓
SignalFlow MCP / supported app interface
        ↓
SignalFlow application services
```

The external assistant may ask SignalFlow to:

- list opportunities;
- explain why something is worth discussing;
- choose/customize an angle;
- create a campaign;
- request changes;
- inspect review state;
- approve only where policy explicitly allows that actor/action.

This does not replace SignalFlow's background inference fabric.

See `docs/AI_CLIENT_INTEGRATIONS.md`.

## 19. Inference and image/video generation

The same task-routing principles apply to multimodal creation.

Future task categories may include:

- image understanding;
- reference-image analysis;
- image editing;
- image composition planning;
- image generation;
- video understanding;
- shot/clip selection;
- video edit planning;
- subtitle/transcript generation;
- motion composition planning.

The provider used for text reasoning does not need to be the same provider used for image generation/editing or video understanding.

SignalFlow should select specialized capabilities through the same provider-neutral routing system.

## 20. Provider fallback

Fallback is allowed only if all constraints remain satisfied.

Example:

```text
Primary model unavailable
        ↓
Candidate fallback found
        ↓
Does it support required modality/schema/quality?
        ↓
Does processing policy allow this provider?
        ↓
Does budget allow it?
        ↓
YES → reroute
NO  → fail truthfully
```

Never reduce privacy silently to keep a job running.

## 21. Structured output and staged intelligence

Important product intelligence should produce validated records rather than only prose.

Examples:

- opportunity score/result;
- narrative strategy;
- platform recommendations;
- media requirements;
- authenticity report;
- evidence critique;
- visual selection plan.

This allows:

- independent retry;
- provider replacement;
- schema validation;
- partial regeneration;
- testing/evaluation;
- provenance;
- lower cost.

## 22. Evaluation architecture

Every major inference task should have deterministic/sanitized evaluation fixtures.

Evaluate:

- output schema validity;
- evidence grounding;
- identity/boundary compliance;
- repetition handling;
- false-positive opportunity rate;
- no-post decisions;
- provider consistency;
- local-vs-cloud degradation;
- cost per useful outcome;
- latency;
- privacy route correctness.

A model upgrade is not automatically an improvement.

## 23. Usage and cost records

`InferenceUsageEvent` should capture safe metadata such as:

```text
workspaceId
inferenceTaskId
provider/model route
inputTokenClass / provider usage counters
output usage
image/video generation unit count where relevant
cost estimate/confirmed cost
latency
cache status
success/failure class
```

Do not treat raw prompts/private source text as analytics.

## 24. User-facing AI settings

Normal users should see a simple mode rather than provider engineering.

Possible UI:

```text
AI & Privacy

● SignalFlow Managed
  Best default. SignalFlow selects approved AI routes.

○ Use my AI provider
  Use your own API billing.

○ Private Hybrid
  Keep raw sensitive source processing on your paired device.

○ Local Only
  No remote AI for protected content.

[Advanced]
```

Advanced settings may expose:

- provider order;
- model selection;
- cost limits;
- local runtime;
- processing-policy overrides where authorized;
- testing/diagnostics.

## 25. Truthful capability states

Examples:

```text
Managed text reasoning      available
Managed vision              available
Image editing               unavailable
Local summarization         available
Local strong reasoning      unsupported on this device
Private Hybrid worker       offline
BYOK Anthropic              expired credential
```

UI must not collapse these to one green `AI connected` indicator.

## 26. Failure/recovery

Inference failure must preserve existing work.

Examples:

- opportunity evaluation failed → signal remains;
- one platform generation failed → other edited variants remain;
- authenticity critic unavailable → mark quality gate incomplete, do not silently approve;
- image-edit provider fails → source image remains safe;
- local worker offline → Private Hybrid job waits/blocks according to policy;
- managed provider quota reached → explain route/budget state.

## 27. Security requirements

- secret references only;
- tenant authorization before reading inference inputs;
- source evidence minimization;
- no cross-workspace prompt/cache reuse containing private data;
- structured redacted logs;
- provider request correlation without raw private payloads;
- encrypted network/storage where applicable;
- retention/deletion policy propagates to stored inference artifacts;
- provider policy snapshot retained sufficiently to explain routing.

## 28. Relationship to private repositories

A private repository is not automatically safe merely because GitHub access is authenticated.

For each repository/project, SignalFlow should expose processing policy such as:

```text
Repository: Private
Policy: Private Hybrid

Raw source:
✓ stays on paired desktop/private worker

Remote AI may receive:
✓ selected feature summary
✓ sanitized change explanation
✓ explicitly selected evidence

Remote AI may not receive:
✕ credentials
✕ environment files
✕ unrelated source files
✕ full repository archive
```

Eventually users should be able to inspect the payload class/summary before remote processing for high-sensitivity modes.

## 29. Recommended implementation sequence

### Phase 1 — provider-neutral contracts

- `InferenceTask`;
- provider capability registry;
- route selection;
- one OpenAI-compatible adapter;
- one structurally different provider adapter;
- BYOK;
- usage/cost records;
- privacy classification.

### Phase 2 — cheap/local preprocessing

- deterministic filters;
- local capability registry;
- local summarization/classification/embeddings;
- source minimization;
- Private Hybrid proof.

### Phase 3 — managed intelligence

- SignalFlow-managed provider credentials;
- budgets/quotas;
- background routing;
- plan/usage integration.

### Phase 4 — multimodal specialization

- vision routes;
- image generation/editing routes;
- audio/video understanding where useful;
- media planning integration.

### Phase 5 — enterprise/private deployment

- customer-owned inference;
- private workers;
- enterprise policy/retention controls.

## 30. Product rules

1. **Task first, provider second.**
2. **Privacy policy is enforced, not implied.**
3. **Never spend frontier-model tokens on deterministic work.**
4. **Free/testing APIs are replaceable development adapters.**
5. **BYOK is useful but not the final mainstream experience.**
6. **Local SLMs are specialist helpers, not magical replacements for frontier models.**
7. **Do not send whole private repositories by default.**
8. **Do not use consumer-session hacks.**
9. **External AI clients are interfaces, not the background backend.**
10. **Provider failures must not destroy user work.**
11. **Different media tasks may use different specialized models/providers.**
12. **Identity and explicit boundaries remain above performance optimization regardless of model/provider.**

## 31. Definition of architectural success

The architecture is successful when SignalFlow can take the same canonical product task—for example `opportunity_evaluation`—and execute it through multiple provider/local routes without changing the surrounding product workflow, while correctly enforcing privacy, capability, cost, provenance, and failure semantics.
