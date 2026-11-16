"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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

function emptyPieceForm() {
  return { purpose: "", canonicalIntent: "", timingIntent: "", destinations: [] };
}

function destinationLabel(value) {
  return value === "x" ? "X" : label(value);
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
  const [showPieceForm, setShowPieceForm] = useState(false);
  const [pieceForm, setPieceForm] = useState(emptyPieceForm);
  const [activeContentPieceId, setActiveContentPieceId] = useState("");

  const opportunityId = entry?.opportunity?.opportunityId || "";
  const selectedAngleId = entry?.opportunity?.selectedAngleId || "";
  const allowedDestinations = useMemo(() => (
    (plan?.strategy?.destinationPlan || []).filter((item) => item.decision !== "exclude")
  ), [plan?.strategy?.destinationPlan]);
  const pieceBundles = plan?.pieceBundles?.length
    ? plan.pieceBundles
    : (plan?.contentPiece ? [{ contentPiece: plan.contentPiece, variants: plan.variants || [] }] : []);

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

  useEffect(() => {
    if (!pieceBundles.length) {
      setActiveContentPieceId("");
      return;
    }
    setActiveContentPieceId((current) => (
      current && pieceBundles.some(({ contentPiece }) => contentPiece.contentPieceId === current)
        ? current
        : pieceBundles[0].contentPiece.contentPieceId
    ));
  }, [pieceBundles.length, plan?.strategy?.narrativeStrategyId]);

  function focusContentPiece(contentPieceId) {
    if (!contentPieceId) return;
    setActiveContentPieceId(contentPieceId);
    requestAnimationFrame(() => {
      const target = document.getElementById(`hosted-content-piece-${contentPieceId}`);
      if (!target) return;
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: "start" });
    });
  }

  function togglePieceDestination(destination) {
    setPieceForm((current) => ({
      ...current,
      destinations: current.destinations.includes(destination)
        ? current.destinations.filter((item) => item !== destination)
        : [...current.destinations, destination],
    }));
  }

  async function addFollowUp(event) {
    event.preventDefault();
    if (!plan?.strategy) return;
    setStatus("revising");
    setMessage(null);
    try {
      const next = await application.addHostedContentPiece(entry, plan.strategy, pieceForm);
      setPlan(next);
      const newest = next.contentPieces?.[next.contentPieces.length - 1] || null;
      setPieceForm(emptyPieceForm());
      setShowPieceForm(false);
      setStatus("ready");
      setMessage({ type: "success", text: "Follow-up ContentPiece added to the canonical hosted plan. Its destination work is independent from the existing pieces." });
      if (newest) requestAnimationFrame(() => focusContentPiece(newest.contentPieceId));
    } catch (error) {
      setStatus("error");
      setMessage({ type: "error", text: error?.message || "SignalFlow could not add the hosted follow-up piece.", code: error?.code });
    }
  }

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

  async function setDestinationDecision(destination, decision) {
    if (!plan?.strategy || plan.strategy.status === "approved") return;
    setStatus("revising");
    setMessage(null);
    try {
      const destinationPlan = plan.strategy.destinationPlan.map((item) => (
        item.destination === destination ? { ...item, decision } : item
      ));
      const next = await application.reviseHostedPlan(entry, plan.strategy, { destinationPlan });
      setPlan(next);
      setStatus("ready");
      setMessage({
        type: "success",
        text: `${destination === "x" ? "X" : label(destination)} is now ${label(decision)}. The exact hosted strategy revision was updated before production.`,
      });
    } catch (error) {
      setStatus("error");
      setMessage({ type: "error", text: error?.message || "SignalFlow could not update this destination decision.", code: error?.code });
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

      <div className={styles.destinationRows} aria-label="Hosted strategy destination decisions">
        {strategy.destinationPlan.map((item) => (
          <div key={item.destination} data-decision={item.decision}>
            <strong>{item.destination === "x" ? "X" : label(item.destination)}</strong>
            {approved ? (
              <span>{label(item.decision)} · {item.format}</span>
            ) : (
              <label className={styles.destinationDecision}>
                <span className={styles.visuallyHidden}>Decision for {item.destination === "x" ? "X" : label(item.destination)}</span>
                <select
                  aria-label={`Decision for ${item.destination === "x" ? "X" : label(item.destination)}`}
                  value={item.decision}
                  onChange={(event) => setDestinationDecision(item.destination, event.target.value)}
                  disabled={status === "revising" || status === "approving" || status === "building"}
                >
                  <option value="include">Include</option>
                  <option value="optional">Optional</option>
                  <option value="exclude">Exclude</option>
                </select>
                <small>{item.format}</small>
              </label>
            )}
            <p>{item.reason}</p>
          </div>
        ))}
      </div>

      {approved && plan.contentPiece ? (
        <>
          <div className={styles.sequenceSection} aria-label="Hosted content sequence">
            <div className={styles.sequenceHeader}>
              <div>
                <span>CONTENT SEQUENCE</span>
                <p>Each piece is a separate communication unit with independent destination revisions. Order and timing intent are editorial planning only—not a publication schedule.</p>
              </div>
              <button type="button" onClick={() => setShowPieceForm((value) => !value)} disabled={status === "revising"}>
                {showPieceForm ? "Cancel" : "Add follow-up"}
              </button>
            </div>

            <div className={styles.sequenceList}>
              {pieceBundles.map(({ contentPiece }, index) => (
                <button
                  type="button"
                  key={contentPiece.contentPieceId}
                  data-active={contentPiece.contentPieceId === activeContentPieceId}
                  aria-pressed={contentPiece.contentPieceId === activeContentPieceId}
                  onClick={() => focusContentPiece(contentPiece.contentPieceId)}
                >
                  <span>{String(index + 1).padStart(2, "0")} · {label(contentPiece.sequenceRole)}</span>
                  <strong>{contentPiece.canonicalIntent}</strong>
                  <p>{contentPiece.purpose}</p>
                  <small>{contentPiece.timingIntent ? `Timing intent · ${contentPiece.timingIntent}` : "No exact timing set"}</small>
                </button>
              ))}
            </div>

            {showPieceForm && (
              <form className={styles.followUpForm} onSubmit={addFollowUp}>
                <label>
                  <span>PURPOSE</span>
                  <input value={pieceForm.purpose} onChange={(event) => setPieceForm((current) => ({ ...current, purpose: event.target.value }))} placeholder="e.g. Explain the implementation lesson" required />
                </label>
                <label>
                  <span>CANONICAL INTENT</span>
                  <textarea rows={3} value={pieceForm.canonicalIntent} onChange={(event) => setPieceForm((current) => ({ ...current, canonicalIntent: event.target.value }))} placeholder="What should this follow-up communicate independently?" required />
                </label>
                <label>
                  <span>TIMING INTENT · NOT A SCHEDULE</span>
                  <input value={pieceForm.timingIntent} onChange={(event) => setPieceForm((current) => ({ ...current, timingIntent: event.target.value }))} placeholder="e.g. after the launch explanation, if still useful" />
                </label>
                <fieldset>
                  <legend>DESTINATIONS</legend>
                  {allowedDestinations.map((item) => (
                    <label key={item.destination}>
                      <input type="checkbox" checked={pieceForm.destinations.includes(item.destination)} onChange={() => togglePieceDestination(item.destination)} />
                      <span>{destinationLabel(item.destination)}</span>
                    </label>
                  ))}
                </fieldset>
                <button type="submit" className={styles.primaryButton} disabled={status === "revising" || !pieceForm.purpose.trim() || !pieceForm.canonicalIntent.trim() || !pieceForm.destinations.length}>
                  {status === "revising" ? "Adding…" : "Add follow-up piece"}
                </button>
              </form>
            )}
          </div>

          <div className={styles.productionSequence}>
            {pieceBundles.map(({ contentPiece }, index) => (
              <section
                key={contentPiece.contentPieceId}
                id={`hosted-content-piece-${contentPiece.contentPieceId}`}
                className={styles.productionPiece}
                data-active={contentPiece.contentPieceId === activeContentPieceId}
                tabIndex={-1}
                onFocusCapture={() => setActiveContentPieceId(contentPiece.contentPieceId)}
              >
                <div className={styles.approvedState}>
                  <span>CONTENT PIECE {index + 1} · {label(contentPiece.sequenceRole)}</span>
                  <strong>{contentPiece.canonicalIntent}</strong>
                  <p>{contentPiece.purpose}{contentPiece.timingIntent ? ` · Timing intent: ${contentPiece.timingIntent}` : ""}</p>
                </div>
                <HostedPlatformDraftsPanel contentPiece={contentPiece} strategy={strategy} />
              </section>
            ))}
          </div>
        </>
      ) : (
        <div className={styles.actions}>
          <button type="button" className={styles.primaryButton} onClick={approve} disabled={status === "approving" || status === "building" || status === "revising"}>
            {status === "approving" ? "Approving…" : "Approve this strategy"}
          </button>
          <button type="button" onClick={rebuild} disabled={status === "approving" || status === "building" || status === "revising"}>Rebuild plan</button>
        </div>
      )}
    </section>
  );
}

export { strategyMatchesOpportunity };
