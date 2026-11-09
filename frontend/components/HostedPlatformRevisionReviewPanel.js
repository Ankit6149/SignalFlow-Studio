"use client";

import { useCallback, useMemo, useState } from "react";
import ExactMediaRevisionPreview from "./ExactMediaRevisionPreview";
import { createBrowserHostedExactMediaPreviewAdapter } from "../lib/infrastructure/browserHostedExactMediaPreviewAdapter.mjs";
import { createBrowserHostedChangeRequestClient } from "../lib/infrastructure/browserHostedChangeRequestClient.mjs";
import styles from "./PlatformReviewPanel.module.css";

const MAX_CHANGE_REQUEST_LENGTH = 2000;

function titleCase(value) {
  return String(value || "").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function revisionText(revision) {
  if (!revision) return "";
  return revision.format === "thread" ? (revision.segments || []).join("\n\n") : revision.content || "";
}

function revisionOriginLabel(revision) {
  if (revision?.editProvenance?.restoredFromRevisionId) return "Restored";
  if (revision?.origin === "edited") return "Owner edit";
  if (revision?.origin === "ai_revised") return "AI change";
  if (revision?.origin === "media_rebound") return "Media rebound";
  if (revision?.origin === "generated" && revision?.revisionNumber > 1) return "Regenerated";
  return "Generated";
}

function displayTime(value) {
  const parsed = Date.parse(value || "");
  if (!Number.isFinite(parsed)) return "Unknown time";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(parsed));
}

function mediaIdentityLines(revision) {
  return (revision?.mediaBindings || []).map((binding) => (
    `${titleCase(binding.role)} · ${binding.assetId} · ${binding.assetVersionId}`
  ));
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

export default function HostedPlatformRevisionReviewPanel({ entry, client, onChanged, requiredMediaPending = false }) {
  const variant = entry?.variant;
  const revision = entry?.currentRevision;
  const reviewBundle = entry?.review || null;
  const review = reviewBundle?.review || null;
  const decision = reviewBundle?.decision || null;
  const approved = Boolean(reviewBundle?.approvalValid);
  const revisionId = revision?.platformVariantRevisionId || "";
  const rejected = decision?.decision === "rejected" && decision?.platformVariantRevisionId === revisionId;
  const historicalRevisions = (entry?.history || [])
    .filter((item) => item.platformVariantRevisionId !== revisionId)
    .sort((left, right) => right.revisionNumber - left.revisionNumber);
  const selectedHistorical = historicalRevisions.find((item) => item.platformVariantRevisionId === selectedHistoryId)
    || historicalRevisions[0]
    || null;

  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState(null);
  const [editing, setEditing] = useState(false);
  const [requestingChange, setRequestingChange] = useState(false);
  const [changeRequest, setChangeRequest] = useState("");
  const [editText, setEditText] = useState(revisionText(revision));
  const [previewGeneration, setPreviewGeneration] = useState(0);
  const [mediaPreviewState, setMediaPreviewState] = useState({ revisionId, required: false, ready: true, status: "not_required", visibleMedia: [] });
  const [selectedHistoryId, setSelectedHistoryId] = useState("");

  const previewAdapter = useMemo(() => createBrowserHostedExactMediaPreviewAdapter(), []);
  const changeRequestClient = useMemo(() => createBrowserHostedChangeRequestClient(), []);
  const handlePreviewState = useCallback((next) => setMediaPreviewState({ ...next, revisionId }), [revisionId]);

  async function run(key, action, successText) {
    setBusy(key);
    setMessage(null);
    try {
      const result = await action();
      await onChanged?.();
      if (successText) setMessage({ type: "success", text: successText });
      return result;
    } catch (error) {
      if (["stale_revision_context", "preview_receipt_expired"].includes(error?.code)) {
        if (error.code === "preview_receipt_expired") setPreviewGeneration((value) => value + 1);
        await onChanged?.();
      }
      setMessage({
        type: "error",
        code: error?.code || "",
        text: error?.code === "stale_revision_context"
          ? "A newer hosted revision exists. SignalFlow refreshed the canonical state instead of applying your action to unseen content."
          : error?.code === "preview_receipt_expired"
            ? "The exact-media visibility receipt expired. SignalFlow is re-resolving the bound AssetVersion before approval."
            : (error?.message || "SignalFlow could not update this hosted review."),
      });
      return null;
    } finally {
      setBusy("");
    }
  }

  if (!variant || !revision) return null;

  const previewBelongsToRevision = mediaPreviewState.revisionId === revisionId;
  const mediaApprovalBlocked = Boolean(requiredMediaPending || (revision.mediaBindings?.length && (
      !previewBelongsToRevision
      || !mediaPreviewState.ready
      || mediaPreviewState.visibleMedia?.length !== revision.mediaBindings.length
    )));
  const blocked = review?.overallVerdict === "block";
  const precheckFindings = review ? [...(review.boundaryPrecheck?.blocked || []), ...(review.boundaryPrecheck?.warnings || [])] : [];

  async function runChecks() {
    await run(
      "review",
      () => client.reviewRevision(variant.platformVariantId, revisionId, {
        expectedCurrentRevisionId: revisionId,
        refresh: Boolean(review),
      }),
      revision.mediaBindings?.length
        ? "Evidence and authenticity checks are pinned to this exact hosted text + media revision."
        : "Evidence and authenticity checks are pinned to this exact hosted revision.",
    );
  }

  async function saveEdit(event) {
    event.preventDefault();
    const value = editText.trim();
    if (!value) return;
    const isThread = revision.format === "thread";
    const segments = isThread ? value.split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean) : [];
    const result = await run(
      "edit",
      () => client.editCurrentVariant(variant.platformVariantId, {
        expectedCurrentRevisionId: revisionId,
        content: isThread ? "" : value,
        segments,
        format: revision.format,
      }),
      "Owner edit saved as a new immutable hosted revision. Exact media bindings are preserved and prior review/approval is historical.",
    );
    if (result) setEditing(false);
  }

  async function requestNaturalLanguageChange(event) {
    event.preventDefault();
    const instruction = changeRequest.trim();
    if (!instruction) return;
    const result = await run(
      "request-change",
      () => changeRequestClient.requestChange(variant.platformVariantId, instruction, {
        expectedCurrentRevisionId: revisionId,
      }),
      "SignalFlow created a new immutable hosted revision from your change request. Exact media bindings stay attached; prior checks and approval remain historical.",
    );
    if (result) {
      setRequestingChange(false);
      setChangeRequest("");
    }
  }

  async function regenerate() {
    await run(
      "regenerate",
      () => client.regenerateVariant(variant.platformVariantId, { expectedCurrentRevisionId: revisionId }),
      "A new immutable hosted revision is current. The previous revision remains in history and must not lend its approval forward.",
    );
  }

  async function approve() {
    if (mediaApprovalBlocked) {
      setMessage({ type: "error", code: "hosted_media_preview_confirmation_required", text: "Approval is blocked until every exact bound AssetVersion is visibly resolved in this hosted review." });
      return;
    }
    await run(
      "approve",
      () => client.approveRevision(variant.platformVariantId, revisionId, {
        expectedCurrentRevisionId: revisionId,
        visibleMedia: mediaPreviewState.visibleMedia || [],
      }),
      revision.mediaBindings?.length
        ? "This exact hosted text + media revision is approved. A later text or media change requires a new judgment."
        : "This exact hosted revision is approved. A later edit or regeneration requires a new judgment.",
    );
  }

  async function reject() {
    await run(
      "reject",
      () => client.rejectRevision(variant.platformVariantId, revisionId, { expectedCurrentRevisionId: revisionId }),
      "This exact hosted revision is rejected; its immutable content remains available in history.",
    );
  }

  async function restore(sourceRevision) {
    await run(
      `restore-${sourceRevision.platformVariantRevisionId}`,
      () => client.restoreRevision(variant.platformVariantId, sourceRevision.platformVariantRevisionId, { expectedCurrentRevisionId: revisionId }),
      `Revision ${sourceRevision.revisionNumber} was restored as a new immutable current child. Run exact checks again before approval.`,
    );
  }

  return (
    <div className={styles.reviewPanel}>
      {message && <div className={`${styles.message} ${styles[`message_${message.type}`] || ""}`} role="status">{message.text}</div>}

      <ExactMediaRevisionPreview
        key={`${revisionId}:${previewGeneration}`}
        mediaBindings={revision.mediaBindings}
        previewAdapter={previewAdapter}
        onPreviewState={handlePreviewState}
      />

      {requiredMediaPending && (
      <div className={styles.reviewGate}>
        <div><span>REQUIRED MEDIA · PREPARING</span><p>SignalFlow will run the final exact evidence/authenticity checks automatically after the required visual proof is bound to this revision.</p></div>
      </div>
    )}

    {!review ? (
      requiredMediaPending ? null : (
        <div className={styles.reviewGate}>
          <div><span>EXACT CHECK RECOVERY</span><p>Automatic exact checks did not complete for immutable revision {revision.revisionNumber}. Retry them without changing the revision.</p></div>
          <button type="button" onClick={runChecks} disabled={Boolean(busy)}>{busy === "review" ? "Checking…" : "Retry exact checks"}</button>
        </div>
      )
    ) : (
      <div className={styles.reviewResults}>
          <div className={styles.resultHeader} data-verdict={review.overallVerdict}>
            <div><span>HOSTED EXACT REVISION REVIEW</span><strong>{titleCase(review.overallVerdict)}</strong><p>Review {review.platformVariantReviewId.slice(-10)} · revision {revision.revisionNumber}{revision.mediaBindings?.length ? " · text + media" : ""}</p></div>
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
          <label><span>EDIT THIS EXACT HOSTED REVISION</span><textarea rows={revision.format === "thread" ? 8 : 7} value={editText} onChange={(event) => setEditText(event.target.value)} /></label>
          {revision.format === "thread" && <small>Keep one blank line between X thread posts.</small>}
          <div><button type="button" onClick={() => { setEditing(false); setEditText(revisionText(revision)); }} disabled={Boolean(busy)}>Cancel</button><button type="submit" disabled={Boolean(busy) || !editText.trim()}>{busy === "edit" ? "Saving…" : "Save as new revision"}</button></div>
        </form>
      ) : requestingChange ? (
        <form className={styles.changeRequestForm} onSubmit={requestNaturalLanguageChange}>
          <label>
            <span>REQUEST A CHANGE TO THIS EXACT HOSTED REVISION</span>
            <textarea
              rows={3}
              maxLength={MAX_CHANGE_REQUEST_LENGTH}
              value={changeRequest}
              onChange={(event) => setChangeRequest(event.target.value)}
              placeholder="Make the opening less promotional, keep the concrete architecture point, and shorten the ending."
              autoFocus
            />
          </label>
          <div className={styles.changeRequestMeta}>
            <small>SignalFlow will preserve the destination, approved story plan, Voice snapshot, exact media binding and immutable revision history.</small>
            <span>{changeRequest.length}/{MAX_CHANGE_REQUEST_LENGTH}</span>
          </div>
          <div>
            <button type="button" onClick={() => { setRequestingChange(false); setChangeRequest(""); }} disabled={Boolean(busy)}>Cancel</button>
            <button type="submit" disabled={Boolean(busy) || !changeRequest.trim()}>{busy === "request-change" ? "Revising…" : "Request change"}</button>
          </div>
        </form>
      ) : (
        <div className={styles.actions}>
          <div>
            <button type="button" onClick={() => { setEditText(revisionText(revision)); setEditing(true); }} disabled={Boolean(busy)}>Edit</button>
            <button type="button" onClick={() => setRequestingChange(true)} disabled={Boolean(busy)}>Request change</button>
            <button type="button" onClick={regenerate} disabled={Boolean(busy)}>{busy === "regenerate" ? "Regenerating…" : "Regenerate"}</button>
            {!approved && !rejected && <button type="button" onClick={reject} disabled={Boolean(busy)}>{busy === "reject" ? "Rejecting…" : "Reject"}</button>}
          </div>
          <div>
            {approved ? <span className={styles.approvedBadge}>Approved · exact revision {revision.revisionNumber}</span> : rejected ? <span className={styles.rejectedBadge}>Rejected · exact revision {revision.revisionNumber}</span> : <button type="button" className={styles.approveButton} onClick={approve} disabled={Boolean(busy) || !review || blocked || mediaApprovalBlocked}>{busy === "approve" ? "Approving…" : mediaApprovalBlocked ? "Resolve exact media preview" : blocked ? "Resolve blockers first" : revision.mediaBindings?.length ? "Approve exact text + media" : "Approve exact revision"}</button>}
          </div>
        </div>
      )}

      {historicalRevisions.length > 0 && (
        <details className={styles.hostedHistory}>
          <summary>
            <span>Immutable history</span>
            <small>{entry.history.length} saved revisions</small>
          </summary>
          <div className={styles.hostedHistoryBody}>
            <div className={styles.hostedHistoryRail} aria-label="Hosted immutable revisions">
              {historicalRevisions.map((item) => (
                <button
                  type="button"
                  key={item.platformVariantRevisionId}
                  aria-pressed={selectedHistorical?.platformVariantRevisionId === item.platformVariantRevisionId}
                  data-selected={selectedHistorical?.platformVariantRevisionId === item.platformVariantRevisionId}
                  onClick={() => setSelectedHistoryId(item.platformVariantRevisionId)}
                  disabled={Boolean(busy)}
                >
                  <span>r{item.revisionNumber}</span>
                  <strong>{revisionOriginLabel(item)}</strong>
                  <small>{displayTime(item.createdAt)}</small>
                </button>
              ))}
            </div>

            {selectedHistorical && (
              <div className={styles.hostedHistorySelection}>
                <header>
                  <div>
                    <span>SELECTED HISTORICAL REVISION</span>
                    <strong>Revision {selectedHistorical.revisionNumber} · {revisionOriginLabel(selectedHistorical)}</strong>
                    <p>{displayTime(selectedHistorical.createdAt)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => restore(selectedHistorical)}
                    disabled={Boolean(busy)}
                  >
                    {busy === `restore-${selectedHistorical.platformVariantRevisionId}` ? "Restoring…" : "Restore as new current"}
                  </button>
                </header>

                {selectedHistorical.changeRequest && (
                  <p className={styles.historyContext}>AI change request: “{selectedHistorical.changeRequest}”</p>
                )}
                {selectedHistorical.editProvenance?.restoredFromRevisionId && (
                  <p className={styles.historyContext}>Restored from immutable revision {selectedHistorical.editProvenance.restoredFromRevisionId}.</p>
                )}

                <div className={styles.hostedCompare} aria-label="Current and selected hosted revision comparison">
                  <section>
                    <span>CURRENT · r{revision.revisionNumber}</span>
                    <p>{revisionText(revision)}</p>
                    <div className={styles.hostedMediaIdentity}>
                      <strong>Exact media</strong>
                      {mediaIdentityLines(revision).length
                        ? mediaIdentityLines(revision).map((line) => <code key={line}>{line}</code>)
                        : <small>No media bound</small>}
                    </div>
                  </section>
                  <section>
                    <span>SELECTED · r{selectedHistorical.revisionNumber}</span>
                    <p>{revisionText(selectedHistorical)}</p>
                    <div className={styles.hostedMediaIdentity}>
                      <strong>Exact media</strong>
                      {mediaIdentityLines(selectedHistorical).length
                        ? mediaIdentityLines(selectedHistorical).map((line) => <code key={line}>{line}</code>)
                        : <small>No media bound</small>}
                    </div>
                  </section>
                </div>
              </div>
            )}
          </div>
        </details>
      )}
    </div>
  );
}
