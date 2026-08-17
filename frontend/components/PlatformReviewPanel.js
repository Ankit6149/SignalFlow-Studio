"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserPlatformReviewApplication } from "../lib/application/browserPlatformReviewApplication.mjs";
import { createBrowserPlatformGenerationApplication } from "../lib/application/browserPlatformGenerationApplication.mjs";
import styles from "./PlatformReviewPanel.module.css";

const LOCAL_WORKSPACE_ID = "local-personal";

function titleCase(value) {
  return String(value || "").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function editorValue(revision) {
  if (!revision) return "";
  return revision.format === "thread" ? (revision.segments || []).join("\n\n") : revision.content || "";
}

function FindingList({ title, result }) {
  if (!result) return null;
  return (
    <div className={styles.criticSection} data-verdict={result.verdict}>
      <div className={styles.criticHeading}><strong>{title}</strong><span>{titleCase(result.verdict)}</span></div>
      <p className={styles.criticSummary}>{result.summary}</p>
      {result.findings?.length > 0 && (
        <ul className={styles.findings}>
          {result.findings.map((finding, index) => (
            <li key={`${finding.code}-${index}`} data-severity={finding.severity}>
              <div><span>{titleCase(finding.severity)}</span><p>{finding.message}</p></div>
              {finding.suggestion && <small>{finding.suggestion}</small>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function PlatformReviewPanel({ variant, revision, onChanged }) {
  const [bundle, setBundle] = useState({ review: null, decision: null, approvalValid: false });
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(editorValue(revision));
  const [rejecting, setRejecting] = useState(false);
  const [rejectNote, setRejectNote] = useState("");

  const reviewApplication = useMemo(() => createBrowserPlatformReviewApplication({
    getStorage: () => window.localStorage,
    workspaceId: LOCAL_WORKSPACE_ID,
  }), []);
  const generationApplication = useMemo(() => createBrowserPlatformGenerationApplication({
    getStorage: () => window.localStorage,
    workspaceId: LOCAL_WORKSPACE_ID,
  }), []);

  const reload = useCallback(async () => {
    if (!variant?.platformVariantId || !revision?.platformVariantRevisionId) return;
    try {
      setBundle(await reviewApplication.getReviewBundle(variant.platformVariantId));
      setEditText(editorValue(revision));
    } catch (error) {
      setMessage({ type: "error", text: error?.message || "SignalFlow could not load review state." });
    }
  }, [reviewApplication, revision, variant?.platformVariantId]);

  useEffect(() => { reload(); }, [reload]);

  async function run(key, action, successText) {
    setBusy(key);
    setMessage(null);
    try {
      const result = await action();
      await onChanged?.();
      await reload();
      if (successText) setMessage({ type: "success", text: successText });
      return result;
    } catch (error) {
      setMessage({ type: "error", code: error?.code || "", text: error?.message || "SignalFlow could not update this review." });
      return null;
    } finally {
      setBusy("");
    }
  }

  async function runChecks() {
    await run("review", () => reviewApplication.reviewCurrentVariant(variant.platformVariantId, { refresh: Boolean(bundle.review) }), "Evidence and authenticity checks are now pinned to this exact revision.");
  }

  async function saveEdit(event) {
    event.preventDefault();
    const value = editText.trim();
    if (!value) return;
    const isThread = revision.format === "thread";
    const segments = isThread ? value.split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean) : [];
    const saved = await run(
      "edit",
      () => reviewApplication.editCurrentVariant(variant.platformVariantId, {
        content: isThread ? "" : value,
        segments,
        format: revision.format,
      }),
      "Edit saved as a new immutable revision. The previous review/approval remains historical and no longer applies to the current draft.",
    );
    if (saved) setEditing(false);
  }

  async function regenerate() {
    await run(
      "regenerate",
      () => generationApplication.regenerateVariant(variant.platformVariantId),
      "A new generated revision is current. Run checks again before approval.",
    );
  }

  async function approve() {
    await run("approve", () => reviewApplication.approveCurrentVariant(variant.platformVariantId), "This exact revision is approved. A later edit or regeneration will require a new review and approval.");
  }

  async function reject(event) {
    event.preventDefault();
    const result = await run("reject", () => reviewApplication.rejectCurrentVariant(variant.platformVariantId, rejectNote.trim()), "This exact revision is rejected; its history is preserved.");
    if (result) {
      setRejecting(false);
      setRejectNote("");
    }
  }

  const review = bundle.review;
  const precheckFindings = review ? [...(review.boundaryPrecheck?.blocked || []), ...(review.boundaryPrecheck?.warnings || [])] : [];
  const blocked = review?.overallVerdict === "block";
  const approved = bundle.approvalValid;
  const rejected = bundle.decision?.decision === "rejected" && bundle.decision?.platformVariantRevisionId === revision.platformVariantRevisionId;

  return (
    <div className={styles.reviewPanel}>
      {message && <div className={`${styles.message} ${styles[`message_${message.type}`] || ""}`} role="status">{message.text}</div>}

      {!review ? (
        <div className={styles.reviewGate}>
          <div><span>QUALITY GATE</span><p>Run factual/evidence and authenticity checks on revision {revision.revisionNumber} before approval.</p></div>
          <button type="button" onClick={runChecks} disabled={Boolean(busy)}>{busy === "review" ? "Checking…" : "Run checks"}</button>
        </div>
      ) : (
        <div className={styles.reviewResults}>
          <div className={styles.resultHeader} data-verdict={review.overallVerdict}>
            <div><span>EXACT REVISION REVIEW</span><strong>{titleCase(review.overallVerdict)}</strong><p>Review {review.platformVariantReviewId.slice(-10)} · revision {revision.revisionNumber}</p></div>
            <button type="button" onClick={runChecks} disabled={Boolean(busy)}>{busy === "review" ? "Rechecking…" : "Re-run checks"}</button>
          </div>

          {precheckFindings.length > 0 && (
            <div className={styles.boundaryFindings}>
              <strong>Explicit boundary precheck</strong>
              {precheckFindings.map((finding, index) => <p key={`${finding.code}-${index}`} data-severity={finding.severity}>{finding.message}</p>)}
            </div>
          )}
          <div className={styles.criticGrid}>
            <FindingList title="Evidence" result={review.evidence} />
            <FindingList title="Authenticity" result={review.authenticity} />
          </div>
        </div>
      )}

      {editing ? (
        <form className={styles.editForm} onSubmit={saveEdit}>
          <label><span>EDIT THIS REVISION</span><textarea rows={revision.format === "thread" ? 8 : 7} value={editText} onChange={(event) => setEditText(event.target.value)} /></label>
          {revision.format === "thread" && <small>Keep one blank line between X thread posts. Every segment must remain within platform limits.</small>}
          <div><button type="button" onClick={() => { setEditing(false); setEditText(editorValue(revision)); }} disabled={Boolean(busy)}>Cancel</button><button type="submit" disabled={Boolean(busy) || !editText.trim()}>{busy === "edit" ? "Saving…" : "Save as new revision"}</button></div>
        </form>
      ) : rejecting ? (
        <form className={styles.rejectForm} onSubmit={reject}>
          <label><span>REJECTION NOTE · OPTIONAL</span><input value={rejectNote} onChange={(event) => setRejectNote(event.target.value)} placeholder="Why this version should not be used" /></label>
          <div><button type="button" onClick={() => setRejecting(false)} disabled={Boolean(busy)}>Cancel</button><button type="submit" disabled={Boolean(busy)}>{busy === "reject" ? "Rejecting…" : "Reject exact revision"}</button></div>
        </form>
      ) : (
        <div className={styles.actions}>
          <div><button type="button" onClick={() => setEditing(true)} disabled={Boolean(busy) || approved}>Edit</button><button type="button" onClick={regenerate} disabled={Boolean(busy) || approved}>{busy === "regenerate" ? "Regenerating…" : "Regenerate"}</button></div>
          <div>
            {!approved && !rejected && <button type="button" onClick={() => setRejecting(true)} disabled={Boolean(busy)}>Reject</button>}
            {approved ? <span className={styles.approvedBadge}>Approved · exact revision {revision.revisionNumber}</span> : rejected ? <span className={styles.rejectedBadge}>Rejected · exact revision {revision.revisionNumber}</span> : <button type="button" className={styles.approveButton} onClick={approve} disabled={Boolean(busy) || !review || blocked}>{busy === "approve" ? "Approving…" : blocked ? "Resolve blockers first" : "Approve exact revision"}</button>}
          </div>
        </div>
      )}
    </div>
  );
}
