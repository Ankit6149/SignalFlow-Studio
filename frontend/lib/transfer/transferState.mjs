import { TRANSFER_STATUSES } from "./transferApplication.mjs";

export function createInitialTransferState() {
  return {
    status: "idle",
    archive: null,
    preview: null,
    report: null,
    error: "",
    destinationWorkspaceId: "local-browser",
    conflictPolicy: "skip",
    selectedFileName: "",
  };
}

export function transferReducer(state, action) {
  switch (action?.type) {
    case "RESET":
      return createInitialTransferState();
    case "SET_DESTINATION":
      return { ...state, destinationWorkspaceId: String(action.value || "") };
    case "SET_CONFLICT_POLICY":
      return { ...state, conflictPolicy: String(action.value || "skip") };
    case "PREPARING":
      return { ...state, status: TRANSFER_STATUSES.PREPARING, error: "", report: null };
    case "VALIDATING":
      return {
        ...state,
        status: TRANSFER_STATUSES.VALIDATING,
        archive: action.archive || state.archive,
        selectedFileName: action.fileName || state.selectedFileName,
        error: "",
      };
    case "PREVIEW_READY":
      return {
        ...state,
        status: action.preview?.status || "ready",
        preview: action.preview,
        archive: action.archive || state.archive,
        error: "",
      };
    case "IMPORTING":
      return { ...state, status: TRANSFER_STATUSES.IMPORTING, error: "" };
    case "REPORT":
      return {
        ...state,
        status: action.report?.status || TRANSFER_STATUSES.FAILED,
        report: action.report,
        error: "",
      };
    case "CANCELLED":
      return { ...state, status: TRANSFER_STATUSES.CANCELLED, error: "" };
    case "FAILED":
      return { ...state, status: TRANSFER_STATUSES.FAILED, error: String(action.error || "Transfer failed.") };
    default:
      return state;
  }
}

export function selectTransferView(state) {
  const status = state?.status || "idle";
  return {
    status,
    busy: [TRANSFER_STATUSES.PREPARING, TRANSFER_STATUSES.VALIDATING, TRANSFER_STATUSES.IMPORTING, TRANSFER_STATUSES.UPLOADING].includes(status),
    canChooseFile: ![TRANSFER_STATUSES.IMPORTING, TRANSFER_STATUSES.UPLOADING].includes(status),
    canImport: Boolean(
      state?.archive
        && state?.preview
        && ![TRANSFER_STATUSES.BLOCKED, TRANSFER_STATUSES.SELECTING_DESTINATION].includes(state.preview.status)
        && state.destinationWorkspaceId,
    ),
    canResume: [TRANSFER_STATUSES.PARTIALLY_IMPORTED, TRANSFER_STATUSES.CANCELLED].includes(state?.report?.status),
    canRollback: Boolean(
      state?.report?.journal?.length
        && ![TRANSFER_STATUSES.ROLLED_BACK, TRANSFER_STATUSES.BLOCKED].includes(state.report.status),
    ),
    hasWarnings: Boolean(state?.preview?.warnings?.length || state?.report?.warnings?.length),
    isComplete: status === TRANSFER_STATUSES.COMPLETE,
    isBlocked: status === TRANSFER_STATUSES.BLOCKED,
  };
}
