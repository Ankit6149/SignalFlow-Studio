# SignalFlow Studio capability matrix

SignalFlow Studio is one product with three declared deployment profiles. Clients must read `GET /api/capabilities` instead of inferring features from hostnames, environment assumptions, or visible controls.

This document describes **whether the current session can use a product capability**. Domain ownership, persistence, migration, and adapter rules are documented separately in [DOMAIN_ARCHITECTURE.md](DOMAIN_ARCHITECTURE.md).

## Contract

- Schema: `frontend/lib/capabilities/capabilityContract.mjs`
- Current schema version: `1`
- Endpoint: `GET /api/capabilities`
- Consumers: Studio web client, browser extension handshake, MCP server, and future workers/clients.
- Cache policy: `no-store`; capability and permission state can change during a session.
- Compatibility: clients ignore unknown future fields, but missing known fields fail closed as unavailable. Unsupported schema versions are rejected.

The document contains no raw credentials, OAuth tokens, captured page content, prompts, drafts, signed URLs, or private asset data.

### Minimal response shape

```json
{
  "schemaVersion": 1,
  "product": "signalflow-studio",
  "deployment": { "profile": "hosted", "publicHosted": true },
  "session": { "authenticated": false, "role": "anonymous" },
  "permissions": { "canGenerate": true, "canUseOwnerTools": false },
  "capabilities": {
    "models": {
      "providers": {
        "gemini": {
          "available": true,
          "configured": false,
          "supportsTemporaryKey": true,
          "reason": "Gemini is available with a temporary personal key."
        }
      }
    },
    "extension": {
      "available": false,
      "reason": "Acknowledged extension ingestion is not ready."
    }
  }
}
```

Clients must still validate the full versioned schema; this excerpt documents hierarchy rather than replacing contract validation.

## Current truthful product matrix

| Capability | Hosted anonymous | Hosted owner | Local | Self-hosted |
| --- | --- | --- | --- | --- |
| Versioned browser-local Campaign save | Available | Available | Available | Available |
| Legacy browser-library migration | Available | Available | Available | Available |
| Authoritative Markdown / JSON export | Available | Available | Available | Available |
| ZIP compatibility API | Owner-only route; not a primary product surface | Owner-only route; not a primary product surface | Owner-operated route; not a primary product surface | Owner-operated route; not a primary product surface |
| Hosted account/workspace system | Not implemented | Not implemented | Not applicable | Not implemented |
| Cloud campaign database | Not implemented | Not implemented | Not applicable | Not implemented |
| Private object storage | Not implemented | Not implemented | Not applicable | Not implemented |
| Durable background jobs | Not implemented | Not implemented | Not implemented | Not implemented |
| Cloud autosave/cross-device sync | Not implemented | Not implemented | Not applicable | Not implemented |
| Collaboration | Not implemented | Not implemented | Not applicable | Not implemented |
| Temporary BYOK cloud provider | Available for declared providers | Available | Available | Available |
| Server-managed provider credentials | Unavailable | Available when configured | Available when configured | Available when configured |
| Custom gateway | Unavailable | Available | Available | Available |
| Ollama / LM Studio | Unavailable | Available only with a reachable trusted URL | Available | Available |
| Public links | Available | Available | Available | Available |
| Public GitHub repository URL | Available | Available | Available | Available |
| Local filesystem repository | Unavailable | Unavailable on public hosting | Opt-in through `SIGNALFLOW_ALLOW_LOCAL_REPO=true` | Opt-in through `SIGNALFLOW_ALLOW_LOCAL_REPO=true` |
| Official connector administration | Unavailable | Available when configured | Available when configured | Available when configured |
| Manual copy/export/open handoff | Available | Available | Available | Available |
| Durable scheduled publishing | Not implemented | Not implemented | Not implemented | Not implemented |
| MCP | Unavailable to an anonymous hosted session | Available with explicit access context | Available | Available |
| Extension capability handshake | Available | Available | Available | Available |
| Acknowledged extension ingestion | Not implemented | Not implemented | Not implemented | Not implemented |
| Screenshot / recording ingestion | Not implemented | Not implemented | Not implemented | Not implemented |
| Billing quotas | Not implemented | Not implemented | Not implemented | Not implemented |

The ZIP compatibility route is not advertised as a complete end-user capability. It now consumes the canonical Campaign export projection so it cannot diverge from authoritative drafts while the product surface, packaging UX, and release verification remain pending.

## Campaign data rules

- The current edited draft is authoritative for saving, reopening, copying, publishing, and export.
- Different original model output may exist only as optional revision history.
- Temporary provider keys and runtime browser objects are excluded from canonical Campaign records.
- Browser records carry schema version `1`, stable campaign IDs, source snapshot IDs, and generation run IDs.
- Markdown and JSON are deterministic projections of a Campaign snapshot.
- Browser, memory, and injected store-backed implementations conform to the same campaign repository port.
- Future cloud/database implementations must pass the same adapter contract suite before capability flags can report them available.

## Session and permission rules

- A public hosted deployment without a valid owner session reports role `anonymous`.
- A valid owner session reports role `owner` and may use configured server credentials and owner-only provider/connector controls.
- Local and self-hosted deployments without an access lock are treated as owner-operated, but local filesystem access still requires the explicit repository opt-in.
- An access-locked local/self-hosted deployment reports owner-only model and connector routes unavailable until the session is authenticated.
- The UI can hide irrelevant capabilities or show them disabled with the contract’s plain-language `reason`. The server remains the authorization boundary.
- “Configured” and “available” are separate. A provider or connector can be configured in the deployment but unavailable to the current session.

## Extension behavior

The extension requests the page’s capability snapshot through a versioned browser handshake. The Send action remains disabled while `capabilities.extension.available` is false. The current contract deliberately reports extension delivery unavailable because the acknowledged ingestion bridge is tracked separately in issue #41.

Dispatching a browser message or DOM event is not durable ingestion acknowledgement and must not be presented as successful delivery.

## Adding a capability

1. Add the server-owned field to the versioned contract builder.
2. Add fail-closed parsing for clients.
3. Define or extend the owning domain record and application service.
4. Document profile, permission, quota, and unavailable reasons.
5. Enforce the same rule in the owning API/application service.
6. Implement infrastructure behind a declared port, not inside UI/domain code.
7. Add contract fixtures for hosted anonymous, hosted member/owner where supported, local, and self-hosted profiles.
8. Add adapter, serialization, migration, security, and rollback tests where persistence is involved.
9. Update web, extension, MCP, worker, README, agent, and public AI-context consumers.
10. Add migration/deprecation notes before changing or removing an existing field.

A capability is not production-ready merely because it appears in the document. It must be backed by the owning implementation and acceptance evidence.
