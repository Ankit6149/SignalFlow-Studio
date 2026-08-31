Read `docs/CURRENT_EXECUTION_STATE.md` first to understand the current implementation frontier and what must be built next. Then read `AGENTS.md` and the canonical product documents it references for architecture and product rules.

Preserve approval-first/review-first behavior, truthful capability and connector states, privacy boundaries, exact-revision semantics, and the current product design direction. Do not start later roadmap work or rebuild an older foundation while an active Golden Path still lacks owner acceptance.

For Studio UI work, use `rem` for dimensions and avoid tiny functional text. For every product slice, run the focused tests plus `cd frontend && npm test && npm run build`; normal repository CI remains the merge gate. Never claim a connector, hosted workflow, capture path, publication path, or other external capability is complete without the acceptance evidence required by its issue/domain contract.
