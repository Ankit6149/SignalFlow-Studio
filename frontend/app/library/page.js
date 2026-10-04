"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import LibraryWorkspace from "../../components/LibraryWorkspace";
import WorkspaceShell from "../../components/WorkspaceShell";
import { createBrowserCampaignApplication } from "../../lib/application/browserCampaignApplication.mjs";
import { CHANNELS } from "../../lib/studio/studioCatalog.mjs";
import { useCampaignEditorSession } from "../../lib/studio/CampaignEditorSessionContext.js";

const LIBRARY_KEY = "signalflow_recovery_library";

export default function LibraryPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState([]);
  const [message, setMessage] = useState(null);
  const {
    currentCampaignId,
    setCurrentCampaignId,
    resetEditorSession,
    restoreEditorSession,
  } = useCampaignEditorSession();
  const campaignApplication = useMemo(() => createBrowserCampaignApplication({
    getStorage: () => window.localStorage,
    key: LIBRARY_KEY,
    limit: 30,
  }), []);

  async function refreshLibrary() {
    try {
      setCampaigns(await campaignApplication.listCampaigns());
    } catch {
      setMessage({
        type: "error",
        text: "The browser could not read or migrate the local campaign library.",
      });
    }
  }

  useEffect(() => {
    void refreshLibrary();
  }, []);

  function startNewCampaign() {
    resetEditorSession();
    router.push("/studio");
  }

  function openCampaign(item) {
    try {
      const restored = campaignApplication.openCampaign(item);
      restoreEditorSession(restored);
      router.push("/studio");
    } catch {
      setMessage({
        type: "error",
        text: "This saved campaign could not be migrated or opened safely.",
      });
    }
  }

  async function deleteCampaign(campaignId) {
    if (!window.confirm("Delete this saved campaign from the current browser?")) return;
    try {
      await campaignApplication.deleteCampaign(campaignId);
      await refreshLibrary();
      if (currentCampaignId === campaignId) setCurrentCampaignId("");
    } catch {
      setMessage({
        type: "error",
        text: "The browser could not update the local campaign library.",
      });
    }
  }

  return (
    <WorkspaceShell activeItem="library" statusLabel="Browser-local library" statusTone="ready">
      {message && (
        <div className={`toast toast--${message.type}`} role="status" aria-live="polite">
          <span>{message.text}</span>
          <button aria-label="Dismiss message" onClick={() => setMessage(null)}>×</button>
        </div>
      )}
      <LibraryWorkspace
        campaigns={campaigns}
        channels={CHANNELS}
        onLibraryChanged={refreshLibrary}
        onNewCampaign={startNewCampaign}
        onOpenCampaign={openCampaign}
        onDeleteCampaign={deleteCampaign}
      />
    </WorkspaceShell>
  );
}
