"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import HostedPlatformDraftsPanel from "./HostedPlatformDraftsPanel";
import styles from "./HostedCampaignPlanPanel.module.css";

function label(value) {
  return String(value || "").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function currentAngle(opportunity) {
  if (!opportunity?.selectedAngleId) return null;
  if (opportunity.selectedAngleId === "custom") return opportunity.customAngle
    ? { angleId: "custom", title: opportunity.customAngle.title || "Something else", summary: opportunity.customAngle.summary || "", approach: opportunity.customAngle.approach || opportunity.customAngle.summary || "" }
    : null;
  const selected = opportunity.candidateAngles?.find((item) => item.angleId === opportunity.selectedAngleId);
  return selected ? { angleId: selected.angleId, title: selected.title || "", summary: selected.summary || "", approach: selected.approach || selected.summary || "" } : null;
}

function strategyMatchesOpportunity(strategy, opportunity) {
  if (!strategy) return false;
  const angle = currentAngle(opportunity);
  if (!angle) return false;
  return strategy.selectedAngle?.angleId === angle.angleId
    && String(strategy.selectedAngle?.title || "") === String(angle.title || "")
    && String(strategy.selectedAngle?.summary || "") === String(angle.summary || "")
    && String(strategy.selectedAngle?.approach || "") === String(angle.approach || "");
}

export default function HostedCampaignPlanPanel({ application, entry }) {
  const [plan, setPlan] = useState(null);
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState(null);

  const opportunityId = entry?.opportunity?.opportunityId || "";
  const selectedAngleId = entry?.opportunity?.selectedAngleId || "";

  useEffect(() => {
    let active = true;
    async function load() {
      if (!opportunityId || !selectedAngleId) {
        if (active) {
          setPlan(null);
          setStatus("idle");
        }
        return;
      }
      setStatus("loading");
      setMessage(null);
      try {
        let next = await application.getHostedPlan(entry);
        if (!strategyMatchesOpportunity(next.strategy, entry.opportunity)) {
          setStatus("building");
          next = await application.buildHostedPlan(entry);
        }
        if (!active) return;
        setPlan(next);
        setStatus("ready");
      } catch (error) {
        if (!active) return;
        setStatus(error?.code === "voice_profile_required" ? "voice_required" : "error");
        setMessage({
          type: "error",
          text: error?.message || "SignalFlow could not build the hosted narrative plan.",
          code: error?.code || "hosted_planning_failed",
        });
      }
    }
    void load();
    return () => { active = false; };
  }, [application, entry, opportunityId, selectedAngleId]);

  async function rebuild() {
    setStatus("building");
    setMessage(null);
    try {
      const next = await application.buildHostedPlan(entry, { refresh: true });
      setPlan(next);
      setStatus("ready");
      setMessage({ type: "success", text: "Narrative plan rebuilt from the current hosted Opportunity and explicit Voice." });
    } catch (error) {
      setStatus(error?.code === "voice_profile_required" ? "voice_required" : "error");
      setMessage({ type: "error", text: error?.message || "SignalFlow could not rebuild the narrative plan.", code: error?.code });
    }
  }

  async function approve() {
    if (!plan?.strategy) return;
    setStatus("approving");
    setMessage(null);
    try {
      const next = await application.approveHostedPlan(entry, plan.strategy, {
        reason: "Owner approved the exact visible hosted NarrativeStrategy.",
      });
      setPlan(next);
      setStatus("ready");
      setMessage({ type: "success", text: "Exact strategy approved. SignalFlow is continuing destination generation, required visual proof and exact checks automatically. Anything still shown below is recovery work, not a routine next step." });
    } catch (error) {
      setStatus("error");
      setMessage({ type: "error", text: error?.message || "SignalFlow could not approve this narrative plan.", code: error?.code });
    }
  }

  if (!selectedAngleId) return null;

  if (status === "voice_required") {
    return (
      <section className={styles.panel} aria-label="Hosted narrative planning">
        <span className={styles.eyebrow}>CONNECTED-SOURCE PLAN · VOICE REQUIRED</span>
        <h3>One explicit Voice setup is needed before automatic writing continues.</h3>
        <p>{message?.text}</p>
        <Link className={styles.primaryLink} href="/voice">Set up Voice</Link>
      </section>
    );
  }

  if (["loading", "building"].includes(status) && !plan?.strategy) {
    return (
      <section className={styles.panel} aria-label="Hosted narrative planning" aria-busy="true">
        <span className={styles.eyebrow}>CONNECTED-SOURCE PLAN</span>
        <h3>{status === "building" ? "Building the narrative plan…" : "Checking the current narrative plan…"}</h3>
        <p>SignalFlow is using the exact hosted Opportunity, source privacy classification and explicit Voice. The connected-source record remains canonical on the server.</p>
      </section>
    );
  }

  if (status === "error" && !plan?.strategy) {
    return (
      <section className={styles.panel} aria-label="Hosted narrative planning">
        <span className={styles.eyebrow}>CONNECTED-SOURCE PLAN · NEEDS ATTENTION</span>
        <h3>Project context and your Opportunity are safe.</h3>
        <p>{message?.text}</p>
        <button type="button" onClick={rebuild}>Retry planning</button>
      </section>
    );
  }

  const strategy = plan?.strategy;
  if (!strategy) return null;
  const approved = strategy.status === "approved";

  return (
    <section className={styles.panel} aria-label="Hosted narrative planning">
      <div className={styles.headingRow}>
        <div>
          <span className={styles.eyebrow}>CONNECTED-SOURCE PLAN · {approved ? "APPROVED" : "READY FOR JUDGMENT"}</span>
          <h3>{strategy.title}</h3>
          <p>{strategy.coreIdea}</p>
        </div>
        <span className={styles.revision}>Strategy v{strategy.strategyRevision}</span>
      </div>

      {message && <div className={styles.message} data-type={message.type} role="status">{message.text}</div>}

      <div className={styles.summaryGrid}>
        <div><span>AUDIENCE TAKEAWAY</span><p>{strategy.audienceTakeaway}</p></div>
        <div><span>HOOK DIRECTION</span><p>{strategy.hookDirection || "No forced hook; follow the selected story."}</p></div>
      </div>

      <div className={styles.sectionBlock}>
        <span>NARRATIVE ARC</span>
        <ol>{strategy.narrativeArc.map((beat) => <li key={beat}>{beat}</li>)}</ol>
      </div>

      <div className={styles.summaryGrid}>
        <div className={styles.sectionBlock}>
          <span>EVIDENCE PLAN</span>
          {strategy.evidencePlan.length ? <ul>{strategy.evidencePlan.map((item) => <li key={item}>{item}</li>)}</ul> : <p>No additional evidence instruction was required.</p>}
        </div>
        <div className={styles.sectionBlock}>
          <span>BOUNDARIES</span>
          {strategy.boundaryConstraints.length ? <ul>{strategy.boundaryConstraints.map((item) => <li key={item}>{item}</li>)}</ul> : <p>Explicit global and project boundaries still apply.</p>}
        </div>
      </div>

      <div className={styles.destinationRows}>
        {strategy.destinationPlan.map((item) => (
          <div key={item.destination}>
            <strong>{item.destination === "x" ? "X" : label(item.destination)}</strong>
            <span>{label(item.decision)} · {item.format}</span>
            <p>{item.reason}</p>
          </div>
        ))}
      </div>

      {approved && plan.contentPiece ? (
        <>
          <div className={styles.approvedState}>
            <span>CANONICAL CONTENT PIECE</span>
            <strong>{plan.contentPiece.canonicalIntent}</strong>
            <p>The exact approved strategy is durable. SignalFlow automatically prepares non-omitted LinkedIn/X revisions, required screenshot proof and exact critics. Controls appear below only when preserved work needs recovery or owner correction.</p>
          </div>
          <HostedPlatformDraftsPanel contentPiece={plan.contentPiece} strategy={strategy} />
        </>
      ) : (
        <div className={styles.actions}>
          <button type="button" className={styles.primaryButton} onClick={approve} disabled={status === "approving" || status === "building"}>
            {status === "approving" ? "Approving…" : "Approve this strategy"}
          </button>
          <button type="button" onClick={rebuild} disabled={status === "approving" || status === "building"}>Rebuild plan</button>
        </div>
      )}
    </section>
  );
}

export { strategyMatchesOpportunity };
