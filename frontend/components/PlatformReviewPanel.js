"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserPlatformReviewApplication } from "../lib/application/browserPlatformReviewApplication.mjs";
import { createBrowserPlatformGenerationApplication } from "../lib/application/browserPlatformGenerationApplication.mjs";
import { createBrowserPlatformChangeRequestApplication } from "../lib/application/browserPlatformChangeRequestApplication.mjs";
import ExactMediaRevisionPreview from "./ExactMediaRevisionPreview";
import RevisionHistoryPanel from "./RevisionHistoryPanel";
import styles from "./PlatformReviewPanel.module.css";

const LOCAL_WORKSPACE_ID = "local-personal";
const MAX_CHANGE_REQUEST_LENGTH = 2000;

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
  const [requestingChange, setRequestingChange] = useState(false);
  const [changeRequest, setChangeRequest] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [mediaPreviewState, setMediaPreviewState] = useState({ required: false, ready: true, status: "not_required" });

  const reviewApplication = useMemo(() => createBrowserPlatformReviewApplication({
    getStorage: () => window.localStorage,
    workspaceId: LOCAL_WORKSPACE_ID,
  }), []);
  const generationApplication = useMemo(() => createBrowserPlatformGenerationApplication({
    getStorage: () => window.localStorage,
    workspaceId: LOCAL_WORKSPACE_ID,
  }), []);
  const changeRequestApplication = useMemo(() => createBrowserPlatformChangeRequestApplication({
    getStorage: () => window.localStorage,
    workspaceId: LOCAL_WORKSPACE_ID,
  }), []);

  const handleMediaPreviewState = useCallback((next) => {
    setMediaPreviewState(next);
  }, []);

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
      if (error?.code === "stale_revision_context") {
        await onChanged?.();
        await reload();
      }
      setMessage({
        type: "error",
        code: error?.code || "",
        text: error?.code === "stale_revision_context"
          ? "A newer revision became current after this review loaded. SignalFlow refreshed the state instead of applying your action to unseen content."
          : (error?.message || "SignalFlow could not update this review."),
      });
      return null;
    } finally {
      setBusy("");
    }
  }

  async function runChecks() {
    await run(
      "review",
      () => reviewApplication.reviewRevision(variant.platformVariantId, revision.platformVariantRevisionId, {
        expectedCurrentRevisionId: revision.platformVariantRevisionId,
        refresh: Boolean(bundle.review),
      }),
      revision.mediaBindings?.length
        ? "Evidence and authenticity checks are pinned to this exact text + media revision."
        : "Evidence and authenticity checks are now pinned to this exact revision.",
    );
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
      "Edit saved as a new immutable revision. Exact media bindings are preserved; the previous review/approval remains historical and no longer applies to the current draft.",
    );
    if (saved) setEditing(false);
  }

  async function requestNaturalLanguageChange(event) {
    event.preventDefault();
    const instruction = changeRequest.trim();
    if (!instruction) return;
    const saved = await run(
      "request-change",
      () => changeRequestApplication.requestChange(variant.platformVariantId, instruction),
      "SignalFlow created a new immutable text revision while preserving the exact media binding. The previous review/approval is historical; run checks again before approval.",
    );
    if (saved) {
      setRequestingChange(false);
      setChangeRequest("");
    }
  }

  async function regenerate() {
    await run(
      "regenerate",
      () => generationApplication.regenerateVariant(variant.platformVariantId),
      "A new generated revision is current. The exact media binding is preserved; the previous review/approval is historical and checks must run again.",
    );
  }

  async function approve() {
    if (mediaPreviewState.required && !mediaPreviewState.ready) {
      setMessage({ type: "error", code: "exact_media_preview_required", text: "SignalFlow cannot approve a media-bound revision until the exact AssetVersion is visibly resolved in this review." });
      return;
    }
    await run(
      "approve",
      () => reviewApplication.approveRevision(variant.platformVariantId, revision.platformVariantRevisionId, {
        expectedCurrentRevisionId: revision.platformVariantRevisionId,
      }),
      revision.mediaBindings?.length
        ? "This exact visible text + media revision is approved. A later text or media change requires a new review and approval."
        : "This exact visible revision is approved. A later edit, requested change, or regeneration will require a new review and approval.",
    );
  }

  async function reject(event) {
    event.preventDefault();
    const result = await run(
      "reject",
      () => reviewApplication.rejectRevision(variant.platformVariantId, revision.platformVariantRevisionId, {
        expectedCurrentRevisionId: revision.platformVariantRevisionId,
        note: rejectNote.trim(),
      }),
      "This exact visible revision is rejected; its text/media history is preserved.",
    );
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
  const mediaApprovalBlocked = Boolean(revision.mediaBindings?.length && !mediaPreviewState.ready);

  return (
    <div className={styles.reviewPanel}>
      {message && <div className={`${styles.message} ${styles[`message_${message.type}`] || ""}`} role="status">{message.text}</div>}

      <ExactMediaRevisionPreview mediaBindings={revision.mediaBindings || []} onPreviewState={handleMediaPreviewState} />

      {!review ? (
        <div className={styles.reviewGate}>
          <div><span>QUALITY GATE</span><p>Run factual/evidence and authenticity checks on revision {revision.revisionNumber} before approval{revision.mediaBindings?.length ? "; the exact visual above remains part of this same immutable revision" : ""}.</p></div>
          <button type="button" onClick={runChecks} disabled={Boolean(busy)}>{busy === "review" ? "Checking…" : "Run checks"}</button>
        </div>
      ) : (
        <div className={styles.reviewResults}>
          <div className={styles.resultHeader} data-verdict={review.overallVerdict}>
            <div><span>EXACT REVISION REVIEW</span><strong>{titleCase(review.overallVerdict)}</strong><p>Review {review.platformVariantReviewId.slice(-10)} · revision {revision.revisionNumber}{revision.mediaBindings?.length ? " · text + media" : ""}</p></div>
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
      ) : requestingChange ? (
        <form className={styles.changeRequestForm} onSubmit={requestNaturalLanguageChange}>
          <label>
            <span>REQUEST A CHANGE TO THIS EXACT REVISION</span>
            <textarea
              rows={3}
              maxLength={MAX_CHANGE_REQUEST_LENGTH}
              value={changeRequest}
              onChange={(event) => setChangeRequest(event.target.value)}
              placeholder="Make the opening less promotional, keep the architecture point, and shorten the ending."
              autoFocus
            />
          </label>
          <div className={styles.changeRequestMeta}><small>SignalFlow will preserve the destination, approved story plan, Voice snapshot, exact media binding and revision history.</small><span>{changeRequest.length}/{MAX_CHANGE_REQUEST_LENGTH}</span></div>
          <div><button type="button" onClick={() => { setRequestingChange(false); setChangeRequest(""); }} disabled={Boolean(busy)}>Cancel</button><button type="submit" disabled={Boolean(busy) || !changeRequest.trim()}>{busy === "request-change" ? "Revising…" : "Request change"}</button></div>
        </form>
      ) : rejecting ? (
        <form className={styles.rejectForm} onSubmit={reject}>
          <label><span>REJECTION NOTE · OPTIONAL</span><input value={rejectNote} onChange={(event) => setRejectNote(event.target.value)} placeholder="Why this version should not be used" /></label>
          <div><button type="button" onClick={() => setRejecting(false)} disabled={Boolean(busy)}>Cancel</button><button type="submit" disabled={Boolean(busy)}>{busy === "reject" ? "Rejecting…" : "Reject exact revision"}</button></div>
        </form>
      ) : (
        <div className={styles.actions}>
          <div>
            <button type="button" onClick={() => setEditing(true)} disabled={Boolean(busy)}>Edit</button>
            <button type="button" onClick={() => setRequestingChange(true)} disabled={Boolean(busy)}>Request change</button>
            <button type="button" onClick={regenerate} disabled={Boolean(busy)}>{busy === "regenerate" ? "Regenerating…" : "Regenerate"}</button>
          </div>
          <div>
            {!approved && !rejected && <button type="button" onClick={() => setRejecting(true)} disabled={Boolean(busy)}>Reject</button>}
            {approved ? <span className={styles.approvedBadge}>Approved · exact revision {revision.revisionNumber}</span> : rejected ? <span className={styles.rejectedBadge}>Rejected · exact revision {revision.revisionNumber}</span> : <button type="button" className={styles.approveButton} onClick={approve} disabled={Boolean(busy) || !review || blocked || mediaApprovalBlocked}>{busy === "approve" ? "Approving…" : mediaApprovalBlocked ? "Resolve exact media preview" : blocked ? "Resolve blockers first" : revision.mediaBindings?.length ? "Approve exact text + media" : "Approve exact revision"}</button>}
          </div>
        </div>
      )}

      <RevisionHistoryPanel
        variantId={variant.platformVariantId}
        currentRevisionId={revision.platformVariantRevisionId}
        onChanged={onChanged}
        context="plan"
      />
    </div>
  );
}
