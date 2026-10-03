# Discoverability and Public Product Truth

Use this document when editing GitHub metadata, public crawler files, answer-engine context, or landing-page search copy.

Public discoverability must describe the **current product truth** while clearly distinguishing the larger Content Operating System direction from features that are not yet accepted.

## Canonical positioning

Recommended repository description:

> Approval-first content operating system for turning meaningful work into evidence-backed content opportunities, exact review decisions, and reusable communication context.

Recommended website:

> https://signal-flow-studio.vercel.app/

Recommended GitHub topics:

```text
signalflow-studio
content-operating-system
content-operations
content-signals
approval-first
narrative-planning
creator-tools
developer-marketing
github-integration
review-workflow
nextjs
open-source
local-first
bring-your-own-ai
mcp
```

Do not reintroduce obsolete primary positioning such as `autoposting`, `post-generator`, `gif-generator`, or `fastapi` unless those terms again describe a supported first-class product surface.

## Useful search language

Use these phrases naturally where they truthfully fit:

- content operating system
- approval-first content workflow
- turn GitHub work into content opportunities
- evidence-backed content planning
- exact revision review and approval
- content signals and narrative planning
- developer content workflow
- review-before-publish content automation
- bring-your-own AI content workflow
- local-first content workflow

Avoid SEO copy that implies SignalFlow already provides:

- unattended autoposting;
- universal scheduled publishing;
- broad verified social connectors;
- complete automatic media production;
- cross-device collaborative workspaces;
- every planned Content OS surface.

## Public truth hierarchy

Before changing a material public capability claim, check in this order:

1. deployed production/runtime evidence;
2. current `master`;
3. `docs/CAPABILITY_MATRIX.md`;
4. `docs/CURRENT_EXECUTION_STATE.md`;
5. acceptance evidence;
6. README/landing copy.

A roadmap issue or architecture document is not a shipped-capability source.

## Public crawler and answer-engine files

The deployable canonical copies live in `frontend/public/`:

- `robots.txt`
- `llms.txt`
- `llms-full.txt`
- `schema.jsonld`

Root copies exist for repository readers and are synchronized mirrors. Use:

```bash
cd frontend
npm run sync:public-metadata
npm run audit:public-metadata
```

The CI audit must fail when a root mirror drifts from its deployable canonical file.

## README structure

Keep the public README oriented around:

1. concise product promise;
2. current implementation versus product direction;
3. accepted/current owner workflows;
4. exact capability boundaries;
5. architecture and trust principles;
6. quick start;
7. verification;
8. roadmap/acceptance links.

Avoid making the compatibility Campaign/Create path look like the permanent product architecture.

## Visual/demo evidence

Public screenshots or demos should show real product surfaces and label future concepts clearly.

Do not present a mock, future workflow, placeholder analytics state, or planned automation as a production screenshot.

## Repository metadata review

During each release/hygiene checkpoint, verify:

- GitHub description;
- homepage URL;
- topics;
- README opening;
- `frontend/public/schema.jsonld`;
- `frontend/public/llms.txt`;
- `frontend/public/llms-full.txt`;
- landing metadata/copy.

All of them should describe the same product.
