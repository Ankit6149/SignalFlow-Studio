# Connected-source Neon migration acceptance record

> Status: the first connected-source relational migration has been applied to the dedicated SignalFlow Neon database. This record proves database-schema readiness only; it does not claim a configured production GitHub connection or live webhook acceptance.

## Applied scope

The committed migration for the connected-source slice is now present on the dedicated SignalFlow Neon main branch and provides the canonical relational persistence needed by the current webhook boundary for:

- source connections;
- source-connection resource/project mappings;
- canonical ContentSignals;
- external-event/idempotency uniqueness;
- workspace-scoped ownership relationships and lookup indexes.

The live database was verified after migration and contains the expected SignalFlow tables:

```text
sf_source_connections
sf_source_connection_resources
sf_content_signals
```

No database credential, connection string, webhook secret, provider token, or raw private source payload is recorded in this acceptance artifact.

## What this unlocks

The #221 server boundary can now target a real dedicated SignalFlow relational schema rather than an unapplied migration fixture.

Target continuation remains:

```text
verified GitHub delivery
→ trusted SourceConnection/resource mapping
→ canonical ContentSignal
→ durable relational persistence
→ cheap noise decision
→ later ProjectContext / Opportunity continuation
```

## Explicit non-claims

This migration does **not** prove or claim:

- production `DATABASE_URL` configuration on the current deployment runtime;
- production `GITHUB_WEBHOOK_SECRET` configuration;
- GitHub App installation/OAuth lifecycle;
- repository selection/mapping UX;
- a live authorized webhook delivery into the production database;
- disconnect/revocation acceptance;
- background ContentOpportunity continuation;
- ProjectContext cloud persistence;
- Cloudflare Workers, Queues, R2 or Hyperdrive integration;
- completion of #161, #167 or #71.

Those remain separate acceptance gates.

## Merge gate for #221

The code slice still requires exact-head CI and an exact-head deployable preview before merge. A hosting/provider rate limit must not be represented as application success, and an older successful preview must not be substituted for the current head.
