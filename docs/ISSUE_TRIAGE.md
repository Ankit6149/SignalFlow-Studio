# SignalFlow Studio — Open Issue Triage

> **Execution classification snapshot: 2026-10-05.**
>
> This ledger answers “what should we work on now?” without pretending that every open roadmap issue is active. It does **not** replace issue bodies or capability evidence.
>
> Allowed statuses:
>
> - **ACTIVE** — part of the practical execution frontier.
> - **BLOCKED** — valid outcome, but a named prerequisite must land first.
> - **PARTIALLY IMPLEMENTED** — meaningful implementation exists; remaining acceptance/scope stays open.
> - **LATER** — valid backlog, intentionally outside the current frontier.
> - **CLOSE WITH EVIDENCE** — implementation is materially complete and the issue should close only after its stated acceptance evidence is attached.
>
> Priority labels in issue titles describe product severity/scope, not scheduling. An open P0 may still be **LATER** if it is not the current owner journey.

## Counts

| Status | Count |
| --- | ---: |
| ACTIVE | 8 |
| CLOSE WITH EVIDENCE | 2 |
| BLOCKED | 3 |
| PARTIALLY IMPLEMENTED | 47 |
| LATER | 34 |
| **Total open issues classified** | **94** |

## Practical execution frontier

Only the **ACTIVE** group is the default working set. Starting work from another group requires an explicit dependency/reprioritization reason.

## ACTIVE

- #34 — [P1][Plan 2] SF-017 — Add request, context, concurrency, and cost controls — residual rate/concurrent-campaign/cost controls; do not rebuild merged limit/token controls.
- #35 — [P1][Plan 2] SF-036 — Expand MCP into a complete campaign workflow — residual external-client/auth/cost/saved-Campaign acceptance; core MCP workflow is already present.
- #159 — [P0][UI/UX] Build Today, Signals, and Plan as the decision-first product center — decision-first Today/Signals/Plan center.
- #161 — [P0][GitHub Signals] Add GitHub App/webhook event ingestion into canonical ContentSignals — connected GitHub source slice required by GP2.
- #163 — [P0][Media Capture] Produce campaign-ready screenshots and responsive visual derivatives from CaptureRecipes — screenshot/media slice required by GP2.
- #167 — [P0][Golden Path 2] GitHub work event → ranked opportunity → automatic evidence/media-ready campaign — current Golden Path 2 owner acceptance outcome.
- #209 — Refactor Studio + landing layout system for stable navigation, spacing, and decision-first usability — shared UI consolidation parent; do not create a parallel visual system.
- #222 — [P0][Onboarding] Connect repository → persistent project context → first useful opportunities — repository onboarding/project-context outcome converging on the GP2 path.

## CLOSE WITH EVIDENCE

- #44 — [P1][Plan 5] SF-018 — Consolidate eight global CSS layers into scoped design architecture — CSS authority is complete; close only after current-production visual acceptance is truthful.
- #340 — [P0][Repo Hygiene] Reconcile GitHub, docs, source tree, and production truth — repository-hygiene closeout; admin-surface blockers must remain explicit.

## BLOCKED

- #53 — [P0][Plan 6] SF-038 — Prove V1 with real providers, connectors, MCP, exports, and release gates — release umbrella; blocked on GP2/GP3 sequence rather than current cleanup.
- #168 — [P0][Golden Path 3] Approved text/media → editorial schedule → durable publish → narrative memory — GP3 follows accepted GP2.
- #214 — Golden Path: multi-platform Content Pack generation beyond LinkedIn/X — destination-breadth work waits until GP2 is accepted.

## PARTIALLY IMPLEMENTED

- #55 — [EPIC] Product architecture, content operating system lifecycle, and deployment profiles
- #56 — [EPIC] Beginner-first hosted experience and low-attention owner workflow
- #57 — [EPIC] Cloud data platform, durable jobs, object storage, and content-OS synchronization
- #59 — [EPIC] Assets, evidence, capture/rendered media, processing, provenance, and reuse
- #60 — [EPIC] Campaign narratives, content pieces, editor, autosave, approvals, and version history
- #61 — [EPIC] Staged generation, editorial reasoning, providers, authenticity, quality, and cost control
- #62 — [EPIC] Decision-first UI/UX, design system, responsiveness, and accessibility
- #63 — [EPIC] Review, exact-revision approvals, editorial publication, connectors, and collaboration
- #64 — [EPIC] Security, privacy, identity/memory trust, capture safety, and tenant isolation
- #65 — [EPIC] Contributor experience, canonical product docs, architecture guidance, and issue quality
- #66 — [EPIC] End-to-end QA, observability, performance, release evidence, and rollback for the content OS
- #72 — [P0][Cloud] Implement object storage and resumable asset uploads
- #73 — [P0][Cloud Jobs] Add durable background jobs for ingestion, intelligence, generation, capture, render, export, and publishing
- #75 — [P0][Hosted UX] Make managed generation the default and move BYOK/local models to Advanced
- #87 — [P1][Assets] Build the asset inbox and reusable asset library
- #88 — [P1][Assets] Add thumbnail, extraction, OCR, transcription, and analysis processing adapters
- #90 — [P0][UI/UX] Establish design tokens, layout primitives, and component usage rules
- #91 — [P1][UI/UX] Rebuild the global shell around Today, Signals, Plan, Calendar, Create, Assets, Library, Connections, Voice, Settings
- #92 — [P1][UI/UX] Rebuild manual Create/source workspace as a first-class signal/evidence intake path
- #93 — [P1][UI/UX] Turn destination/model setup into editorial recommendations plus progressive provider disclosure
- #94 — [P1][UI/UX] Build persistent progress and recovery across generation, capture, render, and publication preparation
- #95 — [P0][UI/UX] Rebuild Review around ContentPieces, exact text/media revisions, evidence, and approval
- #96 — [P1][UI/UX] Standardize Library, Assets, Connections, Voice, Settings, and legal/support routes
- #97 — [P0][UI/UX] Define responsive breakpoints, reflow rules, and zoom-safe behavior for every core workflow
- #98 — [P0][Accessibility] Make the complete hosted and local workflow keyboard and screen-reader usable
- #99 — [P0][UI QA] Add visual regression fixtures for layout, long content, and every workflow state
- #102 — [P1][Connectors] Show verified account identity, scopes, capabilities, and expiry before publishing
- #104 — [P0][Security] Implement centralized authorization and prove tenant isolation across every surface
- #105 — [P0][Security] Build secret management, privacy controls, retention, and redacted observability
- #108 — [P1][Contributors] Publish architecture docs, issue templates, fixtures, and contribution paths
- #109 — [P0][QA/Ops] Build end-to-end acceptance, correlation-based observability, and release evidence
- #127 — [P0][Sources] Harden remote URL ingestion against SSRF, redirects, and oversized content
- #128 — [P1][Sources][UX] Build a source health and ingestion diagnostics workspace
- #129 — [P1][Sources] Version remote evidence snapshots and revalidate source freshness
- #150 — [EPIC][Product Brain] Content intelligence, identity, editorial automation, and low-attention publishing
- #151 — [EPIC][Media Intelligence & Production] Understand media intent, choose the right format, and produce/edit reviewable images, carousels, demos, and creator video
- #153 — [P0][Identity] Build versioned identity, perception, voice, boundary, and platform-expression profiles
- #155 — [P0][Memory] Add narrative memory, publication-story history, and semantic repetition detection
- #156 — [P0][Editorial Intelligence] Build explainable ContentOpportunity scoring, ranking, and angle proposals
- #157 — [P0][Campaign Model] Add NarrativeStrategy, ContentPiece, and PlatformVariant contracts
- #158 — [P0][Generation] Replace giant campaign generation with staged orchestration and authenticity/evidence quality gates
- #170 — [EPIC][AI Platform] Build provider-neutral inference fabric, privacy-aware routing, local intelligence, and user-owned AI modes
- #171 — [P0][Inference] Add task-oriented provider capability registry, policy-aware routing, metering, and fallback
- #172 — [P0][Privacy] Enforce data classification, processing policies, evidence minimization, and Private Hybrid routing
- #179 — [P0][Media Intent] Add AssetRole, AssetUsePolicy, immutable media lineage, and intent resolution
- #180 — [P0][Media Intelligence] Build explainable MediaDecision and MediaRequirement planning across destinations
- #184 — [P1][Direct Create] Add natural-language multimodal creation intake for topics, images, videos, files, links, and explicit media intent

## LATER

- #15 — [ROADMAP] SignalFlow Studio — content operating system, Personal Alpha, cloud, media, and release backlog
- #22 — [P0][Plan 3] SF-001 — Align links-only campaign readiness with server validation
- #25 — [P1][Plan 3] SF-009 — Make local repository mode reachable only in trusted deployments
- #58 — [EPIC] Browser extension for deliberate user-initiated context, screenshots, and recordings
- #70 — [P0][Cloud] Implement hosted authentication, account recovery, and workspace selection
- #74 — [P0][Cloud] Implement autosave, cross-device synchronization, and conflict recovery
- #76 — [P1][Hosted UX] Build guided onboarding and a safe first-campaign experience
- #77 — [P1][Hosted UX] Create plain-language help, recovery guidance, and account data controls
- #78 — [P0][Extension] Define least-privilege permissions, capture threat model, and privacy boundaries
- #79 — [P0][Extension] Build installation, sign-in, deployment pairing, and workspace targeting
- #80 — [P1][Extension] Capture page context, selected text, links, and user notes with provenance
- #81 — [P1][Extension] Implement visible-tab, region, and supported full-page screenshot capture
- #82 — [P1][Extension] Implement tab, window, and screen recording with explicit lifecycle controls
- #83 — [P1][Extension] Add capture review, metadata, annotation, and redaction before delivery
- #84 — [P0][Extension] Implement an offline upload queue with retry, cancellation, and duplicate protection
- #85 — [P1][Extension] Establish browser compatibility, version negotiation, diagnostics, and release packaging
- #89 — [P1][Assets] Implement content hashing, duplicate handling, retention, and deletion semantics
- #100 — [P1][Collaboration] Implement workspace members, invitations, roles, and permission-aware UI
- #101 — [P1][Collaboration] Add comments, review requests, version-specific approvals, and activity history
- #103 — [P0][Publishing] Implement exact-revision idempotent immediate and scheduled publication jobs
- #106 — [P1][Cloud] Add usage metering, quotas, and a billing-ready ledger without premature pricing
- #107 — [P0][Cloud Ops] Implement database/storage migrations, backups, restore drills, and disaster recovery
- #160 — [P0][Editorial Calendar] Add cadence policies, campaign sequencing, empty-slot behavior, and editorial planning
- #164 — [P0][Media Capture] Produce deterministic campaign screencasts from safe CaptureRecipes
- #165 — [P0][Media Rendering] Build versioned motion composition and multi-aspect campaign video rendering
- #173 — [P1][Local AI] Build curated local intelligence registry, device capability assessment, and downloadable private-processing packs
- #174 — [P1][AI Clients] Expose SignalFlow safely to ChatGPT, Claude, Codex, Gemini, and other agents without subscription/session hacks
- #175 — [P1][Mobile] Build a low-attention mobile companion for capture, judgment, approval, calendar, and publication exceptions
- #176 — [P1][Desktop Agent] Build a paired edge agent for private repositories, local files/models, device capabilities, and signed edge jobs
- #177 — [P2][Desktop Capture] Add bounded desktop-app screenshot/screencast recipes through OS accessibility and capture APIs
- #181 — [P1][Image Production] Add image understanding, editing, compositing, generation, and deterministic layout pipeline
- #182 — [P1][Carousel] Build narrative-first carousel planning, semantic slide primitives, deterministic rendering, and slide-level revisions
- #183 — [P1][Creator Video] Edit uploaded footage into structured Reels/Shorts with VideoNarrative, VideoEditPlan, captions, and deterministic rendering
- #185 — [P1][Media Trust] Add rights, consent, face/voice safeguards, audio provenance, and publication blockers for creative media

## Operating rules

- Open does not mean active.
- Do not create duplicate replacement issues because an older issue has a stale description; reconcile its body first.
- Parent epics stay open while their child outcomes remain valid, but they do not become simultaneous execution.
- Product-direction issues may remain **LATER** without implying they are rejected.
- **PARTIALLY IMPLEMENTED** means preserve existing contracts and identify the residual acceptance gap before coding.
- **BLOCKED** issues should not accumulate speculative implementation while their prerequisite is unresolved.
- Closed cleanup issues such as #45 and #135 are intentionally absent from this open-issue ledger.
- Recompute this ledger when the execution frontier materially changes, not after every small PR.
