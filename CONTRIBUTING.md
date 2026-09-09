# Contributing

Thanks for considering contributing to SignalFlow.

- Open issues for bugs, feature requests, and product ideas.
- Fork the repo and create focused topic branches.
- Keep changes small and add tests for new behavior.
- Run `python -m pip install -r requirements.txt` and `python -m pytest -q` before submitting PRs.
- For frontend changes, run `cd frontend && npm run build`.
- Follow the security guidelines in `SECURITY.md`: do not add functionality that harvests secrets or bypasses platform protections.
- Prefer local-first features that keep source code and generated assets on the user's machine.

## Base / Linear linkage

When a pull request corresponds to a Base Linear issue, include exactly one lifecycle statement in the PR body:

- `Fixes ARC-123` only when the PR fully completes that Linear outcome and no owner/release/acceptance action remains.
- `Part of ARC-123` when the PR contributes to a larger outcome or when acceptance/review remains.
- `No Linear issue — <reason>` only for maintenance that genuinely does not need Base tracking.

Do not use `Fixes ARC-...` merely because code or CI is complete when the product outcome still requires owner acceptance, deployment/runtime verification, migration, or another explicit gate.
