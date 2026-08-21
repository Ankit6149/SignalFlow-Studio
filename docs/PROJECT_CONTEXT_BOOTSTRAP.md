# Repository Bootstrap and Persistent Project Context

> Status: the source-neutral ProjectContext core, hosted Neon persistence, secure GitHub App connection lifecycle, and automatic bounded repository-bootstrap code path are implemented. This document does **not** claim that production GitHub credentials/live installation acceptance, initial hosted Opportunities/Today, or durable background webhook continuation are complete.

## Product outcome

A new SignalFlow user should be able to connect a supported repository once and reach useful judgment without configuring internal trigger mechanics:

```text
connect repository
→ bounded repository evidence planning
→ persistent project understanding
→ worthwhile initial Signals / Opportunities
→ owner judgment: start / revise / later / not now
→ later source events reuse the same project understanding automatically
```

`Not now` is valid. It must not erase project understanding or force reconnection.

## Why ProjectContextSnapshot is separate

SignalFlow already has person-level Identity / Perception / Voice / Boundary state and project guidance. Repository understanding is different: it is evidence-backed state about **the project**, not a claim about the person.

Target composition is:

```text
Person Identity / Voice / Boundaries
+ exact ProjectContextSnapshot
+ exact ContentSignal evidence
+ NarrativeMemory
→ ContentOpportunity / NarrativeStrategy
```

A project-context refresh must never silently rewrite person identity or historical content provenance.

## Current implemented path

The current web path is:

```text
Connections
→ secure GitHub App install + owner authorization
→ choose authorized repository
→ SourceConnection ACTIVE
→ resolve exact default-branch commit/tree
→ deterministic bounded evidence plan
→ ephemeral exact-revision file reads
→ immutable SourceArtifact metadata/provenance
→ project_context_synthesis
→ hosted immutable ProjectContextSnapshot
```

Repository selection starts project understanding automatically. There is no normal-user “Analyze repository” setup step. A transient repository-read or inference failure does not revoke, pause, or downgrade a valid GitHub SourceConnection; project understanding is retryable independently.

The ProjectContext contract provides:

- workspace/project ownership;
- immutable version + `supersedesId` lineage;
- exact evidence-identity fingerprint;
- canonical repository reference containing provider/owner/repository/revision and optional SourceConnection ID;
- canonical SourceArtifact / supplemental SourceArtifact / Asset IDs rather than copied source payloads;
- privacy classification;
- structured synthesis for project name, purpose, problem, capabilities, audiences, terminology, maturity, architecture notes, constraints, safe claims and uncertainties;
- model/deterministic synthesis provenance;
- memory, browser, store-backed and hosted Postgres persistence;
- application lookup of the latest project context for a later project-scoped Signal.

The fingerprint follows **exact evidence identity**, not generated summary wording. Retrying the same model task over the same exact repository revision/source refs therefore reuses the existing ProjectContextSnapshot instead of creating false history because model phrasing changed.

Meaningful evidence changes create a new immutable project-context version. Existing historical content remains free to retain the exact prior context reference it used.

## Bounded GitHub evidence acquisition

SignalFlow does not send an unrestricted repository dump to project-context synthesis.

The GitHub repository adapter first resolves the exact current default-branch commit and tree. The deterministic planner then selects a bounded representative set with priority toward:

- README/product documentation;
- architecture/design documentation;
- manifests;
- changelog/release/roadmap context;
- route/module structure;
- selected representative entry/source files.

Current repository-bootstrap bounds are stricter than the model contract:

- at most 5,000 repository tree entries in this first hosted path;
- at most 12 selected repository files;
- at most 96 KB per selected file;
- at most 48,000 aggregate repository evidence characters plus bounded structure inventory;
- at most 9,000 excerpt characters per selected file;
- truncated GitHub recursive trees fail closed rather than pretending incomplete structure is complete.

Known dependency/build outputs, lockfiles, generated/minified content and secret/key-shaped filenames are excluded before file reads. Repository file bodies are ephemeral synthesis input. Hosted SourceArtifact persistence stores normalized metadata, source reference, content hash, evidence usability/privacy and provenance—not raw repository file bodies.

A ProjectContextSnapshot therefore retains exact inspectable SourceArtifact IDs without turning the relational database into a repository mirror.

## Provider-neutral synthesis boundary

Repository/project synthesis uses the shared `InferenceTask` fabric via:

```text
project_context_synthesis
```

The task accepts only bounded evidence selected upstream. It does not accept an unrestricted repository payload.

The shared synthesis contract still enforces:

- at most 24 evidence items per synthesis task;
- at most 60,000 aggregate evidence characters;
- supported evidence categories only;
- exact SourceArtifact IDs remain task refs;
- privacy route policy before model invocation;
- secret/path-shaped fields fail closed before prompt construction.

The synthesis prompt explicitly forbids content ideas, destination choices, hooks, engagement tactics and publishing advice. Its job is only durable project understanding.

## Exact-revision reuse

Before rereading selected file bodies or invoking synthesis, repository bootstrap resolves the current Git commit and checks the latest ProjectContextSnapshot.

If the latest eligible context already represents the same GitHub repository and exact immutable commit revision, SignalFlow reuses it and skips file-body reads and model synthesis.

If the repository revision changes, bounded evidence is acquired again and the normal evidence fingerprint determines whether a new immutable context version is required.

This makes reconnect/retry behavior inexpensive while preserving exact historical provenance.

## Not-now semantics

Project context has no `approved`, `published`, `destination`, or `notNow` state.

Choosing `Not now` belongs to Opportunity/onboarding judgment. It therefore does not mutate ProjectContextSnapshot. A later project-scoped Signal can resolve the same latest eligible snapshot automatically.

This prevents a second onboarding state machine and preserves the rule that ProjectContext is evidence/history while ContentOpportunity owns editorial judgment.

## Destination boundary

Project context is source neutral and destination neutral.

It must not know whether a later piece becomes LinkedIn text, an Instagram carousel, a Reel/Short, an X/thread, a blog/newsletter, YouTube, another supported destination/form, or no content at all.

Those decisions belong downstream to editorial fit, connected/preferred destinations, calendar/cadence, media requirements, NarrativeMemory and owner judgment.

## Current deployment truth / non-claims

The code path above is implemented, but the following claims are still intentionally withheld:

- production GitHub App credentials are not yet configured through the available deployment tooling;
- no real production GitHub App installation/repository has been acceptance-tested yet;
- the new hosted SourceArtifact schema migration must be staged/applied and verified before this slice can merge;
- automatic first hosted ContentSignal/ContentOpportunity creation from repository bootstrap is not included here;
- hosted ContentOpportunity/Today persistence is not implemented in this slice;
- durable background webhook → ProjectContext → Opportunity continuation is not implemented in this slice;
- automatic screenshot/media production is not included;
- #161, #222 and #167 remain open until their actual end-to-end definitions are satisfied.

## Next integration after this slice

Once repository bootstrap is merged and the evidence migration is live, the next dependency-correct vertical is:

```text
persisted ProjectContextSnapshot
→ canonical bootstrap/editorial Signal when evidence warrants
→ hosted ContentOpportunity persistence
→ Opportunity evaluation with exact ProjectContext
→ Today / Plan
→ Start here / Something else / Not now
```

Then the same hosted application path is reused for ongoing work:

```text
future verified GitHub event
→ durable ContentSignal
→ cheap noise/grouping gate
→ latest eligible ProjectContextSnapshot
→ NarrativeMemory/repetition
→ ContentOpportunity
→ Today
→ owner judgment only when useful
```

Normal users should not have to configure routine trigger/event families manually. Advanced source controls remain optional overrides for pause/scope/privacy/revocation.
