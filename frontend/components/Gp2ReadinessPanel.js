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
const RUNTIME_STATUS = /^[a-z0-9_-]{1,64}$/;

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

function safeBlockedBy(values, currentId) {
  return Array.isArray(values)
    ? Array.from(new Set(values
      .map((value) => String(value || "").trim())
      .filter((value) => CHECK_LABELS[value] && value !== currentId)))
      .slice(0, CHECK_IDS.length)
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
    const runtimeStatusValue = String(item?.runtimeStatus || "").trim().toLowerCase();
    byId.set(id, Object.freeze({
      id,
      label: CHECK_LABELS[id],
      configured: item.configured === true,
      missing: safeMissing(item.missing),
      blockedBy: safeBlockedBy(item.blockedBy, id),
      environment: environmentValue && CAPTURE_ENVIRONMENT.test(environmentValue) ? environmentValue : null,
      liveChecked: item.liveChecked === true,
      runtimeStatus: runtimeStatusValue && RUNTIME_STATUS.test(runtimeStatusValue) ? runtimeStatusValue : null,
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

function readinessState(item) {
  if (item.configured) return "ready";
  if (item.missing.length === 0 && item.blockedBy.length > 0) return "blocked";
  return "missing";
}

function runtimeStatusLabel(value) {
  switch (value) {
    case "ready": return "reachable";
    case "unreachable": return "unreachable";
    case "protocol_error": return "protocol error";
    case "configuration_invalid": return "invalid configuration";
    default: return "unavailable";
  }
}

export default function Gp2ReadinessPanel() {
  const [state, setState] = useState({ loading: true, readiness: null, error: null });

  async function refresh({ liveCapture = false } = {}) {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const endpoint = liveCapture ? "/api/gp2/readiness?capture_probe=1" : "/api/gp2/readiness";
      const response = await fetch(endpoint, {
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
  const directMissingCount = checks.filter((item) => readinessState(item) === "missing").length;

  return (
    <section className={styles.panel} aria-labelledby="gp2-readiness-title">
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Automation health</p>
          <h2 id="gp2-readiness-title">Can SignalFlow run the full GitHub workflow?</h2>
          <p>This is a technical health check for the automation behind GitHub evidence, screenshots, and exact review. It should support the connection flow—not become the connection flow.</p>
        </div>
        <div className={styles.actions}>
          {totalCount > 0 && <span className={styles.summary}>{readyCount}/{totalCount} ready</span>}
          <button type="button" onClick={() => void refresh({ liveCapture: true })} disabled={state.loading}>
            {state.loading ? "Checking…" : "Test browser worker"}
          </button>
          <button type="button" onClick={() => void refresh()} disabled={state.loading}>
            {state.loading ? "Checking…" : "Recheck"}
          </button>
        </div>
      </div>

      {state.loading ? (
        <div className={styles.statusBox}>Checking protected automation health…</div>
      ) : state.error?.status === 401 ? (
        <div className={styles.statusBox} data-tone="neutral">
          <strong>Automation details are private</strong>
          <p>Unlock the workspace in the GitHub connection section above. This health check will become available automatically in the same owner session.</p>
        </div>
      ) : state.error?.code === "owner_access_unconfigured" ? (
        <div className={styles.statusBox} data-tone="attention">
          <strong>Owner lock configuration required</strong>
          <p>This public hosted deployment must configure its private owner access lock before protected automation readiness can be inspected.</p>
        </div>
      ) : state.error ? (
        <div className={styles.statusBox} data-tone="attention">
          <strong>Automation health check unavailable</strong>
          <p>SignalFlow could not read the protected readiness contract. The connection workflow remains unchanged; recheck after the owner session and deployment are healthy.</p>
        </div>
      ) : (
        <>
          <div className={styles.overall} data-ready={state.readiness.ready}>
            <div>
              <strong>{state.readiness.ready ? "Automation infrastructure is ready" : `${directMissingCount} direct setup ${directMissingCount === 1 ? "item" : "items"} still need attention`}</strong>
              <span>{state.readiness.ready ? "The production dependencies needed for the full workflow are configured." : "Fix the direct setup items once. Downstream blocked checks will clear when their dependency becomes ready."}</span>
            </div>
            <i aria-hidden="true" />
          </div>

          <details className={styles.details}>
            <summary>
              <span>Technical readiness details</span>
              <small>{readyCount} of {totalCount} checks ready</small>
            </summary>
            <p className={styles.detailsIntro}>Each missing setting is shown only at the dependency that owns it. The browser worker live check runs only when you request it because opening a remote browser connection can consume provider runtime.</p>
            <div className={styles.grid}>
              {checks.map((item) => {
                const itemState = readinessState(item);
                return (
                  <article className={styles.check} key={item.id} data-state={itemState}>
                    <div className={styles.checkHeading}>
                      <span className={styles.dot} aria-hidden="true" />
                      <strong>{item.label}</strong>
                      <small>{itemState === "ready" ? "Ready" : itemState === "blocked" ? "Blocked" : "Missing"}</small>
                    </div>
                    {item.environment && <p>Capture environment: <code>{item.environment}</code></p>}
                    {item.id === "capture_worker" && item.liveChecked && (
                      <p>Live worker check: <strong>{runtimeStatusLabel(item.runtimeStatus)}</strong></p>
                    )}
                    {item.missing.length > 0 && (
                      <ul className={styles.missing} aria-label={`Missing settings for ${item.label}`}>
                        {item.missing.map((name) => <li key={name}><code>{name}</code></li>)}
                      </ul>
                    )}
                    {item.blockedBy.length > 0 && (
                      <p className={styles.blocked}>
                        Blocked by {item.blockedBy.map((id) => CHECK_LABELS[id]).join(", ")}. It will recheck automatically after that dependency is configured.
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          </details>
        </>
      )}
    </section>
  );
}