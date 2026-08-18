# Repository Bootstrap and Persistent Project Context

> Status: first source-neutral core implemented on the #222 branch. This document does **not** claim that the production GitHub App install flow, automatic repository scan, or first-opportunity onboarding is complete.

## Product outcome

A new SignalFlow user should eventually be able to connect a supported repository once and reach useful judgment without configuring internal trigger mechanics:

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

## Implemented core in this slice

The current slice adds a versioned `ProjectContextSnapshot` contract with:

- workspace/project ownership;
- immutable version + `supersedesId` lineage;
- exact evidence-identity fingerprint;
- canonical repository reference containing provider/owner/repository/revision and optional SourceConnection ID;
- canonical SourceArtifact / supplemental SourceArtifact / Asset IDs rather than copied source payloads;
- privacy classification;
- structured synthesis for project name, purpose, problem, capabilities, audiences, terminology, maturity, architecture notes, constraints, safe claims and uncertainties;
- model/deterministic synthesis provenance;
- memory, browser and store-backed repository adapters;
- browser persistence/reopen support;
- application lookup of the latest project context for a later project-scoped Signal.

The fingerprint intentionally follows **exact evidence identity**, not generated summary wording. Retrying the same model task over the same exact repository revision/source refs therefore reuses the existing ProjectContextSnapshot instead of creating false history because model phrasing changed.

Meaningful evidence changes create a new immutable project-context version. Existing historical content remains free to retain the exact prior context reference it used.

## Provider-neutral synthesis boundary

Repository/project synthesis now uses the shared `InferenceTask` fabric via:

```text
project_context_synthesis
```

The task accepts only bounded evidence selected upstream. It does not accept an unrestricted repository payload.

Current hard limits:

- at most 24 evidence items per synthesis task;
- at most 60,000 aggregate evidence characters;
- only supported evidence categories such as README, product/architecture docs, manifests, changelog/release context, route/module inventories, representative source, and owner context;
- exact SourceArtifact IDs remain task refs;
- device-private/restricted evidence cannot silently use a remote inference route;
- secret/path-shaped fields fail closed before prompt construction.

The synthesis prompt explicitly forbids content ideas, destination choices, hooks, engagement tactics and publishing advice. Its job is only durable project understanding.

## What “AI goes through the repo” means

The product target is broad repository understanding without blindly shipping an entire private codebase to a remote model.

The repository planner may inspect repository structure broadly and select representative evidence. The model stage receives a bounded, provenance-backed evidence set. Later local/private intelligence routes may support richer local-only analysis through the same ProjectContextSnapshot contract.

High-signal evidence should prefer, where present and authorized:

- README/product documentation;
- manifests;
- architecture docs;
- route/module inventory;
- changelog/release context;
- selected representative source files;
- owner-provided canonical SourceArtifacts.

## Not-now semantics

Project context has no `approved`, `published`, `destination`, or `notNow` state.

Choosing `Not now` belongs to Opportunity/onboarding judgment. It therefore does not mutate ProjectContextSnapshot. A later project-scoped Signal can resolve the same latest eligible snapshot automatically.

This prevents a second onboarding state machine and preserves the rule that ProjectContext is evidence/history while ContentOpportunity owns editorial judgment.

## Destination boundary

Project context is source neutral and destination neutral.

It must not know whether a later piece becomes:

- LinkedIn text;
- Instagram carousel;
- Reel/Short;
- X/thread;
- blog/newsletter;
- YouTube;
- another supported destination/form;
- or no content at all.

Those decisions belong downstream to editorial fit, connected/preferred destinations, calendar/cadence, media requirements, NarrativeMemory and owner judgment.

## Still required before #222 closes

This slice does **not** yet claim:

- production GitHub App connect/install UX;
- automatic repo traversal/evidence-plan execution after install;
- durable hosted ProjectContext persistence;
- automatic first ContentSignal/ContentOpportunity creation from repository bootstrap;
- owner-facing onboarding screen for initial opportunities;
- destination preference/calendar onboarding;
- automatic refresh on later GitHub events;
- production acceptance with a real connected repository.

Those must converge with #161 and #167 rather than becoming a parallel onboarding product.

## Next integration

The next vertical integration is:

```text
active GitHub SourceConnection
→ automatic bounded repository evidence plan
→ project_context_synthesis
→ ProjectContextSnapshot
→ bootstrap ContentSignal(s) only when evidence warrants them
→ existing ContentOpportunity evaluation
→ Today / Plan judgment
```

After the owner defers or judges the initial suggestions:

```text
future verified GitHub event
→ ContentSignal
→ cheap noise gate
→ latest eligible ProjectContextSnapshot
→ NarrativeMemory/repetition
→ ContentOpportunity
→ owner judgment only when useful
```

Normal users should not have to configure routine trigger/event families manually. Advanced source controls remain optional overrides for pause/scope/privacy/revocation.