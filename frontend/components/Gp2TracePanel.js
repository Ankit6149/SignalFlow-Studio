"use client";

import { useState } from "react";
import styles from "./Gp2TracePanel.module.css";

const SHA_PATTERN = /^[a-f0-9]{40,64}$/i;
const LABELS = Object.freeze({
  signal: "Signal",
  opportunity_job: "Opportunity job",
  opportunity: "Opportunity",
  exact_context: "Exact context",
  planning: "Planning",
  media: "Media",
  review: "Review",
  approval: "Approval",
});

async function readJson(response) {
  const text = await response.text();
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = {}; }
  if (!response.ok) {
    const error = new Error(body?.error || body?.code || `request_failed_${response.status}`);
    error.code = body?.code || `request_failed_${response.status}`;
    error.status = response.status;
    throw error;
  }
  return body;
}

function normalizeInspection(body) {
  const inspection = body?.inspection;
  if (!inspection || !Array.isArray(inspection.stages)) {
    const error = new Error("gp2_inspection_contract_invalid");
    error.code = "gp2_inspection_contract_invalid";
    throw error;
  }
  return {
    sourceRevision: String(inspection.sourceRevision || ""),
    stoppedAt: inspection.stoppedAt ? String(inspection.stoppedAt) : null,
    stages: inspection.stages
      .map((item) => ({
        id: String(item?.id || ""),
        status: String(item?.status || ""),
      }))
      .filter((item) => LABELS[item.id] && item.status),
  };
}

function statusLabel(value) {
  return String(value || "").replaceAll("_", " ");
}

export default function Gp2TracePanel() {
  const [revision, setRevision] = useState("");
  const [state, setState] = useState({ loading: false, inspection: null, error: null });
  const normalizedRevision = revision.trim().toLowerCase();
  const validRevision = SHA_PATTERN.test(normalizedRevision);

  async function inspect(event) {
    event.preventDefault();
    if (!validRevision) return;
    setState({ loading: true, inspection: null, error: null });
    try {
      const response = await fetch(`/api/gp2/inspect?source_revision=${encodeURIComponent(normalizedRevision)}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      const body = await readJson(response);
      setState({ loading: false, inspection: normalizeInspection(body), error: null });
    } catch (error) {
      setState({ loading: false, inspection: null, error });
    }
  }

  return (
    <section className={styles.panel} aria-labelledby="gp2-trace-title">
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Acceptance trace</p>
          <h2 id="gp2-trace-title">Trace one exact GitHub event</h2>
          <p>Use the merged Git SHA to see where GP2 stopped. This inspector is read-only and exposes only safe stage/status data.</p>
        </div>
      </div>

      <form className={styles.form} onSubmit={inspect}>
        <label htmlFor="gp2-source-revision">Exact Git commit SHA</label>
        <div className={styles.inputRow}>
          <input
            id="gp2-source-revision"
            value={revision}
            onChange={(event) => setRevision(event.target.value)}
            placeholder="40-character merge commit SHA"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={revision.length > 0 && !validRevision}
          />
          <button type="submit" disabled={!validRevision || state.loading}>
            {state.loading ? "Tracing…" : "Trace event"}
          </button>
        </div>
        {revision.length > 0 && !validRevision && <small>Enter an exact Git commit SHA.</small>}
      </form>

      {state.error && (
        <div className={styles.message} data-tone="attention">
          <strong>Trace unavailable</strong>
          <span>{state.error.status === 401 ? "Unlock the owner workspace, then try again." : "SignalFlow could not inspect this revision safely."}</span>
        </div>
      )}

      {state.inspection && (
        <div className={styles.result}>
          <div className={styles.resultSummary}>
            <strong>{state.inspection.stoppedAt ? `Stopped at ${LABELS[state.inspection.stoppedAt] || state.inspection.stoppedAt}` : "GP2 trace is complete"}</strong>
            <code>{state.inspection.sourceRevision.slice(0, 12)}…</code>
          </div>
          <div className={styles.stages}>
            {state.inspection.stages.map((item) => (
              <div className={styles.stage} key={item.id} data-status={item.status}>
                <span>{LABELS[item.id]}</span>
                <small>{statusLabel(item.status)}</small>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
