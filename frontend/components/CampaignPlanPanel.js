"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserContentPlanningApplication } from "../lib/application/browserContentPlanningApplication.mjs";
import { createBrowserPlatformGenerationApplication } from "../lib/application/browserPlatformGenerationApplication.mjs";
import styles from "./CampaignPlanPanel.module.css";

const LOCAL_WORKSPACE_ID = "local-personal";

function lines(value) {
  return Array.isArray(value) ? value.join("\n") : "";
}

function formFromStrategy(strategy) {
  return {
    coreIdea: strategy?.coreIdea || "",
    audienceTakeaway: strategy?.audienceTakeaway || "",
    hookDirection: strategy?.hookDirection || "",
    narrativeArc: lines(strategy?.narrativeArc),
    evidencePlan: lines(strategy?.evidencePlan),
  };
}

function titleCase(value) {
  return String(value || "").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function destinationLabel(value) {
  return value === "x" ? "X" : "LinkedIn";
}

export default function CampaignPlanPanel({ opportunity, selectedAngle }) {
  const [bundle, setBundle] = useState({ strategy: null, contentPiece: null, variants: [] });
  const [generationBundle, setGenerationBundle] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(formFromStrategy(null));

  const application = useMemo(() => createBrowserContentPlanningApplication({
    getStorage: () => window.localStorage,
    workspaceId: LOCAL_WORKSPACE_ID,
  }), []);
  const generationApplication = useMemo(() => createBrowserPlatformGenerationApplication({
    getStorage: () => window.localStorage,
    workspaceId: LOCAL_WORKSPACE_ID,
  }), []);

  const reload = useCallback(async () => {
    if (!opportunity?.opportunityId) {
      setBundle({ strategy: null, contentPiece: null, variants: [] });
      setGenerationBundle(null);
      return;
    }
    try {
      const next = await application.getPlanBundle(opportunity.opportunityId);
      setBundle(next);
      if (next.strategy && !editing) setForm(formFromStrategy(next.strategy));
      if (next.contentPiece) {
        setGenerationBundle(await generationApplication.getGenerationBundle(next.contentPiece.contentPieceId));
      } else {
        setGenerationBundle(null);
      }
    } catch (error) {
      setMessage({ type: "error", text: error?.message || "SignalFlow could not load this campaign plan." });
    }
  }, [application, editing, generationApplication, opportunity?.opportunityId]);

  useEffect(() => { reload(); }, [reload]);

  async function run(action, successText = "") {
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
        code: error?.code || "",
        text: error?.message || "SignalFlow could not update the campaign plan.",
      });
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function build(refresh = false) {
    const result = await run(
      () => application.buildStrategy(opportunity.opportunityId, { refresh }),
      refresh ? "Campaign plan rebuilt from the current angle and Voice versions." : "Campaign plan created. Review the story before approving content production.",
    );
    if (result) {
      setEditing(false);
      setForm(formFromStrategy(result));
    }
  }

  async function saveRevision(event) {
    event.preventDefault();
    if (!bundle.strategy) return;
    const result = await run(
      () => application.reviseStrategy(bundle.strategy.narrativeStrategyId, {
        coreIdea: form.coreIdea,
        audienceTakeaway: form.audienceTakeaway,
        hookDirection: form.hookDirection,
        narrativeArc: form.narrativeArc.split("\n").map((item) => item.trim()).filter(Boolean),
        evidencePlan: form.evidencePlan.split("\n").map((item) => item.trim()).filter(Boolean),
      }),
      "Plan revision saved. Any earlier approval/dependent placeholders were invalidated.",
    );
    if (result) setEditing(false);
  }

  async function approve() {
    const result = await run(
      () => application.approveStrategy(bundle.strategy.narrativeStrategyId),
      "Campaign plan approved. The canonical ContentPiece and permitted LinkedIn/X variant records are ready for generation.",
    );
    if (result) setBundle(result);
  }

  async function generateDrafts() {
    if (!bundle.contentPiece) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await generationApplication.generateReadyVariants(bundle.contentPiece.contentPieceId);
      setGenerationBundle(result.bundle);
      await reload();
      if (result.failed.length && result.generated.length) {
        setMessage({
          type: "warning",
          text: `${result.generated.length} platform draft${result.generated.length === 1 ? "" : "s"} generated. ${result.failed.map((item) => destinationLabel(item.destination)).join(", ")} failed without affecting the successful revision.`,
        });
      } else if (result.failed.length) {
        setMessage({
          type: "error",
          text: result.failed.map((item) => `${destinationLabel(item.destination)}: ${item.message}`).join(" "),
        });
      } else if (result.generated.length) {
        setMessage({ type: "success", text: "LinkedIn/X drafts generated as immutable review revisions. Nothing is approved or published yet." });
      } else {
        setMessage({ type: "success", text: "Every non-omitted destination already has a current review revision." });
      }
    } catch (error) {
      setMessage({ type: "error", code: error?.code || "", text: error?.message || "SignalFlow could not generate platform drafts." });
    } finally {
      setBusy(false);
    }
  }

  if (!opportunity || opportunity.recommendation !== "post") return null;

  if (!selectedAngle) {
    return (
      <section className={styles.gate} aria-label="Campaign plan">
        <div><span>CAMPAIGN PLAN</span><strong>Choose the story first.</strong><p>SignalFlow will not spend another reasoning call until you select one suggested direction or write Something else.</p></div>
      </section>
    );
  }

  const { strategy, contentPiece, variants } = bundle;
  const generationRows = generationBundle?.variants || variants.map((variant) => ({ variant, currentRevision: null, history: [] }));
  const pendingGenerationCount = generationRows.filter(({ variant, currentRevision }) => variant.status !== "omitted" && !currentRevision).length;

  return (
    <section className={styles.panel} aria-labelledby="campaign-plan-title">
      <header className={styles.header}>
        <div>
          <span>CAMPAIGN PLAN · GOLDEN PATH</span>
          <h3 id="campaign-plan-title">Approve the story before SignalFlow writes platform copy.</h3>
          <p>The selected angle is already your decision. This layer resolves the core idea, evidence needs, destination exclusions and media need using the exact current Voice profile versions.</p>
        </div>
        {strategy && <small>Strategy r{strategy.strategyRevision} · {titleCase(strategy.status)}</small>}
      </header>

      {message && (
        <div className={`${styles.message} ${styles[`message_${message.type}`] || ""}`} role="status">
          <span>{message.text}</span>
          {message.code === "voice_profile_required" && <Link href="/voice">Set up Voice</Link>}
        </div>
      )}

      {!strategy ? (
        <div className={styles.buildState}>
          <div>
            <span>SELECTED DIRECTION</span>
            <strong>{selectedAngle.title || "Something else"}</strong>
            <p>{selectedAngle.summary}</p>
          </div>
          <button type="button" onClick={() => build(false)} disabled={busy}>{busy ? "Building plan…" : "Build campaign plan"}</button>
        </div>
      ) : editing ? (
        <form className={styles.editForm} onSubmit={saveRevision}>
          <label><span>Core idea</span><textarea rows={3} value={form.coreIdea} onChange={(event) => setForm((current) => ({ ...current, coreIdea: event.target.value }))} /></label>
          <label><span>Audience takeaway</span><textarea rows={3} value={form.audienceTakeaway} onChange={(event) => setForm((current) => ({ ...current, audienceTakeaway: event.target.value }))} /></label>
          <label><span>Hook direction</span><textarea rows={2} value={form.hookDirection} onChange={(event) => setForm((current) => ({ ...current, hookDirection: event.target.value }))} /></label>
          <div className={styles.editColumns}>
            <label><span>Narrative arc · one beat per line</span><textarea rows={5} value={form.narrativeArc} onChange={(event) => setForm((current) => ({ ...current, narrativeArc: event.target.value }))} /></label>
            <label><span>Evidence plan · one item per line</span><textarea rows={5} value={form.evidencePlan} onChange={(event) => setForm((current) => ({ ...current, evidencePlan: event.target.value }))} /></label>
          </div>
          <div className={styles.editActions}><button type="button" onClick={() => { setEditing(false); setForm(formFromStrategy(strategy)); }} disabled={busy}>Cancel</button><button type="submit" disabled={busy}>Save plan revision</button></div>
        </form>
      ) : (
        <>
          <div className={styles.primaryPlan}>
            <div className={styles.ideaBlock}><span>CORE IDEA</span><strong>{strategy.coreIdea}</strong></div>
            <div className={styles.takeawayBlock}><span>AUDIENCE TAKEAWAY</span><p>{strategy.audienceTakeaway}</p></div>
          </div>

          <div className={styles.planRows}>
            <div className={styles.planRow}>
              <span>Story arc</span>
              <ol>{strategy.narrativeArc.map((item, index) => <li key={`${index}-${item}`}><b>{index + 1}</b><p>{item}</p></li>)}</ol>
            </div>
            <div className={styles.planRow}><span>Opening direction</span><p>{strategy.hookDirection}</p></div>
            <div className={styles.planRow}><span>Evidence needed</span><ul>{strategy.evidencePlan.length ? strategy.evidencePlan.map((item) => <li key={item}>{item}</li>) : <li>No extra evidence requested by this plan.</li>}</ul></div>
          </div>

          <div className={styles.destinationPlan}>
            <div className={styles.subhead}><span>DESTINATION DECISIONS</span><p>Absence is valid. An excluded platform will not receive a hidden draft.</p></div>
            {strategy.destinationPlan.map((item) => (
              <div className={styles.destinationItem} key={item.destination} data-decision={item.decision}>
                <strong>{destinationLabel(item.destination)}</strong>
                <span>{titleCase(item.decision)}</span>
                <p>{item.reason}</p>
                <small>{item.format}</small>
              </div>
            ))}
          </div>

          <div className={styles.secondaryGrid}>
            <div><span>MEDIA</span>{strategy.mediaRequirements.length ? strategy.mediaRequirements.map((item) => <p key={`${item.type}-${item.reason}`}><b>{titleCase(item.type)}</b>{item.reason ? ` · ${item.reason}` : ""}</p>) : <p>Text only / no media requirement.</p>}</div>
            <div><span>BOUNDARIES / FACTS</span><p>{[...strategy.factualConstraints, ...strategy.boundaryConstraints].length} explicit planning constraints carried forward.</p><small>Identity snapshot: {strategy.identityContextSnapshotId.slice(-12)}</small></div>
          </div>

          {contentPiece ? (
            <div className={styles.productionStage}>
              <div className={styles.approvedState}>
                <div><span>PLAN APPROVED</span><strong>One canonical ContentPiece is ready.</strong><p>Generate only the non-omitted LinkedIn/X variants. Each result is stored as an immutable review revision using that destination&apos;s exact Voice snapshot.</p></div>
                {pendingGenerationCount > 0 ? (
                  <button type="button" className={styles.generateButton} onClick={generateDrafts} disabled={busy}>{busy ? "Generating…" : `Generate ${pendingGenerationCount} draft${pendingGenerationCount === 1 ? "" : "s"}`}</button>
                ) : <small className={styles.readyLabel}>Draft stage complete</small>}
              </div>

              <div className={styles.draftStage} aria-label="Generated platform drafts">
                <div className={styles.subhead}><span>DRAFTS · GENERATED, NOT APPROVED</span><p>Read-only in this slice. Editing, critics and exact approval are the next review stage.</p></div>
                {generationRows.map(({ variant, currentRevision, history }) => (
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
                        <small>{currentRevision.generationProvenance.provider} · {currentRevision.generationProvenance.model} · {history.length} saved revision{history.length === 1 ? "" : "s"}</small>
                      </div>
                    ) : (
                      <p className={styles.draftPlaceholder}>{variant.status === "failed" ? "Generation failed for this destination. The other platform remains intact; retry is available through the generation service." : "No generated revision yet."}</p>
                    )}
                  </article>
                ))}
              </div>
            </div>
          ) : (
            <footer className={styles.actions}>
              <div><button type="button" onClick={() => setEditing(true)} disabled={busy}>Edit plan</button><button type="button" onClick={() => build(true)} disabled={busy}>Rebuild</button></div>
              <button type="button" className={styles.approveButton} onClick={approve} disabled={busy || strategy.status === "approved"}>{busy ? "Working…" : "Approve campaign plan"}</button>
            </footer>
          )}
        </>
      )}
    </section>
  );
}
