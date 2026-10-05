# SignalFlow Studio Documentation Map

This directory contains product architecture, current execution truth, runtime contracts, implementation guidance, and historical pointers. It is intentionally indexed here so agents and contributors do not treat every document as equal authority.

## Read first

| Need | Source |
| --- | --- |
| What is true right now? | [CURRENT_EXECUTION_STATE.md](./CURRENT_EXECUTION_STATE.md) |
| What should be worked on now? | [ISSUE_TRIAGE.md](./ISSUE_TRIAGE.md) |
| What is implemented versus target? | [CAPABILITY_MATRIX.md](./CAPABILITY_MATRIX.md) |
| What product are we building? | [PRODUCT_VISION.md](./PRODUCT_VISION.md) |
| What is the product sequence? | [../ROADMAP.md](../ROADMAP.md) |
| What rules should coding agents follow? | [../AGENTS.md](../AGENTS.md) |

Truth precedence remains:

```text
live runtime
→ deployed production SHA
→ master
→ current acceptance evidence
→ CURRENT_EXECUTION_STATE / CAPABILITY_MATRIX
→ ISSUE_TRIAGE / architecture and roadmap
→ historical Git snapshots
```

Planned ≠ coded ≠ merged ≠ deployed ≠ accepted.

## Product and domain architecture

- [DOMAIN_ARCHITECTURE.md](./DOMAIN_ARCHITECTURE.md)
- [PRODUCT_INFORMATION_ARCHITECTURE.md](./PRODUCT_INFORMATION_ARCHITECTURE.md)
- [CONTENT_INTELLIGENCE_ARCHITECTURE.md](./CONTENT_INTELLIGENCE_ARCHITECTURE.md)
- [CONTENT_SIGNAL_IMPLEMENTATION.md](./CONTENT_SIGNAL_IMPLEMENTATION.md)
- [SOURCE_ASSET_CONTRACT.md](./SOURCE_ASSET_CONTRACT.md)
- [IDENTITY_MEMORY_AND_AUTHENTICITY.md](./IDENTITY_MEMORY_AND_AUTHENTICITY.md)
- [PERSONAL_ALPHA_EXECUTION.md](./PERSONAL_ALPHA_EXECUTION.md)

## Campaign, review, and publishing

- [CAMPAIGN_EDITING_AND_VERSIONING.md](./CAMPAIGN_EDITING_AND_VERSIONING.md)
- [CAMPAIGN_SCHEMA_MIGRATION.md](./CAMPAIGN_SCHEMA_MIGRATION.md)
- [REVISION_HISTORY_AND_JUDGMENT.md](./REVISION_HISTORY_AND_JUDGMENT.md)
- [EDITORIAL_CALENDAR_AND_PUBLISHING.md](./EDITORIAL_CALENDAR_AND_PUBLISHING.md)
- [PORTABLE_TRANSFER.md](./PORTABLE_TRANSFER.md)

## AI, privacy, and client architecture

- [INFERENCE_AND_PRIVACY_ARCHITECTURE.md](./INFERENCE_AND_PRIVACY_ARCHITECTURE.md)
- [INFERENCE_CLIENT_CAPABILITY_MATRIX.md](./INFERENCE_CLIENT_CAPABILITY_MATRIX.md)
- [HOSTED_PRIVACY_MODEL.md](./HOSTED_PRIVACY_MODEL.md)
- [AI_CLIENT_INTEGRATIONS.md](./AI_CLIENT_INTEGRATIONS.md)
- [CLIENT_ECOSYSTEM_AND_EDGE_AGENT.md](./CLIENT_ECOSYSTEM_AND_EDGE_AGENT.md)
- [SECURE_SECRETS_ARCHITECTURE.md](./SECURE_SECRETS_ARCHITECTURE.md)

## Media and capture

- [MEDIA_INTELLIGENCE_AND_CREATIVE_PRODUCTION.md](./MEDIA_INTELLIGENCE_AND_CREATIVE_PRODUCTION.md)
- [CREATIVE_MEDIA_DOMAIN_CONTRACTS.md](./CREATIVE_MEDIA_DOMAIN_CONTRACTS.md)
- [CAPTURE_AND_MEDIA_PRODUCTION.md](./CAPTURE_AND_MEDIA_PRODUCTION.md)

## Integrations and runtime contracts

- [INTEGRATIONS.md](./INTEGRATIONS.md)
- [CONNECTOR_READINESS.md](./CONNECTOR_READINESS.md)
- [GITHUB_APP_CONNECTION_RUNTIME.md](./GITHUB_APP_CONNECTION_RUNTIME.md)
- [GITHUB_INTEGRATION_AND_MCP.md](./GITHUB_INTEGRATION_AND_MCP.md)
- [CHANNEL_IDENTIFIERS.md](./CHANNEL_IDENTIFIERS.md)

## Product UI and style architecture

- [APP_WORKSPACE_SYSTEM.md](./APP_WORKSPACE_SYSTEM.md)
- [STUDIO_UX_SYSTEM.md](./STUDIO_UX_SYSTEM.md)
- [STUDIO_STYLE_ARCHITECTURE.md](./STUDIO_STYLE_ARCHITECTURE.md)
- [LANDING_PAGE_PRODUCT_TRUTH.md](./LANDING_PAGE_PRODUCT_TRUTH.md)

## Operations, open-source, and discoverability

- [PRODUCT_GRADE_OPEN_SOURCE.md](./PRODUCT_GRADE_OPEN_SOURCE.md)
- [SAAS_LIMITS_AND_ABUSE_PREVENTION.md](./SAAS_LIMITS_AND_ABUSE_PREVENTION.md)
- [DISCOVERABILITY.md](./DISCOVERABILITY.md)

## Acceptance evidence

- [acceptance/](./acceptance/) contains bounded acceptance artifacts. Treat those artifacts as evidence for the exact scope they verify, not as proof of unrelated capabilities.

## Historical pointers

These files intentionally remain at stable paths so old links fail safely instead of silently pointing at stale execution instructions:

- [IMPLEMENTATION_LEDGER.md](./IMPLEMENTATION_LEDGER.md) — historical implementation-ledger pointer; no longer a current execution authority.
- [NEXT_CHAT_HANDOFF.md](./NEXT_CHAT_HANDOFF.md) — historical handoff pointer; no longer a current execution authority.

Do not add a new status/handoff/ledger document when one of the current authorities above already owns the information. Update the owning source instead.
