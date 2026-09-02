"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserPlanOpportunityApplication } from "../lib/application/browserPlanOpportunityApplication.mjs";
import styles from "./TodayOpportunityQueue.module.css";

const LOCAL_WORKSPACE_ID = "local-personal";

function titleCase(value) {
  return String(value || "").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function originLabel(origin) {
  return origin === "hosted" ? "Connected source" : "Direct create";
}

function destinationLabel(value) {
  return value === "x" ? "X" : value === "linkedin" ? "LinkedIn" : titleCase(value);
}

function mediaLabel(value) {
  return titleCase(String(value || "").replace(/^text_only$/, "text only"));
}

function isActionable(entry) {
  const opportunity = entry?.opportunity;
  return Boolean(
    opportunity
      && opportunity.recommendation === "post"
      && !opportunity.selectedAngleId
      && opportunity.status !== "converted_to_campaign",
  );
}

export default function TodayOpportunityQueue({ onStatus = () => {} }) {
  const [entries, setEntries] = useState([]);
  const [hostedState, setHostedState] = useState({ status: "ready", code: null });
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState("");

  const application = useMemo(() => createBrowserPlanOpportunityApplication({
    getStorage: () => window.localStorage,
    workspaceId: LOCAL_WORKSPACE_ID,
  }), []);

  const reload = useCallback(async () => {
    try {
      const result = await application.listRankedOpportunities();
      setEntries(result.entries.filter(isActionable));
      setHostedState(result.hostedState);
    } catch (error) {
      setEntries([]);
      onStatus({ type: "error", text: error?.message || "SignalFlow could not reconstruct today’s opportunity queue." });
    } finally {
      setLoading(false);
    }
  }, [application, onStatus]);

  useEffect(() => { void reload(); }, [reload]);

  async function mutate(entry, action, successText) {
    setBusyKey(entry.key);
    try {
      await action();
      await reload();
      onStatus({ type: "success", text: successText });
    } catch (error) {
      onStatus({ type: "error", text: error?.message || "SignalFlow could not save that opportunity judgment." });
    } finally {
      setBusyKey("");
    }
  }

  if (loading) {
    return <section className={styles.loading} aria-live="polite">Checking for work worth your attention…</section>;
  }

  if (!entries.length) {
    return hostedState.status === "error"
      ? <section className={styles.sourceNotice}>Connected-source opportunities are temporarily unavailable. Existing review decisions below remain usable.</section>
      : null;
  }

  return (
    <section className={styles.section} aria-label="Worth considering opportunities">
      <div className={styles.header}>
        <div>
          <span>WORTH CONSIDERING</span>
          <strong>{entries.length} opportunit{entries.length === 1 ? "y" : "ies"} need{entries.length === 1 ? "s" : ""} an editorial decision</strong>
        </div>
        <small>SignalFlow found these from ranked, unsnoozed opportunities. Nothing advances until you choose.</small>
      </div>

      {hostedState.status === "error" && <p className={styles.sourceNotice}>Connected-source opportunity refresh is unavailable; any visible direct-create opportunities remain actionable.</p>}

      <div className={styles.grid}>
        {entries.map((entry) => {
          const opportunity = entry.opportunity;
          const busy = busyKey === entry.key;
          const recommendedAngle = opportunity.candidateAngles?.find((angle) => angle.angleId === opportunity.recommendedAngleId) || null;
          const destinations = (opportunity.candidateDestinations || []).filter((item) => item.recommended).map((item) => destinationLabel(item.destination));
          const media = (opportunity.recommendedMediaTypes || []).filter((item) => item !== "none").map(mediaLabel);
          return (
            <article className={styles.card} key={entry.key}>
              <div className={styles.meta}>
                <span>{originLabel(entry.origin)}</span>
                <span>{titleCase(opportunity.freshnessState)}</span>
                <strong>{Math.round(Number(opportunity.score || 0))}/100</strong>
              </div>

              <h2>{opportunity.title}</h2>
              <p className={styles.summary}>{opportunity.summary}</p>

              <div className={styles.whyNow}>
                <span>WHY NOW</span>
                <p>{opportunity.whyNow}</p>
              </div>

              <div className={styles.assessments}>
                <div><span>Evidence</span><strong>{titleCase(opportunity.evidenceReadiness?.level)}</strong><p>{opportunity.evidenceReadiness?.reason}</p></div>
                <div><span>Repetition</span><strong>{titleCase(opportunity.repetitionRisk?.level)}</strong><p>{opportunity.repetitionRisk?.reason}</p></div>
              </div>

              <div className={styles.recommendation}>
                <div><span>SUGGESTED DIRECTION</span><strong>{recommendedAngle?.title || "Choose from the available narrative directions"}</strong></div>
                <div><span>LIKELY OUTPUT</span><strong>{[...destinations, ...media].join(" · ") || "Plan will resolve the final output"}</strong></div>
              </div>

              <div className={styles.actions}>
                <Link className={styles.primary} href={`/plan?opportunity=${encodeURIComponent(opportunity.opportunityId)}`}>See ideas</Link>
                <button type="button" onClick={() => mutate(entry, () => application.notNow(entry), "Opportunity snoozed for seven days. SignalFlow kept the source and project understanding intact.")} disabled={busy}>Later</button>
                <button type="button" className={styles.quiet} onClick={() => mutate(entry, () => application.rejectOpportunity(entry), "Opportunity ignored. The original Signal and evidence history remain intact.")} disabled={busy}>Ignore</button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
