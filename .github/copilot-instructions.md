Read `docs/CURRENT_EXECUTION_STATE.md` first to understand the current implementation frontier and what must be built next. Then read `AGENTS.md` and the canonical product documents it references for architecture and product rules.

Preserve approval-first/review-first behavior, truthful capability and connector states, privacy boundaries, exact-revision semantics, and the current product design direction. Do not start later roadmap work or rebuild an older foundation while an active Golden Path still lacks owner acceptance.

For Studio UI work, use `rem` for dimensions and avoid tiny functional text. For every product slice, run the focused tests plus `cd frontend && npm test && npm run build`; normal repository CI remains the merge gate. Never claim a connector, hosted workflow, capture path, publication path, or other external capability is complete without the acceptance evidence required by its issue/domain contract.

## Base / Linear operating contract

Linear is the attention/status projection, not a mirror of GitHub. Do not create a Linear issue for every commit, PR, GitHub issue, or implementation slice.

When work is associated with a Base Linear issue, preserve its `ARC-###` identifier in the branch or PR context and use exactly one lifecycle statement in the PR body:

- `Fixes ARC-123` only when merging the PR fully achieves the Linear issue's intended outcome and no owner/release/acceptance action remains.
- `Part of ARC-123` when the PR is one implementation slice or when acceptance/review remains. This must not auto-close the Linear issue.
- `No Linear issue — <reason>` only for maintenance that genuinely does not require Base tracking.

Never use `Fixes ARC-...` merely because code was implemented or CI is green when the Linear outcome still requires owner acceptance, deployment verification, migration, runtime evidence, or another explicit gate. Prefer updating/consolidating existing Base outcomes rather than generating new tracking work.

## Base execution write-back

When an `ARC-###` issue is part of the execution and Linear MCP/access is available:

1. Read the Linear issue before implementation. Treat its stable outcome, constraints, acceptance criteria, latest execution report, relations, attachments, and current Golden Path/owner-acceptance boundary as authoritative execution context.
2. Preserve the executor chosen by the user. Do not silently delegate to a different agent or tool.
3. If the next action requires owner approval, production migration, public/external side effects, privacy/security changes, or another explicit issue approval boundary, stop after writing a concrete execution proposal until the scoped approval exists.
4. After meaningful work, write a dated execution report back to the same Linear issue containing: execution summary; what happened; what changed; findings; why; evidence; impact; verification; remaining gaps/uncertainty; next recommended execution; human decision required; executor.
5. Keep Linear state truthful. CI/deployment success does not close a GP/owner-acceptance issue while the required real event path or owner judgment is still unverified.
6. If Linear write access is unavailable, return the same structured report and explicitly mark `Linear write-back pending`; never claim the Base record is updated when it is not.

A meaningful execution must make the Linear issue easier to resume and audit than it was before the execution.