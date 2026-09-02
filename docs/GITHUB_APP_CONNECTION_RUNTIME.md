# SignalFlow Studio — GitHub App Connection Runtime

> **Synchronized:** 2 September 2026.
>
> This document records the current GP2 GitHub source runtime contract and its acceptance boundary. GitHub is a high-value source vertical, not the entire SignalFlow product.

## Runtime purpose

GitHub App/webhook integration exists to convert authorized real work events into canonical ContentSignals with enough exact provenance to support evidence-backed opportunity inference.

It is not the same responsibility as MCP.

```text
GitHub App / webhooks
  → passive/ongoing source event ingestion

SignalFlow MCP/API
  → explicit external AI-agent commands/queries
```

Do not route production webhook transport through MCP merely because both touch GitHub-related content.

## Owner authority

GitHub source management is an owner operation.

Hosted owner policy:

- Vercel/public-hosted deployment requires a configured owner lock;
- missing owner lock fails closed with safe `owner_access_unconfigured`, not anonymous owner authorization;
- owner auth/readiness responses are private/no-store;
- local/self-hosted no-key operation may remain intentionally unlocked only under the explicit local design;
- browser code must not read/contain server access secrets.

## Connection flow

Expected authority sequence:

```text
owner-authenticated SignalFlow session
  → signed setup/install state
  → GitHub App installation
  → owner OAuth authorization when required
  → exact installation identity verification
  → list repositories under verified installation authority
  → owner selects allowed repository scope
  → persist active SourceConnection
```

The saved connection must represent the verified installation/repository scope, not an arbitrary user-supplied repository name.

Pause/resume/revoke must retain proper authority semantics and not create duplicate independent connection records for the same authority accidentally.

## Callback/setup safety

Connection/setup callbacks must preserve sequencing and signed state. A callback must not persist unverified installation identity merely because GitHub returned parameters.

Owner-facing callback recovery should be safe and bounded; never expose OAuth codes/tokens/secrets in client-visible diagnostics.

## Readiness

Owner-safe `/api/gp2/readiness` and Connections UI report only allowlisted classes and safe configuration-name-shaped missing states.

GitHub-specific readiness concerns include:

- App/runtime configuration;
- webhook signature verification capability;
- owner-access configuration;
- downstream durable database/inference/capture/storage dependencies required for the full GP2 journey.

Readiness is not permission to expose actual secret values.

## Webhook boundary

For each delivery:

1. verify webhook signature before trusting payload;
2. normalize delivery/event family under supported contracts;
3. derive stable idempotency identity;
4. authorize/associate event with active SourceConnection scope;
5. normalize canonical ContentSignal;
6. preserve exact immutable source revision when supported;
7. run a cheap/noise gate before expensive opportunity reasoning;
8. schedule/reuse durable continuation only when appropriate.

Duplicate delivery must not create a second editorial chain.

## Supported exact source-revision rule

### Pull requests

For a real merged PR:

- exact evidence revision is GitHub `merge_commit_sha`;
- never fall back to PR head SHA as merged-state evidence.

Why: branch head identifies proposal state and can differ from the actual merge commit used in repository history/evidence.

### Releases

A release is promotable only when the supported `target_commitish` value is already an immutable Git SHA.

A branch/tag/ref target may remain an auditable signal but stays non-promotional until an explicit exact-resolution capability is implemented and verified.

### Missing exact revision

The event may still be worth recording, but it cannot proceed through exact-evidence opportunity inference as if freshness were proven.

This is a fail-closed product rule, not a logging inconvenience.

## Evidence refresh

GP2 opportunity continuation must use exact source state.

```text
ContentSignal.sourceRevision
→ bootstrap/refresh repository at exact commit
→ bounded ProjectContextSnapshot
→ immutable SourceArtifact identities
→ verify snapshot revision == signal revision
→ opportunity inference
```

If exact evidence cannot be refreshed or verified:

- durable job retries/blocks according to failure policy;
- no opportunity should be evaluated against unrelated current/latest source state.

## Strategy evidence continuity

NarrativeStrategy does not receive only free-form signal text.

It resolves the exact ProjectContextSnapshot pinned by the selected Opportunity.

Exact snapshot/revision/artifact identities may participate in:

- canonical record relationships;
- task provenance;
- fingerprints/idempotency.

They should not automatically become model prompt text.

For private repositories, use canonical minimized ProjectContext synthesis and exclude unnecessary repository identity/opaque SourceArtifact IDs while retaining safe evidence claims/constraints/uncertainties.

## Meaningful vs noise event behavior

SignalFlow must not manufacture content from every webhook.

Acceptance must include:

### Meaningful event

A real merged PR/release that contains a worthwhile product/engineering story and can be supported by exact evidence.

Expected outcome:

- one signal;
- one exact revision identity;
- durable opportunity continuation;
- useful ranked opportunity.

### Noise event

Example class: routine dependency-only/trivial maintenance event.

Expected outcome:

- may remain auditable;
- opportunity evaluation is skipped or returns non-promotional;
- no high-priority content/media work is manufactured merely because event arrived.

## Current merged state

Through PRs #254/#256/#257/#258, the repository includes:

- exact source-revision continuity contracts;
- exact evidence refresh before opportunity inference;
- private-source inference minimization;
- owner-safe readiness + fail-closed hosted owner policy;
- Today ranked-opportunity visibility;
- canonical hosted exact review decisions in Today.

Current production master: `ea71fa39836dfadddd70f0fe5a135c2f4d8ce9e0`.

## Active downstream PR #259

PR #259 does not change GitHub ingestion semantics. It automates downstream exact review after revisions are prepared.

- exact head: `6df646f76151e6544dbd506eb7e41909b83cb8cd`
- CI #877 all required jobs green
- final-head Vercel preview not executed due account-level build-rate gating
- remains unmerged until exact-head Vercel READY.

Do not accidentally mix #259's review-preparation responsibility into GitHub transport code.

## Acceptance still pending

The code/runtime architecture is not enough to close #161/#167.

Real hosted acceptance must prove:

- owner login/readiness;
- real GitHub App install + repository scope selection;
- real meaningful merged PR delivery;
- signature verification;
- exactly one signal;
- duplicate idempotency;
- exact `merge_commit_sha` propagation;
- exact ProjectContext/SourceArtifact refresh/continuity;
- useful Opportunity in Today;
- owner angle judgment;
- evidence-bound strategy;
- downstream automatic generation/media/review;
- exact owner judgment;
- low-value/noise event non-promotion;
- recovery/reopen semantics.

Record sanitized evidence only in `docs/acceptance/GOLDEN_PATH_2_OWNER_ACCEPTANCE.md`.

## Security/logging rules

Never log/store in acceptance artifacts:

- OAuth authorization code;
- access/refresh token;
- webhook secret;
- owner access key;
- raw private repository body/diff when not required;
- cookies/session secret;
- private storage/CDP credentials.

Use safe IDs/status names and exact Git SHA where the SHA itself is acceptable evidence.

## Current next action

Do not build another GitHub connection feature before resolving the active release/automation frontier.

Next sequence:

1. preserve #259 exact head and clear its exact-head Vercel gate;
2. merge/production-verify #259;
3. build automatic post-strategy generation + required screenshot preparation;
4. then execute the real GitHub source acceptance run end to end.
