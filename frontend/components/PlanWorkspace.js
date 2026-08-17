"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserContentOpportunityApplication } from "../lib/application/browserContentOpportunityApplication.mjs";
import WorkspaceShell from "./WorkspaceShell";
import styles from "./PlanWorkspace.module.css";

const LOCAL_WORKSPACE_ID = "local-personal";

function formatScore(value) {
  const score = Math.max(0, Math.min(100, Number(value || 0)));
  return `${Math.round(score)}`;
}

function titleCase(value) {
  return String(value || "").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function PlanWorkspace() {
  const [opportunities, setOpportunities] = useState([]);
  const [activeId, setActiveId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [customAngle, setCustomAngle] = useState("");

  const application = useMemo(() => createBrowserContentOpportunityApplication({
    getStorage: () => window.localStorage,
    workspaceId: LOCAL_WORKSPACE_ID,
  }), []);

  const reload = useCallback(async () => {
    try {
      const next = await application.listRankedOpportunities({ includeRejected: true });
      setOpportunities(next);
      const requested = typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("opportunity")
        : "";
      setActiveId((current) => {
        if (requested && next.some((item) => item.opportunityId === requested)) return requested;
        if (current && next.some((item) => item.opportunityId === current)) return current;
        return next.find((item) => item.status !== "rejected")?.opportunityId || next[0]?.opportunityId || "";
      });
    } catch (error) {
      setMessage({ type: "error", text: error?.message || "SignalFlow could not load the opportunity plan." });
    }
  }, [application]);

  useEffect(() => {
    reload();
  }, [reload]);

  const active = opportunities.find((item) => item.opportunityId === activeId) || null;
  const selectedAngle = active
    ? active.selectedAngleId === "custom"
      ? active.customAngle
      : active.candidateAngles.find((angle) => angle.angleId === active.selectedAngleId) || null
    : null;

  async function run(action, successText = "") {
    setBusy(true);
    setMessage(null);
    try {
      const result = await action();
      await reload();
      if (successText) setMessage({ type: "success", text: successText });
      return result;
    } catch (error) {
      setMessage({ type: "error", text: error?.message || "The opportunity could not be updated." });
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function chooseAngle(angleId) {
    if (!active) return;
    await run(() => application.selectAngle(active.opportunityId, angleId), "Narrative direction saved. SignalFlow can build the campaign strategy from this exact choice next.");
  }

  async function saveCustomAngle(event) {
    event.preventDefault();
    if (!active || !customAngle.trim()) return;
    const saved = await run(
      () => application.setCustomAngle(active.opportunityId, { summary: customAngle.trim(), approach: customAngle.trim() }),
      "Your custom narrative direction is now the selected angle.",
    );
    if (saved) setCustomAngle("");
  }

  async function refreshEvaluation() {
    if (!active?.signalIds?.[0]) return;
    const next = await run(() => application.evaluateSignal(active.signalIds[0], { refresh: true }), "Opportunity re-evaluated from the current Signal revision.");
    if (next) setActiveId(next.opportunityId);
  }

  return (
    <WorkspaceShell activeItem="plan" statusLabel="Editorial planning · Personal Alpha" statusTone="ready">
      <main className={styles.page} id="workspace-content">
        <header className={styles.heading}>
          <div>
            <p className={styles.eyebrow}>PLAN · EDITORIAL JUDGMENT</p>
            <h1>Choose the story before SignalFlow writes the post.</h1>
            <p>Opportunities are persisted decisions, not temporary model output. Pick a direction, write your own, or decide this topic should not become content.</p>
          </div>
          <Link className={styles.captureLink} href="/signals">+ Capture another signal</Link>
        </header>

        {message && <div className={`${styles.message} ${styles[`message_${message.type}`] || ""}`} role="status">{message.text}</div>}

        {!opportunities.length ? (
          <section className={styles.empty}>
            <span>NO OPPORTUNITIES YET</span>
            <h2>Start with something you actually want to talk about.</h2>
            <p>Capture a thought, lesson, update, decision, or topic. From the Signal, ask SignalFlow to find worthwhile narrative directions.</p>
            <Link href="/signals">Capture a signal</Link>
          </section>
        ) : (
          <div className={styles.layout}>
            <aside className={styles.inbox} aria-label="Opportunity inbox">
              <div className={styles.inboxTitle}><span>OPPORTUNITIES</span><small>{opportunities.length} saved</small></div>
              <div className={styles.inboxList}>
                {opportunities.map((item) => (
                  <button
                    key={item.opportunityId}
                    type="button"
                    className={`${styles.inboxItem} ${item.opportunityId === activeId ? styles.inboxItemActive : ""}`}
                    onClick={() => setActiveId(item.opportunityId)}
                    aria-current={item.opportunityId === activeId ? "true" : undefined}
                  >
                    <span className={styles.inboxScore}>{formatScore(item.score)}</span>
                    <span><strong>{item.title}</strong><small>{titleCase(item.recommendation)} · {titleCase(item.status)}</small></span>
                  </button>
                ))}
              </div>
            </aside>

            {active && (
              <div className={styles.detail}>
                <section className={styles.opportunityHero}>
                  <div className={styles.heroMeta}>
                    <span className={styles.recommendation} data-value={active.recommendation}>{active.recommendation === "post" ? "WORTH CONSIDERING" : active.recommendation.toUpperCase()}</span>
                    <span>{titleCase(active.freshnessState)}</span>
                  </div>
                  <div className={styles.heroGrid}>
                    <div>
                      <h2>{active.title}</h2>
                      <p className={styles.summary}>{active.summary}</p>
                      <div className={styles.whyNow}><span>WHY NOW</span><p>{active.whyNow}</p></div>
                    </div>
                    <div className={styles.scorePanel}>
                      <strong>{formatScore(active.score)}</strong>
                      <span>editorial score</span>
                      <small>{Math.round(active.confidence * 100)}% evaluation confidence</small>
                    </div>
                  </div>
                </section>

                <section className={styles.signalChecks} aria-label="Opportunity assessment">
                  <div><span>Evidence</span><strong>{titleCase(active.evidenceReadiness.level)}</strong><p>{active.evidenceReadiness.reason}</p></div>
                  <div><span>Narrative fit</span><strong>{titleCase(active.narrativeFit.level)}</strong><p>{active.narrativeFit.reason}</p></div>
                  <div><span>Repetition</span><strong>{titleCase(active.repetitionRisk.level)}</strong><p>{active.repetitionRisk.reason}</p></div>
                </section>

                <section className={styles.destinations}>
                  <div className={styles.sectionTitle}><span>DESTINATION FIT</span><p>Only destinations that belong in this first proof are considered.</p></div>
                  <div className={styles.destinationRows}>
                    {active.candidateDestinations.length ? active.candidateDestinations.map((item) => (
                      <div key={item.destination} className={styles.destinationRow}>
                        <strong>{item.destination === "x" ? "X" : "LinkedIn"}</strong>
                        <span>{item.recommended ? "Recommended" : "Optional"}</span>
                        <p>{item.reason}</p>
                        <small>{item.format}</small>
                      </div>
                    )) : <p className={styles.muted}>No destination is recommended for this opportunity yet.</p>}
                  </div>
                </section>

                <section className={styles.angles}>
                  <div className={styles.sectionTitle}>
                    <span>NARRATIVE DIRECTIONS</span>
                    <p>Choose the reason/story you actually want to tell. This decision will become strategy state before generation.</p>
                  </div>
                  {active.recommendation === "post" && active.candidateAngles.length > 0 ? (
                    <div className={styles.angleGrid}>
                      {active.candidateAngles.map((angle, index) => {
                        const chosen = active.selectedAngleId === angle.angleId;
                        return (
                          <button
                            key={angle.angleId}
                            type="button"
                            className={`${styles.angleCard} ${chosen ? styles.angleCardSelected : ""}`}
                            onClick={() => chooseAngle(angle.angleId)}
                            disabled={busy}
                          >
                            <small>0{index + 1}</small>
                            <strong>{angle.title}</strong>
                            <p>{angle.summary}</p>
                            <span>{chosen ? "Selected" : "Choose this direction"}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className={styles.skipNote}>SignalFlow is not recommending content from this Signal right now. You can refresh the evaluation or capture more context instead of filling a calendar slot.</div>
                  )}

                  <form className={styles.customAngle} onSubmit={saveCustomAngle}>
                    <div><span>SOMETHING ELSE…</span><p>Write the direction in your own words. SignalFlow should adapt to the judgment, not force one of its suggestions.</p></div>
                    <textarea value={customAngle} onChange={(event) => setCustomAngle(event.target.value)} rows={3} placeholder="e.g. I don't want a launch update. Explain the privacy trade-off that made us change the architecture." />
                    <button type="submit" disabled={busy || !customAngle.trim()}>Use my direction</button>
                  </form>
                </section>

                <footer className={styles.detailFooter}>
                  <div>
                    {selectedAngle ? <><span>SELECTED DIRECTION</span><strong>{selectedAngle.title || "Something else"}</strong><p>{selectedAngle.summary}</p></> : <><span>NEXT DECISION</span><strong>Select a narrative direction</strong><p>Campaign strategy is deliberately not generated until this editorial choice exists.</p></>}
                  </div>
                  <div className={styles.footerActions}>
                    <button type="button" onClick={refreshEvaluation} disabled={busy}>Re-evaluate</button>
                    {active.status !== "rejected" && <button type="button" className={styles.quietButton} onClick={() => run(() => application.rejectOpportunity(active.opportunityId), "Opportunity rejected. The original Signal remains in history.")} disabled={busy}>Not worth posting</button>}
                  </div>
                </footer>
              </div>
            )}
          </div>
        )}
      </main>
    </WorkspaceShell>
  );
}
