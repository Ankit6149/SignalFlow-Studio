"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createBrowserContentSignalApplication } from "../lib/application/browserContentSignalApplication.mjs";
import { CONTENT_SIGNAL_KINDS } from "../lib/domain/contentSignals.mjs";
import styles from "./SignalsWorkspace.module.css";

const LOCAL_WORKSPACE_ID = "local-personal";
const SIGNAL_STORAGE_KEY = "signalflow_content_signals_v1";

const KIND_OPTIONS = [
  [CONTENT_SIGNAL_KINDS.THOUGHT, "Thought"],
  [CONTENT_SIGNAL_KINDS.FEATURE, "Feature"],
  [CONTENT_SIGNAL_KINDS.BUGFIX, "Bug fix"],
  [CONTENT_SIGNAL_KINDS.RELEASE, "Release"],
  [CONTENT_SIGNAL_KINDS.MILESTONE, "Milestone"],
  [CONTENT_SIGNAL_KINDS.LESSON, "Lesson"],
  [CONTENT_SIGNAL_KINDS.RESEARCH, "Research"],
  [CONTENT_SIGNAL_KINDS.LAUNCH, "Launch"],
  [CONTENT_SIGNAL_KINDS.PERSONAL_UPDATE, "Personal update"],
  [CONTENT_SIGNAL_KINDS.CAREER_UPDATE, "Career update"],
  [CONTENT_SIGNAL_KINDS.OPINION, "Opinion"],
  [CONTENT_SIGNAL_KINDS.QUESTION, "Question"],
  [CONTENT_SIGNAL_KINDS.EXTERNAL_TOPIC, "External topic"],
  [CONTENT_SIGNAL_KINDS.OTHER, "Other"],
];

const PRIVACY_OPTIONS = [
  ["workspace_private", "Private to this workspace"],
  ["device_private", "Device private"],
  ["restricted", "Restricted"],
  ["public", "Public-safe context"],
];

const STATUS_LABELS = {
  new: "New",
  interpreted: "Interpreted",
  used: "Used",
  ignored: "Ignored",
  snoozed: "Snoozed",
  archived: "Archived",
};

function defaultForm() {
  return {
    thought: "",
    projectId: "",
    signalKind: CONTENT_SIGNAL_KINDS.THOUGHT,
    privacyClassification: "workspace_private",
    occurredAt: "",
    boundaryNote: "",
  };
}

function firstLineHeadline(value) {
  const normalized = String(value || "").trim();
  const firstLine = normalized.split("\n").map((line) => line.trim()).find(Boolean) || normalized;
  if (firstLine.length <= 220) return firstLine;
  return `${firstLine.slice(0, 217).trimEnd()}…`;
}

function toIso(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function formatDate(value) {
  if (!value) return "Just now";
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

function statusClass(status) {
  return `${styles.status} ${styles[`status_${status}`] || ""}`;
}

export default function SignalsWorkspace() {
  const [form, setForm] = useState(defaultForm);
  const [signals, setSignals] = useState([]);
  const [filter, setFilter] = useState("active");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);

  const application = useMemo(() => createBrowserContentSignalApplication({
    getStorage: () => window.localStorage,
    key: SIGNAL_STORAGE_KEY,
    workspaceId: LOCAL_WORKSPACE_ID,
    validateCanonicalReferences: true,
  }), []);

  const reload = useCallback(async () => {
    try {
      const next = await application.listSignals({ includeArchived: true });
      setSignals(next);
    } catch (error) {
      setMessage({ type: "error", text: error?.message || "Signals could not be loaded from this browser." });
    }
  }, [application]);

  useEffect(() => {
    reload();
  }, [reload]);

  const visibleSignals = useMemo(() => signals.filter((signal) => {
    if (filter === "all") return true;
    if (filter === "archived") return signal.status === "archived";
    if (filter === "snoozed") return signal.status === "snoozed";
    if (filter === "ignored") return signal.status === "ignored";
    return !["archived", "ignored"].includes(signal.status);
  }), [filter, signals]);

  const activeCount = signals.filter((signal) => !["archived", "ignored"].includes(signal.status)).length;
  const projectCount = new Set(signals.map((signal) => signal.projectId).filter(Boolean)).size;

  function updateForm(key, value) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  async function submitSignal(event) {
    event.preventDefault();
    const thought = form.thought.trim();
    if (!thought) {
      setMessage({ type: "error", text: "Write the thought, event, lesson, or topic you want SignalFlow to remember." });
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      await application.createManualSignal({
        headline: firstLineHeadline(thought),
        summary: thought,
        projectId: form.projectId.trim() || null,
        signalKind: form.signalKind,
        privacyClassification: form.privacyClassification,
        occurredAt: toIso(form.occurredAt),
        boundaryNote: form.boundaryNote.trim() || null,
      });
      setForm(defaultForm());
      await reload();
      setMessage({
        type: "success",
        text: "Signal saved in this browser. Nothing was generated or published; opportunity evaluation is a separate next step.",
      });
    } catch (error) {
      setMessage({ type: "error", text: error?.message || "The signal could not be saved." });
    } finally {
      setBusy(false);
    }
  }

  async function runAction(action, successText) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      await reload();
      setMessage({ type: "success", text: successText });
    } catch (error) {
      setMessage({ type: "error", text: error?.message || "The signal could not be updated." });
    } finally {
      setBusy(false);
    }
  }

  function beginEdit(signal) {
    setEditingId(signal.signalId);
    setEditDraft({
      headline: signal.headline,
      summary: signal.summary,
      projectId: signal.projectId || "",
      signalKind: signal.signalKind,
      privacyClassification: signal.privacyClassification,
      boundaryNote: signal.boundaryNote || "",
    });
  }

  async function saveEdit(signalId) {
    if (!editDraft?.headline?.trim()) {
      setMessage({ type: "error", text: "A signal needs a headline." });
      return;
    }
    await runAction(
      () => application.updateSignalMetadata(signalId, {
        headline: editDraft.headline.trim(),
        summary: editDraft.summary.trim(),
        projectId: editDraft.projectId.trim() || null,
        signalKind: editDraft.signalKind,
        privacyClassification: editDraft.privacyClassification,
        boundaryNote: editDraft.boundaryNote.trim() || null,
      }),
      "Signal details updated.",
    );
    setEditingId(null);
    setEditDraft(null);
  }

  async function snooze24Hours(signalId) {
    const until = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await runAction(() => application.snoozeSignal(signalId, until), "Signal snoozed for 24 hours.");
  }

  return (
    <main className={styles.page} id="main-content">
      <header className={styles.topbar}>
        <Link className={styles.brand} href="/" aria-label="SignalFlow Studio home">
          <span className={styles.brandGlyph} aria-hidden="true"><i /><i /><i /></span>
          <span><strong>SignalFlow</strong><small>STUDIO</small></span>
        </Link>
        <div className={styles.topActions}>
          <span className={styles.localBadge}>Browser-local owner workspace</span>
          <Link className={styles.studioLink} href="/">Current Studio</Link>
        </div>
      </header>

      <section className={styles.hero} aria-labelledby="signals-title">
        <div>
          <p className={styles.eyebrow}>SIGNALS · AVAILABLE NOW</p>
          <h1 id="signals-title">Capture what may be worth talking about before it becomes a post.</h1>
          <p>
            A signal is a durable record of a thought, lesson, milestone, release, question, or event. Saving one does not create a campaign and does not call AI. It gives the editorial system something real to judge later.
          </p>
        </div>
        <div className={styles.principleCard}>
          <span>OWNER-FIRST CONTRACT</span>
          <strong>Your job is judgment.</strong>
          <p>SignalFlow keeps the context so later opportunity, narrative, media, and publishing steps can be automated without losing why the story exists.</p>
        </div>
      </section>

      <section className={styles.stats} aria-label="Signal summary">
        <div><strong>{activeCount}</strong><span>Active signals</span></div>
        <div><strong>{signals.length}</strong><span>Saved in this browser</span></div>
        <div><strong>{projectCount}</strong><span>Project references</span></div>
        <div><strong>0</strong><span>Automatic detections</span><small>Not implemented</small></div>
      </section>

      {message && (
        <div className={`${styles.message} ${message.type === "error" ? styles.messageError : styles.messageSuccess}`} role={message.type === "error" ? "alert" : "status"} aria-live="polite">
          {message.text}
        </div>
      )}

      <div className={styles.workspaceGrid}>
        <section className={styles.captureCard} aria-labelledby="capture-signal-title">
          <div className={styles.cardHeading}>
            <div>
              <span>MANUAL INTAKE</span>
              <h2 id="capture-signal-title">What happened?</h2>
            </div>
            <small>No AI call</small>
          </div>

          <form onSubmit={submitSignal} className={styles.form}>
            <label className={styles.fullField}>
              <span>Thought, event, lesson, or topic</span>
              <textarea
                value={form.thought}
                onChange={(event) => updateForm("thought", event.target.value)}
                placeholder="I changed how private repository context is handled, and the reason behind the boundary is worth explaining…"
                rows={8}
                maxLength={12000}
              />
              <small>The first line becomes the signal headline. Keep the evidence and nuance here; this is not post copy.</small>
            </label>

            <div className={styles.fieldGrid}>
              <label>
                <span>Kind</span>
                <select value={form.signalKind} onChange={(event) => updateForm("signalKind", event.target.value)}>
                  {KIND_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label>
                <span>Project reference <em>optional</em></span>
                <input value={form.projectId} onChange={(event) => updateForm("projectId", event.target.value)} placeholder="signalflow-studio" maxLength={240} />
              </label>
              <label>
                <span>Privacy</span>
                <select value={form.privacyClassification} onChange={(event) => updateForm("privacyClassification", event.target.value)}>
                  {PRIVACY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label>
                <span>When it happened <em>optional</em></span>
                <input type="datetime-local" value={form.occurredAt} onChange={(event) => updateForm("occurredAt", event.target.value)} />
              </label>
            </div>

            <label className={styles.fullField}>
              <span>Boundary note <em>optional</em></span>
              <textarea
                value={form.boundaryNote}
                onChange={(event) => updateForm("boundaryNote", event.target.value)}
                placeholder="For example: do not mention the client name or expose private repository details."
                rows={3}
                maxLength={4000}
              />
            </label>

            <div className={styles.formFooter}>
              <div>
                <strong>Stored locally in this browser</strong>
                <span>Cloud sync and automatic event detection are not claimed here.</span>
              </div>
              <button type="submit" disabled={busy}>{busy ? "Saving…" : "Save signal"}</button>
            </div>
          </form>
        </section>

        <aside className={styles.nextCard} aria-labelledby="next-title">
          <span className={styles.nextTag}>NEXT PRODUCT STEP</span>
          <h2 id="next-title">Signals are evidence, not content.</h2>
          <ol>
            <li><b>Now</b><span>Capture and persist the signal.</span></li>
            <li><b>Next</b><span>Evaluate whether it is a worthwhile ContentOpportunity and explain why.</span></li>
            <li><b>Then</b><span>Choose an angle before narrative, media, and platform variants exist.</span></li>
          </ol>
          <p>This separation is what lets the owner workflow scale later without turning every event into spam.</p>
        </aside>
      </div>

      <section className={styles.librarySection} aria-labelledby="saved-signals-title">
        <div className={styles.libraryHeader}>
          <div>
            <p className={styles.eyebrow}>BROWSER SIGNAL HISTORY</p>
            <h2 id="saved-signals-title">Saved context</h2>
          </div>
          <label className={styles.filterLabel}>
            <span>Show</span>
            <select value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="active">Active</option>
              <option value="snoozed">Snoozed</option>
              <option value="ignored">Ignored</option>
              <option value="archived">Archived</option>
              <option value="all">All</option>
            </select>
          </label>
        </div>

        {visibleSignals.length === 0 ? (
          <div className={styles.emptyState}>
            <strong>No signals in this view.</strong>
            <p>Capture a real thought or event above. SignalFlow will preserve it without generating filler.</p>
          </div>
        ) : (
          <div className={styles.signalList}>
            {visibleSignals.map((signal) => {
              const isEditing = editingId === signal.signalId;
              return (
                <article className={styles.signalCard} key={signal.signalId}>
                  <div className={styles.signalMeta}>
                    <span className={statusClass(signal.status)}>{STATUS_LABELS[signal.status] || signal.status}</span>
                    <span>{signal.signalKind.replaceAll("_", " ")}</span>
                    <span>{signal.privacyClassification.replaceAll("_", " ")}</span>
                    {signal.projectId && <span>Project · {signal.projectId}</span>}
                  </div>

                  {isEditing ? (
                    <div className={styles.editForm}>
                      <label><span>Headline</span><input value={editDraft.headline} onChange={(event) => setEditDraft((previous) => ({ ...previous, headline: event.target.value }))} maxLength={240} /></label>
                      <label><span>Context</span><textarea value={editDraft.summary} onChange={(event) => setEditDraft((previous) => ({ ...previous, summary: event.target.value }))} rows={5} maxLength={12000} /></label>
                      <div className={styles.fieldGrid}>
                        <label><span>Project</span><input value={editDraft.projectId} onChange={(event) => setEditDraft((previous) => ({ ...previous, projectId: event.target.value }))} maxLength={240} /></label>
                        <label><span>Kind</span><select value={editDraft.signalKind} onChange={(event) => setEditDraft((previous) => ({ ...previous, signalKind: event.target.value }))}>{KIND_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                        <label><span>Privacy</span><select value={editDraft.privacyClassification} onChange={(event) => setEditDraft((previous) => ({ ...previous, privacyClassification: event.target.value }))}>{PRIVACY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                      </div>
                      <label><span>Boundary note</span><textarea value={editDraft.boundaryNote} onChange={(event) => setEditDraft((previous) => ({ ...previous, boundaryNote: event.target.value }))} rows={2} maxLength={4000} /></label>
                      <div className={styles.editActions}>
                        <button type="button" onClick={() => saveEdit(signal.signalId)} disabled={busy}>Save changes</button>
                        <button type="button" className={styles.quietButton} onClick={() => { setEditingId(null); setEditDraft(null); }} disabled={busy}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className={styles.signalCopy}>
                        <h3>{signal.headline}</h3>
                        {signal.summary && signal.summary !== signal.headline && <p>{signal.summary}</p>}
                        {signal.boundaryNote && <div className={styles.boundary}><strong>Boundary</strong><span>{signal.boundaryNote}</span></div>}
                      </div>
                      <div className={styles.signalFoot}>
                        <div>
                          <span>Observed {formatDate(signal.observedAt)}</span>
                          {signal.occurredAt && <span>Occurred {formatDate(signal.occurredAt)}</span>}
                          {signal.status === "snoozed" && signal.snoozedUntil && <span>Until {formatDate(signal.snoozedUntil)}</span>}
                          {(signal.sourceArtifactIds.length > 0 || signal.assetIds.length > 0) && <span>{signal.sourceArtifactIds.length} sources · {signal.assetIds.length} assets</span>}
                        </div>
                        <div className={styles.signalActions}>
                          <button type="button" onClick={() => beginEdit(signal)} disabled={busy}>Edit</button>
                          {signal.status === "ignored" || signal.status === "archived" || signal.status === "snoozed" ? (
                            <button type="button" onClick={() => runAction(() => application.restoreSignal(signal.signalId), "Signal restored to active review.")} disabled={busy}>Restore</button>
                          ) : (
                            <>
                              <button type="button" onClick={() => snooze24Hours(signal.signalId)} disabled={busy}>Snooze 24h</button>
                              <button type="button" onClick={() => runAction(() => application.ignoreSignal(signal.signalId), "Signal ignored. It remains in history.")} disabled={busy}>Ignore</button>
                            </>
                          )}
                          {signal.status !== "archived" && <button type="button" className={styles.quietButton} onClick={() => runAction(() => application.archiveSignal(signal.signalId), "Signal archived. Its provenance is retained.")} disabled={busy}>Archive</button>}
                        </div>
                      </div>
                    </>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
