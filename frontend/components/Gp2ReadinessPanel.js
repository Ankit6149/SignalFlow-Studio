"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./Gp2ReadinessPanel.module.css";

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

function safeMissing(values) {
  return Array.isArray(values)
    ? values.map((value) => String(value || "").trim()).filter(Boolean).slice(0, 16)
    : [];
}

export default function Gp2ReadinessPanel() {
  const [state, setState] = useState({ loading: true, readiness: null, error: null });

  async function refresh() {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const response = await fetch("/api/gp2/readiness", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const body = await readJson(response);
      setState({ loading: false, readiness: body?.gp2 || null, error: null });
    } catch (error) {
      setState({ loading: false, readiness: null, error });
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const checks = useMemo(
    () => Array.isArray(state.readiness?.checks) ? state.readiness.checks : [],
    [state.readiness],
  );
  const readyCount = checks.filter((item) => item?.configured === true).length;
  const totalCount = checks.length;

  return (
    <section className={styles.panel} aria-labelledby="gp2-readiness-title">
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Golden Path 2</p>
          <h2 id="gp2-readiness-title">Production readiness</h2>
          <p>Owner-safe deployment checks for the GitHub → evidence → screenshot → exact-review path. Only configuration state and missing setting names are shown; credential values never leave the server.</p>
        </div>
        <div className={styles.actions}>
          {totalCount > 0 && <span className={styles.summary}>{readyCount}/{totalCount} ready</span>}
          <button type="button" onClick={() => void refresh()} disabled={state.loading}>
            {state.loading ? "Checking…" : "Recheck"}
          </button>
        </div>
      </div>

      {state.loading ? (
        <div className={styles.statusBox}>Checking protected production readiness…</div>
      ) : state.error?.status === 401 ? (
        <div className={styles.statusBox} data-tone="attention">
          <strong>Owner session required</strong>
          <p>Unlock the private workspace in Settings, then return here and recheck readiness.</p>
          <a href="/?workspace=settings">Open Settings</a>
        </div>
      ) : state.error ? (
        <div className={styles.statusBox} data-tone="attention">
          <strong>Readiness check unavailable</strong>
          <p>SignalFlow could not read the protected readiness contract. The connection workflow remains unchanged; recheck after the owner session and deployment are healthy.</p>
        </div>
      ) : (
        <>
          <div className={styles.overall} data-ready={state.readiness?.ready === true}>
            <strong>{state.readiness?.ready ? "GP2 infrastructure ready" : "GP2 infrastructure needs configuration"}</strong>
            <span>{state.readiness?.ready ? "The required production dependency classes are configured." : "Resolve the named deployment settings below before live owner acceptance."}</span>
          </div>

          <div className={styles.grid}>
            {checks.map((item) => {
              const missing = safeMissing(item?.missing);
              return (
                <article className={styles.check} key={item.id || item.label} data-ready={item?.configured === true}>
                  <div className={styles.checkHeading}>
                    <span className={styles.dot} aria-hidden="true" />
                    <strong>{item.label || item.id || "Readiness check"}</strong>
                    <small>{item?.configured === true ? "Ready" : "Missing"}</small>
                  </div>
                  {item?.environment && <p>Capture environment: <code>{String(item.environment)}</code></p>}
                  {missing.length > 0 && (
                    <div className={styles.missing} aria-label={`Missing settings for ${item.label || item.id}`}>
                      {missing.map((name) => <code key={name}>{name}</code>)}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
