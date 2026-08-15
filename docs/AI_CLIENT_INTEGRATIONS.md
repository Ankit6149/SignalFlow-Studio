# SignalFlow Studio — AI Client and Subscription Integration Architecture

> **Status:** canonical target architecture. This document defines how external AI products such as ChatGPT, Claude, Codex, Gemini, and similar agent systems may interact with SignalFlow through supported interfaces. It also defines what SignalFlow must not assume about consumer subscriptions, OAuth sessions, CLIs, or billing.

## 1. The problem

Many future SignalFlow users will already use one or more AI products every day.

Examples:

- ChatGPT;
- Claude;
- Codex;
- Claude Code;
- Gemini;
- Gemini CLI;
- IDE coding agents;
- enterprise AI assistants.

It is tempting to think:

> "If the user already pays for an AI subscription, SignalFlow should just use that subscription instead of an API."

That assumption is unsafe.

Consumer subscriptions, API billing, local CLI agents, OAuth credentials, model access, terms, data-processing policies, and programmatic-use capabilities are separate concerns.

SignalFlow therefore needs to distinguish **three integration patterns**.

## 2. Pattern A — External AI as a SignalFlow client

This is the cleanest and most broadly useful integration.

```text
ChatGPT / Claude / Codex / Gemini / another agent
        ↓
MCP / supported app integration / SignalFlow API
        ↓
SignalFlow application services
        ↓
canonical SignalFlow records
```

The external AI is a user interface/controller for SignalFlow.

It does not become SignalFlow's hidden backend.

Examples:

- "What are the best things SignalFlow thinks I could post about this week?"
- "Show me why opportunity #123 is worth considering."
- "Use a more technical angle for the second idea."
- "Create a campaign from this opportunity."
- "Tell SignalFlow to use the second screenshot."
- "Show me what is waiting for approval."
- "Move this planned post to next week."

These requests call SignalFlow's domain/application services through an authorized interface.

## 3. Pattern B — User-owned API provider

The user supplies an official provider API credential or supported enterprise connection.

```text
SignalFlow Inference Fabric
        ↓
user's provider connection
        ↓
official provider API
```

This is `BRING_YOUR_OWN_PROVIDER` and belongs to the Inference Fabric.

It is appropriate for background jobs because the credential can be used through SignalFlow's secure server/private-worker architecture according to policy.

See `docs/INFERENCE_AND_PRIVACY_ARCHITECTURE.md`.

## 4. Pattern C — Optional local authenticated AI agent

A developer/power user may have an officially supported local AI agent already installed and authenticated.

Potential architecture:

```text
SignalFlow Desktop Agent
        ↓
local adapter
        ↓
official agent CLI/SDK/non-interactive mode
        ↓
authorized local source context
        ↓
structured result
        ↓
SignalFlow application service
```

This may be useful for:

- local repository explanation;
- engineering-change interpretation;
- technical evidence extraction;
- private project analysis;
- power-user workflows.

This is optional local compute, not the primary cloud backend.

## 5. Consumer subscription rule

Canonical rule:

> **A consumer subscription must never be treated as generic API credit unless the provider explicitly supports that exact integration model.**

SignalFlow must not promise:

```text
"Connect your ChatGPT Plus account and get unlimited SignalFlow AI."
```

or equivalent claims for another provider without a supported product/API contract.

Reasons include:

- separate billing systems;
- different rate/usage limits;
- separate product terms;
- different privacy/data controls;
- different authentication models;
- no guarantee of stable programmatic access;
- background operation requirements.

## 6. Forbidden integration techniques

SignalFlow must not:

- scrape another AI product's consumer web UI as the production inference backend;
- copy browser cookies/session storage;
- reuse OAuth tokens intended for another first-party client;
- extract credentials from another CLI configuration unless the provider explicitly documents that as supported;
- automate CAPTCHA/login flows to impersonate the user;
- tell users a subscription is supported merely because a local hack appears to work;
- depend on unofficial endpoints;
- bypass provider rate limits or access controls.

## 7. Why external AI clients cannot replace SignalFlow inference

SignalFlow is intended to perform background work without continuous human presence.

Example:

```text
03:00 source event arrives
        ↓
Signal normalized
        ↓
opportunity evaluation
        ↓
media production requested
        ↓
08:00 user sees a useful decision on phone
```

This cannot depend on:

- ChatGPT being open;
- Claude conversation running;
- Codex CLI session being active;
- user's laptop being awake;
- an external assistant receiving a manual prompt.

Therefore the product needs its own durable Inference Fabric even when external AI clients are available.

## 8. MCP as the primary agent-control abstraction

SignalFlow MCP should expose canonical application commands/queries rather than provider internals.

Potential tools/resources:

### Opportunity

```text
list_opportunities
get_opportunity
snooze_opportunity
reject_opportunity
select_angle
set_custom_angle
```

### Campaign/plan

```text
create_campaign_from_opportunity
get_narrative_strategy
update_narrative_direction
list_content_pieces
```

### Review

```text
get_review_item
request_change
replace_asset
list_revisions
```

### Calendar

```text
get_editorial_plan
move_calendar_entry
skip_calendar_entry
```

### Connections/capabilities

```text
get_signalflow_capabilities
get_connection_status
```

High-risk actions such as publication/approval require explicit actor authorization and policy; an MCP tool existing does not mean every external agent can publish.

## 9. Approval through external AI

Approval is reputationally sensitive.

Potential policy levels:

### Read-only agent

Can inspect but not mutate decisions.

### Editorial agent

Can select/customize angles and request changes.

### Review agent

May perform approval only if the user/workspace explicitly grants it and the interface presents exact revision consequences.

### Publication-capable agent

Only later/explicitly scoped. Must still bind exact revisions/targets/schedule and use durable publication contracts.

Default should be conservative.

## 10. Chat-based conversational use

External assistants can make SignalFlow more convenient because users may naturally express intent conversationally.

Example:

```text
User in their AI client:
"I want to post about the way private repo processing works, but not as a launch. Make it more like a technical insight and use the architecture screenshot if it's useful."
```

The client can translate this into SignalFlow operations:

```text
create_manual_signal
→ select/custom angle
→ attach/reference asset
→ set narrative constraints
→ request campaign production
```

SignalFlow remains authoritative for records/revisions.

## 11. External assistant context minimization

If an external AI client asks SignalFlow for data, return only the context required by the authorized request.

Do not expose:

- unrelated private signals;
- provider secrets;
- whole private repositories;
- raw identity memory not needed for the action;
- other workspaces;
- hidden source credentials.

The MCP/API layer must use normal server-side authorization.

## 12. AI-client identity and audit

Actions should preserve actor/provenance such as:

```text
actorType = external_agent
clientType = chatgpt | claude | codex | gemini | other
connectionId
userId
scope
requestId
createdAt
```

This lets users understand whether a change was made from web, mobile, or an external assistant.

## 13. Codex/Claude Code-style local adapters

Where an AI agent officially supports local programmatic operation, SignalFlow Desktop Agent may integrate through a dedicated adapter.

Potential `LocalAgentCapability`:

```text
agentId
agentVersion
installed
authenticated
supportedTaskKinds[]
structuredOutput
workingDirectoryControl
privacyPolicyClass
interactiveRequired
available
lastVerifiedAt
```

The desktop agent must never infer availability solely from a binary existing on PATH; it should run safe capability diagnostics.

## 14. Local agent source authorization

If SignalFlow asks a local agent to analyze a repository, both layers should be bounded.

```text
SignalFlow authorized root
        ↓
Desktop Edge policy
        ↓
local agent working directory/tool permissions
        ↓
structured result
```

A local AI agent having access to the machine does not grant SignalFlow permission to analyze arbitrary folders.

## 15. Data-policy differences

Different AI products/account tiers may have different data-processing controls.

SignalFlow must model the actual route rather than assume:

```text
"It's local CLI, therefore private."
```

A local CLI may still send source content to the provider's cloud.

Therefore each local-agent route should declare a policy class such as:

```text
remote_consumer_processing
remote_commercial_processing
local_model_processing
enterprise_private_processing
```

The workspace ProcessingPolicy decides whether it is allowed.

## 16. Subscription-agent limitations

Even when a local agent is officially supported:

- user plan limits may be reached;
- authentication can expire;
- product behavior can change;
- interactive confirmation may be required;
- device may be offline;
- account policy may forbid some confidential work;
- the user can uninstall it.

SignalFlow must handle these routes as optional capabilities, not hard dependencies.

## 17. UI representation

External AI integrations should appear separately from model-provider inference settings.

Example:

```text
Connections

AI providers
────────────
SignalFlow Managed        Ready
Anthropic API             Connected
Local model               Ready

AI assistants
────────────
ChatGPT / MCP             Connected
Claude / MCP              Connected
Codex local adapter       Available on desktop
Gemini client             Not configured
```

This prevents users from thinking `ChatGPT connected` means SignalFlow can use ChatGPT's subscription for unattended background generation.

## 18. App ecosystem direction

Over time SignalFlow may expose supported integrations through:

- MCP;
- provider-specific app/plugin systems where officially supported;
- OAuth/API integrations;
- command-line/SDK integration;
- automation/webhook surfaces.

Use the provider's official integration mechanism and preserve SignalFlow's domain/authorization contracts.

## 19. Example end-to-end flows

### 19.1 User asks ChatGPT to use SignalFlow

```text
User → ChatGPT
"What should I post about?"
        ↓
ChatGPT calls SignalFlow MCP
        ↓
SignalFlow returns ranked opportunities
        ↓
ChatGPT presents options
        ↓
user chooses #2
        ↓
MCP selects angle
        ↓
SignalFlow workers produce content/media
        ↓
user later reviews in mobile/web/assistant
```

### 19.2 User asks Codex about a local repository

```text
SignalFlow opportunity needs technical evidence
        ↓
paired Desktop Agent has supported Codex adapter
        ↓
workspace policy allows route
        ↓
local repo root authorized
        ↓
Codex/agent analyzes bounded context
        ↓
structured feature explanation returned
        ↓
SignalFlow evidence snapshot
```

### 19.3 No external assistant available

```text
SignalFlow managed inference
        ↓
same application task
        ↓
same canonical result
```

The product should still work.

## 20. Relationship to mobile

A user may interact with SignalFlow through an AI assistant on their phone, but SignalFlow's own mobile app remains useful for:

- notifications;
- quick capture;
- review;
- exact approval;
- offline/secure state;
- media preview;
- publication exceptions.

External assistants supplement rather than eliminate the mobile product.

## 21. Relationship to privacy

Before allowing an external AI client or local subscription agent to access private workspace data, SignalFlow must evaluate:

- actor authorization;
- connection scopes;
- data classification;
- processing policy;
- route's declared data policy;
- requested resource scope;
- whether the client needs raw or summarized context.

Fail closed when policy cannot be satisfied.

## 22. Relationship to billing

SignalFlow should keep separate concepts:

```text
SignalFlow subscription/plan
SignalFlow managed inference usage
BYOK provider billing
external AI client subscription
local agent subscription
enterprise model contract
```

Do not combine them into one fictional universal credit balance.

## 23. Product rules

1. **External AI can control SignalFlow; it does not automatically power SignalFlow.**
2. **Consumer subscriptions are not API credits unless officially supported.**
3. **Never scrape sessions/cookies/tokens.**
4. **Use official provider integrations only.**
5. **Background automation must work without another AI app being open.**
6. **Local coding agents are optional power-user capabilities.**
7. **A local CLI may still be cloud processing; privacy policy must reflect that.**
8. **All agent actions use SignalFlow authorization and stable records.**
9. **Approval/publication remain exact-revision, high-risk actions.**
10. **Provider/client capability may disappear and must fail truthfully.**

## 24. Recommended sequence

### Phase 1

- strengthen SignalFlow MCP around canonical application services;
- document actor/scopes;
- keep publishing high-risk/explicit.

### Phase 2

- support external assistants as read/editorial clients;
- add clear Connections UI distinction between provider and assistant.

### Phase 3

- Desktop Agent local-agent capability contract;
- one officially supported local agent adapter for technical evidence if product value justifies it.

### Phase 4

- expand official assistant/app integrations based on actual user demand.

## 25. Definition of architectural success

This architecture succeeds when a user can choose to operate SignalFlow from their preferred AI assistant or optional local coding agent without SignalFlow depending on unsupported subscription reuse, while the same work remains available through web/mobile and the normal background inference system.
