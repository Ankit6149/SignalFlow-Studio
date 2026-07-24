"use client";

import { useEffect } from "react";

const ACCESS_TOKEN_KEY = "signalflow_owner_token";
const SYNC_MARKER_KEY = "signalflow_owner_cookie_synced";

/**
 * Migrates owner bearer sessions created by older SignalFlow builds into the
 * new HTTP-only cookie used by OAuth redirects. It never reads social tokens.
 */
export default function SessionBridge() {
  useEffect(() => {
    const token = window.localStorage.getItem(ACCESS_TOKEN_KEY) || "";
    if (!token || window.sessionStorage.getItem(SYNC_MARKER_KEY) === token) {
      return;
    }

    let cancelled = false;
    fetch("/api/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: "{}",
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Owner session synchronization failed");
        }
        const data = await response.json();
        if (!cancelled && data.token) {
          window.localStorage.setItem(ACCESS_TOKEN_KEY, data.token);
          window.sessionStorage.setItem(SYNC_MARKER_KEY, data.token);
        }
      })
      .catch(() => {
        if (!cancelled) {
          window.sessionStorage.removeItem(SYNC_MARKER_KEY);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
