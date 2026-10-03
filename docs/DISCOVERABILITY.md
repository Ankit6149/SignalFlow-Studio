# Discoverability and Public Product Truth

Use this document when aligning the GitHub repository, public site, crawler metadata, release notes, and AI-answer-engine context.

Public positioning must follow the same capability truth as the product. Do not optimize discoverability by reviving the retired “autoposting/post generator” description.

## Canonical positioning

Recommended GitHub description:

> Approval-first content operating system that turns meaningful work and connected signals into evidence-backed, reviewable communication.

Recommended website:

> https://signal-flow-studio.vercel.app/

Recommended topics:

```text
signalflow-studio
content-operating-system
content-operations
content-signals
approval-first
narrative-planning
creator-tools
developer-tools
github-integration
bring-your-own-ai
nextjs
open-source
local-first
```

Avoid using obsolete primary topics such as `autoposting`, `post-generator`, `gif-generator`, or `fastapi` unless the repository once again intentionally ships and centers those products.

## Search and answer-engine language

Use these phrases naturally when they accurately describe the current product or explicitly labelled direction:

- content operating system
- approval-first content workflow
- content signals from product work
- GitHub work to content opportunity
- evidence-backed content planning
- exact revision review and approval
- narrative planning for LinkedIn and X
- bring-your-own AI content workflow
- review before publishing
- developer content operations

Do not market planned capabilities as already available. In particular, broad automatic media production, durable scheduled publication, collaboration, and fully accepted GP2/GP3 journeys require their own acceptance evidence.

## Current public truth

The public narrative may state that SignalFlow:

- captures manual ContentSignals;
- has an accepted browser-local owner Golden Path 1;
- has owner-scoped hosted GitHub/source, ProjectContext, Opportunity, planning, review, opportunity-job and private-Asset persistence paths where configured;
- supports exact revision review workflows for LinkedIn/X;
- exposes capability discovery and an MCP client surface;
- retains the legacy/manual Studio flow as a compatibility/Create foundation.

It should state that GP2 is still active until the real GitHub-event → opportunity → automatic evidence → exact owner-review acceptance ledger closes.

## Public metadata files

The deployed Next.js copies are under `frontend/public/`.

Repository-root copies exist for GitHub readers. They must not drift semantically from the deployed copies:

- `robots.txt`
- `llms.txt`
- `llms-full.txt`
- `schema.jsonld`

When one copy changes, update or mechanically verify its paired copy in the same PR.

## README structure

Keep the root README oriented around:

1. product promise and problem;
2. current capability truth versus product direction;
3. canonical lifecycle;
4. approval/identity/evidence principles;
5. setup and deployment modes;
6. verified current source/model/MCP/connector boundaries;
7. current execution/roadmap links.

Avoid presenting twelve-channel generation breadth as the product’s primary identity.

## Release/publication discipline

Before publishing a release or changing repository metadata:

- compare claims with `docs/CAPABILITY_MATRIX.md`;
- check `docs/CURRENT_EXECUTION_STATE.md`;
- use exact deployed production SHA when making production claims;
- distinguish configured/code-present from credential-backed accepted;
- keep future architecture labelled as direction/in development.

## Repository presentation checklist

- concise GitHub description aligned with Content OS positioning;
- current website URL;
- current topics;
- product screenshot/demo only when it represents the current interface;
- pinned active issues rather than old planning generations;
- release notes linked to exact merged SHA and acceptance state;
- Sponsor button remains optional and separate from capability/access claims.
