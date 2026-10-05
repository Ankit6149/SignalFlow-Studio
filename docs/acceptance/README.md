# SignalFlow Studio Acceptance Evidence

This directory contains bounded evidence records for specific product gates and implementation slices. These files are **evidence**, not a second execution roadmap.

For current merged/deployed/accepted truth, read [../CURRENT_EXECUTION_STATE.md](../CURRENT_EXECUTION_STATE.md). For current scheduling, read [../ISSUE_TRIAGE.md](../ISSUE_TRIAGE.md).

## Golden paths

| Artifact | Status | Scope |
| --- | --- | --- |
| [GOLDEN_PATH_1_OWNER_ACCEPTANCE.md](./GOLDEN_PATH_1_OWNER_ACCEPTANCE.md) | Accepted; #166 closed | Manual thought → opportunity → authentic LinkedIn/X exact-revision approval. Does not prove durable publication or connected-source automation. |
| [GOLDEN_PATH_2_OWNER_ACCEPTANCE.md](./GOLDEN_PATH_2_OWNER_ACCEPTANCE.md) | **Not yet accepted** | Evidence ledger for real GitHub work → worthwhile opportunity → bounded screenshot/media → exact LinkedIn/X review. Historical production checkpoints inside the ledger are preserved as evidence snapshots, not current runtime truth. |
| [GP2_RUNTIME_NEGATIVE_CONTROL_2026-09-14.md](./GP2_RUNTIME_NEGATIVE_CONTROL_2026-09-14.md) | Historical negative-control probe | Deliberately low-value GitHub event intended to prove that GP2 does not manufacture an opportunity from operational noise. |

## Supporting infrastructure / progress evidence

| Artifact | Status | Scope |
| --- | --- | --- |
| [CONNECTED_SOURCE_NEON_MIGRATION.md](./CONNECTED_SOURCE_NEON_MIGRATION.md) | Supporting acceptance evidence | Proves the bounded connected-source relational migration/schema state only. It does not prove a live GitHub source connection. |
| [PROJECT_CONTEXT_CORE_PROGRESS.md](./PROJECT_CONTEXT_CORE_PROGRESS.md) | Historical progress artifact | Proves a bounded ProjectContext implementation slice for #222/#167; not final owner acceptance. |
| [PROJECT_CONTEXT_CORE_TEST_PLAN.md](./PROJECT_CONTEXT_CORE_TEST_PLAN.md) | Historical verification plan | Records the gates used for that ProjectContext slice; it is not the current repository test checklist. |

## Evidence rules

- Never infer a broader capability from a narrower acceptance artifact.
- A historical production SHA/deployment in an evidence file remains a historical checkpoint unless the file explicitly says otherwise.
- Current production truth comes from live Vercel state plus `CURRENT_EXECUTION_STATE.md`, not from the newest-looking date in this folder.
- Planned ≠ coded ≠ merged ≠ deployed ≠ accepted.
- Do not paste secrets, credentials, private source payloads, cookies, signed URLs, or raw private repository content into acceptance artifacts.
- Prefer adding evidence to the owning Golden Path or issue artifact instead of creating a new status document.
