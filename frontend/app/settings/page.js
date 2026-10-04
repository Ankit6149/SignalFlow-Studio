"use client";

import { useEffect, useMemo, useState } from "react";
import SettingsWorkspace from "../../components/SettingsWorkspace";
import WorkspaceShell from "../../components/WorkspaceShell";
import { createBrowserCampaignApplication } from "../../lib/application/browserCampaignApplication.mjs";
import { downloadText } from "../../lib/browser/browserDownload.mjs";
import { useOwnerConnectionsController } from "../../lib/studio/useOwnerConnectionsController.js";

const LIBRARY_KEY = "signalflow_recovery_library";

export default function SettingsPage() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const campaignApplication = useMemo(() => createBrowserCampaignApplication({
    getStorage: () => window.localStorage,
    key: LIBRARY_KEY,
    limit: 30,
  }), []);
  const {
    accessToken,
    ownerKey,
    setOwnerKey,
    syncOwnerSession,
    unlockOwnerSession,
    lockOwnerSession,
  } = useOwnerConnectionsController({
    setBusy,
    setMessage,
  });

  useEffect(() => {
    void syncOwnerSession();
  }, []);

  async function exportLocalLibrary() {
    try {
      const library = await campaignApplication.listCampaigns();
      downloadText(
        "signalflow-local-library.json",
        JSON.stringify(library, null, 2),
        "application/json",
      );
    } catch {
      setMessage({
        type: "error",
        text: "The browser could not read the local campaign library for export.",
      });
    }
  }

  function clearLocalLibrary() {
    if (!window.confirm("Clear the local campaign library?")) return;
    window.localStorage.removeItem(LIBRARY_KEY);
  }

  return (
    <WorkspaceShell
      activeItem="settings"
      statusLabel={accessToken ? "Owner session active" : "Owner access locked"}
      statusTone={accessToken ? "ready" : "attention"}
    >
      {message && (
        <div className={`toast toast--${message.type}`} role="status" aria-live="polite">
          <span>{message.text}</span>
          <button aria-label="Dismiss message" onClick={() => setMessage(null)}>×</button>
        </div>
      )}
      <SettingsWorkspace
        ownerSessionActive={Boolean(accessToken)}
        ownerKey={ownerKey}
        busy={busy}
        onOwnerKeyChange={setOwnerKey}
        onUnlockOwner={unlockOwnerSession}
        onLockOwner={lockOwnerSession}
        onExportLibrary={exportLocalLibrary}
        onClearLibrary={clearLocalLibrary}
      />
    </WorkspaceShell>
  );
}
