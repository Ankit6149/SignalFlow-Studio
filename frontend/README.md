# SignalFlow Studio Frontend

The production Next.js App Router application for SignalFlow Studio, an approval-first **content operating system**.

The frontend hosts the current web product, API routes, owner decision surfaces, connected-source workflows, review flows, and public site. The current product contains both:

- canonical Content OS surfaces such as Today, Signals, Plan, Voice, hosted GitHub/project context, and exact review; and
- a compatibility/manual Campaign/Create workflow that remains usable while the product migrates onto the canonical ContentSignal → Opportunity → NarrativeStrategy → ContentPiece → PlatformVariant lifecycle.

Do not describe the application as only a posting-package generator.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Optional private hosted owner lock:

```text
SIGNALFLOW_ACCESS_KEY=make-a-long-private-key-here
```

If `SIGNALFLOW_ACCESS_KEY` is set, owner-only hosted routes require owner access. The browser exchanges the owner key for a signed session token. Never use a `NEXT_PUBLIC_` name for this value.

## Current product flow

The current canonical owner workflow is increasingly decision-first:

```text
manual thought or connected work
→ ContentSignal
→ worthwhile ContentOpportunity
→ owner angle judgment
→ NarrativeStrategy
→ ContentPiece
→ destination-specific PlatformVariant revisions
→ evidence/authenticity checks
→ exact owner review
→ approve / change / reject
```

Golden Path 1 is accepted for the browser-local owner flow. Golden Path 2 is still an active acceptance gate and must not be represented as complete merely because its GitHub, Postgres, planning, capture, or review foundations exist.

The older manual Campaign workflow remains a compatibility/Create path for source briefs, destination generation, editing, export, and connector handoff.

## Capability truth

Do not infer product capability from routes, adapters, or environment variables alone.

Use:

1. `GET /api/capabilities` for session/deployment runtime capability truth;
2. `../docs/CAPABILITY_MATRIX.md` for implementation/deployment status;
3. `../docs/CURRENT_EXECUTION_STATE.md` for the current execution/acceptance frontier.

General hosted Campaign autosave, cross-device workspace sync, collaboration, and durable scheduled publication are not implied by the presence of owner-scoped Postgres records.

## Vercel

When this folder is the Vercel Root Directory:

```text
Install Command: npm install
Build Command: npm run build
Output Directory: .next
```

Long-running inference, capture, render, ingestion, or publication work must not depend on one browser tab or one serverless request.

## Verification

```bash
npm ci
npm test
npm run gp2:preflight
npm audit --package-lock-only --omit=dev --audit-level=high
npm run build
npm run audit:function-traces
npm run audit:public-metadata
```

Normal repository CI remains the merge gate. External capabilities additionally require the credential/runtime/acceptance evidence owned by their issues.
