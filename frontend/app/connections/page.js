"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ConnectionsWorkspace from "../../components/ConnectionsWorkspace";
import WorkspaceShell from "../../components/WorkspaceShell";
import { CHANNELS, OFFICIAL_CONNECTORS } from "../../lib/studio/studioCatalog.mjs";
import { useOwnerConnectionsController } from "../../lib/studio/useOwnerConnectionsController.js";

export default function ConnectionsPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const {
    connections,
    connectionsLoading,
    accessToken,
    syncOwnerSession,
    refreshConnections,
    connectPlatform,
    disconnectPlatform,
  } = useOwnerConnectionsController({
    setBusy,
    setMessage,
    onRequireOwnerUnlock: () => router.push("/settings"),
  });

  useEffect(() => {
    void syncOwnerSession();

    const params = new URLSearchParams(window.location.search);
    const socialStatus = params.get("social_status");
    const socialMessage = params.get("social_message");
    if (socialStatus) {
      setMessage({
        type: socialStatus === "success" ? "success" : "error",
        text: socialMessage || "Connector flow completed.",
      });
      const next = new URL(window.location.href);
      next.searchParams.delete("social_status");
      next.searchParams.delete("social_message");
      window.history.replaceState({}, "", `${next.pathname}${next.search}`);
    }
  }, []);

  useEffect(() => {
    void refreshConnections();
  }, [accessToken]);

  function useChannelInStudio(channelId) {
    router.push(`/studio?channel=${encodeURIComponent(channelId)}`);
  }

  return (
    <WorkspaceShell
      activeItem="connections"
      statusLabel={accessToken ? "Owner session active" : "Owner access locked"}
      statusTone={accessToken ? "ready" : "attention"}
    >
      {message && (
        <div className={`toast toast--${message.type}`} role="status" aria-live="polite">
          <span>{message.text}</span>
          <button aria-label="Dismiss message" onClick={() => setMessage(null)}>×</button>
        </div>
      )}
      <ConnectionsWorkspace
        channels={CHANNELS}
        officialConnectorIds={Array.from(OFFICIAL_CONNECTORS)}
        connections={connections}
        ownerSessionActive={Boolean(accessToken)}
        loading={connectionsLoading}
        busy={busy}
        onRefresh={refreshConnections}
        onConnect={connectPlatform}
        onDisconnect={disconnectPlatform}
        onUseInStudio={useChannelInStudio}
      />
    </WorkspaceShell>
  );
}
