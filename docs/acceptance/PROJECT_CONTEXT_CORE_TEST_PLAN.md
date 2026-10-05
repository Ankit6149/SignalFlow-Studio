# Project Context Core — Exact Verification Plan

> **Historical verification plan:** this records the gates for the bounded ProjectContext progress slice. It is not the current repository test checklist; use `../CURRENT_EXECUTION_STATE.md`, current CI, and the owning issues for current requirements.

Before that slice was merged, the exact PR head was required to pass the normal repository gates.

## Required gates

1. Frontend regression suite passes on the exact head.
2. Production dependency audit reaches completion.
3. Next production build reaches completion.
4. MCP and Python jobs remain green.
5. PR diff remains scoped to ProjectContext/inference/domain/docs/tests.
6. Vercel preview is checked against the exact head when account deployment capacity allows it.

## Failure policy

- Do not weaken existing assertions merely because a new port/domain/task expands an established contract.
- Fix stale truth assertions when the product contract deliberately expanded.
- Fix actual product defects when composed tests expose them.
- A Vercel build-rate-limit is deployment infrastructure state, not code success and not code failure; it does not permit a false preview-ready claim.
- This progress slice does not close #222 or #167.