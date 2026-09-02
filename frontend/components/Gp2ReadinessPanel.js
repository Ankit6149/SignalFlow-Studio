"use client";

import { useEffect, useState } from "react";
import styles from "./Gp2ReadinessPanel.module.css";

const CHECK_LABELS = Object.freeze({
  database: "Durable database",
  owner_lock: "Owner access lock",
  github_app: "GitHub App connection",
  github_webhook: "GitHub webhook verification",
  private_asset_storage: "Private Asset storage",
  capture_worker: "Bounded screenshot worker",
  exact_media_preview: "Exact media visibility receipts",
  inference: "Hosted inference route",
});
const CHECK_IDS = Object.freeze(Object.keys(CHECK_LABELS));
const CONFIGURATION_NAME = /^[A-Z0-9_+|.-]{1,240}$/;
const CAPTURE_ENVIRONMENT = /^[a-z0-9_-]{2,40}$/;

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
    ? values
      .map((value) => String(value || "").trim())
      .filter((value) => CONFIGURATION_NAME.test(value))
      .slice(0, 16)
    : [];
}

function normalizeReadiness(body) {
  const raw = body?.gp2;
  if (!raw || typeof raw.ready !== "boolean" || !Array.isArray(raw.checks)) {
    const error = new Error("gp2_readiness_contract_invalid");
    error.code = "gp2_readiness_contract_invalid";
    throw error;
  }

  const byId = new Map();
  for (const item of raw.checks) {
    const id = String(item?.id || "").trim();
    if (!CHECK_LABELS[id] || typeof item?.configured !== "boolean" || byId.has(id)) {
      const error = new Error("gp2_readiness_contract_invalid");
      error.code = "gp2_readiness_contract_invalid";
      throw error;
    }
    const environmentValue = String(item?.environment || "").trim().toLowerCase();
    byId.set(id, Object.freeze({
      id,
      label: CHECK_LABELS[id],
      configured: item.configured === true,
      missing: safeMissing(item.missing),
      environment: environmentValue && CAPTURE_ENVIRONMENT.test(environmentValue) ? environmentValue : null,
    }));
  }

  if (raw.checks.length !== CHECK_IDS.length || CHECK_IDS.some((id) => !byId.has(id))) {
    const error = new Error("gp2_readiness_contract_invalid");
    error.code = "gp2_readiness_contract_invalid";
    throw error;
  }

  const checks = CHECK_IDS.map((id) => byId.get(id));
  return Object.freeze({
    ready: raw.ready === true && checks.every((item) => item.configured),
    checks,
  });
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
      setState({ loading: false, readiness: normalizeReadiness(body), error: null });
    } catch (error) {
      setState({ loading: false, readiness: null, error });
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const checks = state.readiness?.checks || [];
  const readyCount = checks.filter((item) => item.configured).length;
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
      ) : state.error?.code === "owner_access_unconfigured" ? (
        <div className={styles.statusBox} data-tone="attention">
          <strong>Owner lock configuration required</strong>
          <p>This public hosted deployment must configure its private owner access lock before protected GP2 readiness can be inspected.</p>
        </div>
      ) : state.error ? (
        <div className={styles.statusBox} data-tone="attention">
          <strong>Readiness check unavailable</strong>
          <p>SignalFlow could not read the protected readiness contract. The connection workflow remains unchanged; recheck after the owner session and deployment are healthy.</p>
        </div>
      ) : (
        <>
          <div className={styles.overall} data-ready={state.readiness.ready}>
            <strong>{state.readiness.ready ? "GP2 infrastructure ready" : "GP2 infrastructure needs configuration"}</strong>
            <span>{state.readiness.ready ? "The required production dependency classes are configured." : "Resolve the named deployment settings below before live owner acceptance."}</span>
          </div>

          <div className={styles.grid}>
            {checks.map((item) => (
              <article className={styles.check} key={item.id} data-ready={item.configured}>
                <div className={styles.checkHeading}>
                  <span className={styles.dot} aria-hidden="true" />
                  <strong>{item.label}</strong>
                  <small>{item.configured ? "Ready" : "Missing"}</small>
                </div>
                {item.environment && <p>Capture environment: <code>{item.environment}</code></p>}
                {item.missing.length > 0 && (
                  <div className={styles.missing} aria-label={`Missing settings for ${item.label}`}>
                    {item.missing.map((name) => <code key={name}>{name}</code>)}
                  </div>
                )}
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
