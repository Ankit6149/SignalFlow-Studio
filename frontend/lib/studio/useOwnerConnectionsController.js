"use client";

import { useState } from "react";
import {
  disconnectSocial as disconnectSocialAccount,
  getOwnerSession as getOwnerApiSession,
  getSocialStatus as getSocialConnectionStatus,
  lockOwnerSession as lockOwnerApiSession,
  unlockOwnerSession as unlockOwnerApiSession,
} from "./studioApiClient.mjs";

export function useOwnerConnectionsController({
  setBusy,
  setMessage,
  onRequireOwnerUnlock,
}) {
  const [connections, setConnections] = useState({});
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [ownerKey, setOwnerKey] = useState("");

  async function syncOwnerSession() {
    try {
      const { data } = await getOwnerApiSession();
      setAccessToken(data.authenticated ? "cookie-session" : "");
    } catch {
      setAccessToken("");
    }
  }

  async function refreshConnections() {
    setConnectionsLoading(true);
    try {
      const { response, data } = await getSocialConnectionStatus();
      if (!response.ok) throw new Error("Owner access is required to inspect official connectors.");
      setConnections(data.platforms || {});
    } catch {
      setConnections({});
    } finally {
      setConnectionsLoading(false);
    }
  }

  function connectPlatform(platform) {
    if (!accessToken) {
      onRequireOwnerUnlock?.();
      setMessage({
        type: "warning",
        text: "Unlock the owner session before connecting an official account.",
      });
      return;
    }
    window.location.assign(`/api/social/connect?platform=${encodeURIComponent(platform)}`);
  }

  async function disconnectPlatform(platform) {
    setBusy(true);
    setMessage(null);
    try {
      const { response, data } = await disconnectSocialAccount(platform);
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Could not disconnect this account.");
      }
      setMessage({ type: "success", text: data.message });
      await refreshConnections();
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function unlockOwnerSession() {
    if (!ownerKey.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      const { response, data } = await unlockOwnerApiSession(ownerKey);
      if (!response.ok) throw new Error(data.error || "The owner key was not accepted.");
      setAccessToken(data.authenticated ? "cookie-session" : "");
      setOwnerKey("");
      setMessage({
        type: "success",
        text: data.locked === false ? "Access lock is disabled for this deployment." : "Owner session unlocked.",
      });
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function lockOwnerSession() {
    await lockOwnerApiSession().catch(() => null);
    setAccessToken("");
    setConnections({});
    setMessage({ type: "success", text: "Owner session closed." });
  }

  return {
    connections,
    connectionsLoading,
    accessToken,
    ownerKey,
    setOwnerKey,
    syncOwnerSession,
    refreshConnections,
    connectPlatform,
    disconnectPlatform,
    unlockOwnerSession,
    lockOwnerSession,
  };
}
