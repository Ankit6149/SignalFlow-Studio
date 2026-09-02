# SignalFlow Studio — Connector & Hosted Readiness

> **Synchronized:** 2 September 2026.
>
> This file describes connector/readiness truth, especially the current GP2 GitHub-source acceptance boundary. It does not turn configured code into credential-backed acceptance.

## Current production baseline

- master: `ea71fa39836dfadddd70f0fe5a135c2f4d8ce9e0`
- production: `dpl_ExhZUutbj3peG3BKX1FLDLmJe7Ez`
- production state at checkpoint: READY on exact master SHA
- GP2: active / not owner-accepted

## Owner access boundary

Merged PR #256 established the canonical hosted owner policy.

### Hosted mode

A deployment is treated as hosted when explicit hosted configuration indicates it or when Vercel runtime proves hosted deployment context.

Public-hosted/Vercel deployment must not become owner-authorized because a secret is missing.

If owner access configuration is absent in hosted mode:

- owner-only routes fail closed;
- safe status is 503 `owner_access_unconfigured` rather than anonymous authorization;
- owner auth/readiness responses are private/no-store;
- no secret values are returned.

Local/self-hosted no-key operation may remain intentionally unlocked where explicitly designed.

Direct owner key verification uses constant-time comparison under the canonical owner policy.

## GP2 readiness surface

Canonical owner-safe endpoint: `/api/gp2/readiness`.

Canonical UI: Connections workspace readiness panel.

The browser trusts only the known readiness contract and known labels. Unknown/duplicate/missing/malformed checks fail closed rather than being rendered as guessed readiness.

Readiness displays safe state/missing **configuration names only**, never credential values.

Current expected classes include the core hosted requirements for:

- durable database;
- owner access lock;
- GitHub App connection/runtime configuration;
- GitHub webhook verification;
- private Asset storage;
- bounded screenshot worker;
- exact-media visibility receipts;
- hosted inference route.

The precise server contract remains authoritative; UI must not infer readiness by reading browser environment variables.

## GitHub source authority

GP2 source management must remain owner-protected.

Expected live acceptance sequence:

```text
owner session
→ signed GitHub setup/install state
→ GitHub App installation
→ separate owner OAuth authorization where required
→ exact installation identity verification
→ repository selection verified against installation authority
→ persisted active SourceConnection with only selected enabled repository scope
```

Pause/resume/revoke must preserve authority semantics.

## GitHub webhook source rules

MCP is not the production event transport.

```text
GitHub App/webhook
→ production source event ingestion

SignalFlow MCP
→ AI-agent commands/queries
```

Webhook acceptance requirements:

- verify delivery signature before trusting event body;
- normalize delivery ID/event family safely;
- make delivery idempotent;
- persist exactly one canonical ContentSignal for duplicate delivery;
- preserve exact immutable source revision when available;
- do not log raw private payload/secret material as acceptance evidence.

## Exact source-revision rules

### Merged pull request

Use `merge_commit_sha` as exact merge evidence.

Do **not** fall back to PR head SHA. Head SHA may identify proposed branch state, not the immutable merged repository state used for evidence.

### Release

Promote only when `target_commitish` is already an immutable Git SHA under the supported contract.

A mutable branch/tag/ref target may remain auditable but must remain non-promotional until exact resolution is explicitly supported and verified.

### Missing exact revision

Missing/unresolved immutable revision means:

- the event may remain a canonical/auditable signal;
- it must not continue into exact-evidence opportunity inference as though freshness were proven.

## Exact evidence continuity

Before opportunity inference for a GitHub GP2 signal:

1. read exact source revision from canonical signal;
2. refresh or reuse bounded repository evidence at that exact revision;
3. verify ProjectContextSnapshot resolves to that exact source state;
4. only then run opportunity inference;
5. persist the exact ProjectContext snapshot identity used by opportunity;
6. propagate the exact evidence context into NarrativeStrategy planning.

Failure/mismatch blocks or retries. Do not silently substitute unrelated latest repository context.

## Private-source minimization

Exact provenance does not mean every identifier belongs in the model prompt.

For private source context:

- reuse canonical minimized ProjectContext synthesis;
- include only safe claims/architecture/constraints/uncertainties needed for the task;
- do not send repository owner/name merely for provenance;
- do not send opaque SourceArtifact IDs when they provide no semantic value;
- retain exact IDs/revisions in canonical record/fingerprint/task provenance where required;
- secret material must not become normal model input.

## Hosted private Asset/capture dependencies

GP2 visual proof depends on:

- private S3-compatible Asset byte storage;
- canonical workspace-scoped Asset metadata;
- bounded CDP browser endpoint;
- server-only capture environment/configuration;
- screenshot quality + deterministic derivative pipeline;
- protected exact AssetVersion preview;
- server-only visibility-receipt signing secret.

Browser responses must not expose:

- S3 credentials;
- canonical private object keys;
- permanent private storage URLs;
- CDP/browser credentials;
- visibility-receipt signing secret.

## Exact media visibility boundary

Media-bound approval is allowed only when:

- requested approval revision is exact current revision;
- strategy-required media is actually bound;
- every exact media binding can be streamed through protected preview;
- browser receives exact Asset/AssetVersion identity for displayed bytes;
- server issued a valid short-lived visibility receipt after serving those exact bytes;
- approval sends matching role/Asset/AssetVersion/receipt set;
- server verifies each receipt against workspace + exact identity.

Expired/tampered/cross-workspace/stale receipts fail closed.

## PR #259 readiness effect — unmerged

PR #259 exact head: `6df646f76151e6544dbd506eb7e41909b83cb8cd`.

It does not change GitHub source authority/configuration. It changes downstream review preparation:

- automatic exact critics;
- valid review reuse;
- fail-soft critic recovery;
- required media review deferral;
- required media Today/API approval guard.

CI #877 is green, but #259 remains unmerged because exact final head has no executed Vercel preview due account-level build-rate gating.

Do not treat #259 as production readiness until merge + production exact-SHA verification.

## Current live acceptance still required

The following remain acceptance actions, not documentation claims:

- authenticate owner session in production;
- verify all GP2 readiness classes are actually configured;
- install/connect GitHub App;
- select the intended repository through verified installation authority;
- exercise one real meaningful merged PR;
- exercise duplicate delivery;
- exercise one low-value/noise event;
- prove exact evidence snapshot/revision continuity;
- prove actual configured capture/storage path;
- prove automatic destination/media/review preparation after the next orchestration slice;
- prove exact owner judgment/recovery/reopen states.

Record only sanitized safe IDs/states in `docs/acceptance/GOLDEN_PATH_2_OWNER_ACCEPTANCE.md`.

## Current source/connector issue state

Keep open until live owner evidence satisfies them:

- #161 — GitHub App/webhook event ingestion;
- #163 — campaign-ready screenshots/derivatives;
- #167 — complete GP2 owner path.

## Social destination connectors

Existing LinkedIn/X/Reddit or other connector code paths must be advertised only according to actual configured/verified capabilities. A route existing in code is not proof that every environment has valid OAuth identity/scopes or that durable publication is complete.

GP3 will own exact durable publication semantics. Do not broaden destination connector work before GP2 acceptance unless a connector defect directly blocks current acceptance.

## Failure/response hygiene

- owner/auth failures: private/no-store;
- readiness: safe names/states only;
- public browser errors: bounded safe code/message;
- raw provider/private source errors must not leak sensitive payloads;
- external outcomes may be `unknown` when confirmation cannot be obtained.

## Next connector/readiness action

No new connector feature branch is the next move.

Next session:

1. preserve #259 exact head;
2. clear its exact-head Vercel preview gate without no-op commits;
3. merge/verify production;
4. build automatic post-strategy GP2 preparation;
5. then perform real production GitHub owner acceptance using this readiness model.
