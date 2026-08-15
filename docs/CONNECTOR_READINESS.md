# SignalFlow Studio — Official Destination Connector Readiness

> **Status:** production-verification contract. This document does not guarantee current external API scopes/pricing/review requirements; re-check each platform's official documentation during implementation/credential rollout.

SignalFlow's current repository contains official connector code paths for LinkedIn, X, and Reddit. **Code present, configured, authorized, capability-verified, and production-verified are different states.**

The target product will add other destination adapters only through the same capability/approval/publication contracts.

## 1. Connector product model

Do not represent a destination with a single `connected` boolean.

A connection should eventually expose a verified capability snapshot such as:

```text
connectionId
provider
workspaceId
target identity/account/page/channel/community
granted scopes/products
status
verifiedAt
expiresAt?
canPublishText
canPublishImage
canPublishVideo
canPublishCarousel
canReadOwnPosts
canReadAnalytics
providerNativeScheduleCapability?
safe unavailable/failure reason
secret reference
```

Different platforms legitimately expose different capabilities.

## 2. Connection state vocabulary

Use explicit states rather than “done”:

```text
not_configured
configured
authorization_required
authorized_unverified
verified
insufficient_scope
expired
revoked
provider_unavailable
manual_only
implementation_unverified
```

A provider can be configured server-side but unavailable to the current session or target.

## 3. Definition of production-ready direct publishing

A connector/content-type capability is production-complete only after all relevant conditions pass:

- official developer application/project exists;
- required platform review/API/product access is granted;
- production client ID/secret/settings are configured server-side;
- canonical callback URL is registered;
- required scopes/products are approved;
- a real intended test account completes OAuth/authorization;
- SignalFlow identifies the exact account/page/channel/community target;
- the capability snapshot reflects real granted permissions;
- a real **approved exact draft/media revision** publishes successfully;
- the external API confirms publication and returns a stable reference where available;
- token expiry/refresh/reconnect behavior is verified;
- revoked/insufficient permission is verified;
- invalid content/media is verified;
- rate-limit/transient provider behavior is verified;
- duplicate request/job delivery cannot create duplicate external posts;
- unknown provider outcomes are preserved/reconciled rather than guessed;
- logs/evidence contain no tokens/private campaign content;
- manual export/copy fallback remains available where appropriate.

Verification may need to be repeated per content type. A connector verified for text does not automatically prove image/video publishing.

## 4. Exact-revision publication contract

Direct publishing must consume an immutable `PublicationRequest` (target architecture under #103/#168) that references:

- campaign/content piece;
- destination PlatformVariant;
- exact approved `DraftRevision`;
- exact required media Asset/MediaComposition revisions;
- exact target connection identity;
- approval snapshot;
- source-freshness/quality state;
- immediate/scheduled time semantics;
- idempotency key.

No connector may fetch “whatever text is currently in the editor” at worker execution time if that differs from the approved publication request.

## 5. Durable scheduling

Editorial planning (#160) decides what/when should be communicated.

Publication jobs (#103) execute the approved intent.

Rules:

- do not use browser timers;
- scheduled jobs survive browser closure/deploy/worker restart;
- connection/permission/source/approval policy is revalidated before the side effect;
- cancel/reschedule is explicit;
- edited content after scheduling does not silently replace the frozen revision;
- duplicate delivery remains idempotent.

## 6. Publication result states

Normalized states must include at least:

```text
scheduled
queued
publishing
published
failed
rejected
unknown
cancelled
superseded
```

### `published`

Only after provider confirmation.

### `failed`

Known no-success outcome with actionable safe reason.

### `rejected`

Platform refused the request/content/permission.

### `unknown`

SignalFlow cannot prove whether the platform accepted the request, for example after a network timeout following request transmission.

Do not convert `unknown` to failed and retry blindly; that can create duplicates.

## 7. Manual handoff

Manual handoff remains a first-class path when:

- a destination has no official supported connector;
- the app lacks approved API access;
- the account/type does not support the required operation;
- credentials/scopes are unavailable;
- the user explicitly prefers manual publication.

Manual workflow may provide:

- exact approved text;
- exact approved media download/copy;
- validation/checklist;
- open destination action.

It must not be recorded as confirmed direct publication unless the user explicitly marks it or later verified evidence exists.

## 8. Current canonical environment variables

Current repository connector code may use environment values such as:

```text
NEXTAUTH_URL=https://signal-flow-studio.vercel.app
SIGNALFLOW_ACCESS_KEY=<private owner key>
SIGNALFLOW_PUBLIC_HOSTED=true
SOCIAL_ENCRYPTION_KEY=<independent long random value>
```

Provider-specific client IDs/secrets remain server-side and must never be committed.

Exact provider environment names should be verified against current code before deployment.

## 9. Current LinkedIn code path

Current repository configuration uses LinkedIn OAuth/publishing code paths.

Before live rollout verify through current official LinkedIn documentation/dashboard:

- application/product access;
- callback URL;
- member/page authorization model as implemented;
- required publishing scopes/products;
- current API version/header requirements;
- text/image/video/document flow used by the adapter;
- organization/page versus member target identity;
- token lifetime/refresh behavior;
- API rate/permission errors.

Do not preserve a hard-coded documentation claim about an API version indefinitely; platform versions change independently of this repository.

## 10. Current X code path

Current repository configuration uses X OAuth/user publishing code paths.

Before live rollout verify through current official X developer documentation/dashboard:

- app approval/access tier;
- current pricing/credit model;
- user authorization method/scopes;
- callback URL;
- text-post endpoint behavior;
- media upload workflow for any claimed media capability;
- token refresh/expiry;
- rate/usage limits;
- duplicate/unknown outcome behavior.

Do not assume text verification proves image/video support.

## 11. Current Reddit code path

Current repository configuration contains Reddit OAuth/submission paths.

Before any commercial/public SaaS rollout, re-check current Reddit developer/data-API terms, approval requirements, user-agent expectations, scopes and commercial-use restrictions.

Direct Reddit publishing remains unavailable unless the actual account/application usage is permitted and credential-backed verification passes.

If API/commercial permission is uncertain, keep Reddit as a review/manual-handoff destination rather than bypassing platform policy.

## 12. Future destination adapters

Potential future destinations include other current generation targets such as Instagram, Threads, YouTube and TikTok, plus owned-channel integrations.

Each future adapter must start by defining:

- supported account type(s);
- exact target identity model;
- official API access/review requirements;
- text/image/video/carousel capabilities;
- upload/finalization state machine;
- external rate/size/duration/format constraints;
- token refresh/expiry/revoke;
- idempotency/reconciliation possibilities;
- analytics-read capabilities if later added;
- manual fallback.

Do not create a universal `publish()` UI assumption before these differences are represented.

## 13. Live verification protocol

Use controlled test accounts and clearly disposable, non-sensitive content.

### Authorization

- connect through owner/authorized Connections flow;
- confirm exact returned identity;
- verify callback uses canonical production origin;
- verify raw tokens never appear in page JavaScript/logs;
- inspect granted scopes/capabilities;
- verify reconnect/revoke.

### Text publish

- create a short safe draft;
- approve exact revision;
- create one publication request with stable idempotency key;
- execute via durable job where implemented;
- confirm SignalFlow reports success only after provider confirmation;
- verify returned external reference/content;
- remove disposable test content afterward where appropriate.

### Media publish

Repeat separately for every advertised media type:

- exact source/rendered asset revision;
- provider upload/finalization;
- processing status;
- aspect-ratio/size/duration constraints;
- timeout after upload but before final confirmation;
- duplicate job delivery.

### Expiry/revocation

- expired access token;
- refresh available/unavailable;
- authorization revoked at provider;
- scope/product removed;
- account/page/community access removed.

### Rejection/rate/unknown

Test normalized handling for:

- authorization failure;
- insufficient permission;
- resource/target mismatch;
- validation/content rejection;
- rate limiting/retry guidance;
- provider temporary failure;
- timeout where outcome may be unknown.

Every failure preserves the draft/media and approval history.

## 14. Current status statement

Today the truthful high-level status is:

- LinkedIn/X/Reddit connector code paths exist in the repository;
- deployment configuration is environment-dependent;
- current-session capability is server/capability dependent;
- real account authorization requires actual credentials/user action;
- direct publication must not be called production-verified without current credential-backed evidence;
- other generation destinations remain manual-hand-off until their own verified adapters exist;
- durable scheduled publication remains an open implementation area (#103/#168).

## 15. Connections UI requirements

A destination card/detail should eventually show:

- provider name;
- exact connected target identity;
- status;
- granted scopes/products;
- text/image/video/etc. capabilities;
- expiry/last verified;
- test/reconnect/revoke;
- manual-only/unverified explanation;
- queued/scheduled publication impact when revoking.

Never hide a critical permission limitation behind a green “Connected” badge.

## 16. Connector completion principle

> **The code path is only the beginning. SignalFlow may claim a destination capability only when a real account, real authorization, exact approved revision, external confirmation, retry/idempotency, expiry/revoke, and error behavior have been proven.**
