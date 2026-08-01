# SignalFlow Studio

SignalFlow Studio is an open-source, review-first campaign workspace. It turns product notes, public links, repository context, and supported text/code files into editable drafts for twelve destinations while keeping generation, review, version, export, and publishing states explicit.

The active product **requires a real model provider**. Retired template, offline, prompt-only, and automatic fallback generation are rejected rather than presented as real campaign output.

## Current product flow

1. Add a campaign name, source brief, audience, public links, repository, and optional supported files.
2. Select destinations across social, community, video, and owned channels.
3. Choose an available model route for the current deployment/session.
4. Generate a staged campaign and destination-specific drafts.
5. Review, edit, and explicitly approve one authoritative current draft per channel.
6. Regenerate one channel, regenerate only unedited channels, or archive the current version before regenerating everything.
7. Save changes to the current stable campaign ID, save as a separate copy, export deterministic Markdown/JSON, copy/open a destination, or publish through a genuinely configured official connector.

## Destinations

- Social: LinkedIn, X, Instagram, Facebook, Threads
- Community: Reddit, Hacker News
- Video: YouTube, TikTok
- Owned: Newsletter, Blog, Release notes

LinkedIn, X, and Reddit have official OAuth connector code paths. Every other destination currently uses an explicit review, copy, export, and open-platform handoff.

## Generation routes

Supported adapters:

- Gemini
- OpenAI
- Claude
- OpenRouter
- Groq
- Custom OpenAI-compatible endpoint
- Ollama
- LM Studio

A route is usable only when `GET /api/capabilities` reports it available for the current deployment and session.

- Hosted non-owner sessions can use supported temporary personal keys where the provider allows them.
- Server-configured credentials and owner tools remain owner-only on protected/public hosted deployments.
- Custom, Ollama, and LM Studio routes are owner/trusted-local capabilities. Hosted local-model use requires a reachable trusted base URL.
- Temporary keys are request-scoped and excluded from saved campaigns.

## Edit-safe regeneration and review state

SignalFlow never silently replaces a manually edited draft.

When edited drafts exist, full regeneration requires a deliberate choice:

- regenerate only unedited destinations and keep edited text byte-for-byte unchanged;
- archive the complete current campaign and regenerate every selected destination;
- cancel without sending a request or changing state.

Each channel can also be regenerated independently. Failed or rejected regeneration leaves existing work intact. The current generated baseline can be restored per channel, and archived campaign versions can be restored or explicitly discarded.

Persistent campaign and channel statuses show source freshness, generated/regenerated state, manual edits, needs-review state, approval, failures, unsaved changes, last save, and whether the current revision has been exported. Editing a draft clears its approval. Publishing and manual handoff require the current channel revision to be explicitly approved.

See [docs/CAMPAIGN_EDITING_AND_VERSIONING.md](docs/CAMPAIGN_EDITING_AND_VERSIONING.md).

## Storage, identity, and authoritative drafts

- Saved campaigns are browser-local in the current product. There is no cloud campaign database, cross-device sync, collaboration, or account workspace yet.
- Saved records use a versioned Campaign domain contract.
- Every campaign has a stable opaque `campaignId`; titles are display text and are never used as identity.
- Multiple campaigns may use the same title without overwriting one another.
- **Save changes** updates only the current ID. **Save as copy** creates a new ID and preserves the original.
- Each channel has one authoritative current draft and one generated baseline.
- Original and archived text is revision history, never another active draft.
- Legacy browser-library records are migrated into the canonical contract when read.
- Clearing browser site data can remove the local library; export important campaigns first.

Markdown and JSON exports are projected from the same canonical Campaign snapshot. They include campaign/source/generation IDs, provider/model, snapshot timestamp, editor revision, warnings, approval/edited/quality states, and authoritative current drafts. Identical campaign state produces deterministic output.

## Canonical source and asset records

SignalFlow now uses one versioned source graph across browser uploads, generation requests, MCP, campaign freshness, persistence, and portable transfer:

- `Asset` records stored original/derived object metadata, safe storage identity, privacy, provenance, lifecycle, retention, and deletion state;
- `SourceArtifact` records source identity/version, ingestion method, usability/evidence state, extraction state, provenance, and Asset relationships;
- `AssetProcessing` records processor identity/version and input/output lineage without claiming a processor completed when it did not.

Browser uploads create canonical records immediately after reading the browser File. Campaign source fingerprints use stable SourceArtifact version references rather than editable filenames/descriptions. API and MCP validate one workspace-scoped graph and return safe issue codes on invalid references.

Remote URLs remain reference-only unless a hardened fetch boundary verifies them; #127 owns SSRF/redirect/timeout/MIME/size enforcement. The complete diagnostics workspace, remote revalidation, processing adapters, and retention/deletion jobs remain separate open issues.

See [docs/SOURCE_ASSET_CONTRACT.md](docs/SOURCE_ASSET_CONTRACT.md).

## Portable transfer and recovery

The Library includes an explicit portable ownership workflow:

- select saved campaigns and prepare a versioned `.signalflow.json` archive;
- review campaign, asset, source-artifact, approval, export, blob-byte, and exclusion counts before download;
- verify SHA-256 integrity and optional deployment signatures before import;
- preview schema, size, traversal, blob, missing-asset, warning, and conflict states before changing storage;
- choose Skip, Copy, or Replace deliberately;
- cancel between records, resume compatible partial/cancelled reports, and roll back journaled changes;
- preserve generation timestamps, authoritative drafts, generated baselines, approvals, version archives, source snapshots, and transfer provenance as historical data.

Provider keys, OAuth/session credentials, signed/private references, private endpoints, and local filesystem paths are excluded with a safe manifest report. Transfer is user initiated; SignalFlow does not silently upload or synchronize browser data.

Browser-local import/export is implemented. The same application contract is tested through injected store-backed adapters, but a production hosted destination, cloud database, object storage, tenant authorization, and durable transfer jobs are **not** claimed yet.

See [docs/PORTABLE_TRANSFER.md](docs/PORTABLE_TRANSFER.md).

## Deployment capability contract

`GET /api/capabilities` is the server-owned source of truth for hosted, local, and self-hosted profiles. It describes current-session permissions and availability for models, persistence, repositories, exports, connectors, MCP, extension capture, quotas, and owner tools.

Clients fail closed when a known capability is missing or discovery fails. “Configured” and “available to this session” are separate states.

See [docs/CAPABILITY_MATRIX.md](docs/CAPABILITY_MATRIX.md).

## Browser extension status

The extension is an experimental capture client. It can perform a versioned capability handshake with an open Studio tab.

**Acknowledged extension ingestion is not implemented yet.** The Send action remains disabled, and dispatching a tab message or DOM event is not reported as durable delivery. Screenshot, recording, review, upload queue, and store-release work remain tracked separately.

## MCP status

The `mcp/` package exposes:

- deployment capability discovery;
- provider status;
- provider connection testing;
- campaign creation through the canonical generation API.

MCP requires an explicitly configured SignalFlow base URL and any required workspace/provider credentials in the MCP environment. Secrets are not accepted from model-authored tool arguments unless the server route intentionally supports a temporary request key.

## Publishing truth

Direct publishing code exists for LinkedIn, X, and Reddit, but code presence is not production proof. A connector is complete only after:

- developer application and production credentials are configured;
- canonical callback URL and required products/scopes are approved;
- a real account authorizes;
- a real publish succeeds and is confirmed by the destination API;
- refresh, expiry, rejection, permission, and rate-limit behavior are verified.

SignalFlow reports direct success only after the destination API confirms it. No campaign is silently published. The current channel revision must be approved before a direct or manual publishing action becomes available.

See [docs/CONNECTOR_READINESS.md](docs/CONNECTOR_READINESS.md).

## Source handling boundaries

Implemented:

- written campaign brief and audience;
- public link extraction with bounded failure handling;
- public GitHub repository context;
- opt-in trusted local repository context on eligible local/self-hosted deployments;
- browser extraction for supported text, Markdown, CSV, JSON, and code files;
- image/video file metadata and user descriptions as planning references.

Not implemented in the active campaign route:

- automatic visual understanding of uploaded image/video content;
- durable cloud asset storage;
- extension screenshot/recording ingestion;
- background generation jobs.

## Quick start

Requirements:

- Node.js 22 (the CI version)
- npm
- Python 3.10 only for the retained Python test suite
- at least one real model provider route

```bash
cd frontend
npm ci
npm run dev
```

Open `http://localhost:3000`.

Copy `frontend/.env.example` to `frontend/.env.local` and configure the chosen provider. Never commit credentials or prefix server secrets with `NEXT_PUBLIC_`.

Protected hosted deployment example:

```text
SIGNALFLOW_ACCESS_KEY=use-a-long-private-value
SIGNALFLOW_PUBLIC_HOSTED=true
NEXTAUTH_URL=https://your-canonical-domain.example
```

## Verification

Frontend:

```bash
cd frontend
npm ci
npm test
npm audit --omit=dev --audit-level=high
npm run build
```

MCP:

```bash
cd mcp
npm test
```

Python compatibility suite:

```bash
python -m pip install -r requirements.txt
python -m pip install pytest
pytest -q
```

A change is not complete when only compilation succeeds. Relevant contract, regression, security, migration, accessibility, and user-flow evidence must pass.

## Vercel

```text
Root Directory: frontend
Framework Preset: Next.js
Install Command: npm install
Build Command: npm run build
Output Directory: .next
```

## Repository map

- `frontend/app/page.js` — current Studio, Library, Connections, and Settings UI
- `frontend/app/api/capabilities/` — deployment/session capability document
- `frontend/app/api/launch_kit/` — canonical campaign generation route
- `frontend/app/api/social/` — OAuth status/connect/callback/disconnect routes
- `frontend/app/api/publish/` — confirmed-only publishing route
- `frontend/lib/domain/` — versioned records, invariants, serialization, and ports
- `frontend/lib/application/` — shared campaign use cases and composition roots
- `frontend/lib/infrastructure/` — browser, memory, and injected-store adapters
- `frontend/lib/studio/campaignState.mjs` — edit-safe reducer and editor version state
- `frontend/lib/studio/campaignStatus.mjs` — campaign/channel/action selectors
- `frontend/lib/studio/regenerationPolicy.mjs` — explicit regeneration policies
- `frontend/lib/domain/sourceArtifacts.mjs` — canonical Asset, SourceArtifact, AssetProcessing, migration, graph validation, and compatibility projections
- `frontend/lib/transfer/` — portable archive, validation, conflict, resume, provenance, and rollback rules
- `frontend/components/PortableTransferPanel.js` — Library transfer preparation, preview, import, and recovery UI
- `frontend/lib/export/campaignExport.mjs` — authoritative deterministic export projector
- `frontend/lib/context/` — repository, URL, and file context extraction
- `frontend/lib/ai/` — provider adapters, policy, and staged generation
- `frontend/lib/social/` — connector configuration, encrypted session handling, and providers
- `extension/` — experimental browser capture companion
- `mcp/` — supported MCP server package
- `docs/DOMAIN_ARCHITECTURE.md` — canonical domain/application/adapter boundaries
- `docs/CAMPAIGN_EDITING_AND_VERSIONING.md` — regeneration, approval, persistence, and version rules
- `docs/CAPABILITY_MATRIX.md` — current deployment truth

## Product principles

- Review and explicit approval before publish
- One authoritative current draft and generated baseline per channel
- Never replace manual edits silently
- Stable campaign identity independent of title
- Real model routes only; no fake fallback output
- Explicit portable ownership; no silent cross-deployment sync
- Browser-local and self-hostable today, cloud-ready through adapters
- Truthful capability, connector, extension, and success states
- No credential harvesting or platform bypasses
- Calm creative workspace rather than a crowded dashboard

Start with [AGENTS.md](AGENTS.md) before making repository changes. Security and ethics guidance is in [SECURITY.md](SECURITY.md).
