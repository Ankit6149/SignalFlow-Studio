# SignalFlow Studio Agent Guide

## Mission

SignalFlow Studio is becoming a **content operating system that lets people stay focused on their real work while SignalFlow handles the burden between what happened and what is worth communicating**.

The intended product is not a generic post generator, a prompt wrapper, a social scheduler that must be manually filled, or a dashboard full of model controls.

The primary product loop is:

```text
Work / manual thought / connected source
        ↓
ContentSignal
        ↓
ContentOpportunity
        ↓
user chooses an angle or "Something else"
        ↓
NarrativeStrategy / Campaign
        ↓
Evidence + Capture + Media Production
        ↓
ContentPiece + PlatformVariant
        ↓
Review / Approval
        ↓
Editorial Calendar / PublicationRequest
        ↓
Durable Publication
        ↓
NarrativeMemory + eligible Feedback learning
```

> **The user's job is judgment. SignalFlow's job is everything between the work and that judgment.**

The currently implemented manual campaign flow remains a valid foundation and should evolve into the **Create** path. Do not mistake the current UI architecture for the permanent product architecture.

## Read this first

Before changing product behavior, read in this order:

1. `docs/PRODUCT_VISION.md`
2. `docs/PERSONAL_ALPHA_EXECUTION.md`
3. `docs/CONTENT_INTELLIGENCE_ARCHITECTURE.md`
4. `docs/IDENTITY_MEMORY_AND_AUTHENTICITY.md`
5. `docs/CAPTURE_AND_MEDIA_PRODUCTION.md`
6. `docs/EDITORIAL_CALENDAR_AND_PUBLISHING.md`
7. `docs/PRODUCT_INFORMATION_ARCHITECTURE.md`
8. `docs/CAPABILITY_MATRIX.md`
9. `docs/DOMAIN_ARCHITECTURE.md`
10. `docs/SOURCE_ASSET_CONTRACT.md`
11. `docs/CAMPAIGN_EDITING_AND_VERSIONING.md`
12. `docs/PORTABLE_TRANSFER.md`
13. `docs/CONNECTOR_READINESS.md`
14. `SECURITY.md`

When target architecture and current capability truth differ, **the capability matrix/current code determine what may be claimed as implemented**, while the canonical product docs determine the direction new work must follow.

## Product source of truth

### Target product direction

- `docs/PRODUCT_VISION.md` — canonical product definition and principles.
- `docs/CONTENT_INTELLIGENCE_ARCHITECTURE.md` — target Signals/Opportunities/Campaign/ContentPiece/Memory domain.
- `docs/IDENTITY_MEMORY_AND_AUTHENTICITY.md` — identity, perception, boundaries, feedback learning and narrative memory.
- `docs/CAPTURE_AND_MEDIA_PRODUCTION.md` — target screenshot/screencast/media production system.
- `docs/EDITORIAL_CALENDAR_AND_PUBLISHING.md` — target cadence/calendar/publication model.
- `docs/PRODUCT_INFORMATION_ARCHITECTURE.md` — target decision-first application structure.
- `docs/PERSONAL_ALPHA_EXECUTION.md` — owner-first vertical execution sequence.

### Current implementation truth

- Product capability discovery: `frontend/app/api/capabilities/route.js`
- Domain schema/serialization: `frontend/lib/domain/contracts.mjs`
- Campaign aggregate/migration: `frontend/lib/domain/campaign.mjs`
- Edit-safe reducer: `frontend/lib/studio/campaignState.mjs`
- Campaign/channel/action state selectors: `frontend/lib/studio/campaignStatus.mjs`
- Regeneration policies: `frontend/lib/studio/regenerationPolicy.mjs`
- Application use cases: `frontend/lib/application/`
- Infrastructure adapters: `frontend/lib/infrastructure/`
- Canonical source graph: `frontend/lib/domain/sourceArtifacts.mjs`
- Transfer: `frontend/lib/transfer/`
- Authoritative export: `frontend/lib/export/campaignExport.mjs`
- Current primary UI: `frontend/app/page.js`
- Current generation API: `frontend/app/api/launch_kit/route.js`
- Provider policy/adapters: `frontend/lib/ai/`
- Social OAuth/status: `frontend/app/api/social/` and `frontend/lib/social/`
- Confirmed-only publishing: `frontend/app/api/publish/route.js`
- Context extraction: `frontend/lib/context/`
- Browser extension: `extension/`
- MCP server: `mcp/`

## Current product truth boundaries

Do not claim target architecture as shipped functionality.

Currently implemented foundations include:

- real model-provider generation routes;
- stable browser-local campaign identity;
- authoritative current drafts;
- edit-safe regeneration/history rules;
- approval invalidation on edits;
- deterministic Markdown/JSON export;
- canonical Asset/SourceArtifact/AssetProcessing records;
- portable browser archive/import/export;
- capability discovery;
- current MCP operations;
- connector code paths for LinkedIn, X and Reddit where configured.

Currently **not** complete production capabilities include:

- persistent ContentSignal/ContentOpportunity intelligence;
- automatic work-event opportunity recommendations;
- identity/style/narrative learning;
- Today/Signals/Plan/Calendar target navigation;
- cloud account workspace/database/object storage;
- durable full-pipeline background jobs;
- automatic browser capture worker;
- deterministic product-demo rendering;
- production scheduled publication jobs;
- broad verified social connector coverage;
- analytics/performance learning;
- unreviewed global autoposting.

The README and capability matrix must remain truthful while these are built.

## Canonical architecture direction

Dependency direction remains:

```text
UI / routes / MCP / extension / webhook / workers
                    ↓
           application services
                    ↓
          domain contracts + ports
                    ↑
 browser / memory / cloud / provider / connector / worker adapters
```

New target records such as `ContentSignal`, `ContentOpportunity`, `NarrativeStrategy`, `ContentPiece`, `PlatformVariant`, `CadencePolicy`, `EditorialCalendarEntry`, `PublicationRequest`, `FeedbackEvent`, `StyleMemory`, `NarrativeMemory`, `CaptureRecipe`, and `MediaComposition` must follow the same dependency direction.

## Product-domain rules

### Signals

- A signal is evidence/context, not generated copy.
- GitHub is one source, not the whole product.
- Manual thoughts/topics and `Something else…` must remain first-class.
- Do not turn every commit/event into an opportunity.
- Event ingestion must be authorized, idempotent and provenance-preserving.

### Opportunities

- Opportunity scoring must be explainable.
- The system may recommend **do not post**.
- Repetition, evidence, narrative fit, timing and user boundaries matter.
- A proposed angle list must allow a free-form override.

### Campaigns/content pieces

- A campaign is a narrative container and may contain multiple content pieces over time.
- Do not force all supported destinations into every campaign.
- Platform absence is a valid recommendation.
- Narrative strategy must remain separate from destination copy.

### Identity/authenticity

- Do not solve identity with only a tone preset.
- Explicit boundaries outrank engagement optimization.
- Learned preferences require evidence and should be inspectable/correctable.
- Approval/edit/rejection events may inform memory but must not silently create irreversible personality rules.
- Narrative memory (what was said) is separate from style memory (how the user prefers to communicate).

### Capture/media

- AI should direct media; deterministic capture/composition should be preferred for repeatable product demos.
- Bounded CaptureRecipes are preferred over random agent clicking.
- Automated capture must be visible/authorized/target-scoped and privacy-aware.
- Raw captures and rendered derivatives require canonical Asset provenance.
- Long capture/render tasks belong behind durable jobs/workers.
- Do not build a general video editor before the automated demo golden path works.

### Editorial calendar

- Cadence is a target/constraint policy, not a recurring content factory.
- An empty slot is valid.
- Campaign pieces should be sequenced intentionally rather than published everywhere simultaneously by default.
- The calendar is editorial state plus execution state, not only timestamps.

### Publishing

- Publishing remains an external reputational side effect.
- Publication intent must bind exact draft/media revisions, target identity, approval, source state and idempotency key.
- `connected=true` is insufficient; connectors expose verified capabilities/scopes/targets.
- Manual copy/export is not direct publication success.
- `unknown` external outcomes remain unknown until reconciled.
- No unapproved revised content may replace an approved scheduled revision silently.

## Existing campaign editing rules that remain mandatory

- Never replace an edited draft silently.
- Full regeneration with edited drafts requires deliberate policy.
- Per-channel regeneration mutates only the requested channel.
- Failed/invalid regeneration leaves current work intact.
- Editing clears approval for the affected exact revision.
- Save updates the current stable ID; Save as copy allocates a new ID.
- Current edited revision is authoritative.
- Restore remains reversible where current versioning supports it.

Future ContentPiece/PlatformVariant revisions must preserve these invariants rather than weakening them.

## Infrastructure rules

- React components and domain modules must not own database/object-store/queue/provider/connector clients.
- Persisted/protocol-crossing records require stable IDs and schema versions.
- Secrets are referenced by secret IDs/secure adapters, never embedded in campaign/signal/memory records.
- Runtime `File`, `Blob`, Request/Response and SDK objects do not cross domain boundaries.
- Browser, local, cloud and worker implementations must sit behind ports/application services.
- Long-running capture/render/publication work must not depend on one open browser tab/serverless request.
- Jobs must be idempotent/retry-safe and expose persistent progress/failure.
- Binary media belongs in blob/object storage; relational/domain records own metadata/relationships.

## GitHub integration rule

Do not use GitHub MCP as the sole production source-event architecture.

Target separation:

```text
GitHub App/webhooks
    → ongoing authorized work-event/signal ingestion

SignalFlow MCP
    → AI-agent commands and queries over SignalFlow application services
```

Both may coexist.

## Vertical-slice execution rule

Prefer complete owner journeys over horizontal infrastructure breadth.

Canonical early sequence:

1. manual signal → opportunity → authentic review;
2. GitHub event → signal/opportunity → same review loop;
3. automatic screenshot;
4. automatic short demo;
5. durable scheduling/publishing;
6. editorial continuity;
7. feedback/style learning;
8. destination expansion;
9. SaaS breadth.

Do not prioritize a large team/billing/connector matrix ahead of a broken owner golden path unless a security/data foundation is genuinely required by that vertical slice.

## UX rules

- Default product home should eventually be `Today`: decisions/exceptions requiring attention.
- `Create` remains the manual entry path.
- Provider/model configuration belongs behind Connections/Settings/Advanced for normal users.
- Do not require platform selection before SignalFlow can recommend where a story fits.
- Keep `Something else…` available where options are proposed.
- Review prioritizes the exact content/media and decision, not infrastructure status.
- Persistent state cannot rely only on toasts.
- Mobile must support approval/reject/change/schedule recovery even if deep production editing is desktop-first.
- WCAG 2.2 AA is the target for supported primary workflows.
- Avoid cramped dashboards, oversized marketing cards, tiny functional text, nested scroll traps and floating bars that cover content.

## Styling architecture

Current implementation styling rules remain until UI architecture work deliberately replaces them:

- scope application styles under `.app-shell`;
- improve authoritative style owners rather than adding late global override layers;
- test responsive/zoom behavior;
- preserve readable forms/editors;
- do not interpret current Source/Destinations/Review layout as permanent navigation architecture.

## Required verification

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

Feature-specific work additionally requires the tests/evidence defined by its issue: contract, migration, authorization, visual, accessibility, worker recovery, capture/render, connector credentials, or other relevant gates.

## Completion rules

Never close an implementation issue merely because code exists or the build is green.

Close only when:

- the vertical user outcome is real;
- acceptance criteria pass;
- current and target docs remain consistent;
- capability flags are truthful;
- failure/recovery states work;
- no approved/manual work is lost;
- relevant security/privacy boundaries are tested;
- external side effects are credential-backed where claimed;
- screenshots/rendered/browser evidence is attached for visual/capture work;
- documentation names anything still incomplete.

## Final product rule

> **Reduce the amount of content work the user has to think about. Do not automate the production of noise.**
