"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

export default function HostedPlatformDraftsPanel({ contentPiece }) {
  const [bundle, setBundle] = useState(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState(null);
  const client = useMemo(() => createBrowserHostedPlatformReviewClient(), []);
  const contentPieceId = contentPiece?.contentPieceId || "";

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

  useEffect(() => { void reload(); }, [reload]);

  async function generateReady() {
    if (!contentPieceId) return;
    setBusy("generate");
    setMessage(null);
    try {
      const result = await client.generateReady(contentPieceId);
      setBundle(result.bundle);
      if (result.failed.length && result.generated.length) {
        setMessage({
          type: "warning",
          text: `${result.generated.length} hosted draft${result.generated.length === 1 ? "" : "s"} generated. ${result.failed.map((item) => destinationLabel(item.destination)).join(", ")} failed without invalidating the successful revision.`,
        });
      } else if (result.failed.length) {
        setMessage({ type: "error", text: result.failed.map((item) => `${destinationLabel(item.destination)}: ${item.message}`).join(" ") });
      } else if (result.generated.length) {
        setMessage({ type: "success", text: "Hosted platform drafts are now durable immutable revisions. Review each exact revision independently." });
      } else {
        setMessage({ type: "success", text: "Every non-omitted hosted destination already has a current durable revision." });
      }
      await reload();
    } catch (error) {
      setMessage({ type: "error", code: error?.code || "", text: error?.message || "SignalFlow could not generate the hosted platform drafts." });
    } finally {
      setBusy("");
    }
  }

  if (!contentPieceId) return null;

  const rows = bundle?.variants || [];
  const pending = rows.filter(({ variant, currentRevision }) => variant.status !== "omitted" && !currentRevision).length;
  const loading = !bundle;

  return (
    <div className={styles.productionStage} aria-label="Hosted platform draft review">
      <div className={styles.approvedState}>
        <div>
          <span>HOSTED CONTENT PIECE · DURABLE</span>
          <strong>{loading ? "Loading canonical platform state…" : pending ? `${pending} destination draft${pending === 1 ? "" : "s"} still need generation.` : "Current hosted drafts are available for exact review."}</strong>
          <p>Connected-source drafts, revisions, critic results and owner judgments are persisted on the server. Browser refresh does not become a new source of truth.</p>
        </div>
        {!loading && pending > 0 && <button type="button" className={styles.generateButton} onClick={generateReady} disabled={Boolean(busy)}>{busy === "generate" ? "Generating…" : `Generate ${pending} draft${pending === 1 ? "" : "s"}`}</button>}
      </div>

      {message && <div className={`${styles.message} ${styles[`message_${message.type}`] || ""}`} role="status">{message.text}</div>}

      {!loading && (
        <div className={styles.draftStage}>
          <div className={styles.subhead}><span>CONNECTED-SOURCE REVIEW · EXACT REVISIONS</span><p>Every judgment is pinned to the visible immutable revision. Media-bound approvals additionally require a signed proof that every exact private AssetVersion was actually rendered.</p></div>
          {rows.map((entry) => {
            const { variant, currentRevision, history } = entry;
            return (
              <article className={styles.draftRow} key={variant.platformVariantId} data-status={variant.status}>
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
                    <HostedPlatformRevisionReviewPanel entry={entry} client={client} onChanged={reload} />
                  </div>
                ) : (
                  <div>
                    <p className={styles.draftPlaceholder}>{variant.status === "failed" ? "Generation failed for this destination. Other successful destination revisions remain intact." : "No durable generated revision exists yet."}</p>
                    <button type="button" className={styles.generateButton} onClick={generateReady} disabled={Boolean(busy)}>{busy === "generate" ? "Generating…" : "Generate available drafts"}</button>
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
