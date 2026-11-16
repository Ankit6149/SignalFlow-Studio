"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserHostedGp2PreparationClient } from "../lib/infrastructure/browserHostedGp2PreparationClient.mjs";
import { createBrowserHostedPlatformReviewClient } from "../lib/infrastructure/browserHostedPlatformReviewClient.mjs";
import HostedPlatformRevisionReviewPanel from "./HostedPlatformRevisionReviewPanel";
import styles from "./CampaignPlanPanel.module.css";

function titleCase(value) {
  return String(value || "").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function destinationLabel(value) {
  return value === "x" ? "X" : value === "linkedin" ? "LinkedIn" : titleCase(value);
}

function revisionProvenance(revision) {
  if (!revision) return "";
  if (revision.origin === "edited") return `Owner edit · ${revision.editProvenance?.editedBy || "owner"}`;
  if (revision.origin === "media_rebound") return "Media rebound";
  const provider = revision.generationProvenance?.provider || "model route";
  const model = revision.generationProvenance?.model || "default model";
  return `${provider} · ${model}`;
}

function screenshotRequirement(strategy) {
  return (Array.isArray(strategy?.mediaRequirements) ? strategy.mediaRequirements : [])
    .find((item) => String(item?.type || "").trim().toLowerCase() === "screenshot") || null;
}

function screenshotAspectRatio(destination) {
  if (destination === "linkedin") return "4:5";
  if (destination === "x") return "16:9";
  return "1:1";
}

function screenshotMessage(result, destination) {
  const label = destinationLabel(destination);
  if (result.status === "bound" && result.autoReview?.status === "reviewed") return { type: "success", text: `${label} now has the exact screenshot derivative bound and automatic exact checks complete. The revision is ready in Today.` };
  if (result.status === "bound" && result.autoReview?.status === "already_reviewed") return { type: "success", text: `${label} now has the exact screenshot derivative bound and its current exact review is already available in Today.` };
  if (result.status === "bound" && result.autoReview?.status === "review_failed") return { type: "warning", text: `${label} now has the exact screenshot derivative bound, but automatic exact checks need a retry before owner judgment.` };
  if (result.status === "bound" && result.autoReview?.status === "deferred_required_media") return { type: "warning", text: `${label} media was bound, but another required media dependency still prevents exact review.` };
  if (result.status === "bound") return { type: "success", text: `${label} now has a new immutable revision with the exact automatic screenshot derivative bound for review.` };
  if (result.status === "quality_needs_review") return { type: "warning", text: `${label} screenshot was captured, but its quality needs review before it can become approval media.` };
  if (result.status === "quality_blocked") return { type: "error", text: `${label} screenshot was blocked by the quality/privacy gate and was not attached to the draft.` };
  if (result.status === "derivative_needs_review") return { type: "warning", text: `${label} screenshot derivative needs review before it can be attached.` };
  if (result.status === "derivative_blocked") return { type: "error", text: `${label} screenshot derivative was blocked and no media revision was created.` };
  if (result.status === "capture_retrying") return { type: "warning", text: `${label} capture is retrying from durable state; the current text revision remains unchanged.` };
  return { type: "warning", text: `${label} capture is still pending; the current text revision remains unchanged.` };
}

function destinationReviewStatus(entry, requiredScreenshot) {
  const variant = entry?.variant;
  const revision = entry?.currentRevision;
  if (!variant) return "Unavailable";
  if (variant.status === "omitted") return "Omitted";
  if (!revision) return variant.status === "failed" ? "Generation failed" : "Draft pending";
  if (requiredScreenshot?.required === true && !revision.mediaBindings?.length) return "Media pending";
  if (entry?.review?.approvalValid) return "Approved";
  if (entry?.review?.decision?.decision === "rejected" && entry.review.decision.platformVariantRevisionId === revision.platformVariantRevisionId) return "Rejected";
  const verdict = entry?.review?.review?.overallVerdict;
  if (verdict === "block") return "Blocked";
  if (entry?.review?.review) return "Needs judgment";
  return "Draft ready";
}

function preparationMessage(result) {
  if (!result) return null;
  if (result.status === "ready_for_judgment") {
    return { type: "success", text: "Automatic preparation is complete. Current exact reviewed revisions are ready in Today." };
  }
  if (result.status === "partial_failure") {
    return { type: "warning", text: "Some exact revisions are ready in Today. Remaining destination work is preserved below for recovery without invalidating the successful work." };
  }
  if (result.status === "recovery_required") {
    return { type: "warning", text: "Automatic preparation paused safely. Durable work is preserved; only the unresolved recovery action remains below." };
  }
  return null;
}

export default function HostedPlatformDraftsPanel({ contentPiece, strategy = null }) {
  const [bundle, setBundle] = useState(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState(null);
  const [activeVariantId, setActiveVariantId] = useState("");
  const client = useMemo(() => createBrowserHostedPlatformReviewClient(), []);
  const preparationClient = useMemo(() => createBrowserHostedGp2PreparationClient(), []);
  const contentPieceId = contentPiece?.contentPieceId || "";
  const requiredScreenshot = screenshotRequirement(strategy);
  const rows = bundle?.variants || [];

  const reload = useCallback(async () => {
    if (!contentPieceId) {
      setBundle(null);
      return;
    }
    try {
      setBundle(await client.getBundle(contentPieceId));
    } catch (error) {
      setMessage({ type: "error", code: error?.code || "", text: error?.message || "SignalFlow could not load the hosted platform review state." });
    }
  }, [client, contentPieceId]);

  useEffect(() => {
    let active = true;
    async function resumePreparation() {
      if (!contentPieceId) {
        if (active) setBundle(null);
        return;
      }
      setBusy("auto-prepare");
      setMessage(null);
      await reload();
      try {
        const result = await preparationClient.prepareContentPiece(contentPieceId);
        if (!active) return;
        const nextMessage = preparationMessage(result);
        if (nextMessage) setMessage(nextMessage);
        await reload();
      } catch (error) {
        if (!active) return;
        setMessage({
          type: "warning",
          code: error?.code || "",
          text: "Automatic preparation could not resume in this request. Durable work is preserved and the recovery controls below remain safe to use.",
        });
      } finally {
        if (active) setBusy("");
      }
    }
    void resumePreparation();
    return () => { active = false; };
  }, [contentPieceId, preparationClient, reload]);

  useEffect(() => {
    if (!rows.length) {
      setActiveVariantId("");
      return;
    }
    setActiveVariantId((current) => (
      current && rows.some(({ variant }) => variant.platformVariantId === current)
        ? current
        : (rows.find(({ variant }) => variant.status !== "omitted") || rows[0]).variant.platformVariantId
    ));
  }, [bundle, rows.length]);

  function focusDestination(platformVariantId) {
    if (!platformVariantId) return;
    setActiveVariantId(platformVariantId);
    requestAnimationFrame(() => {
      const target = document.getElementById(`hosted-review-${platformVariantId}`);
      if (!target) return;
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: "start" });
    });
  }

  function moveDestination(offset) {
    if (!rows.length) return;
    const currentIndex = Math.max(0, rows.findIndex(({ variant }) => variant.platformVariantId === activeVariantId));
    const nextIndex = Math.max(0, Math.min(rows.length - 1, currentIndex + offset));
    focusDestination(rows[nextIndex]?.variant.platformVariantId);
  }

  async function generateReady() {
    if (!contentPieceId) return;
    setBusy("generate");
    setMessage(null);
    try {
      const result = await client.generateReady(contentPieceId);
      setBundle(result.bundle);
      const reviewPreparation = result.reviewPreparation;
      const reviewFailures = reviewPreparation?.failed || [];
      if (result.failed.length && result.generated.length) {
        setMessage({
          type: "warning",
          text: `${result.generated.length} hosted draft${result.generated.length === 1 ? "" : "s"} generated. ${result.failed.map((item) => destinationLabel(item.destination)).join(", ")} failed without invalidating the successful revision.`,
        });
      } else if (result.failed.length) {
        setMessage({ type: "error", text: result.failed.map((item) => `${destinationLabel(item.destination)}: ${item.message}`).join(" ") });
      } else if (reviewFailures.length) {
        setMessage({ type: "warning", text: `Hosted drafts are durable, but ${reviewFailures.length} automatic exact review${reviewFailures.length === 1 ? "" : "s"} need recovery before owner judgment.` });
      } else if (reviewPreparation?.deferredCount) {
        setMessage({ type: "success", text: "Hosted drafts are durable. Required visual proof will be bound before SignalFlow runs the final exact checks." });
      } else if (reviewPreparation?.reviewedCount || result.generated.length) {
        setMessage({ type: "success", text: "Hosted drafts are durable and automatic exact checks are complete. Reviewed revisions are ready in Today." });
      } else {
        setMessage({ type: "success", text: "Every non-omitted hosted destination already has a current durable revision and exact review is up to date." });
      }
      await reload();
    } catch (error) {
      setMessage({ type: "error", code: error?.code || "", text: error?.message || "SignalFlow could not generate the hosted platform drafts." });
    } finally {
      setBusy("");
    }
  }

  async function produceScreenshot(entry) {
    const { variant, currentRevision } = entry;
    if (!currentRevision) return;
    const busyKey = `screenshot:${variant.platformVariantId}`;
    setBusy(busyKey);
    setMessage(null);
    try {
      const result = await client.produceScreenshot(variant.platformVariantId, {
        expectedCurrentRevisionId: currentRevision.platformVariantRevisionId,
        aspectRatio: screenshotAspectRatio(variant.destination),
      });
      setMessage(screenshotMessage(result, variant.destination));
      await reload();
    } catch (error) {
      if (error?.code === "stale_revision_context") await reload();
      setMessage({
        type: "error",
        code: error?.code || "",
        text: error?.message || `SignalFlow could not prepare the ${destinationLabel(variant.destination)} screenshot evidence.`,
      });
    } finally {
      setBusy("");
    }
  }

  if (!contentPieceId) return null;

  const pending = rows.filter(({ variant, currentRevision }) => variant.status !== "omitted" && !currentRevision).length;
  const loading = !bundle;
  const automaticallyPreparing = busy === "auto-prepare";

  return (
    <div className={styles.productionStage} aria-label="Hosted platform draft review" aria-busy={automaticallyPreparing}>
      <div className={styles.approvedState}>
        <div>
          <span>HOSTED CONTENT PIECE · DURABLE</span>
          <strong>{automaticallyPreparing ? "SignalFlow is continuing preparation…" : loading ? "Loading canonical platform state…" : pending ? `${pending} destination draft${pending === 1 ? "" : "s"} still need recovery.` : "Current hosted drafts are available for exact review."}</strong>
          <p>Connected-source drafts, revisions, critic results and owner judgments are persisted on the server. Browser refresh does not become a new source of truth.</p>
          {requiredScreenshot && <p>Strategy media requirement: screenshot · {requiredScreenshot.reason || "Visible product proof is useful for this story."}</p>}
        </div>
        {!loading && pending > 0 && !automaticallyPreparing && <button type="button" className={styles.generateButton} onClick={generateReady} disabled={Boolean(busy)}>{busy === "generate" ? "Generating…" : `Retry ${pending} draft${pending === 1 ? "" : "s"}`}</button>}
      </div>

      {message && <div className={`${styles.message} ${styles[`message_${message.type}`] || ""}`} role="status">{message.text}</div>}

      {!loading && (
        <div className={styles.draftStage}>
          <div className={styles.subhead}><span>CONNECTED-SOURCE REVIEW · EXACT REVISIONS</span><p>SignalFlow runs exact evidence/authenticity checks automatically when the revision is judgment-ready. Required media is bound first; manual controls remain only as recovery.</p></div>
          {rows.length > 1 && (
            <nav className={styles.reviewNavigator} aria-label="Destination review navigation">
              <div className={styles.reviewNavList}>
                {rows.map((entry) => {
                  const variantId = entry.variant.platformVariantId;
                  const active = variantId === activeVariantId;
                  return (
                    <button
                      type="button"
                      key={variantId}
                      data-active={active}
                      aria-pressed={active}
                      onClick={() => focusDestination(variantId)}
                    >
                      <strong>{destinationLabel(entry.variant.destination)}</strong>
                      <small>{destinationReviewStatus(entry, requiredScreenshot)}</small>
                    </button>
                  );
                })}
              </div>
              <div className={styles.reviewNavActions}>
                <button type="button" onClick={() => moveDestination(-1)} disabled={!activeVariantId || rows.findIndex(({ variant }) => variant.platformVariantId === activeVariantId) <= 0}>Previous</button>
                <span>{Math.max(1, rows.findIndex(({ variant }) => variant.platformVariantId === activeVariantId) + 1)} of {rows.length}</span>
                <button type="button" onClick={() => moveDestination(1)} disabled={!activeVariantId || rows.findIndex(({ variant }) => variant.platformVariantId === activeVariantId) >= rows.length - 1}>Next</button>
              </div>
            </nav>
          )}
          {rows.map((entry) => {
            const { variant, currentRevision, history } = entry;
            const screenshotBusy = busy === `screenshot:${variant.platformVariantId}`;
            const needsScreenshot = Boolean(requiredScreenshot && currentRevision && !currentRevision.mediaBindings?.length);
            const requiredMediaPending = Boolean(requiredScreenshot?.required === true && needsScreenshot);
            return (
              <article
                className={styles.draftRow}
                key={variant.platformVariantId}
                id={`hosted-review-${variant.platformVariantId}`}
                data-status={variant.status}
                data-active={variant.platformVariantId === activeVariantId}
                tabIndex={-1}
                onFocusCapture={() => setActiveVariantId(variant.platformVariantId)}
              >
                <div className={styles.draftMeta}>
                  <strong>{destinationLabel(variant.destination)}</strong>
                  <span>{titleCase(variant.status)}</span>
                  {currentRevision && <small>revision {currentRevision.revisionNumber} · strategy r{currentRevision.strategyRevision}</small>}
                </div>

                {variant.status === "omitted" ? (
                  <p className={styles.draftPlaceholder}>{variant.omittedReason || "This destination is intentionally absent from the approved plan."}</p>
                ) : currentRevision ? (
                  <div className={styles.draftContent}>
                    {currentRevision.format === "thread" ? (
                      <ol>{currentRevision.segments.map((segment, index) => <li key={`${currentRevision.platformVariantRevisionId}-${index}`}><b>{index + 1}</b><p>{segment}</p></li>)}</ol>
                    ) : <p>{currentRevision.content}</p>}
                    <small>{revisionProvenance(currentRevision)} · {history.length} saved revision{history.length === 1 ? "" : "s"}</small>
                    {needsScreenshot && !automaticallyPreparing && (
                      <button
                        type="button"
                        className={styles.generateButton}
                        onClick={() => produceScreenshot(entry)}
                        disabled={Boolean(busy)}
                      >
                        {screenshotBusy ? "Preparing visual proof…" : "Retry visual proof"}
                      </button>
                    )}
                    <HostedPlatformRevisionReviewPanel entry={entry} client={client} onChanged={reload} requiredMediaPending={requiredMediaPending} />
                  </div>
                ) : (
                  <div>
                    <p className={styles.draftPlaceholder}>{variant.status === "failed" ? "Generation failed for this destination. Other successful destination revisions remain intact." : "No durable generated revision exists yet."}</p>
                    {!automaticallyPreparing && <button type="button" className={styles.generateButton} onClick={generateReady} disabled={Boolean(busy)}>{busy === "generate" ? "Generating…" : "Retry available drafts"}</button>}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

export { preparationMessage, screenshotAspectRatio, screenshotRequirement };
