# SignalFlow Studio capability matrix

SignalFlow Studio is one product with three declared deployment profiles. Clients must read `GET /api/capabilities` instead of inferring features from hostnames, environment assumptions, or visible controls.

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
| Browser-local campaign save | Available | Available | Available | Available |
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
| Markdown / JSON export | Available | Available | Available | Available |
| Structured ZIP export | Not implemented | Not implemented | Not implemented | Not implemented |
| Official connector administration | Unavailable | Available when configured | Available when configured | Available when configured |
| Manual copy/export/open handoff | Available | Available | Available | Available |
| Durable scheduled publishing | Not implemented | Not implemented | Not implemented | Not implemented |
| MCP | Unavailable to an anonymous hosted session | Available with explicit access context | Available | Available |
| Extension capability handshake | Available | Available | Available | Available |
| Acknowledged extension ingestion | Not implemented | Not implemented | Not implemented | Not implemented |
| Screenshot / recording ingestion | Not implemented | Not implemented | Not implemented | Not implemented |
| Billing quotas | Not implemented | Not implemented | Not implemented | Not implemented |

## Session and permission rules

- A public hosted deployment without a valid owner session reports role `anonymous`.
- A valid owner session reports role `owner` and may use configured server credentials and owner-only provider/connector controls.
- Local and self-hosted deployments without an access lock are treated as owner-operated, but local filesystem access still requires the explicit repository opt-in.
- The UI can hide irrelevant capabilities or show them disabled with the contract’s plain-language `reason`. The server remains the authorization boundary.
- “Configured” and “available” are separate. A provider or connector can be configured in the deployment but unavailable to the current session.

## Extension behavior

The extension requests the page’s capability snapshot through a versioned browser handshake. The Send action remains disabled while `capabilities.extension.available` is false. The current contract deliberately reports extension delivery unavailable because the acknowledged ingestion bridge is tracked separately in issue #41.

Dispatching a browser message or DOM event is not durable ingestion acknowledgement and must not be presented as successful delivery.

## Adding a capability

1. Add the server-owned field to the versioned contract builder.
2. Add fail-closed parsing for clients.
3. Document profile, permission, quota, and unavailable reasons.
4. Enforce the same rule in the owning API/application service.
5. Add contract fixtures for hosted anonymous, hosted member/owner where supported, local, and self-hosted profiles.
6. Update web, extension, MCP, and worker consumers that expose the capability.
7. Add migration/deprecation notes before changing or removing an existing field.

A capability is not production-ready merely because it appears in the document. It must be backed by the owning implementation and acceptance evidence.
