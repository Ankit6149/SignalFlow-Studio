# SignalFlow Studio — Hosted Privacy and Data Security Model

> **Synchronized:** 2 September 2026.
>
> This document describes the current privacy/security boundary for local/self-hosted and public-hosted operation. It intentionally avoids claiming that every future privacy mode is fully implemented.

## 1. Core principles

SignalFlow handles unpublished plans, source evidence, repository context, private screenshots/assets, AI credentials, connector credentials and identity preferences. The product therefore follows these rules:

- privacy/authorization fail closed;
- server secrets never become browser-visible configuration values;
- private source/media is minimized before remote inference when policy requires it;
- upload/capture does not imply permission to publish;
- original media stays immutable;
- owner approval binds exact text/media revisions;
- external publication is a separate reputational side effect;
- readiness/errors expose safe state, not raw secret values.

## 2. Operating/deployment modes

### Local / self-hosted development

A local/self-hosted instance may intentionally operate without an owner access key where the explicit local product design allows it.

Local browser persistence remains relevant to compatibility/manual GP1 paths, but the product also has hosted Postgres/private Asset-store paths for current GP2. Do not describe the entire application as localStorage-only.

Browser-entered BYOK credentials, when supported, remain client/session-scoped according to the specific provider flow. Do not advertise lightweight obfuscation as cryptographic protection.

### Hosted / Vercel operation

Vercel/public-hosted operation is treated as hosted even if an explicit `SIGNALFLOW_PUBLIC_HOSTED` flag is accidentally absent.

Hosted mode requires an owner access lock for owner-only capabilities.

If hosted owner configuration is missing:

- owner access fails closed;
- owner-only routes return a safe unavailable state such as `owner_access_unconfigured` rather than treating the visitor as owner;
- owner auth responses are `private, no-store`;
- no secret value is returned to explain the missing configuration.

### Anonymous/public visitor behavior

A public visitor is not the owner merely because the main site is reachable.

Anonymous/BYOK-capable routes must not inherit:

- owner server-managed model credentials;
- owner GitHub source authority;
- owner social connector identity/tokens;
- private hosted Asset access;
- owner-only planning/review state.

Capabilities must remain role/session aware.

## 3. Canonical owner access policy

Merged PR #256 established a shared hosted owner-access boundary.

Important rules:

- explicit hosted mode and Vercel both require owner lock;
- configured owner key comparison uses length checking + constant-time comparison;
- session-token validation remains server-side;
- missing owner lock in hosted mode is configuration failure, not authentication success;
- local/self-hosted no-key behavior may remain intentionally unlocked;
- owner auth failures are private/non-cacheable.

Do not reintroduce route-local “if no key, allow” behavior.

## 4. Owner-only routes

Current owner-only GP2 surfaces include source/readiness/review/media functions such as:

- `/api/gp2/readiness`;
- GitHub source-management actions;
- hosted platform review/generation/change/judgment actions;
- protected private exact AssetVersion preview.

Every owner-only route must use the shared owner access policy rather than inventing another lock check.

## 5. Secret handling

Never return raw secrets from backend routes.

Examples of server-only values that must never be exposed as browser data/log evidence:

- `SIGNALFLOW_ACCESS_KEY`;
- GitHub App/private key/secret/OAuth credentials;
- GitHub webhook signing secret;
- server-managed model API keys;
- social connector OAuth tokens;
- private S3-compatible storage credentials;
- private object keys when not explicitly safe identifiers;
- CDP/browser worker credentials/endpoints where secret-bearing;
- exact-media visibility-receipt signing secret;
- session signing secrets.

Readiness/status responses may expose safe configuration **names/status classes**, never values.

## 6. GitHub private-source data minimization

Exact provenance and privacy coexist.

For GP2 private repository work:

- preserve exact immutable source revision in canonical state;
- refresh/reuse bounded evidence at that exact revision;
- keep exact ProjectContextSnapshot/SourceArtifact identity in records/fingerprints/task provenance where needed;
- construct model input through canonical minimized ProjectContext;
- omit repository owner/name when it is not semantically necessary;
- omit opaque SourceArtifact IDs when they do not help the reasoning task;
- include only safe claims/architecture/constraints/uncertainties permitted by processing policy;
- never send credentials/secrets as normal evidence.

Missing/mismatched exact evidence fails closed before opportunity inference.

## 7. Source/webhook privacy

Before trusting a provider event:

1. verify webhook signature;
2. associate with authorized SourceConnection/resource scope;
3. normalize only supported bounded event metadata;
4. preserve exact source revision when supported;
5. deduplicate by stable external delivery/event identity.

Do not record raw private webhook payloads in acceptance evidence.

A real acceptance ledger should use safe delivery reference, signal ID and exact Git SHA where appropriate.

## 8. Private Asset storage

Current GP2 includes private immutable S3-compatible Asset byte storage.

Privacy rules:

- workspace authorization before exact read/preview/delete;
- content-addressed immutable identity/idempotent reuse;
- server-side storage composition;
- no permanent public URL as canonical private Asset identity;
- no browser exposure of storage credential/object-key internals;
- device-private/restricted data fails closed when hosted storage is not allowed by policy.

## 9. Protected exact-media preview

Private media-bound approval uses a proof-of-visibility boundary.

Flow:

```text
owner requests exact assetId + assetVersionId
→ server authorizes workspace/exact AssetVersion
→ server streams exact private image bytes
→ response carries exact safe identity headers
→ server issues short-lived signed visibility receipt
→ browser confirms the exact media was resolved/visible
→ approval returns role + exact Asset + exact AssetVersion + receipt
→ server verifies receipt against workspace/exact identity
```

Expired/tampered/cross-workspace/stale receipt fails closed.

The browser never receives the receipt signing secret.

## 10. Required-media approval privacy/truth

PR #259 (unmerged at this checkpoint) adds defense in depth for strategy-required non-text media:

- preparation defers final exact review;
- Today suppresses incomplete final judgment;
- hosted approval independently rejects `required_media_pending`.

This prevents stale/API/UI paths from approving text while the strategy says exact visual proof is required.

#259 exact head `6df646f76151e6544dbd506eb7e41909b83cb8cd` has green CI #877 but awaits exact-head Vercel preview/merge.

## 11. Capture privacy

Bounded capture must enforce:

- allowed target/origin constraints in domain/recipe planning;
- same-origin/target enforcement again in worker execution;
- privacy selector/state check immediately before screenshot capture when required;
- no credential-bearing URL provenance;
- sanitized final URL (query/fragment removed where appropriate);
- safe fixture filling only through explicit bounded selectors/actions;
- canonical private immutable output with provenance;
- fail-closed privacy result before derivative/binding.

A successful browser navigation does not imply capture is safe to publish.

## 12. Inference processing privacy

Target inference architecture remains policy/capability aware.

Current GP2 already applies important minimization rules, but do not overclaim complete Local Only/Private Hybrid support across all tasks.

Permanent rule:

- provider fallback cannot silently lower privacy;
- `LOCAL_ONLY`/restricted processing fails closed if only disallowed remote route exists;
- protected raw evidence should be minimized/structured before remote reasoning where policy permits;
- model provider choice is an adapter concern, not permission to ignore classification.

## 13. Browser storage truth

Do not claim every browser-stored credential is cryptographically secure merely because it is encoded/obfuscated.

Where BYOK/browser settings are used:

- present the actual storage/security model truthfully;
- prefer transient/session handling where possible;
- do not return server-managed credentials to browser settings;
- treat XSS/browser compromise as a real security boundary rather than claiming obfuscation defeats it.

## 14. Social connector security

Use official OAuth/API flows where supported.

Do not:

- scrape consumer web sessions;
- ask for platform passwords;
- reuse unsupported consumer AI/social session cookies;
- treat a consumer subscription as generic API authorization.

Publication remains explicit/exact and later GP3 durable-publication rules apply.

## 15. Logging/error hygiene

Logs/errors should prefer:

- safe request/correlation IDs;
- bounded state/error codes;
- provider/service class where safe;
- redacted identifiers.

Avoid:

- authorization headers;
- cookies/session tokens;
- webhook signatures/secrets;
- raw OAuth code/token;
- raw private source bodies;
- signed private object URLs;
- private storage/CDP credentials.

External errors may contain private upstream payloads; do not blindly forward them to browser/acceptance docs.

## 16. Acceptance truth

Current production master is `ea71fa39836dfadddd70f0fe5a135c2f4d8ce9e0` and production is READY on that SHA.

GP2 is still **NOT YET ACCEPTED** because live credential-backed source/capture/judgment proof is incomplete and post-strategy normal preparation still needs automation.

Security/privacy acceptance is recorded only through sanitized evidence in `acceptance/GOLDEN_PATH_2_OWNER_ACCEPTANCE.md`.

## 17. Self-hosting guidance

For a hosted private/self-hosted deployment:

- configure a strong owner access secret where hosted owner locking is desired/required;
- configure provider/connector/storage/webhook/capture secrets only in server-side secret storage/environment;
- configure official OAuth redirect URLs for enabled connectors;
- keep private object storage private;
- protect backups/database credentials;
- verify readiness through safe owner-only status rather than exposing values;
- rotate/revoke credentials if leakage is suspected;
- treat log aggregation/observability as part of the privacy perimeter.

Do not copy production secrets into repository files, screenshots, acceptance ledgers or chat.
