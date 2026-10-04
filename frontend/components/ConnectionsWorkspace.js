"use client";

import PlatformIcon from "./PlatformIcon";

function formatDate(value) {
  if (!value) return "Just now";
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function channelMeta(channels, id) {
  return channels.find((channel) => channel.id === id) || {
    id,
    label: id,
    openUrl: "",
  };
}

export default function ConnectionsWorkspace({
  channels,
  officialConnectorIds,
  connections,
  ownerSessionActive,
  loading,
  busy,
  onRefresh,
  onConnect,
  onDisconnect,
  onUseInStudio,
}) {
  const officialConnectors = new Set(officialConnectorIds);
  const inspected = Boolean(ownerSessionActive && Object.keys(connections).length > 0);

  return (
    <main className="secondary-page" id="workspace-content">
      <header className="secondary-heading">
        <div>
          <p className="eyebrow eyebrow--dark">
            <span /> Publishing paths
          </p>
          <h1>Every destination has a clear next step.</h1>
          <p>
            Official connectors publish only after approval. Manual destinations stay useful with a
            copy, export, and open-platform path.
          </p>
        </div>
        <button className="button button--outline" onClick={onRefresh} disabled={loading}>
          {loading ? "Checking…" : "Refresh status"}
        </button>
      </header>

      <section className="connection-summary" aria-label="Publishing connection summary">
        <div>
          <strong>{officialConnectorIds.length}</strong>
          <span>Official OAuth routes</span>
        </div>
        <div>
          <strong>{channels.length - officialConnectorIds.length}</strong>
          <span>Export-ready destinations</span>
        </div>
        <div>
          <strong>100%</strong>
          <span>Review before action</span>
        </div>
      </section>

      <section className="connector-readiness" aria-labelledby="connector-readiness-title">
        <div className="connector-readiness__heading">
          <div>
            <h2 id="connector-readiness-title">Official connector readiness</h2>
            <p>Implementation, deployment credentials, account authorization, and live post verification are separate gates.</p>
          </div>
        </div>
        <div className="connector-readiness__grid">
          {officialConnectorIds.map((platformId) => {
            const status = connections[platformId] || {};
            const ready = Boolean(
              inspected &&
                status.configured &&
                status.connected &&
                status.verified &&
                status.scopeStatus === "verified" &&
                status.canPublishText &&
                !status.expired,
            );
            const readinessLabel = loading
              ? "Checking"
              : !inspected
                ? "Unlock to inspect"
                : ready
                  ? "Ready for text"
                  : status.expired
                    ? "Expired"
                    : status.scopeStatus === "insufficient"
                      ? "Missing scope"
                      : status.connected && !status.canPublishText
                        ? "Capability blocked"
                        : status.configured
                          ? "Needs authorization"
                          : "Needs credentials";

            return (
              <article key={platformId} className="connector-readiness__card">
                <header>
                  <h3>{channelMeta(channels, platformId).label}</h3>
                  <span className={`readiness-state ${ready ? "is-ready" : ""}`}>{readinessLabel}</span>
                </header>
                <ul>
                  <li>Credentials: {!inspected ? "unlock and refresh to inspect" : status.configured ? "configured" : "missing in deployment"}</li>
                  <li>
                    Identity: {!inspected
                      ? "not inspected"
                      : status.verified
                        ? status.profile?.username || status.profile?.name || "verified account"
                        : "not verified"}
                  </li>
                  <li>Authorization: {!inspected ? "not inspected" : status.expired ? "expired" : status.connected ? "active" : "not completed"}</li>
                  <li>
                    Scopes: {!inspected
                      ? "not inspected"
                      : status.scopeStatus === "verified"
                        ? (status.grantedScopes || []).join(" · ") || "verified"
                        : status.scopeStatus === "insufficient"
                          ? `missing ${(status.missingScopes || []).join(", ")}`
                          : "not verified"}
                  </li>
                  <li>
                    Direct capabilities: {!inspected
                      ? "not inspected"
                      : (status.publishCapabilities || []).length
                        ? status.publishCapabilities.join(" · ")
                        : "none verified"}
                  </li>
                  <li>Expiry: {!inspected ? "not inspected" : status.expiresAt ? formatDate(status.expiresAt) : "provider did not supply an expiry"}</li>
                  <li>Last verified: {!inspected ? "not inspected" : status.verifiedAt ? formatDate(status.verifiedAt) : "not verified"}</li>
                  <li>Refresh token: {!inspected ? "not inspected" : status.hasRefreshToken ? "stored server-side" : "not available"}</li>
                  <li>Live post verification: {status.readiness?.publishTest === "available_for_live_test" ? "still required" : "blocked until ready"}</li>
                  {status.callbackUrl && <li>Callback: <code>{status.callbackUrl}</code></li>}
                </ul>
              </article>
            );
          })}
        </div>
      </section>

      <div className="connections-grid">
        {channels.map((channel) => {
          const status = connections[channel.id];
          const official = officialConnectors.has(channel.id);
          const connected = Boolean(status?.connected && status?.verified && !status?.expired && !status?.manualOnly);
          const publishReady = Boolean(connected && status?.canPublishText && status?.scopeStatus === "verified");
          const canConnect = official && Boolean(status?.configured);
          let description = status?.reason;

          if (!description && publishReady) {
            description = `Verified as ${status?.profile?.username || status?.profile?.name || "official account"}. Text publishing capability is available.`;
          }
          if (!description && connected && status?.scopeStatus === "insufficient") {
            description = `Identity verified, but required publishing scopes are missing: ${(status?.missingScopes || []).join(", ") || "unknown scope"}.`;
          }
          if (!description && connected && !status?.canPublishText) {
            description = "Identity verified, but direct text publishing is not currently authorized.";
          }
          if (!description && status?.expired) {
            description = "The stored session expired. Reconnect this account.";
          }
          if (!description && ownerSessionActive && canConnect) {
            description = "Official connector is configured and ready to connect.";
          }
          if (!description && ownerSessionActive && official) {
            description = "OAuth credentials are not configured in the deployment environment.";
          }
          if (!description && official) {
            description = "Unlock the owner session to inspect and connect the official publishing route.";
          }
          if (!description) {
            description = channel.openUrl
              ? `Generate the draft, copy it, and open ${channel.label} from the review workspace.`
              : "Generate and copy the approved draft into your existing publishing workflow.";
          }

          return (
            <article key={channel.id} className={`connection-card ${official ? "is-official" : ""}`}>
              <div className="connection-card__mark">
                <PlatformIcon platform={channel.id} size={23} branded />
              </div>
              <div className="connection-card__body">
                <div className="connection-card__title">
                  <h2>{channel.label}</h2>
                  {official && <span>Official API</span>}
                </div>
                <p>{description}</p>
              </div>
              <div className="connection-card__actions">
                <span className={publishReady ? "status-tag status-tag--ready" : "status-tag"}>
                  {publishReady
                    ? "Verified · text"
                    : status?.expired
                      ? "Expired"
                      : connected
                        ? "Connected · limited"
                        : official
                          ? "Not connected"
                          : "Export ready"}
                </span>
                {connected && (
                  <button
                    className="connector-action connector-action--quiet"
                    onClick={() => onDisconnect(channel.id)}
                    disabled={busy}
                  >
                    Disconnect
                  </button>
                )}
                {!connected && canConnect && (
                  <button
                    className="connector-action"
                    onClick={() => onConnect(channel.id)}
                    disabled={busy}
                  >
                    Connect
                  </button>
                )}
                {!official && (
                  <button
                    className="connector-action connector-action--quiet"
                    onClick={() => onUseInStudio(channel.id)}
                  >
                    Use in Studio
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <div className="truth-panel">
        <div>
          <span>Why this matters</span>
          <h2>Professional automation starts with truthful states.</h2>
        </div>
        <p>
          SignalFlow reports success only after a platform API confirms it. OAuth state and tokens are
          encrypted in HTTP-only cookies, while manual channels remain explicit instead of pretending to
          be connected.
        </p>
      </div>
    </main>
  );
}
