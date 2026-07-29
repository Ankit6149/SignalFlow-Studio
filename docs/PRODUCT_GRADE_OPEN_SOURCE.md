# Product-grade open-source direction

SignalFlow Studio should remain a serious product while it is open source, browser-local, and self-hostable.

## Current product position

SignalFlow Studio is a review-first campaign workspace for builders, founders, creators, maintainers, and small teams. It turns product evidence into editable channel-specific drafts without pretending unsupported automation succeeded.

Current source inputs include:

- product notes and audience;
- public links;
- public GitHub repository context;
- supported text, Markdown, JSON, CSV, and code files;
- image/video metadata and user descriptions as planning references.

Current destinations include LinkedIn, X, Instagram, Facebook, Threads, Reddit, Hacker News, YouTube, TikTok, newsletters, blogs, and release notes.

## Generation truth

Campaign generation requires a real model provider route.

Supported directions:

- server-configured providers when the current session is authorized;
- temporary bring-your-own keys for supported cloud providers;
- trusted custom OpenAI-compatible endpoints;
- Ollama and LM Studio for eligible local/self-hosted sessions;
- hosted local-model access only through a reachable trusted endpoint.

Template, offline, prompt-only, and automatic fallback campaign output are retired. Provider failure must produce an actionable failure or partial-failure state, never substitute copy presented as model-generated content.

## Product experience

Even as open source, the product should have:

- clear first-run guidance;
- understandable source, destination, generation, and review stages;
- one authoritative current draft per channel;
- useful native previews and platform guidance;
- a versioned browser-local campaign library;
- deterministic Markdown/JSON export;
- explicit connector and manual publishing paths;
- plain-language security, privacy, and deployment boundaries;
- no dead core actions or fake success states.

## Local-first boundaries

Implemented today:

- no mandatory cloud account;
- browser-local campaign persistence;
- request-scoped temporary provider keys;
- local model adapters;
- MCP support through an explicitly configured server package;
- review-first publishing;
- official connector code paths for LinkedIn, X, and Reddit;
- manual copy/export/open routes for other destinations.

Not implemented today:

- cloud campaign database and object storage;
- cross-device synchronization;
- collaboration and team permissions;
- durable background jobs;
- hosted AI credits and billing quotas;
- acknowledged extension ingestion, screenshots, or recordings;
- automatic visual understanding in the main generation route.

These must not be described as active merely because they are planned.

## Architecture direction

The canonical dependency direction is:

```text
UI / routes / MCP / extension receiver
                ↓
       application services
                ↓
      domain contracts + ports
                ↑
 browser / memory / cloud adapters
```

Required boundaries:

- versioned domain records and stable identifiers;
- portable serialization without provider keys, OAuth secrets, runtime files, database clients, or framework requests;
- campaign, asset, blob-storage, job-queue, provider, connector, notification, clock, and ID ports;
- browser/local and hosted/store-backed adapters behind the same contracts;
- pure application services for campaign decisions;
- deterministic export projectors from authoritative campaign state;
- compatibility migrations into canonical records rather than parallel data models.

See [DOMAIN_ARCHITECTURE.md](DOMAIN_ARCHITECTURE.md) and [CAPABILITY_MATRIX.md](CAPABILITY_MATRIX.md).

## Hosted and self-hosted evolution

Future hosted work may add:

- authentication and workspaces;
- tenant-isolated campaign/asset repositories;
- encrypted secret management;
- object storage and resumable uploads;
- durable queues and workers;
- autosave, conflict handling, and version history;
- collaboration, approvals, audit events, usage limits, backups, and restore.

Those implementations must satisfy the existing domain and adapter contracts. They must not be wired directly into React handlers or introduced as a second product architecture.

## Engineering rule

Every feature should answer:

```text
Does this help a user create, review, preserve, or distribute better campaign content from real product evidence?
```

Build it only when the answer is clear, the product state is truthful, and the full acceptance evidence can be supplied.

## Release readiness

A public release requires more than a successful build:

- documented capability truth;
- passing domain, adapter, migration, regression, security, and build gates;
- usable setup instructions;
- no committed credentials;
- verified local persistence and export recovery;
- truthful provider and connector states;
- accessibility and responsive verification for touched UI;
- deployment and rollback evidence;
- no stale README, agent, architecture, capability, privacy, or AI-context claims.
