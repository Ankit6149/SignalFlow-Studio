"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserContentSignalApplication } from "../lib/application/browserContentSignalApplication.mjs";
import { createBrowserContentOpportunityApplication } from "../lib/application/browserContentOpportunityApplication.mjs";
import styles from "./OpportunityWorkspace.module.css";

const LOCAL_WORKSPACE_ID = "local-personal";
const SIGNAL_STORAGE_KEY = "signalflow_content_signals_v1";
const OPPORTUNITY_STORAGE_KEY = "signalflow_content_opportunities_v1";

const EMPTY_CONTEXT = {
  identitySummary: "",
  desiredPerception: "",
  recentNarratives: "",
};

function formatDate(value) {
  if (!value) return "Unknown";
  try {
    return new Intl.DateTimeFormat("en", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function recommendationLabel(value) {
  if (value === "discuss") return "Worth discussing";
  if (value === "hold") return "Hold for now";
  return "Probably skip";
}

function evidenceLabel(value) {
  if (value === "strong") return "Strong evidence";
  if (value === "moderate") return "Moderate evidence";
  return "Weak evidence";
}

function normalizeNarratives(value) {
  return String(value || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20);
}

export default function OpportunityWorkspace() {
  const params = useParams();
  const signalId = String(params?.signalId || "");
  const [signal, setSignal] = useState(null);
  const [opportunity, setOpportunity] = useState(null);
  const [context, setContext] = useState(EMPTY_CONTEXT);
  const [customAngle, setCustomAngle] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [showContext, setShowContext] = useState(false);

  const signalApplication = useMemo(() => createBrowserContentSignalApplication({
    getStorage: () => window.localStorage,
    key: SIGNAL_STORAGE_KEY,
    workspaceId: LOCAL_WORKSPACE_ID,
    validateCanonicalReferences: true,
  }), []);

  const opportunityApplication = useMemo(() => createBrowserContentOpportunityApplication({
    getStorage: () => window.localStorage,
    signalKey: SIGNAL_STORAGE_KEY,
    opportunityKey: OPPORTUNITY_STORAGE_KEY,
    workspaceId: LOCAL_WORKSPACE_ID,
  }), []);

  const reload = useCallback(async () => {
    if (!signalId) return;
    try {
      const nextSignal = await signalApplication.readSignal(signalId);
      setSignal(nextSignal);
      if (!nextSignal) {
        setOpportunity(null);
        return;
      }
      const nextOpportunity = await opportunityApplication.readOpportunityForSignal(signalId);
      setOpportunity(nextOpportunity);
      if (nextOpportunity?.evaluationContext) {
        setContext({
          identitySummary: nextOpportunity.evaluationContext.identitySummary || "",
          desiredPerception: nextOpportunity.evaluationContext.desiredPerception || "",
          recentNarratives: (nextOpportunity.evaluationContext.recentNarrativeSummaries || []).join("\n"),
        });
      }
      if (nextOpportunity?.selectedAngle?.type === "custom") setCustomAngle(nextOpportunity.selectedAngle.text || "");
    } catch (error) {
      setMessage({ type: "error", text: error?.message || "This signal could not be loaded." });
    }
  }, [opportunityApplication, signalApplication, signalId]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function run(action, successText) {
    setBusy(true);
    setMessage(null);
    try {
      const result = await action();
      await reload();
      if (successText) setMessage({ type: "success", text: successText });
      return result;
    } catch (error) {
      setMessage({
        type: "error",
        text: error?.recovery ? `${error.message} ${error.recovery}` : (error?.message || "The action could not be completed."),
      });
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function evaluate({ force = false } = {}) {
    await run(
      () => opportunityApplication.evaluateSignal(signalId, {
        force,
        evaluationContext: {
          identitySummary: context.identitySummary.trim() || null,
          desiredPerception: context.desiredPerception.trim() || null,
          recentNarrativeSummaries: normalizeNarratives(context.recentNarratives),
        },
      }),
      force ? "Signal re-evaluated. Your new opportunity view is saved in this browser." : "Opportunity evaluation saved. Nothing has been posted or published.",
    );
  }

  async function chooseRecommended(angleId) {
    await run(
      () => opportunityApplication.selectAngle(opportunity.opportunityId, angleId),
      "Angle selected and saved. No post has been generated yet.",
    );
  }

  async function chooseCustom() {
    const text = customAngle.trim();
    if (!text) {
      setMessage({ type: "error", text: "Describe the direction you want SignalFlow to use." });
      return;
    }
    await run(
      () => opportunityApplication.selectCustomAngle(opportunity.opportunityId, text),
      "Your custom angle is saved. No post has been generated yet.",
    );
  }

  if (!signalId) {
    return <main className={styles.page}><div className={styles.notFound}><strong>No signal selected.</strong><Link href="/signals">Back to Signals</Link></div></main>;
  }

  if (!signal) {
    return (
      <main className={styles.page}>
        <header className={styles.topbar}><Link href="/signals">← Signals</Link><span>Golden Path · owner workspace</span></header>
        <div className={styles.notFound}>
          <strong>Signal not found in this browser.</strong>
          <p>This Golden Path currently uses browser-local Personal Alpha persistence.</p>
          <Link href="/signals">Return to Signals</Link>
        </div>
      </main>
    );
  }

  const privateBlocked = ["device_private", "restricted"].includes(signal.privacyClassification);
  const selectedAngle = opportunity?.selectedAngle;

  return (
    <main className={styles.page} id="main-content">
      <header className={styles.topbar}>
        <Link href="/signals" className={styles.backLink}>← Signals</Link>
        <div className={styles.topMeta}>
          <span>GOLDEN PATH 01</span>
          <strong>Signal → judgment</strong>
        </div>
        <Link href="/" className={styles.studioLink}>Studio</Link>
      </header>

      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>SAVED SIGNAL</p>
          <h1>{signal.headline}</h1>
          {signal.summary && signal.summary !== signal.headline && <p className={styles.signalSummary}>{signal.summary}</p>}
          <div className={styles.signalMeta}>
            <span>{signal.signalKind.replaceAll("_", " ")}</span>
            <span>{signal.privacyClassification.replaceAll("_", " ")}</span>
            {signal.projectId && <span>{signal.projectId}</span>}
            <span>Observed {formatDate(signal.observedAt)}</span>
          </div>
        </div>
        <aside className={styles.boundaryCard}>
          <span>BOUNDARY</span>
          <strong>{signal.boundaryNote ? "Explicit instruction present" : "No explicit boundary supplied"}</strong>
          <p>{signal.boundaryNote || "SignalFlow will still require factual evidence and will not invent unsupported details."}</p>
        </aside>
      </section>

      {message && (
        <div className={`${styles.message} ${message.type === "error" ? styles.messageError : styles.messageSuccess}`} role={message.type === "error" ? "alert" : "status"} aria-live="polite">
          {message.text}
        </div>
      )}

      {!opportunity ? (
        <section className={styles.evaluateSection} aria-labelledby="evaluate-title">
          <div className={styles.decisionIntro}>
            <span className={styles.stepNumber}>01</span>
            <div>
              <p className={styles.eyebrow}>EDITORIAL JUDGMENT</p>
              <h2 id="evaluate-title">Is this actually worth talking about?</h2>
              <p>SignalFlow will evaluate the signal before writing anything: why now, evidence strength, narrative fit, repetition risk, boundaries, destinations, and possible angles.</p>
            </div>
          </div>

          {privateBlocked ? (
            <div className={styles.blocker}>
              <strong>Remote evaluation is blocked by this signal&apos;s privacy choice.</strong>
              <p>This signal requires a local/private processing route. SignalFlow will not silently send it to the current remote model. Return to Signals and deliberately change the privacy choice only if that is appropriate.</p>
              <Link href="/signals">Review signal privacy</Link>
            </div>
          ) : (
            <div className={styles.evaluationCard}>
              <div className={styles.evaluationMain}>
                <h3>Use the context you already have.</h3>
                <p>The signal and its boundary are enough to start. Identity and recent-story context are optional here until the canonical Voice/Memory systems are implemented.</p>
                <button className={styles.contextToggle} type="button" onClick={() => setShowContext((value) => !value)} aria-expanded={showContext}>
                  {showContext ? "Hide optional context" : "Add identity / repetition context"}
                </button>

                {showContext && (
                  <div className={styles.contextFields}>
                    <label>
                      <span>Who should this sound like?</span>
                      <textarea value={context.identitySummary} onChange={(event) => setContext((previous) => ({ ...previous, identitySummary: event.target.value }))} rows={3} placeholder="Example: A builder who explains real product decisions, tradeoffs and lessons without launch hype." />
                    </label>
                    <label>
                      <span>How should people understand you?</span>
                      <textarea value={context.desiredPerception} onChange={(event) => setContext((previous) => ({ ...previous, desiredPerception: event.target.value }))} rows={2} placeholder="Specific, thoughtful, technically grounded." />
                    </label>
                    <label>
                      <span>Recent stories to avoid repeating <em>one per line</em></span>
                      <textarea value={context.recentNarratives} onChange={(event) => setContext((previous) => ({ ...previous, recentNarratives: event.target.value }))} rows={3} placeholder="Previously explained provider-neutral inference routing." />
                    </label>
                  </div>
                )}
              </div>

              <div className={styles.evaluateAction}>
                <span>Uses the configured Personal Alpha model route</span>
                <strong>No content is generated yet.</strong>
                <button type="button" onClick={() => evaluate()} disabled={busy}>{busy ? "Evaluating…" : "Evaluate signal"}</button>
              </div>
            </div>
          )}
        </section>
      ) : (
        <>
          <section className={styles.resultSection} aria-labelledby="result-title">
            <div className={styles.resultHeader}>
              <div>
                <p className={styles.eyebrow}>OPPORTUNITY · SAVED</p>
                <h2 id="result-title">{recommendationLabel(opportunity.evaluation.recommendation)}</h2>
              </div>
              <div className={styles.scoreDial}>
                <strong>{opportunity.evaluation.score}</strong>
                <span>/ 100</span>
              </div>
            </div>

            <div className={styles.explanationGrid}>
              <article className={styles.whyNow}>
                <span>WHY NOW</span>
                <p>{opportunity.evaluation.whyNow}</p>
              </article>
              <article>
                <span>EVIDENCE</span>
                <strong>{evidenceLabel(opportunity.evaluation.evidenceQuality.level)}</strong>
                <p>{opportunity.evaluation.evidenceQuality.note}</p>
              </article>
              <article>
                <span>NARRATIVE FIT</span>
                <p>{opportunity.evaluation.narrativeNote}</p>
              </article>
              <article>
                <span>REPETITION</span>
                <p>{opportunity.evaluation.repetitionNote}</p>
              </article>
              <article className={styles.boundaryResult}>
                <span>BOUNDARY CHECK</span>
                <p>{opportunity.evaluation.boundaryNote}</p>
              </article>
            </div>

            {opportunity.evaluation.factors.length > 0 && (
              <div className={styles.factorList}>
                {opportunity.evaluation.factors.map((factor) => (
                  <div key={factor.key} className={styles.factorRow}>
                    <div><strong>{factor.label}</strong><span>{factor.note}</span></div>
                    <div className={styles.factorMeter}><i style={{ width: `${factor.score}%` }} /></div>
                    <b>{factor.score}</b>
                  </div>
                ))}
              </div>
            )}

            <div className={styles.recommendationFoot}>
              <div><span>Destinations</span>{opportunity.recommendedDestinations.map((item) => <b key={item}>{item}</b>)}</div>
              <div><span>Media</span>{opportunity.recommendedFormats.map((item) => <b key={item}>{item.replaceAll("_", " ")}</b>)}</div>
              <button type="button" onClick={() => evaluate({ force: true })} disabled={busy}>Re-evaluate</button>
            </div>
          </section>

          <section className={styles.angleSection} aria-labelledby="angle-title">
            <div className={styles.decisionIntro}>
              <span className={styles.stepNumber}>02</span>
              <div>
                <p className={styles.eyebrow}>YOUR DECISION</p>
                <h2 id="angle-title">What is the story actually about?</h2>
                <p>Choose a narrative direction, not a headline variant. You can ignore every recommendation and describe something else.</p>
              </div>
            </div>

            {opportunity.status === "rejected" ? (
              <div className={styles.rejectedState}>
                <strong>You rejected this opportunity.</strong>
                <p>The signal and evaluation remain in history. Nothing is generated.</p>
                <button type="button" onClick={() => run(() => opportunityApplication.reopenOpportunity(opportunity.opportunityId), "Opportunity reopened for judgment.")} disabled={busy}>Reopen</button>
              </div>
            ) : (
              <>
                <div className={styles.angleGrid}>
                  {opportunity.angles.map((angle, index) => {
                    const selected = selectedAngle?.type === "recommended" && selectedAngle.angleId === angle.angleId;
                    return (
                      <article key={angle.angleId} className={`${styles.angleCard} ${selected ? styles.angleSelected : ""}`}>
                        <div className={styles.angleTop}><span>0{index + 1}</span><small>{angle.family.replaceAll("_", " ")}</small></div>
                        <h3>{angle.title}</h3>
                        <p>{angle.summary}</p>
                        <div className={styles.rationale}><strong>Why this is different</strong><span>{angle.rationale}</span></div>
                        <button type="button" onClick={() => chooseRecommended(angle.angleId)} disabled={busy || selected}>{selected ? "Selected" : "Choose this angle"}</button>
                      </article>
                    );
                  })}
                </div>

                <div className={`${styles.customCard} ${selectedAngle?.type === "custom" ? styles.customSelected : ""}`}>
                  <div>
                    <span>SOMETHING ELSE…</span>
                    <h3>Your direction outranks the recommendation.</h3>
                    <p>Describe what you actually want this story to focus on. SignalFlow will carry that instruction into strategy instead of trying to force one of its options.</p>
                  </div>
                  <div>
                    <textarea value={customAngle} onChange={(event) => setCustomAngle(event.target.value)} rows={4} maxLength={1800} placeholder="Focus on the tension between convenience and confidentiality, without making this sound like a launch announcement…" />
                    <button type="button" onClick={chooseCustom} disabled={busy}>{selectedAngle?.type === "custom" ? "Update custom angle" : "Use this direction"}</button>
                  </div>
                </div>

                <div className={styles.angleFooter}>
                  <button type="button" className={styles.rejectButton} onClick={() => run(() => opportunityApplication.rejectOpportunity(opportunity.opportunityId), "Opportunity rejected. The signal remains saved.")} disabled={busy}>Not worth posting</button>
                  {selectedAngle && (
                    <div className={styles.nextStep}>
                      <span>ANGLE SAVED</span>
                      <strong>{selectedAngle.text}</strong>
                      <p>The next Golden Path stage will build the narrative strategy and only the LinkedIn/X variants from this exact choice.</p>
                      <button type="button" disabled>Build story · next stage</button>
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        </>
      )}
    </main>
  );
}
