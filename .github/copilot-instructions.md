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
