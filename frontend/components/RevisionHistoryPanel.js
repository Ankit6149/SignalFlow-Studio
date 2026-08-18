"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserPlatformReviewApplication } from "../lib/application/browserPlatformReviewApplication.mjs";
import styles from "./RevisionHistoryPanel.module.css";

const LOCAL_WORKSPACE_ID = "local-personal";

function titleCase(value) {
  return String(value || "").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function originLabel(revision) {
  if (revision?.editProvenance?.restoredFromRevisionId) return "Restored";
  if (revision?.origin === "edited") return "Owner edit";
  if (revision?.origin === "ai_revised") return "AI change";
  if (revision?.origin === "generated" && revision?.revisionNumber > 1) return "Regenerated";
  return "Generated";
}

function revisionText(revision) {
  if (!revision) return "";
  if (revision.format === "thread") return (revision.segments || []).join("\n\n");
  return revision.content || "";
}

function decisionLabel(entry) {
  if (entry?.approvalValid) return "Approved";
  if (entry?.decision?.decision === "rejected") return "Rejected";
  if (entry?.review?.overallVerdict) return `Reviewed · ${titleCase(entry.review.overallVerdict)}`;
  return "Not reviewed";
}

function displayTime(value) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "Unknown time";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(parsed));
}

function reviewFindings(review) {
  if (!review) return [];
  return [
    ...(review.boundaryPrecheck?.blocked || []),
    ...(review.boundaryPrecheck?.warnings || []),
    ...(review.evidence?.findings || []),
    ...(review.authenticity?.findings || []),
  ];
}

export default function RevisionHistoryPanel({ variantId, currentRevisionId, onChanged, context = "plan" }) {
  const [history, setHistory] = useState([]);
  const [selectedId, setSelectedId] = useState(currentRevisionId || "");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState(null);

  const application = useMemo(() => createBrowserPlatformReviewApplication({
    getStorage: () => window.localStorage,
    workspaceId: LOCAL_WORKSPACE_ID,
  }), []);

  const reload = useCallback(async ({ preserveSelection = true } = {}) => {
    if (!variantId) return;
    try {
      const next = await application.getRevisionHistory(variantId);
      setHistory(next);
      setSelectedId((current) => {
        if (preserveSelection && next.some((entry) => entry.revision.platformVariantRevisionId === current)) return current;
        return next.find((entry) => entry.isCurrent)?.revision.platformVariantRevisionId || next[0]?.revision.platformVariantRevisionId || "";
      });
    } catch (error) {
      setMessage({ type: "error", text: error?.message || "SignalFlow could not load revision history." });
    }
  }, [application, variantId]);

  useEffect(() => {
    setSelectedId(currentRevisionId || "");
    reload({ preserveSelection: false });
  }, [currentRevisionId, reload]);

  const selected = history.find((entry) => entry.revision.platformVariantRevisionId === selectedId) || null;
  const current = history.find((entry) => entry.isCurrent) || null;
  const selectedIsCurrent = Boolean(selected?.isCurrent);
  const findings = reviewFindings(selected?.review);
  const blocked = selected?.review?.overallVerdict === "block";

  async function run(key, operation, successText) {
    setBusy(key);
    setMessage(null);
    try {
      const result = await operation();
      await onChanged?.();
      await reload({ preserveSelection: key !== "restore" });
      setMessage({ type: "success", text: successText });
      return result;
    } catch (error) {
      setMessage({
        type: "error",
        text: error?.code === "stale_revision_context"
          ? "A newer revision became current after this history view loaded. Reloaded state is required before any judgment."
          : (error?.message || "SignalFlow could not update this revision judgment."),
      });
      await onChanged?.();
      await reload({ preserveSelection: false });
      return null;
    } finally {
      setBusy("");
    }
  }

  async function runChecks() {
    if (!selected || !currentRevisionId) return;
    await run(
      "review",
      () => application.reviewRevision(variantId, selected.revision.platformVariantRevisionId, {
        expectedCurrentRevisionId: currentRevisionId,
        refresh: Boolean(selected.review),
      }),
      `Checks are pinned to historical revision ${selected.revision.revisionNumber}.`,
    );
  }

  async function approveHistorical() {
    if (!selected || !currentRevisionId) return;
    await run(
      "approve",
      () => application.approveRevision(variantId, selected.revision.platformVariantRevisionId, {
        expectedCurrentRevisionId: currentRevisionId,
        note: "Approved from revision history.",
      }),
      `Revision ${selected.revision.revisionNumber} is explicitly approved. The newer current working revision was not silently replaced.`,
    );
  }

  async function rejectHistorical() {
    if (!selected || !currentRevisionId) return;
    await run(
      "reject",
      () => application.rejectRevision(variantId, selected.revision.platformVariantRevisionId, {
        expectedCurrentRevisionId: currentRevisionId,
        note: "Rejected from revision history.",
      }),
      `Revision ${selected.revision.revisionNumber} is explicitly rejected. Its immutable content remains in history.`,
    );
  }

  async function restoreHistorical() {
    if (!selected || !currentRevisionId) return;
    await run(
      "restore",
      () => application.restoreRevision(variantId, selected.revision.platformVariantRevisionId, {
        expectedCurrentRevisionId: currentRevisionId,
      }),
      `Revision ${selected.revision.revisionNumber} was restored as a new immutable current child. Run checks on the new revision before approval.`,
    );
  }

  if (!history.length) return null;

  return (
    <details className={styles.history} data-context={context}>
      <summary>
        <span>Revision history</span>
        <small>{history.length} saved revision{history.length === 1 ? "" : "s"}</small>
      </summary>

      <div className={styles.body}>
        {message && <div className={`${styles.message} ${styles[`message_${message.type}`] || ""}`} role="status">{message.text}</div>}

        <div className={styles.rail} role="list" aria-label="Immutable revisions">
          {history.map((entry) => (
            <button
              type="button"
              role="listitem"
              className={styles.revisionButton}
              data-selected={entry.revision.platformVariantRevisionId === selectedId}
              data-current={entry.isCurrent}
              aria-pressed={entry.revision.platformVariantRevisionId === selectedId}
              key={entry.revision.platformVariantRevisionId}
              onClick={() => { setSelectedId(entry.revision.platformVariantRevisionId); setMessage(null); }}
            >
              <span>r{entry.revision.revisionNumber}</span>
              <strong>{entry.isCurrent ? "Current" : originLabel(entry.revision)}</strong>
              <small>{decisionLabel(entry)}</small>
            </button>
          ))}
        </div>

        {selected && current && (
          <div className={styles.selection}>
            <header className={styles.selectionHeader}>
              <div>
                <span>{selectedIsCurrent ? "CURRENT WORKING REVISION" : "SELECTED HISTORICAL REVISION"}</span>
                <strong>Revision {selected.revision.revisionNumber} · {originLabel(selected.revision)}</strong>
                <p>{displayTime(selected.revision.createdAt)}{selected.revision.parentRevisionId ? ` · child of ${selected.revision.parentRevisionId.slice(-10)}` : ""}</p>
              </div>
              <div className={styles.state} data-state={selected.approvalValid ? "approved" : selected.decision?.decision || selected.review?.overallVerdict || "pending"}>{decisionLabel(selected)}</div>
            </header>

            {selected.revision.editProvenance?.restoredFromRevisionId && (
              <p className={styles.restoreNote}>Restored from immutable revision {selected.revision.editProvenance.restoredFromRevisionId.slice(-12)}; the intervening revisions were not overwritten.</p>
            )}
            {!selected.planningCurrent && (
              <p className={styles.staleNote}>This revision belongs to an older campaign-plan revision. It remains inspectable, but SignalFlow will not newly review, judge, or restore it into the current story contract.</p>
            )}

            {!selectedIsCurrent && (
              <div className={styles.compare} aria-label="Current and selected revision comparison">
                <section><span>CURRENT · r{current.revision.revisionNumber}</span><p>{revisionText(current.revision)}</p></section>
                <section><span>SELECTED · r{selected.revision.revisionNumber}</span><p>{revisionText(selected.revision)}</p></section>
              </div>
            )}

            <div className={styles.reviewSummary}>
              <div><span>Evidence</span><strong>{selected.review ? titleCase(selected.review.evidence.verdict) : "Not reviewed"}</strong><p>{selected.review?.evidence.summary || "No evidence critic result is pinned to this exact revision."}</p></div>
              <div><span>Authenticity</span><strong>{selected.review ? titleCase(selected.review.authenticity.verdict) : "Not reviewed"}</strong><p>{selected.review?.authenticity.summary || "No authenticity critic result is pinned to this exact revision."}</p></div>
            </div>

            {findings.length > 0 && (
              <details className={styles.findings}>
                <summary>{findings.length} review finding{findings.length === 1 ? "" : "s"}</summary>
                {findings.map((finding, index) => <p key={`${finding.code}-${index}`} data-severity={finding.severity}><strong>{titleCase(finding.severity)}</strong>{finding.message}</p>)}
              </details>
            )}

            {!selectedIsCurrent && selected.planningCurrent && (
              <div className={styles.actions}>
                <button type="button" onClick={runChecks} disabled={Boolean(busy)}>{busy === "review" ? "Checking…" : selected.review ? "Re-run exact checks" : "Run exact checks"}</button>
                {!selected.approvalValid && selected.decision?.decision !== "rejected" && (
                  <button type="button" className={styles.approve} onClick={approveHistorical} disabled={Boolean(busy) || !selected.review || blocked}>{blocked ? "Blocked" : busy === "approve" ? "Approving…" : "Approve selected"}</button>
                )}
                {!selected.approvalValid && selected.decision?.decision !== "rejected" && <button type="button" onClick={rejectHistorical} disabled={Boolean(busy)}>{busy === "reject" ? "Rejecting…" : "Reject selected"}</button>}
                <button type="button" className={styles.restore} onClick={restoreHistorical} disabled={Boolean(busy)}>{busy === "restore" ? "Restoring…" : "Restore as new current"}</button>
              </div>
            )}

            {selectedIsCurrent && <p className={styles.currentNote}>Current-revision editing, change requests, regeneration and final approval remain in the primary review controls above. History never silently changes the active draft.</p>}
          </div>
        )}
      </div>
    </details>
  );
}
