import test from "node:test";
import assert from "node:assert/strict";

import {
  createInitialTransferState,
  selectTransferView,
  transferReducer,
} from "../lib/transfer/transferState.mjs";
import { TRANSFER_STATUSES } from "../lib/transfer/transferApplication.mjs";

test("transfer state covers preparation validation warnings import completion and reset", () => {
  let state = createInitialTransferState();
  assert.equal(state.status, "idle");
  state = transferReducer(state, { type: "PREPARING" });
  assert.equal(selectTransferView(state).busy, true);
  const archive = { archiveId: "archive-1" };
  state = transferReducer(state, { type: "VALIDATING", archive, fileName: "campaign.signalflow.json" });
  assert.equal(state.archive, archive);
  assert.equal(state.selectedFileName, "campaign.signalflow.json");
  state = transferReducer(state, {
    type: "PREVIEW_READY",
    archive,
    preview: { status: TRANSFER_STATUSES.WARNINGS_FOUND, warnings: [{ code: "excluded_private_data" }] },
  });
  assert.equal(selectTransferView(state).hasWarnings, true);
  assert.equal(selectTransferView(state).canImport, true);
  state = transferReducer(state, { type: "IMPORTING" });
  assert.equal(state.status, TRANSFER_STATUSES.IMPORTING);
  state = transferReducer(state, {
    type: "REPORT",
    report: { status: TRANSFER_STATUSES.COMPLETE, journal: [{ kind: "campaign" }] },
  });
  assert.equal(selectTransferView(state).isComplete, true);
  assert.equal(selectTransferView(state).canRollback, true);
  assert.deepEqual(transferReducer(state, { type: "RESET" }), createInitialTransferState());
});

test("blocked and destination-selection states cannot import", () => {
  for (const status of [TRANSFER_STATUSES.BLOCKED, TRANSFER_STATUSES.SELECTING_DESTINATION]) {
    const state = transferReducer(createInitialTransferState(), {
      type: "PREVIEW_READY",
      archive: { archiveId: "archive-1" },
      preview: { status },
    });
    assert.equal(selectTransferView(state).canImport, false);
    assert.equal(selectTransferView(state).isBlocked, status === TRANSFER_STATUSES.BLOCKED);
  }
});

test("partial and cancelled reports can resume while rolled-back reports cannot", () => {
  for (const status of [TRANSFER_STATUSES.PARTIALLY_IMPORTED, TRANSFER_STATUSES.CANCELLED]) {
    const state = transferReducer(createInitialTransferState(), {
      type: "REPORT",
      report: { status, journal: [{ kind: "campaign" }] },
    });
    assert.equal(selectTransferView(state).canResume, true);
    assert.equal(selectTransferView(state).canRollback, true);
  }
  const rolledBack = transferReducer(createInitialTransferState(), {
    type: "REPORT",
    report: { status: TRANSFER_STATUSES.ROLLED_BACK, journal: [{ kind: "campaign" }] },
  });
  assert.equal(selectTransferView(rolledBack).canResume, false);
  assert.equal(selectTransferView(rolledBack).canRollback, false);
});

test("failure state exposes an actionable error", () => {
  const state = transferReducer(createInitialTransferState(), { type: "FAILED", error: "Archive could not be parsed." });
  assert.equal(state.status, TRANSFER_STATUSES.FAILED);
  assert.equal(state.error, "Archive could not be parsed.");
});
