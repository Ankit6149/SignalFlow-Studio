# GitHub App connection runtime

This document records the implemented GitHub source-connection boundary and the deployment work still required before SignalFlow may call GitHub ingestion live/verified.

## Product outcome

Normal owner onboarding is intentionally low-attention:

```text
Connections
→ Connect GitHub
→ GitHub App installation
→ SignalFlow verifies that exact installation for the authorized GitHub user
→ choose an authorized repository
→ durable SourceConnection becomes active
→ supported repository events are observed automatically
```

The owner does not configure webhook event families or trigger rules during ordinary setup. The current default repository event families are merged pull requests and published releases. Editorial opportunity value remains downstream of source ingestion.

## Security boundary

The GitHub App setup callback and user authorization callback are separate on purpose.

```text
SignalFlow owner session
→ short-lived signed install state
→ GitHub App setup/install flow
→ setup callback receives installation_id
→ SignalFlow DOES NOT trust or persist that installation_id yet
→ short-lived signed authorization state binds workspace + pending connection + installation
→ GitHub App user OAuth authorization
→ ephemeral user access token
→ verify /user/installations/{installation_id}/repositories
→ fetch installation metadata as the GitHub App
→ persist safe SourceConnection metadata
```

GitHub documents that the setup callback `installation_id` alone is not proof that the current user owns or may access that installation. SignalFlow therefore verifies the exact installation through a GitHub App user access token before it becomes connection authority.

### Secrets and tokens

The following remain server-only and never belong in SourceConnection, ContentSignal, browser JSON, logs, or repository files:

- GitHub App private key;
- GitHub App client secret;
- webhook HMAC secret;
- install/authorization state secret;
- GitHub user access token;
- GitHub installation access token.

User and installation tokens are transient adapter concerns. The persisted SourceConnection keeps only safe provider/account/installation identifiers, permission/capability metadata, repository mappings, lifecycle state, timestamps, and safe error codes.

## Repository mapping

After authorization, repository discovery uses an ephemeral GitHub installation token. Selecting a repository creates/updates one canonical SourceConnection resource scope with:

- immutable GitHub repository ID as resource identity;
- human-readable repository name;
- stable SignalFlow project identity derived from the repository ID for Personal Alpha;
- supported default event families;
- enabled/paused/revoked lifecycle state.

Reselecting a repository is idempotent. Reconnecting the same GitHub installation reuses the existing canonical SourceConnection instead of creating two active installation mappings that could make webhook authorization ambiguous.

## Lifecycle semantics

- `pending`: App setup is incomplete or installation is verified but no repository has been selected yet.
- `active`: at least one selected repository may create supported signals.
- `paused`: historical state remains, but webhook ingestion ignores it because only active mappings authorize new signals.
- `revoked`: repository scopes are disabled; history/provenance remains; a future reconnect must pass the installation/authorization flow again.

Disconnecting a source does not rewrite historical ContentSignal, ProjectContext, revision, approval, or NarrativeMemory provenance.

## Current HTTP routes

Owner-session protected:

- `GET /api/sources/github/connect` — configuration + safe connection status.
- `POST /api/sources/github/connect` — create/reuse pending connection and begin GitHub App install.
- `GET /api/sources/github/callback` — GitHub App setup callback; converts untrusted installation ID into a signed user-authorization step.
- `GET /api/sources/github/oauth/callback` — completes GitHub user authorization and verifies the exact installation.
- `GET /api/sources/github/repositories` — list repositories visible to the verified installation.
- `POST /api/sources/github/repositories` — select/map repository and activate default observation.
- `GET/PATCH /api/sources/github/connections` — safe status and pause/resume/revoke lifecycle actions.

Provider-authenticated, not owner-session authenticated:

- `POST /api/sources/github/webhook` — validates GitHub webhook HMAC and enters the existing durable ContentSignal ingestion path.

## Required GitHub App configuration

Current Personal Alpha deployment expects:

- setup URL: `${NEXTAUTH_URL}/api/sources/github/callback`;
- OAuth callback: `${NEXTAUTH_URL}/api/sources/github/oauth/callback`;
- webhook URL: `${NEXTAUTH_URL}/api/sources/github/webhook`;
- user authorization during installation disabled, because SignalFlow deliberately performs its own authorization step after the setup callback;
- redirect on update disabled for this slice;
- repository permissions: Metadata read, Contents read, Pull requests read;
- webhook subscriptions: Pull request and Release.

Server environment names are documented in `frontend/.env.example`. Real values must be configured in the deployment secret store and must never be committed.

## Relationship to ProjectContext and Opportunities

Connection is not the end of onboarding. The next vertical is:

```text
active selected repository
→ bounded repository evidence planner
→ immutable SourceArtifact/provenance refs
→ hosted ProjectContext bootstrap/version reuse
→ canonical bootstrap Signal when warranted
→ existing Opportunity evaluation
→ Today / owner judgment
```

A later verified webhook event then reuses the latest eligible ProjectContext through the already-merged Signal → ProjectContext → Opportunity continuation.

## Current non-claims

This implementation does **not** claim any of the following yet:

- production GitHub App credentials are configured;
- a credential-backed installation has been completed against the production site;
- a live GitHub webhook has reached production through the new connection lifecycle;
- automatic repository evidence traversal/bootstrap is complete;
- initial Opportunities are generated immediately after repository selection;
- a durable background worker continues webhook signals into Opportunity evaluation;
- automatic screenshots/media for Golden Path 2 are complete;
- Cloudflare is required or configured;
- GitHub source connection implies any destination publishing capability.

Issues #161, #222 and #167 remain open until their actual end-to-end acceptance outcomes are demonstrated.
