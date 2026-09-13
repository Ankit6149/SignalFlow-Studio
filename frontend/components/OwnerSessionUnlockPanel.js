"use client";

import { useEffect, useState } from "react";
import styles from "./OwnerSessionUnlockPanel.module.css";

async function readJson(response) {
  let body = {};
  try {
    body = await response.json();
  } catch {
    body = {};
  }
  if (!response.ok) {
    const error = new Error("owner_session_request_failed");
    error.status = response.status;
    error.code = body?.code || (response.status === 401 ? "owner_session_required" : "owner_session_request_failed");
    throw error;
  }
  return body;
}

function messageFor(error) {
  if (error?.status === 401 || error?.code === "owner_session_required") return "That owner key was not accepted. Check the private workspace key and try again.";
  if (error?.code === "owner_access_unconfigured") return "Owner access is not configured on this deployment yet.";
  return "SignalFlow could not unlock the owner session right now. Please try again.";
}

export default function OwnerSessionUnlockPanel({
  title = "Unlock this workspace to continue.",
  description = "Connected work stays private until your owner session is unlocked.",
}) {
  const [state, setState] = useState({ status: "checking", misconfigured: false });
  const [ownerKey, setOwnerKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const response = await fetch("/api/session", { credentials: "same-origin", cache: "no-store" });
        const body = await readJson(response);
        if (cancelled) return;
        if (body.authenticated || body.locked === false) {
          setState({ status: "ready", misconfigured: false });
          return;
        }
        setState({ status: "locked", misconfigured: Boolean(body.misconfigured) });
      } catch {
        if (!cancelled) setState({ status: "locked", misconfigured: false });
      }
    }
    void check();
    return () => { cancelled = true; };
  }, []);

  async function unlock(event) {
    event.preventDefault();
    const accessKey = ownerKey.trim();
    if (!accessKey) return;
    setState((current) => ({ ...current, status: "unlocking" }));
    setMessage("");
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_key: accessKey }),
      });
      await readJson(response);
      setOwnerKey("");
      window.location.reload();
    } catch (error) {
      setMessage(messageFor(error));
      setState({ status: "locked", misconfigured: error?.code === "owner_access_unconfigured" });
    }
  }

  if (state.status === "checking" || state.status === "ready") return null;

  if (state.misconfigured) {
    return (
      <section className={styles.card} data-tone="attention" aria-label="Owner access unavailable">
        <div>
          <span className={styles.kicker}>Private workspace</span>
          <strong>Owner access needs deployment setup.</strong>
          <p>The hosted app cannot open private connected work until its owner access lock is configured.</p>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.card} aria-labelledby="owner-unlock-title">
      <div className={styles.copy}>
        <span className={styles.kicker}>Private workspace</span>
        <strong id="owner-unlock-title">{title}</strong>
        <p>{description}</p>
      </div>
      <form className={styles.form} onSubmit={unlock}>
        <label htmlFor="workspace-owner-key">Owner access key</label>
        <div className={styles.inputRow}>
          <input
            id="workspace-owner-key"
            type={showKey ? "text" : "password"}
            value={ownerKey}
            onChange={(event) => setOwnerKey(event.target.value)}
            placeholder="Enter the private workspace key"
            autoComplete="current-password"
            required
          />
          <button type="button" className={styles.reveal} onClick={() => setShowKey((value) => !value)} aria-label={showKey ? "Hide owner access key" : "Show owner access key"}>
            {showKey ? "Hide" : "Show"}
          </button>
        </div>
        {message && <p className={styles.error} role="alert">{message}</p>}
        <button type="submit" className={styles.primary} disabled={!ownerKey.trim() || state.status === "unlocking"}>
          {state.status === "unlocking" ? "Unlocking…" : "Unlock & continue"}
        </button>
        <small>The key is exchanged for the secure owner session and is not saved by this panel. Never paste it into chat.</small>
      </form>
    </section>
  );
}
