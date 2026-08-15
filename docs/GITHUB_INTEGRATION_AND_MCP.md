# SignalFlow Studio — GitHub Integration and MCP

> **Status:** canonical architecture guidance. Current implemented capability remains governed by `docs/CAPABILITY_MATRIX.md` and current source/MCP code.

## 1. GitHub has three different roles in SignalFlow

Do not collapse these into one integration.

```text
A. GitHub App / webhook events
   → ongoing work-event ingestion
   → ContentSignal

B. Repository evidence access
   → bounded source context / immutable evidence versions
   → SourceArtifact / generation evidence

C. SignalFlow MCP
   → AI-agent commands and queries over SignalFlow
   → application services
```

Each role has different permissions, security boundaries, and reliability requirements.

## 2. GitHub is one signal source, not the product definition

SignalFlow must support manual thoughts/topics and future connected sources through the same `ContentSignal` model.

GitHub is particularly useful because development work naturally creates structured events and evidence, but a user should not need GitHub to use the product.

## 3. GitHub App / webhook event ingestion

Target production path:

```text
GitHub event
    ↓
verified webhook signature
    ↓
installation/repository authorization
    ↓
delivery deduplication
    ↓
allowlisted event normalization
    ↓
ContentSignal
    ↓
cheap noise filtering
    ↓
ContentOpportunity evaluation
```

Initial useful event families may include:

- merged pull requests;
- releases;
- meaningful closed issues;
- selected push/change summaries;
- relevant workflow/release milestones.

Do not turn every commit into a post or every webhook into an expensive AI task.

Issue #161 owns the first implementation.

## 4. Source connection permissions

A production GitHub source connection should use least privilege.

Depending on event/evidence scope, permissions may include only the repository metadata/content/events required by the enabled features.

Rules:

- workspace/project scope is derived from the authorized installation/mapping;
- provider tokens/signatures remain server-side secret references;
- raw private webhook payloads are not copied into ContentSignal records;
- event delivery IDs are used for idempotency where appropriate;
- disconnect/revocation stops future processing;
- private repository content is excluded from logs/release evidence.

## 5. Repository evidence access

A GitHub event does not automatically prove every claim the campaign may want to make.

After the user selects an opportunity, SignalFlow may gather bounded repository evidence through the canonical source architecture.

Required principles:

- normalize repository identity/URL;
- respect authorization;
- select only relevant files/context;
- ignore generated/vendor/binary-heavy noise where appropriate;
- use canonical SourceArtifact/evidence records;
- preserve exact evidence version/fingerprint;
- never silently update historical generation evidence;
- visual/runtime claims may require deployed-product capture rather than code alone.

Related issues include #23, #24, #25, #127, #128 and #129.

## 6. SignalFlow MCP

MCP is the **agent-control interface** for SignalFlow.

An AI coding/assistant client may use SignalFlow MCP to do permitted operations such as:

- inspect deployment capabilities;
- inspect provider status;
- list/read signals when implemented;
- create a manual signal;
- inspect opportunities;
- select/create a campaign;
- request generation/production work;
- inspect review/publication state;
- invoke other explicitly supported SignalFlow application services.

MCP should call the same application/domain services as web/workers rather than creating parallel business logic.

## 7. MCP is not a webhook substitute

Do not design the production event flow as:

```text
SignalFlow periodically asks an AI agent's GitHub MCP what changed
```

for normal repository event ingestion.

That would be:

- less reliable;
- more expensive;
- dependent on an external agent session;
- difficult to deduplicate;
- not suitable for durable low-attention automation.

Use provider events/webhooks for event ingestion and MCP for commands/queries.

## 8. Read-only repository MCP during development

A coding agent may still use GitHub MCP/read-only repository access to inspect SignalFlow itself.

For an agent that only needs repository context, prefer least privilege:

- repository metadata: read-only;
- contents: read-only;
- pull requests/issues/actions: read-only only when required;
- no administration/secrets/environment write access.

Never put a token in:

- this repository;
- prompts committed to the repository;
- screenshots;
- `.env.example`;
- issue comments;
- release evidence.

## 9. Reading order for development agents

1. `AGENTS.md`
2. `docs/PRODUCT_VISION.md`
3. `docs/PERSONAL_ALPHA_EXECUTION.md`
4. `docs/CONTENT_INTELLIGENCE_ARCHITECTURE.md`
5. `docs/IDENTITY_MEMORY_AND_AUTHENTICITY.md`
6. `docs/CAPTURE_AND_MEDIA_PRODUCTION.md`
7. `docs/EDITORIAL_CALENDAR_AND_PUBLISHING.md`
8. `docs/PRODUCT_INFORMATION_ARCHITECTURE.md`
9. `docs/CAPABILITY_MATRIX.md`
10. `docs/DOMAIN_ARCHITECTURE.md`
11. current source/MCP code as needed

Target product docs define direction; current capabilities/code define what may be claimed as working.

## 10. Example agent instruction

```text
Use repository access to inspect Ankit6149/SignalFlow-Studio. Read AGENTS.md and the canonical product docs first. Distinguish target architecture from current capability truth. Do not infer that GitHub MCP is SignalFlow's production event-ingestion layer: GitHub App/webhooks own events, repository source services own evidence, and SignalFlow MCP owns agent commands/queries. Do not access or expose secrets.
```

## 11. Future other Git providers

The domain must not encode GitHub-specific fields as the generic signal model.

Future providers should implement source adapters that normalize into:

- `SourceConnection`;
- `ContentSignal`;
- canonical repository/source evidence records.

Provider-specific event IDs/types remain provenance metadata behind the generic application contracts.

## 12. Definition of integration completeness

### GitHub event source is complete only when

- installation/connection is authorized;
- events are signature-verified;
- delivery is idempotent;
- workspace/project mapping is secure;
- normalized signals are persisted;
- noise control is proven;
- disconnect/revocation works;
- private data is redacted from logs/evidence.

### Repository evidence is complete only when

- source version/provenance is stable;
- authorization and safety boundaries pass;
- selected evidence is visible/diagnosable;
- historical generation references remain reproducible.

### MCP workflow is complete only when

- tools use canonical application services;
- auth/capability boundaries match web/workers;
- long-running work does not block one MCP request when jobs are required;
- secrets are never accepted/stored through unsafe model-authored arguments;
- tool success reflects real application outcomes.
