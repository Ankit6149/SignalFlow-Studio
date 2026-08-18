"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserTodayDecisionApplication } from "../lib/application/browserTodayDecisionApplication.mjs";
import { createBrowserPlatformReviewApplication } from "../lib/application/browserPlatformReviewApplication.mjs";
import { createBrowserPlatformChangeRequestApplication } from "../lib/application/browserPlatformChangeRequestApplication.mjs";
import RevisionHistoryPanel from "./RevisionHistoryPanel";
import WorkspaceShell from "./WorkspaceShell";
import styles from "./TodayWorkspace.module.css";

const LOCAL_WORKSPACE_ID = "local-personal";
const MAX_CHANGE_REQUEST_LENGTH = 2000;

function titleCase(value) {
  return String(value || "").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function destinationLabel(value) {
  return value === "x" ? "X" : "LinkedIn";
}

function originLabel(item) {
  if (item.revisionOrigin === "edited") return "Owner edited";
  if (item.revisionOrigin === "ai_revised") return "AI revised";
  return "Generated";
}

function ReviewState({ item }) {
  return (
    <div className={styles.reviewState} aria-label="Quality checks">
      <span data-verdict={item.evidenceVerdict}>Evidence <strong>{titleCase(item.evidenceVerdict)}</strong></span>
      <span data-verdict={item.authenticityVerdict}>Authenticity <strong>{titleCase(item.authenticityVerdict)}</strong></span>
      {item.blockers > 0 && <span data-verdict="block">{item.blockers} blocker{item.blockers === 1 ? "" : "s"}</span>}
      {item.warnings > 0 && <span data-verdict="warn">{item.warnings} warning{item.warnings === 1 ? "" : "s"}</span>}
    </div>
  );
}

function RevisionPreview({ item }) {
  if (item.destination === "x" && item.format === "thread" && item.segments?.length) {
    return (
      <div className={styles.threadPreview}>
        {item.segments.map((segment, index) => <p key={`${item.platformVariantRevisionId}-${index}`}><span>{index + 1}</span>{segment}</p>)}
      </div>
    );
  }
  return <p className={styles.revisionCopy}>{item.content}</p>;
}

export default function TodayWorkspace() {
  const [decisions, setDecisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState(null);
  const [requestingId, setRequestingId] = useState("");
  const [changeRequest, setChangeRequest] = useState("");
  const [rejectingId, setRejectingId] = useState("");
  const [rejectNote, setRejectNote] = useState("");

  const todayApplication = useMemo(() => createBrowserTodayDecisionApplication({
    getStorage: () => window.localStorage,
    workspaceId: LOCAL_WORKSPACE_ID,
  }), []);
  const reviewApplication = useMemo(() => createBrowserPlatformReviewApplication({
    getStorage: () => window.localStorage,
    workspaceId: LOCAL_WORKSPACE_ID,
  }), []);
  const changeApplication = useMemo(() => createBrowserPlatformChangeRequestApplication({
    getStorage: () => window.localStorage,
    workspaceId: LOCAL_WORKSPACE_ID,
  }), []);

  const reload = useCallback(async () => {
    try {
      setDecisions(await todayApplication.listDecisions());
    } catch (error) {
      setMessage({ type: "error", text: error?.message || "SignalFlow could not reconstruct the decision inbox." });
    } finally {
      setLoading(false);
    }
  }, [todayApplication]);

  useEffect(() => { reload(); }, [reload]);

  async function decide(item, action, successText) {
    setBusyId(item.decisionId);
    setMessage(null);
    try {
      await action();
      await reload();
      setMessage({ type: "success", text: successText });
      return true;
    } catch (error) {
      await reload();
      setMessage({
        type: "error",
        text: error?.code === "stale_revision_context"
          ? "A newer revision became current after this decision loaded. SignalFlow refreshed Today instead of applying your judgment to unseen content."
          : (error?.message || "SignalFlow could not save that decision."),
      });
      return false;
    } finally {
      setBusyId("");
    }
  }

  async function approve(item) {
    await decide(
      item,
      () => reviewApplication.approveRevision(item.platformVariantId, item.platformVariantRevisionId, {
        expectedCurrentRevisionId: item.platformVariantRevisionId,
      }),
      `${destinationLabel(item.destination)} revision ${item.revisionNumber} is approved exactly.`,
    );
  }

  async function reject(event, item) {
    event.preventDefault();
    const saved = await decide(
      item,
      () => reviewApplication.rejectRevision(item.platformVariantId, item.platformVariantRevisionId, {
        expectedCurrentRevisionId: item.platformVariantRevisionId,
        note: rejectNote.trim(),
      }),
      `${destinationLabel(item.destination)} revision ${item.revisionNumber} is rejected. Its history is preserved.`,
    );
    if (saved) {
      setRejectingId("");
      setRejectNote("");
    }
  }

  async function requestChange(event, item) {
    event.preventDefault();
    const instruction = changeRequest.trim();
    if (!instruction) return;
    setBusyId(item.decisionId);
    setMessage(null);
    let revisionCreated = false;
    try {
      const visible = await reviewApplication.getReviewBundle(item.platformVariantId);
      if (visible.revision?.platformVariantRevisionId !== item.platformVariantRevisionId) {
        const error = new Error("A newer revision became current after this decision loaded.");
        error.code = "stale_revision_context";
        throw error;
      }
      await changeApplication.requestChange(item.platformVariantId, instruction);
      revisionCreated = true;
      await reviewApplication.reviewCurrentVariant(item.platformVariantId);
      await reload();
      setRequestingId("");
      setChangeRequest("");
      setMessage({ type: "success", text: "SignalFlow revised the exact draft and re-ran evidence/authenticity checks. The new revision is ready for your judgment." });
    } catch (error) {
      await reload();
      setMessage({
        type: "error",
        text: error?.code === "stale_revision_context"
          ? "A newer revision became current after this decision loaded. SignalFlow refreshed Today instead of changing unseen content."
          : revisionCreated
            ? `The new revision was saved, but its checks did not finish: ${error?.message || "review unavailable"}. It will not appear as approval-ready until checks complete.`
            : (error?.message || "SignalFlow could not apply that change request."),
      });
    } finally {
      setBusyId("");
    }
  }

  return (
    <WorkspaceShell activeItem="today" statusLabel="Decision inbox · Personal Alpha" statusTone="ready">
      <main className={styles.page} id="workspace-content">
        <header className={styles.heading}>
          <div>
            <p className={styles.eyebrow}>TODAY · YOUR JUDGMENT</p>
            <h1>Only the decisions that need you.</h1>
            <p>SignalFlow keeps the working context, planning, revisions and checks underneath. This surface asks for the final judgment.</p>
          </div>
          <Link className={styles.planLink} href="/plan">Advanced planning</Link>
        </header>

        {message && <div className={`${styles.message} ${styles[`message_${message.type}`] || ""}`} role="status">{message.text}</div>}

        {loading ? (
          <section className={styles.loading} aria-live="polite">Reconstructing what needs your judgment…</section>
        ) : decisions.length === 0 ? (
          <section className={styles.empty}>
            <span>ALL CLEAR</span>
            <h2>Nothing needs your judgment.</h2>
            <p>Reviewed drafts that need approval, a change, or rejection will appear here. You can keep working instead of watching a dashboard.</p>
            <div><Link href="/signals">Capture a signal</Link><Link href="/plan">Open Plan</Link></div>
          </section>
        ) : (
          <section className={styles.queue} aria-label="Decisions requiring owner judgment">
            <div className={styles.queueHeader}><span>NEEDS YOU</span><small>{decisions.length} decision{decisions.length === 1 ? "" : "s"}</small></div>
            {decisions.map((item) => {
              const busy = busyId === item.decisionId;
              const blocked = item.reviewVerdict === "block";
              const isRequesting = requestingId === item.decisionId;
              const isRejecting = rejectingId === item.decisionId;
              return (
                <article className={styles.decision} key={item.decisionId} data-recommended={item.recommendedAction}>
                  <div className={styles.decisionMeta}>
                    <div><span className={styles.destination}>{destinationLabel(item.destination)}</span><span>REVISION {item.revisionNumber}</span><span>{originLabel(item)}</span></div>
                    <ReviewState item={item} />
                  </div>

                  <div className={styles.contextLine}>
                    <span>WHY THIS NEEDS YOU</span>
                    <p>{item.why}</p>
                  </div>

                  <div className={styles.storyContext}>
                    <small>{item.sourceSignal?.headline || item.opportunity?.title || "Saved Signal"}</small>
                    <strong>{item.strategy.title || item.strategy.selectedAngle.title}</strong>
                    <p>{item.strategy.audienceTakeaway}</p>
                  </div>

                  <RevisionPreview item={item} />

                  {isRequesting ? (
                    <form className={styles.inlineForm} onSubmit={(event) => requestChange(event, item)}>
                      <label><span>WHAT SHOULD CHANGE?</span><textarea rows={3} maxLength={MAX_CHANGE_REQUEST_LENGTH} value={changeRequest} onChange={(event) => setChangeRequest(event.target.value)} placeholder="Make the opening less promotional, keep the architecture point, and shorten the ending." autoFocus /></label>
                      <div className={styles.formMeta}><small>SignalFlow will keep the destination, approved story plan, Voice snapshot and revision history, then re-run checks.</small><span>{changeRequest.length}/{MAX_CHANGE_REQUEST_LENGTH}</span></div>
                      <div className={styles.formActions}><button type="button" onClick={() => { setRequestingId(""); setChangeRequest(""); }} disabled={busy}>Cancel</button><button type="submit" className={styles.primaryAction} disabled={busy || !changeRequest.trim()}>{busy ? "Revising + checking…" : "Request change"}</button></div>
                    </form>
                  ) : isRejecting ? (
                    <form className={styles.inlineForm} onSubmit={(event) => reject(event, item)}>
                      <label><span>REJECTION NOTE · OPTIONAL</span><input value={rejectNote} onChange={(event) => setRejectNote(event.target.value)} placeholder="Why this exact revision should not be used" /></label>
                      <div className={styles.formActions}><button type="button" onClick={() => { setRejectingId(""); setRejectNote(""); }} disabled={busy}>Cancel</button><button type="submit" disabled={busy}>{busy ? "Rejecting…" : "Reject exact revision"}</button></div>
                    </form>
                  ) : (
                    <div className={styles.actions}>
                      <div className={styles.mainActions}>
                        <button type="button" className={blocked ? styles.secondaryAction : styles.primaryAction} onClick={() => approve(item)} disabled={busy || blocked}>{blocked ? "Resolve blockers first" : busy ? "Saving…" : "Approve"}</button>
                        <button type="button" className={blocked ? styles.primaryAction : styles.secondaryAction} onClick={() => { setRequestingId(item.decisionId); setChangeRequest(""); }} disabled={busy}>Request change</button>
                        <button type="button" className={styles.quietAction} onClick={() => { setRejectingId(item.decisionId); setRejectNote(""); }} disabled={busy}>Reject</button>
                      </div>
                    </div>
                  )}

                  <details className={styles.details}>
                    <summary>Details</summary>
                    <div className={styles.detailsGrid}>
                      <section><span>SOURCE</span><strong>{item.sourceSignal?.headline || "Signal"}</strong><p>{item.sourceSignal?.summary || "Canonical source context is preserved with the decision."}</p></section>
                      {item.opportunity && <section><span>OPPORTUNITY</span><strong>{item.opportunity.title} · {item.opportunity.score}/100</strong><p>{item.opportunity.whyNow}</p></section>}
                      <section><span>SELECTED ANGLE</span><strong>{item.strategy.selectedAngle.title}</strong><p>{item.strategy.selectedAngle.summary}</p></section>
                      <section><span>STRATEGY</span><strong>{item.strategy.coreIdea}</strong><p>{item.strategy.audienceTakeaway}</p></section>
                      <section><span>REVISION BINDING</span><strong>Strategy revision {item.strategy.strategyRevision}</strong><p>Voice snapshot {item.identityContextSnapshotId} · {originLabel(item)}</p></section>
                      <section><span>REVIEW</span><strong>{titleCase(item.reviewVerdict)}</strong><p>{item.evidenceSummary} {item.authenticitySummary}</p></section>
                    </div>
                    {item.findings.length > 0 && <div className={styles.findings}><span>FINDINGS</span>{item.findings.map((finding, index) => <p key={`${finding.code}-${index}`} data-severity={finding.severity}><strong>{titleCase(finding.severity)}</strong>{finding.message}</p>)}</div>}
                    <RevisionHistoryPanel
                      variantId={item.platformVariantId}
                      currentRevisionId={item.platformVariantRevisionId}
                      onChanged={reload}
                      context="today"
                    />
                    <div className={styles.detailLinks}>{item.opportunity?.opportunityId && <Link href={`/plan?opportunity=${encodeURIComponent(item.opportunity.opportunityId)}`}>Open full plan</Link>}</div>
                  </details>
                </article>
              );
            })}
          </section>
        )}
      </main>
    </WorkspaceShell>
  );
}
