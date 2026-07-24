# Official Connector Readiness

SignalFlow Studio implements official connector paths for LinkedIn, X, and Reddit. Implementation, configuration, authorization, and production verification are separate states.

## Definition of Done

A connector is production-complete only after:

1. Developer application exists.
2. Production client ID and secret are configured server-side.
3. Canonical callback URL is registered exactly.
4. Required scopes/products are approved.
5. A real account completes OAuth.
6. A real approved test post receives platform confirmation.
7. Access-token expiry and refresh behavior are verified.
8. Missing permission, revoked token, invalid content, and rate-limit responses are verified.
9. The UI reports truthful failure and provides a manual fallback.

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

### Reddit

```text
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=
Callback: https://signal-flow-studio.vercel.app/api/social/callback/reddit
Scopes: identity submit read
Application type: web app
```

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
