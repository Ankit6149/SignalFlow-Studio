# SignalFlow Studio — Historical Implementation Ledger Pointer

> **Retired from active execution use on 2026-10-05.**
>
> This path previously accumulated implementation checkpoints, PR numbers, CI runs, and phase-by-phase status. It is intentionally no longer a current execution authority because that format drifted behind the live repository and duplicated GitHub history.

Use the following sources instead:

1. `docs/CURRENT_EXECUTION_STATE.md` — current merged, deployed, accepted, blocked, and next-state truth.
2. `docs/ISSUE_TRIAGE.md` — current execution classification and practical working frontier.
3. `docs/CAPABILITY_MATRIX.md` — implemented-versus-target capability truth.
4. GitHub issues, pull requests, commits, Actions, and acceptance artifacts — exact historical implementation evidence.

The former ledger remains available in Git history for forensic reference. Do not copy an old "current engineering slice", branch, SHA, CI run, or phase status from historical versions into new work without re-verifying live state.

Truth precedence:

```text
live runtime
→ deployed production SHA
→ master
→ current acceptance evidence
→ CURRENT_EXECUTION_STATE / CAPABILITY_MATRIX
→ ISSUE_TRIAGE / roadmap
→ historical Git snapshots
```

Planned ≠ coded ≠ merged ≠ deployed ≠ accepted.
