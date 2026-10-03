## Issue linkage

<!--
Use the repository issue that owns this change.
- `Closes #123` only when this PR fully completes that issue.
- `Part of #123` when the issue remains open after merge.
- For maintenance without an issue, explain why creating another tracker item would add noise.
-->

Part of #

## Outcome

<!-- Describe the concrete product/engineering outcome. Do not summarize only filenames. -->

## Scope boundary

<!-- State what this PR intentionally does NOT change. Keep unrelated feature families out. -->

## Current-truth impact

Check every applicable truth layer:

- [ ] No capability/runtime claim changes
- [ ] `docs/CAPABILITY_MATRIX.md` updated when capability truth changes
- [ ] `docs/CURRENT_EXECUTION_STATE.md` updated when execution/deployment/acceptance truth changes
- [ ] README/public/AI metadata updated when public product truth changes
- [ ] GitHub issue body updated when prior scope/status is now stale

<!-- Planned ≠ coded ≠ merged ≠ deployed ≠ accepted. Say which level this PR reaches. -->

## Validation

Record exact evidence, not “tested locally”.

- [ ] Relevant focused tests pass
- [ ] Normal repository CI passes
- [ ] Frontend production dependency audit passes when frontend dependencies change
- [ ] Production build passes when runtime/frontend behavior changes
- [ ] No Playwright dependency or Playwright-based capture path was introduced
- [ ] Security/privacy/source-provenance boundaries were rechecked where relevant

## Deployment / acceptance

<!-- A green PR or preview is not production acceptance. -->

- [ ] Deployment verification is not required for this change
- [ ] Or: exact deployed SHA / runtime evidence is recorded
- [ ] Owner/user acceptance evidence is recorded when the owning issue requires it
- [ ] External credential/provider/connector/capture verification remains explicitly open when not proven

## Remaining work / blockers

<!-- Write `None` only if the linked issue is genuinely complete after this PR. Otherwise state the exact remainder. -->
