# Official Connector Readiness

SignalFlow Studio implements official connector paths for LinkedIn, X, and Reddit. Implementation, configuration, authorization, and production verification are separate states.

## Definition of Done

A connector is production-complete only after:

- Developer application exists and any required platform/API access approval is granted.
- Production client ID, secret, and platform-specific identification settings are configured server-side.
- Canonical callback URL is registered exactly.
- Required scopes/products are approved.
- A real account completes OAuth.
- A real approved test post receives platform confirmation.
- Access-token expiry and refresh behavior are verified.
- Missing permission, revoked token, invalid content, and rate-limit responses are verified.
- The UI reports truthful failure and provides a manual fallback.

## Canonical Environment

```text
NEXTAUTH_URL=https://signal-flow-studio.vercel.app
SIGNALFLOW_ACCESS_KEY=<private owner key>
SIGNALFLOW_PUBLIC_HOSTED=true
SOCIAL_ENCRYPTION_KEY=<independent long random value>
```

### LinkedIn

```text
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
LINKEDIN_API_VERSION=202607
Callback: https://signal-flow-studio.vercel.app/api/social/callback/linkedin
Scopes: openid profile w_member_social
Products: Sign In with LinkedIn using OpenID Connect; Share on LinkedIn
```

### X

```text
X_CLIENT_ID=
X_CLIENT_SECRET=
Callback: https://signal-flow-studio.vercel.app/api/social/callback/x
Scopes: tweet.read tweet.write users.read offline.access
Authentication: OAuth 2.0 Authorization Code with PKCE
```

The X API currently uses pay-per-use credits. The developer app must be approved, funded for write requests, and protected with a spending limit before a live test.

### Reddit

```text
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=
REDDIT_USER_AGENT=web:signalflow-studio:0.2.0 (by /u/<owner_username>)
Callback: https://signal-flow-studio.vercel.app/api/social/callback/reddit
Scopes: identity submit read
Application type: Data API web app
```

Creating an app record is not sufficient. Reddit currently requires explicit Data API approval under its Responsible Builder Policy, OAuth authentication, and an identifiable user agent. Direct publishing must remain unavailable until all three requirements are satisfied.

## Live Verification Protocol

Use a dedicated test account and clearly disposable test content.

### Authorization

- Connect from the owner-only Connections page.
- Confirm the returned profile belongs to the intended account.
- Verify the callback uses the canonical production origin.
- Confirm raw tokens never appear in browser JavaScript or logs.

### Publish

- Generate a short, non-sensitive draft.
- Review and explicitly approve it.
- Publish one post.
- Confirm SignalFlow only reports success after the platform response.
- Open the returned post URL and verify the content.
- Delete the test post from the platform when finished.

### Expiry and Refresh

- Test a session without a refresh token and verify reconnect guidance.
- Test an expired session with a refresh token and verify renewal.
- Revoke authorization at the platform and verify the next publish fails safely.
- Confirm refreshed token data is written back only to the encrypted HTTP-only cookie.

### Rejection and Rate Limit

Verify that the UI distinguishes:

- `401`: expired or revoked authorization
- `403`: missing product/scope/permission
- `404`: endpoint/resource mismatch
- `409`/`422`: content or platform validation rejection
- `429`: rate limited, including `Retry-After` when supplied
- `5xx`: platform temporary failure

Every failure should preserve the draft and offer copy/manual publication.

## Current Status

- Code path: implemented for LinkedIn, X, Reddit
- Credential configuration: deployment-dependent
- Approved callbacks/scopes: platform-dashboard dependent
- Live account authorization: requires owner action
- Real post verification: requires owner action
- Expiry/refresh verification: requires live connected sessions
- Rejection/rate-limit handling: normalized in code; external responses still require live verification

Never replace these distinctions with a single "connected" or "done" claim.

## Platform Documentation Check — July 24, 2026

- LinkedIn's current Marketing API version header is `202607`; the Posts API requires `Linkedin-Version`, `X-Restli-Protocol-Version: 2.0.0`, and `w_member_social` for member publishing.
- X supports `POST /2/tweets` with user OAuth, uses OAuth 2.0 PKCE scopes including `tweet.write`, and currently charges write operations through pay-per-use credits.
- Reddit requires OAuth and explicit Data API approval under the Responsible Builder Policy; clients must use an identifiable user agent and `submit` permission for post creation.

Re-check official documentation before every production credential rollout because platform access, pricing, scopes, and review requirements change independently of this repository.
