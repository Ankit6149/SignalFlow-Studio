"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./GithubSourceConnectionPanel.module.css";

const STATUS_LABELS = Object.freeze({
  pending: "Needs repository",
  active: "Observing",
  paused: "Paused",
  error: "Needs attention",
  revoked: "Disconnected",
});

async function readJson(response) {
  const text = await response.text();
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = {}; }
  if (!response.ok) {
    const error = new Error(body?.error || body?.code || `request_failed_${response.status}`);
    error.code = body?.code || body?.error || `request_failed_${response.status}`;
    error.status = response.status;
    throw error;
  }
  return body;
}

function friendlyError(error) {
  const code = String(error?.code || "");
  if (error?.status === 401) return "Unlock the owner session in Settings before changing source connections.";
  if (code === "github_app_unconfigured") return "GitHub App setup is not configured on this deployment yet.";
  if (code === "github_connection_not_verified") return "Finish the verified GitHub installation before choosing a repository.";
  if (code === "github_connection_not_active") return "The GitHub source must stay active while SignalFlow builds project understanding.";
  if (code === "github_user_authorization_denied" || code === "github_user_authorization_failed") return "GitHub did not authorize this installation for the current owner. Reconnect and approve the App before continuing.";
  if (code === "github_installation_permissions_insufficient") return "The GitHub App installation is missing required repository read permissions. Update the App permissions and reconnect.";
  if (code === "github_installation_suspended") return "This GitHub App installation is suspended. Restore it in GitHub before resuming SignalFlow.";
  if (code === "github_repository_not_observable") return "That repository is archived or disabled and cannot be observed automatically.";
  if (code === "github_repository_scope_mismatch") return "That repository is no longer authorized by this GitHub source connection.";
  if (code === "github_repository_tree_truncated" || code === "github_repository_tree_too_large") return "SignalFlow refused to infer from an incomplete repository tree. The connection remains active; bounded support for larger repositories can be added without reconnecting.";
  if (code === "github_repository_evidence_unavailable" || code === "github_repository_evidence_insufficient") return "The repository is connected, but SignalFlow could not find enough safe representative evidence to build trustworthy project understanding yet.";
  if (code === "inference_route_unavailable") return "The repository is connected and evidence is ready, but no permitted project-understanding model route is configured yet.";
  if (code.startsWith("project_context_") || code.startsWith("inference_")) return "The repository remains connected, but project understanding could not finish right now. You can retry without reconnecting GitHub.";
  if (code.startsWith("github_app_http_") || code.startsWith("github_repository_http_")) return "GitHub could not verify or read the repository right now. The existing connection was not changed.";
  return "SignalFlow could not complete that GitHub connection action.";
}

function statusTone(status) {
  if (status === "active") return "ready";
  if (status === "paused" || status === "pending") return "attention";
  return "muted";
}

function enabledResources(connection) {
  return Array.isArray(connection?.resourceScopes)
    ? connection.resourceScopes.filter((item) => item.enabled)
    : [];
}

function repositoryCount(connection) {
  return enabledResources(connection).length;
}

export default function GithubSourceConnectionPanel() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [configured, setConfigured] = useState(null);
  const [connections, setConnections] = useState([]);
  const [repositories, setRepositories] = useState([]);
  const [repositoryConnectionId, setRepositoryConnectionId] = useState("");
  const [message, setMessage] = useState(null);

  const activeCount = useMemo(
    () => connections.filter((item) => item.status === "active").length,
    [connections],
  );

  async function refresh({ quiet = false } = {}) {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch("/api/sources/github/connect", { cache: "no-store" });
      const body = await readJson(response);
      setConfigured(Boolean(body.configured));
      setConnections(Array.isArray(body.connections) ? body.connections : []);
      if (!body.configured) setMessage({ tone: "attention", text: "GitHub source automation needs server-side App configuration before it can be connected." });
      else if (!quiet) setMessage(null);
    } catch (error) {
      setConfigured(error?.status === 401 ? "locked" : false);
      setMessage({ tone: "attention", text: friendlyError(error) });
    } finally {
      if (!quiet) setLoading(false);
    }
  }

  async function loadRepositories(sourceConnectionId) {
    setBusy(`repositories:${sourceConnectionId}`);
    setMessage(null);
    try {
      const response = await fetch(`/api/sources/github/repositories?source_connection=${encodeURIComponent(sourceConnectionId)}`, { cache: "no-store" });
      const body = await readJson(response);
      setRepositories(Array.isArray(body.repositories) ? body.repositories : []);
      setRepositoryConnectionId(sourceConnectionId);
      if (!body.repositories?.length) setMessage({ tone: "attention", text: "This GitHub installation does not currently expose an observable repository." });
    } catch (error) {
      setMessage({ tone: "attention", text: friendlyError(error) });
    } finally {
      setBusy("");
    }
  }

  async function bootstrapRepository(sourceConnectionId, repositoryId, repositoryName) {
    setBusy(`bootstrap:${repositoryId}`);
    setMessage({ tone: "ready", text: `Understanding ${repositoryName || "the repository"} from bounded representative evidence…` });
    try {
      const response = await fetch("/api/sources/github/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceConnectionId, repositoryId }),
      });
      const body = await readJson(response);
      const projectName = body.context?.projectName || repositoryName || "Repository";
      const reuseText = body.reused ? " Existing project understanding was reused." : ` Project context v${body.context?.version || 1} is ready.`;
      setMessage({
        tone: "ready",
        text: `${projectName} is connected and understood from ${body.evidenceCount || 0} bounded evidence items.${reuseText} SignalFlow can reuse this context for future work automatically.`,
      });
      return body;
    } catch (error) {
      setMessage({ tone: "attention", text: `${friendlyError(error)} GitHub observation remains connected.` });
      return null;
    } finally {
      setBusy("");
    }
  }

  useEffect(() => {
    void refresh();
    const params = new URLSearchParams(window.location.search);
    const callbackConnection = params.get("source_connection");
    const callbackStatus = params.get("github_source_status");
    if (callbackStatus === "installed" && callbackConnection) {
      setMessage({ tone: "ready", text: "GitHub installation and owner authorization verified. Choose the repository SignalFlow should understand and observe." });
      void loadRepositories(callbackConnection);
      const next = new URL(window.location.href);
      next.searchParams.delete("github_source_status");
      next.searchParams.delete("source_connection");
      window.history.replaceState({}, "", `${next.pathname}${next.search}${next.hash}`);
    }
  }, []);

  async function startInstallation() {
    setBusy("install");
    setMessage(null);
    try {
      const response = await fetch("/api/sources/github/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnTo: "/?workspace=connections" }),
      });
      const body = await readJson(response);
      if (!body.installUrl) throw new Error("github_install_url_missing");
      window.location.assign(body.installUrl);
    } catch (error) {
      setBusy("");
      setMessage({ tone: "attention", text: friendlyError(error) });
    }
  }

  async function selectRepository(repository) {
    if (!repositoryConnectionId) return;
    const sourceConnectionId = repositoryConnectionId;
    setBusy(`select:${repository.id}`);
    setMessage(null);
    try {
      const response = await fetch("/api/sources/github/repositories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceConnectionId, repositoryId: repository.id }),
      });
      const body = await readJson(response);
      setRepositories([]);
      setRepositoryConnectionId("");
      await refresh({ quiet: true });
      await bootstrapRepository(
        body.connection?.sourceConnectionId || sourceConnectionId,
        body.repository?.id || repository.id,
        body.repository?.fullName || repository.fullName,
      );
    } catch (error) {
      setMessage({ tone: "attention", text: friendlyError(error) });
      setBusy("");
    }
  }

  async function refreshUnderstanding(connection) {
    const resources = enabledResources(connection);
    if (!resources.length) return;
    if (resources.length > 1) {
      await loadRepositories(connection.sourceConnectionId);
      return;
    }
    const resource = resources[0];
    await bootstrapRepository(connection.sourceConnectionId, resource.resourceRef, resource.displayName || "the repository");
  }

  async function mutate(connection, action) {
    if (action === "revoke" && !window.confirm("Disconnect this GitHub source? Existing SignalFlow history stays intact, but new events from this connection will stop.")) return;
    setBusy(`${action}:${connection.sourceConnectionId}`);
    setMessage(null);
    try {
      const response = await fetch("/api/sources/github/connections", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceConnectionId: connection.sourceConnectionId, action }),
      });
      await readJson(response);
      setMessage({
        tone: action === "revoke" ? "attention" : "ready",
        text: action === "pause" ? "GitHub observation is paused." : action === "resume" ? "GitHub observation is active again." : "GitHub source disconnected. Historical provenance was preserved.",
      });
      await refresh({ quiet: true });
    } catch (error) {
      setMessage({ tone: "attention", text: friendlyError(error) });
    } finally {
      setBusy("");
    }
  }

  return (
    <section className={styles.panel} aria-labelledby="github-source-title">
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Source connections</p>
          <h2 id="github-source-title">Let SignalFlow notice the work worth talking about.</h2>
          <p>Connect a GitHub repository once. SignalFlow builds persistent project understanding and then uses supported repository events as signals; there is no trigger setup.</p>
        </div>
        <div className={styles.headingActions}>
          <span className={styles.summary}>{activeCount} active</span>
          <button type="button" className={styles.secondaryButton} onClick={() => void refresh()} disabled={loading || Boolean(busy)}>Refresh</button>
        </div>
      </div>

      {message && <div className={styles.message} data-tone={message.tone} role="status">{message.text}</div>}

      {loading ? (
        <div className={styles.emptyState}>Checking GitHub source readiness…</div>
      ) : configured === "locked" ? (
        <div className={styles.emptyState}>
          <strong>Owner session required</strong>
          <p>Source connections are private workspace configuration.</p>
          <a href="/?workspace=settings">Open Settings</a>
        </div>
      ) : configured === false ? (
        <div className={styles.emptyState}>
          <strong>GitHub App setup pending</strong>
          <p>The product code is ready, but this deployment still needs its server-side GitHub App, owner lock, database, OAuth, and webhook secrets configured before installation can begin.</p>
        </div>
      ) : (
        <>
          <div className={styles.connectionList}>
            {connections.map((connection) => {
              const count = repositoryCount(connection);
              return (
                <article className={styles.connectionCard} key={connection.sourceConnectionId}>
                  <div className={styles.connectionIdentity}>
                    <div className={styles.githubMark} aria-hidden="true">GH</div>
                    <div>
                      <div className={styles.titleRow}>
                        <h3>GitHub</h3>
                        <span data-tone={statusTone(connection.status)}>{STATUS_LABELS[connection.status] || connection.status}</span>
                      </div>
                      <p>
                        {connection.status === "active"
                          ? `${count} ${count === 1 ? "repository" : "repositories"} observed automatically. Project understanding is reusable and refreshes only when repository revision evidence changes.`
                          : connection.installationRef && connection.status === "pending"
                            ? "Installation verified. Choose a repository to finish the connection."
                            : connection.status === "paused"
                              ? "Observation is paused. Existing project and narrative context are preserved."
                              : connection.status === "revoked"
                                ? "Disconnected. Historical provenance remains available."
                                : "Finish the GitHub App installation and owner authorization to continue."}
                      </p>
                      {connection.resourceScopes?.length > 0 && (
                        <div className={styles.repositories}>
                          {connection.resourceScopes.map((resource) => (
                            <span key={resource.resourceRef} data-enabled={resource.enabled}>{resource.displayName || resource.resourceRef}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className={styles.cardActions}>
                    {connection.installationRef && connection.status === "pending" && (
                      <button type="button" onClick={() => void loadRepositories(connection.sourceConnectionId)} disabled={Boolean(busy)}>
                        {busy === `repositories:${connection.sourceConnectionId}` ? "Checking…" : "Choose repository"}
                      </button>
                    )}
                    {!connection.installationRef && connection.status === "pending" && (
                      <button type="button" onClick={() => void startInstallation()} disabled={Boolean(busy)}>Restart installation</button>
                    )}
                    {connection.status === "active" && count > 0 && (
                      <button type="button" onClick={() => void refreshUnderstanding(connection)} disabled={Boolean(busy)}>
                        {String(busy).startsWith("bootstrap:") ? "Understanding…" : count === 1 ? "Refresh understanding" : "Choose repository"}
                      </button>
                    )}
                    {connection.status === "active" && <button type="button" onClick={() => void mutate(connection, "pause")} disabled={Boolean(busy)}>Pause</button>}
                    {connection.status === "paused" && <button type="button" onClick={() => void mutate(connection, "resume")} disabled={Boolean(busy)}>Resume</button>}
                    {connection.status !== "revoked" && <button type="button" className={styles.quietButton} onClick={() => void mutate(connection, "revoke")} disabled={Boolean(busy)}>Disconnect</button>}
                  </div>
                </article>
              );
            })}
          </div>

          {connections.every((item) => item.status === "revoked") && (
            <div className={styles.connectRow}>
              <div>
                <strong>{connections.length ? "Connect another repository" : "Connect your first repository"}</strong>
                <p>GitHub controls which repositories the App can access. SignalFlow stores the selected mapping and safe evidence provenance, not raw repository credentials.</p>
              </div>
              <button type="button" className={styles.primaryButton} onClick={() => void startInstallation()} disabled={Boolean(busy)}>
                {busy === "install" ? "Opening GitHub…" : "Connect GitHub"}
              </button>
            </div>
          )}

          {repositories.length > 0 && (
            <div className={styles.repositoryPicker}>
              <div className={styles.pickerHeading}>
                <div>
                  <span>Authorized repositories</span>
                  <h3>Choose what SignalFlow should understand first.</h3>
                </div>
                <button type="button" className={styles.quietButton} onClick={() => { setRepositories([]); setRepositoryConnectionId(""); }}>Cancel</button>
              </div>
              <div className={styles.repositoryGrid}>
                {repositories.map((repository) => (
                  <button
                    type="button"
                    className={styles.repositoryOption}
                    key={repository.id}
                    onClick={() => void selectRepository(repository)}
                    disabled={Boolean(busy) || repository.archived || repository.disabled}
                  >
                    <strong>{repository.fullName}</strong>
                    <span>{repository.private ? "Private" : "Public"}{repository.defaultBranch ? ` · ${repository.defaultBranch}` : ""}</span>
                    <small>{repository.archived ? "Archived" : repository.disabled ? "Disabled" : "Use this repository"}</small>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
