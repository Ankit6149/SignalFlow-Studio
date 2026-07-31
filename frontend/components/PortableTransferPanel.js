"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { createBrowserTransferApplication } from "../lib/application/browserTransferApplication.mjs";
import {
  DEFAULT_MAX_ARCHIVE_BYTES,
  PORTABLE_ARCHIVE_SCHEMA_VERSION,
} from "../lib/transfer/portableArchive.mjs";
import {
  TRANSFER_CONFLICT_POLICIES,
  TRANSFER_STATUSES,
} from "../lib/transfer/transferApplication.mjs";
import {
  createInitialTransferState,
  selectTransferView,
  transferReducer,
} from "../lib/transfer/transferState.mjs";

const LIBRARY_KEY = "signalflow_recovery_library";
const LOCAL_WORKSPACE_ID = "local-browser";

const STATUS_LABELS = Object.freeze({
  idle: "Ready",
  ready: "Ready to import",
  [TRANSFER_STATUSES.PREPARING]: "Preparing",
  [TRANSFER_STATUSES.VALIDATING]: "Validating",
  [TRANSFER_STATUSES.WARNINGS_FOUND]: "Review warnings",
  [TRANSFER_STATUSES.BLOCKED]: "Blocked",
  [TRANSFER_STATUSES.SELECTING_DESTINATION]: "Choose destination",
  [TRANSFER_STATUSES.UPLOADING]: "Uploading",
  [TRANSFER_STATUSES.IMPORTING]: "Importing",
  [TRANSFER_STATUSES.PARTIALLY_IMPORTED]: "Partially imported",
  [TRANSFER_STATUSES.COMPLETE]: "Complete",
  [TRANSFER_STATUSES.CANCELLED]: "Cancelled",
  [TRANSFER_STATUSES.FAILED]: "Failed",
  [TRANSFER_STATUSES.ROLLED_BACK]: "Rolled back",
});

function formatBytes(value) {
  const bytes = Number(value) || 0;
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let size = bytes / 1024;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size >= 10 ? size.toFixed(0) : size.toFixed(1)} ${units[index]}`;
}

function formatDate(value) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function archiveFilename(archive) {
  const date = String(archive?.createdAt || new Date().toISOString()).slice(0, 10);
  return `signalflow-transfer-${date}.signalflow.json`;
}

function downloadArchive(archive) {
  const blob = new Blob([JSON.stringify(archive, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = archiveFilename(archive);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function issueMessage(issue) {
  if (!issue) return "Transfer issue";
  if (typeof issue === "string") return issue;
  return issue.message || issue.code || "Transfer issue";
}

function reportCanRollback(report) {
  return Boolean(
    report?.journal?.length
      && ![TRANSFER_STATUSES.ROLLED_BACK, TRANSFER_STATUSES.BLOCKED].includes(report.status),
  );
}

function reportCanResume(report) {
  return [TRANSFER_STATUSES.PARTIALLY_IMPORTED, TRANSFER_STATUSES.CANCELLED].includes(report?.status);
}

export default function PortableTransferPanel({ campaigns = [], onLibraryChanged }) {
  const transferApplication = useMemo(() => createBrowserTransferApplication({
    getStorage: () => window.localStorage,
    campaignKey: LIBRARY_KEY,
  }), []);
  const [state, dispatch] = useReducer(
    transferReducer,
    undefined,
    createInitialTransferState,
  );
  const [selectedCampaignIds, setSelectedCampaignIds] = useState([]);
  const [includeTransferMetadata, setIncludeTransferMetadata] = useState(true);
  const [preparedArchive, setPreparedArchive] = useState(null);
  const [reports, setReports] = useState([]);
  const [notice, setNotice] = useState(null);
  const [confirmRollbackId, setConfirmRollbackId] = useState("");
  const fileInputRef = useRef(null);
  const abortControllerRef = useRef(null);
  const view = selectTransferView(state);

  useEffect(() => {
    const available = new Set(campaigns.map((campaign) => campaign.campaignId));
    setSelectedCampaignIds((current) => current.filter((campaignId) => available.has(campaignId)));
  }, [campaigns]);

  useEffect(() => {
    void refreshReports();
  }, []);

  async function refreshReports() {
    try {
      setReports(await transferApplication.listReports());
    } catch {
      setReports([]);
    }
  }

  async function notifyLibraryChanged() {
    if (typeof onLibraryChanged === "function") await onLibraryChanged();
  }

  function toggleCampaign(campaignId) {
    setSelectedCampaignIds((current) => current.includes(campaignId)
      ? current.filter((id) => id !== campaignId)
      : [...current, campaignId]);
    setPreparedArchive(null);
  }

  function selectAllCampaigns() {
    setSelectedCampaignIds(campaigns.map((campaign) => campaign.campaignId));
    setPreparedArchive(null);
  }

  function clearCampaignSelection() {
    setSelectedCampaignIds([]);
    setPreparedArchive(null);
  }

  async function prepareExport() {
    if (!selectedCampaignIds.length) return;
    setNotice(null);
    setPreparedArchive(null);
    try {
      const archive = await transferApplication.exportSelection({
        campaignIds: selectedCampaignIds,
        assetIds: includeTransferMetadata ? [] : ["__signalflow-no-asset-selection__"],
        sourceArtifactIds: includeTransferMetadata ? [] : ["__signalflow-no-artifact-selection__"],
        approvalIds: includeTransferMetadata ? [] : ["__signalflow-no-approval-selection__"],
        exportIds: includeTransferMetadata ? [] : ["__signalflow-no-export-selection__"],
        sourceDeployment: {
          profile: "browser-local",
          product: "SignalFlow Studio",
          archiveSchemaVersion: PORTABLE_ARCHIVE_SCHEMA_VERSION,
        },
      });
      setPreparedArchive(archive);
      setNotice({
        type: "success",
        text: "Archive prepared. Review the manifest and exclusions before downloading it.",
      });
    } catch (error) {
      setNotice({ type: "error", text: error.message || "SignalFlow could not prepare the archive." });
    }
  }

  function handleDownloadPreparedArchive() {
    if (!preparedArchive) return;
    downloadArchive(preparedArchive);
    setNotice({
      type: "success",
      text: "Portable archive downloaded. Its SHA-256 integrity will be verified during import.",
    });
  }

  async function createPreview(archive, {
    destinationWorkspaceId = state.destinationWorkspaceId,
    conflictPolicy = state.conflictPolicy,
    fileName = state.selectedFileName,
  } = {}) {
    dispatch({ type: "VALIDATING", archive, fileName });
    const preview = await transferApplication.previewImport(archive, {
      destinationWorkspaceId,
      conflictPolicy,
      maxBytes: DEFAULT_MAX_ARCHIVE_BYTES,
    });
    dispatch({ type: "PREVIEW_READY", archive, preview });
    return preview;
  }

  async function handleArchiveFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setNotice(null);
    dispatch({ type: "PREPARING" });
    try {
      if (file.size > DEFAULT_MAX_ARCHIVE_BYTES) {
        throw new Error(`This archive is ${formatBytes(file.size)}. The browser import limit is ${formatBytes(DEFAULT_MAX_ARCHIVE_BYTES)}.`);
      }
      const raw = await file.text();
      let archive;
      try {
        archive = JSON.parse(raw);
      } catch {
        throw new Error("This file is not valid JSON and cannot be a SignalFlow portable archive.");
      }
      await createPreview(archive, { fileName: file.name });
    } catch (error) {
      dispatch({ type: "FAILED", error: error.message });
    } finally {
      event.target.value = "";
    }
  }

  async function changeDestination(value) {
    dispatch({ type: "SET_DESTINATION", value });
    if (!state.archive) return;
    try {
      await createPreview(state.archive, {
        destinationWorkspaceId: value,
        conflictPolicy: state.conflictPolicy,
      });
    } catch (error) {
      dispatch({ type: "FAILED", error: error.message });
    }
  }

  async function changeConflictPolicy(value) {
    dispatch({ type: "SET_CONFLICT_POLICY", value });
    if (!state.archive) return;
    try {
      await createPreview(state.archive, {
        destinationWorkspaceId: state.destinationWorkspaceId,
        conflictPolicy: value,
      });
    } catch (error) {
      dispatch({ type: "FAILED", error: error.message });
    }
  }

  async function runImport({ resumeReportId = null } = {}) {
    if (!state.archive) return;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    dispatch({ type: "IMPORTING" });
    setNotice(null);
    try {
      const options = {
        destinationWorkspaceId: state.destinationWorkspaceId,
        conflictPolicy: state.conflictPolicy,
        atomic: resumeReportId ? false : true,
        signal: controller.signal,
        maxBytes: DEFAULT_MAX_ARCHIVE_BYTES,
      };
      const report = resumeReportId
        ? await transferApplication.resumeImport(state.archive, resumeReportId, options)
        : await transferApplication.importArchive(state.archive, options);
      dispatch({ type: "REPORT", report });
      await refreshReports();
      if ([TRANSFER_STATUSES.COMPLETE, TRANSFER_STATUSES.PARTIALLY_IMPORTED].includes(report.status)) {
        await notifyLibraryChanged();
      }
      setNotice({
        type: report.status === TRANSFER_STATUSES.COMPLETE ? "success" : "warning",
        text: report.status === TRANSFER_STATUSES.COMPLETE
          ? "Archive imported into this browser library. Historical generation timestamps and provenance were preserved."
          : `Transfer finished with status: ${STATUS_LABELS[report.status] || report.status}. Review the report before continuing.`,
      });
    } catch (error) {
      dispatch({ type: "FAILED", error: error.message });
    } finally {
      abortControllerRef.current = null;
    }
  }

  function cancelImport() {
    abortControllerRef.current?.abort();
    setNotice({ type: "warning", text: "Cancellation requested. SignalFlow will stop between transfer records and preserve an auditable report." });
  }

  async function rollbackReport(reportId) {
    setConfirmRollbackId("");
    setNotice(null);
    try {
      const report = await transferApplication.rollbackImport(reportId);
      dispatch({ type: "REPORT", report });
      await refreshReports();
      await notifyLibraryChanged();
      setNotice({
        type: report.status === TRANSFER_STATUSES.ROLLED_BACK ? "success" : "error",
        text: report.status === TRANSFER_STATUSES.ROLLED_BACK
          ? "Imported records were rolled back using the transfer journal."
          : "Rollback was incomplete. Review the report errors before changing the library.",
      });
    } catch (error) {
      setNotice({ type: "error", text: error.message || "SignalFlow could not roll back this import." });
    }
  }

  function resetImport() {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    dispatch({ type: "RESET" });
    setNotice(null);
    setConfirmRollbackId("");
  }

  const preview = state.preview;
  const validationErrors = preview?.validation?.errors || [];
  const previewWarnings = preview?.warnings || preview?.validation?.warnings || [];
  const exclusions = preview?.exclusions || [];
  const conflicts = preview?.conflicts || [];
  const preparedManifest = preparedArchive?.manifest;

  return (
    <section className="portable-transfer" aria-labelledby="portable-transfer-title">
      <header className="portable-transfer__heading">
        <div>
          <p className="portable-transfer__eyebrow">Portable ownership</p>
          <h2 id="portable-transfer-title">Move campaigns without surrendering control.</h2>
          <p>
            Prepare or import a versioned SignalFlow archive. Secrets, signed references, and private local paths are excluded; imported history remains historical.
          </p>
        </div>
        <span className="portable-transfer__schema">Archive schema v{PORTABLE_ARCHIVE_SCHEMA_VERSION}</span>
      </header>

      {notice && (
        <div className={`portable-transfer__notice is-${notice.type}`} role={notice.type === "error" ? "alert" : "status"} aria-live="polite">
          {notice.text}
        </div>
      )}

      <div className="portable-transfer__grid">
        <article className="portable-transfer-card" aria-labelledby="transfer-export-title">
          <div className="portable-transfer-card__heading">
            <div>
              <span>Export</span>
              <h3 id="transfer-export-title">Prepare a reviewed archive</h3>
            </div>
            <strong>{selectedCampaignIds.length}/{campaigns.length}</strong>
          </div>
          <p>Select the campaigns that should move. SignalFlow prepares the archive first so you can inspect counts and exclusions before downloading.</p>

          <div className="portable-transfer-selection-actions">
            <button type="button" onClick={selectAllCampaigns} disabled={!campaigns.length}>Select all</button>
            <button type="button" onClick={clearCampaignSelection} disabled={!selectedCampaignIds.length}>Clear</button>
          </div>

          <div className="portable-transfer-campaigns" role="group" aria-label="Campaigns to include in the portable archive">
            {campaigns.length === 0 ? (
              <p className="portable-transfer-empty">Save a campaign before preparing an archive.</p>
            ) : campaigns.map((campaign) => (
              <label key={campaign.campaignId}>
                <input
                  type="checkbox"
                  checked={selectedCampaignIds.includes(campaign.campaignId)}
                  onChange={() => toggleCampaign(campaign.campaignId)}
                />
                <span>
                  <strong>{campaign.title || "Untitled campaign"}</strong>
                  <small>{campaign.channels?.length || 0} destinations · updated {formatDate(campaign.updatedAt)}</small>
                </span>
              </label>
            ))}
          </div>

          <label className="portable-transfer-metadata-choice">
            <input
              type="checkbox"
              checked={includeTransferMetadata}
              onChange={(event) => {
                setIncludeTransferMetadata(event.target.checked);
                setPreparedArchive(null);
              }}
            />
            <span>
              <strong>Include browser-local transfer metadata and asset records</strong>
              <small>The prepared manifest shows exactly how many records and bytes are included.</small>
            </span>
          </label>

          <div className="portable-transfer-card__actions">
            <button
              type="button"
              className="button button--outline"
              onClick={prepareExport}
              disabled={!selectedCampaignIds.length}
            >
              Prepare archive
            </button>
            <button
              type="button"
              className="button button--dark"
              onClick={handleDownloadPreparedArchive}
              disabled={!preparedArchive}
            >
              Download .signalflow.json
            </button>
          </div>

          {preparedManifest && (
            <div className="portable-transfer-manifest" aria-label="Prepared archive manifest">
              <div className="portable-transfer-metrics">
                <div><strong>{preparedManifest.campaignCount}</strong><span>campaigns</span></div>
                <div><strong>{preparedManifest.assetCount}</strong><span>assets</span></div>
                <div><strong>{preparedManifest.sourceArtifactCount}</strong><span>source records</span></div>
                <div><strong>{formatBytes(preparedManifest.estimatedAssetBytes)}</strong><span>asset payload</span></div>
              </div>
              <div className="portable-transfer-integrity">
                <span>SHA-256</span>
                <code title={preparedArchive.integrity?.digest}>{preparedArchive.integrity?.digest?.slice(0, 18)}…</code>
              </div>
              {preparedManifest.exclusions?.length > 0 && (
                <details>
                  <summary>{preparedManifest.exclusions.length} private or unsupported fields excluded</summary>
                  <ul>
                    {preparedManifest.exclusions.map((item, index) => (
                      <li key={`${item.path}-${index}`}><code>{item.path}</code><span>{item.reason}</span></li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </article>

        <article className="portable-transfer-card" aria-labelledby="transfer-import-title">
          <div className="portable-transfer-card__heading">
            <div>
              <span>Import</span>
              <h3 id="transfer-import-title">Validate before changing the library</h3>
            </div>
            <strong className={`portable-transfer-status is-${state.status}`}>{STATUS_LABELS[state.status] || state.status}</strong>
          </div>
          <p>The archive is checked for schema compatibility, traversal, size, payload length, SHA-256 integrity, optional signatures, missing assets, and conflicts before import.</p>

          <input
            ref={fileInputRef}
            type="file"
            className="portable-transfer-file-input"
            accept=".json,.signalflow.json,application/json"
            onChange={handleArchiveFile}
            tabIndex={-1}
          />
          <button
            type="button"
            className="portable-transfer-dropzone"
            onClick={() => fileInputRef.current?.click()}
            disabled={!view.canChooseFile}
          >
            <strong>{state.selectedFileName || "Choose a SignalFlow archive"}</strong>
            <span>Maximum {formatBytes(DEFAULT_MAX_ARCHIVE_BYTES)} · no automatic upload or sync</span>
          </button>

          <div className="portable-transfer-controls">
            <label>
              <span>Destination</span>
              <select
                value={state.destinationWorkspaceId}
                onChange={(event) => void changeDestination(event.target.value)}
                disabled={view.busy}
              >
                <option value={LOCAL_WORKSPACE_ID}>This browser library</option>
              </select>
              <small>Hosted workspaces will use the same contract when a hosted adapter is connected.</small>
            </label>
            <label>
              <span>Conflict policy</span>
              <select
                value={state.conflictPolicy}
                onChange={(event) => void changeConflictPolicy(event.target.value)}
                disabled={view.busy}
              >
                <option value={TRANSFER_CONFLICT_POLICIES.SKIP}>Skip existing records</option>
                <option value={TRANSFER_CONFLICT_POLICIES.COPY}>Import as independent copies</option>
                <option value={TRANSFER_CONFLICT_POLICIES.REPLACE}>Replace matching records</option>
              </select>
              <small>Replace is reversible through the transfer journal until that report is rolled back.</small>
            </label>
          </div>

          {preview && (
            <div className="portable-transfer-preview" aria-label="Import preview">
              <div className="portable-transfer-metrics">
                <div><strong>{preview.counts?.campaigns || 0}</strong><span>campaigns</span></div>
                <div><strong>{preview.counts?.assets || 0}</strong><span>assets</span></div>
                <div><strong>{preview.counts?.sourceArtifacts || 0}</strong><span>source records</span></div>
                <div><strong>{formatBytes(preview.estimatedAssetBytes)}</strong><span>asset payload</span></div>
              </div>

              {validationErrors.length > 0 && (
                <div className="portable-transfer-issues is-error" role="alert">
                  <strong>Import blocked</strong>
                  <ul>{validationErrors.map((item, index) => <li key={`${item.code}-${index}`}>{issueMessage(item)}</li>)}</ul>
                </div>
              )}
              {previewWarnings.length > 0 && (
                <div className="portable-transfer-issues is-warning">
                  <strong>Warnings to review</strong>
                  <ul>{previewWarnings.map((item, index) => <li key={`${item.code || "warning"}-${index}`}>{issueMessage(item)}</li>)}</ul>
                </div>
              )}
              {conflicts.length > 0 && (
                <details className="portable-transfer-conflicts">
                  <summary>{conflicts.length} existing record conflict{conflicts.length === 1 ? "" : "s"}</summary>
                  <ul>
                    {conflicts.map((conflict) => (
                      <li key={`${conflict.kind}-${conflict.sourceId}`}>
                        <strong>{conflict.kind}</strong>
                        <span>{conflict.type === "already_imported" ? "Already imported from this archive" : "ID already exists"}</span>
                        <code>{conflict.sourceId}</code>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {exclusions.length > 0 && (
                <details>
                  <summary>{exclusions.length} fields were excluded when this archive was created</summary>
                  <ul>
                    {exclusions.map((item, index) => (
                      <li key={`${item.path}-${index}`}><code>{item.path}</code><span>{item.reason}</span></li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}

          <div className="portable-transfer-card__actions">
            {view.busy && state.status === TRANSFER_STATUSES.IMPORTING ? (
              <button type="button" className="button button--outline" onClick={cancelImport}>Cancel import</button>
            ) : (
              <button
                type="button"
                className="button button--dark"
                onClick={() => void runImport()}
                disabled={!view.canImport || view.busy}
              >
                Import reviewed archive
              </button>
            )}
            {view.canResume && state.report && (
              <button type="button" className="button button--outline" onClick={() => void runImport({ resumeReportId: state.report.transferReportId })}>
                Resume import
              </button>
            )}
            <button type="button" className="button button--outline" onClick={resetImport} disabled={view.busy}>Reset</button>
          </div>

          {state.error && <p className="portable-transfer-error" role="alert">{state.error}</p>}
          {state.report && (
            <div className="portable-transfer-current-report" role="status" aria-live="polite">
              <strong>{STATUS_LABELS[state.report.status] || state.report.status}</strong>
              <span>{state.report.summary?.imported ?? state.report.summary?.completed ?? 0} records applied · {state.report.summary?.skipped || 0} skipped</span>
              <small>Report {state.report.transferReportId} · updated {formatDate(state.report.updatedAt)}</small>
            </div>
          )}
        </article>
      </div>

      <section className="portable-transfer-reports" aria-labelledby="transfer-reports-title">
        <div className="portable-transfer-reports__heading">
          <div>
            <p className="portable-transfer__eyebrow">Audit and recovery</p>
            <h3 id="transfer-reports-title">Transfer reports</h3>
          </div>
          <button type="button" onClick={() => void refreshReports()}>Refresh</button>
        </div>

        {reports.length === 0 ? (
          <p className="portable-transfer-empty">No import reports are stored in this browser yet.</p>
        ) : (
          <div className="portable-transfer-report-list">
            {reports.map((report) => (
              <article key={report.transferReportId} className="portable-transfer-report">
                <div>
                  <span className={`portable-transfer-status is-${report.status}`}>{STATUS_LABELS[report.status] || report.status}</span>
                  <strong>{report.summary?.imported ?? report.summary?.completed ?? report.items?.length ?? 0} processed records</strong>
                  <small>{formatDate(report.updatedAt)} · {report.conflictPolicy || "skip"} conflicts</small>
                </div>
                <div className="portable-transfer-report__actions">
                  {reportCanResume(report) && state.archive && state.archive.integrity?.digest === report.archiveDigest && (
                    <button type="button" onClick={() => void runImport({ resumeReportId: report.transferReportId })}>Resume</button>
                  )}
                  {reportCanRollback(report) && confirmRollbackId !== report.transferReportId && (
                    <button type="button" onClick={() => setConfirmRollbackId(report.transferReportId)}>Rollback</button>
                  )}
                  {confirmRollbackId === report.transferReportId && (
                    <div className="portable-transfer-rollback-confirmation" role="group" aria-label="Confirm transfer rollback">
                      <span>Reverse every journaled change?</span>
                      <button type="button" onClick={() => void rollbackReport(report.transferReportId)}>Confirm</button>
                      <button type="button" onClick={() => setConfirmRollbackId("")}>Cancel</button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
