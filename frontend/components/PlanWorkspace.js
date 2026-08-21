"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserPlanOpportunityApplication } from "../lib/application/browserPlanOpportunityApplication.mjs";
import CampaignPlanPanel from "./CampaignPlanPanel";
import WorkspaceShell from "./WorkspaceShell";
import styles from "./PlanWorkspace.module.css";
import judgmentStyles from "./HostedOpportunityJudgment.module.css";

const LOCAL_WORKSPACE_ID = "local-personal";

function formatScore(value) {
  const score = Math.max(0, Math.min(100, Number(value || 0)));
  return `${Math.round(score)}`;
}

function titleCase(value) {
  return String(value || "").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function originLabel(origin) {
  return origin === "hosted" ? "Connected source" : "Direct create";
}

export default function PlanWorkspace() {
  const [opportunities, setOpportunities] = useState([]);
  const [activeKey, setActiveKey] = useState("");
  const [hostedState, setHostedState] = useState({ status: "ready", code: null });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [customAngle, setCustomAngle] = useState("");

  const application = useMemo(() => createBrowserPlanOpportunityApplication({
    getStorage: () => window.localStorage,
    workspaceId: LOCAL_WORKSPACE_ID,
  }), []);

  const reload = useCallback(async () => {
    try {
      const result = await application.listRankedOpportunities({ includeRejected: true });
      const next = result.entries;
      setOpportunities(next);
      setHostedState(result.hostedState);
      const requested = typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("opportunity")
        : "";
      setActiveKey((current) => {
        if (requested) {
          const matched = next.find((entry) => entry.key === requested || entry.opportunity.opportunityId === requested);
          if (matched) return matched.key;
        }
        if (current && next.some((entry) => entry.key === current)) return current;
        return next.find((entry) => entry.opportunity.status !== "rejected")?.key || next[0]?.key || "";
      });
    } catch (error) {
      setMessage({ type: "error", text: error?.message || "SignalFlow could not load the opportunity plan." });
    }
  }, [application]);

  useEffect(() => {
    reload();
  }, [reload]);

  const activeEntry = opportunities.find((entry) => entry.key === activeKey) || null;
  const active = activeEntry?.opportunity || null;
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
    if (!activeEntry) return;
    await run(() => application.selectAngle(activeEntry, angleId), "Narrative direction saved. SignalFlow can build from this exact owner judgment next.");
  }

  async function startHere() {
    if (!activeEntry) return;
    await run(() => application.startHere(activeEntry), "SignalFlow saved the explicit recommended direction as your current choice.");
  }

  async function saveCustomAngle(event) {
    event.preventDefault();
    if (!activeEntry || !customAngle.trim()) return;
    const saved = await run(
      () => application.setCustomAngle(activeEntry, { summary: customAngle.trim(), approach: customAngle.trim() }),
      "Your custom narrative direction is now the selected angle.",
    );
    if (saved) setCustomAngle("");
  }

  async function refreshEvaluation() {
    if (!activeEntry) return;
    await run(() => application.refresh(activeEntry), "Opportunity re-evaluated from the latest canonical Signal and retained project understanding.");
  }

  async function notNow() {
    if (!activeEntry) return;
    await run(
      () => application.notNow(activeEntry),
      "Snoozed for seven days. The project understanding remains intact and later connected-source signals can still reuse it.",
    );
  }

  function focusSomethingElse() {
    document.getElementById("plan-custom-angle")?.focus();
  }

  return (
    <WorkspaceShell activeItem="plan" statusLabel="Editorial planning · Personal Alpha" statusTone="ready">
      <main className={styles.page} id="workspace-content">
        <header className={styles.heading}>
          <div>
            <p className={styles.eyebrow}>PLAN · EDITORIAL JUDGMENT</p>
            <h1>Choose the story before SignalFlow writes the post.</h1>
            <p>Connected work and direct ideas meet here as persisted opportunities. Start with SignalFlow&apos;s exact recommendation, choose another direction, write your own, defer it, or decide it should not become content.</p>
            {hostedState.status === "error" && <p className={judgmentStyles.hostedState}>Connected-source opportunities could not be loaded. Direct-create planning is still available.</p>}
          </div>
          <Link className={styles.captureLink} href="/signals">+ Capture another signal</Link>
        </header>

        {message && <div className={`${styles.message} ${styles[`message_${message.type}`] || ""}`} role="status">{message.text}</div>}

        {!opportunities.length ? (
          <section className={styles.empty}>
            <span>NO OPPORTUNITIES YET</span>
            <h2>SignalFlow is waiting for something worth your judgment.</h2>
            <p>Connected GitHub work can arrive here automatically once the hosted source path is configured. You can also capture a thought, lesson, update, decision, or topic directly.</p>
            <Link href="/signals">Capture a signal</Link>
          </section>
        ) : (
          <div className={styles.layout}>
            <aside className={styles.inbox} aria-label="Opportunity inbox">
              <div className={styles.inboxTitle}><span>OPPORTUNITIES</span><small>{opportunities.length} active</small></div>
              <div className={styles.inboxList}>
                {opportunities.map((entry) => {
                  const item = entry.opportunity;
                  return (
                    <button
                      key={entry.key}
                      type="button"
                      className={`${styles.inboxItem} ${entry.key === activeKey ? styles.inboxItemActive : ""}`}
                      onClick={() => setActiveKey(entry.key)}
                      aria-current={entry.key === activeKey ? "true" : undefined}
                    >
                      <span className={styles.inboxScore}>{formatScore(item.score)}</span>
                      <span>
                        <strong>{item.title}</strong>
                        <small>{titleCase(item.recommendation)} · {titleCase(item.status)}</small>
                        <span className={judgmentStyles.inboxOrigin}>{originLabel(entry.origin)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </aside>

            {active && activeEntry && (
              <div className={styles.detail}>
                <section className={styles.opportunityHero}>
                  <div className={styles.heroMeta}>
                    <span className={styles.recommendation} data-value={active.recommendation}>{active.recommendation === "post" ? "WORTH CONSIDERING" : active.recommendation.toUpperCase()}</span>
                    <span>{titleCase(active.freshnessState)}</span>
                    <span className={judgmentStyles.sourceBadge}>{originLabel(activeEntry.origin)}</span>
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

                {active.status !== "rejected" && (
                  <section className={judgmentStyles.judgmentBar} aria-label="Opportunity judgment">
                    <div className={judgmentStyles.judgmentCopy}>
                      <span>YOUR DECISION</span>
                      <strong>{active.recommendedAngleId ? "SignalFlow has one exact place to start." : "Choose the direction that deserves attention."}</strong>
                      <p>Start here never guesses from array order. If there is no explicit recommended angle, choose one of the visible directions or write Something else.</p>
                    </div>
                    <div className={judgmentStyles.judgmentActions}>
                      <button type="button" className={judgmentStyles.primaryAction} onClick={startHere} disabled={busy || !active.recommendedAngleId || active.recommendation !== "post"}>Start here</button>
                      <button type="button" onClick={focusSomethingElse} disabled={busy}>Something else…</button>
                      <button type="button" onClick={notNow} disabled={busy}>Not now</button>
                    </div>
                  </section>
                )}

                <section className={styles.signalChecks} aria-label="Opportunity assessment">
                  <div><span>Evidence</span><strong>{titleCase(active.evidenceReadiness.level)}</strong><p>{active.evidenceReadiness.reason}</p></div>
                  <div><span>Narrative fit</span><strong>{titleCase(active.narrativeFit.level)}</strong><p>{active.narrativeFit.reason}</p></div>
                  <div><span>Repetition</span><strong>{titleCase(active.repetitionRisk.level)}</strong><p>{active.repetitionRisk.reason}</p></div>
                </section>

                <section className={styles.destinations}>
                  <div className={styles.sectionTitle}><span>DESTINATION FIT</span><p>These are current recommendation inputs, not publishing claims or forced distribution.</p></div>
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
                    <p>Choose the reason/story you actually want to tell. This owner judgment remains explicit before downstream planning.</p>
                  </div>
                  {active.recommendation === "post" && active.candidateAngles.length > 0 ? (
                    <div className={styles.angleGrid}>
                      {active.candidateAngles.map((angle, index) => {
                        const chosen = active.selectedAngleId === angle.angleId;
                        const recommended = active.recommendedAngleId === angle.angleId;
                        return (
                          <button
                            key={angle.angleId}
                            type="button"
                            className={`${styles.angleCard} ${chosen ? styles.angleCardSelected : ""}`}
                            onClick={() => chooseAngle(angle.angleId)}
                            disabled={busy}
                          >
                            <small>0{index + 1}{recommended ? " · SIGNALFLOW PICK" : ""}</small>
                            <strong>{angle.title}</strong>
                            <p>{angle.summary}</p>
                            <span>{chosen ? "Selected" : "Choose this direction"}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className={styles.skipNote}>SignalFlow is not recommending content from this Signal right now. You can refresh the evaluation, defer it, or capture more context instead of filling a calendar slot.</div>
                  )}

                  <form className={styles.customAngle} onSubmit={saveCustomAngle}>
                    <div><span>SOMETHING ELSE…</span><p>Write the direction in your own words. SignalFlow should adapt to the judgment, not force one of its suggestions.</p></div>
                    <textarea id="plan-custom-angle" value={customAngle} onChange={(event) => setCustomAngle(event.target.value)} rows={3} placeholder="e.g. I don't want a launch update. Explain the privacy trade-off that made us change the architecture." />
                    <button type="submit" disabled={busy || !customAngle.trim()}>Use my direction</button>
                  </form>
                </section>

                {activeEntry.origin === "local" ? (
                  <CampaignPlanPanel opportunity={active} selectedAngle={selectedAngle} />
                ) : selectedAngle ? (
                  <section className={judgmentStyles.hostedHandoff} aria-label="Hosted planning boundary">
                    <span>DIRECTION SAVED · CANONICAL HOSTED OPPORTUNITY</span>
                    <strong>{selectedAngle.title || "Something else"}</strong>
                    <p>This connected-source judgment remains on the hosted Opportunity. SignalFlow will not copy it into the browser-local campaign planner; hosted strategy/production continuity is the next durable layer.</p>
                  </section>
                ) : null}

                <footer className={styles.detailFooter}>
                  <div>
                    {selectedAngle ? <><span>SELECTED DIRECTION</span><strong>{selectedAngle.title || "Something else"}</strong><p>{selectedAngle.summary}</p></> : <><span>NEXT DECISION</span><strong>Select a narrative direction</strong><p>The story does not advance until one exact owner-visible direction exists.</p></>}
                  </div>
                  <div className={styles.footerActions}>
                    <button type="button" onClick={refreshEvaluation} disabled={busy}>Re-evaluate</button>
                    {active.status !== "rejected" && <button type="button" className={styles.quietButton} onClick={() => run(() => application.rejectOpportunity(activeEntry), "Opportunity rejected. ProjectContext and the original Signal remain in history.")} disabled={busy}>Not worth posting</button>}
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
