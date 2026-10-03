# SignalFlow Studio Frontend

Next.js App Router application for SignalFlow Studio, an approval-first content operating system.

The production frontend contains the web product, owner-only hosted application routes, model/provider adapters, connected-source workflows, review surfaces, capture/media foundations, public crawler metadata, and compatibility/manual Create flow.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

For repository-wide architecture and product rules, read:

1. `../AGENTS.md`
2. `../docs/CURRENT_EXECUTION_STATE.md`
3. `../docs/CAPABILITY_MATRIX.md`
4. `../docs/PRODUCT_VISION.md`

## Current product center

SignalFlow is no longer defined by `source → destinations → generate posting package`.

The intended product lifecycle is:

```text
meaningful work / manual thought / connected source
→ ContentSignal
→ worthwhile ContentOpportunity
→ owner angle decision
→ NarrativeStrategy / ContentPiece
→ evidence + media when justified
→ platform-specific exact revisions
→ owner review / approval
→ durable publication later
→ narrative/style learning where verified
```

Current web surfaces include owner workflows for Signals, Plan, Today/review, Voice/identity, the compatibility/manual Studio/Create path, Library/Connections/Settings, and hosted GitHub-connected source/planning routes where configured.

Do not infer capability from a visible route. `/api/capabilities`, `docs/CAPABILITY_MATRIX.md`, deployment configuration, and acceptance evidence define what may be claimed as available.

## Hosted owner lock

Optional private hosted owner access:

```text
SIGNALFLOW_ACCESS_KEY=make-a-long-private-key-here
```

When configured, owner-only application/provider/connector routes require authenticated owner access. Never expose this value through a `NEXT_PUBLIC_` variable.

## Persistence truth

SignalFlow currently has more than one persistence class:

- legacy/general Campaign save remains browser-local;
- owner-scoped hosted records can use Postgres/Neon for connected sources, ContentSignals, ProjectContext, Opportunities, planning/revisions, exact review state, durable opportunity-job state, and private Asset metadata/blob storage where configured;
- hosted record configuration does not imply broad cloud Campaign autosave, collaboration, or an always-on worker;
- production acceptance is stronger than code/configuration presence.

Use the capability endpoint and matrix instead of collapsing all persistence into a single “cloud database” claim.

## Vercel project settings

When this directory is the project root:

```text
Install Command: npm install
Build Command: npm run build
Output Directory: .next
```

The current free-tier deployment quota may prevent previews even when GitHub CI succeeds. A failed Vercel status caused by the deployment/build rate limit is not equivalent to an application test failure.

## Verification

```bash
npm test
npm run gp2:preflight
npm audit --package-lock-only --omit=dev --audit-level=high
npm run build
npm run audit:function-traces
```

Repository CI also runs MCP and Python compatibility tests.

A feature is not complete because it builds. External-source, inference, media, connector, or publishing claims require the acceptance evidence defined by their owning issue.
