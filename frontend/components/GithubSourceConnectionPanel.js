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
  if (error?.status === 401 || code === "owner_session_required") return "Owner access is required before GitHub can be connected.";
  if (code === "owner_access_unconfigured") return "This hosted deployment is missing its owner access lock. Configure the deployment before connecting GitHub.";
  if (code === "github_app_unconfigured") return "SignalFlow's secure GitHub provisioning prerequisites are not complete on this deployment yet.";
  if (code === "github_install_state_expired") return "This GitHub connection attempt expired before it could be verified. Restart installation to create a fresh secure connection state.";
  if (code === "github_install_state_invalid" || code === "github_install_state_workspace_mismatch") return "SignalFlow could not verify this GitHub connection attempt. Restart installation from Connections rather than reusing the old callback.";
  if (code === "github_install_callback_incomplete" || code === "github_oauth_callback_incomplete") return "GitHub returned an incomplete connection response. Restart installation from Connections.";
  if (code === "github_provider_unavailable") return "GitHub connection verification is temporarily unavailable. Your existing SignalFlow state was not changed; retry the connection when GitHub is reachable.";
  if (code === "github_connection_unavailable") return "SignalFlow connection storage is temporarily unavailable. No GitHub authority was changed; retry after the hosted connection service is healthy.";
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
  const [ownerKey, setOwnerKey] = useState("");
  const [showOwnerKey, setShowOwnerKey] = useState(false);

  const activeCount = useMemo(
    () => connections.filter((item) => item.status === "active").length,
    [connections],
  );
  const hasVerifiedInstallation = useMemo(
    () => connections.some((item) => item.status !== "revoked" && Boolean(item.installationRef)),
    [connections],
  );
  const hasSelectedRepository = useMemo(
    () => connections.some((item) => item.status === "active" && repositoryCount(item) > 0),
    [connections],
  );

  const journey = [
    {
      number: "01",
      label: "Unlock workspace",
      detail: "Private owner session",
      done: configured !== null && configured !== "locked",
      active: configured === "locked",
    },
    {
      number: "02",
      label: "Authorize GitHub",
      detail: "Create and install the App",
      done: hasVerifiedInstallation,
      active: configured === true && !hasVerifiedInstallation,
    },
    {
      number: "03",
      label: "Choose repository",
      detail: "Select what SignalFlow observes",
      done: hasSelectedRepository,
      active: hasVerifiedInstallation && !hasSelectedRepository,
    },
  ];

  async function refresh({ quiet = false } = {}) {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch("/api/sources/github/connect", { cache: "no-store" });
      const body = await readJson(response);
      setConfigured(Boolean(body.configured));
      setConnections(Array.isArray(body.connections) ? body.connections : []);
      if (!body.configured) {
        setMessage({ tone: "attention", text: "GitHub source automation needs its hosted manifest prerequisites before it can be connected." });
      } else if (!quiet) {
        setMessage(null);
      }
    } catch (error) {
      setConfigured(error?.status === 401 ? "locked" : false);
      setConnections([]);
      if (error?.status === 401) setMessage(null);
      else setMessage({ tone: "attention", text: friendlyError(error) });
    } finally {
      if (!quiet) setLoading(false);
    }
  }

  async function unlockOwnerSession(event) {
    event.preventDefault();
    const accessKey = ownerKey.trim();
    if (!accessKey || busy) return;

    setBusy("unlock");
    setMessage(null);
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_key: accessKey }),
      });
      const body = await readJson(response);
      if (!body.authenticated && body.locked !== false) {
        const error = new Error("owner_session_required");
        error.code = "owner_session_required";
        error.status = 401;
        throw error;
      }
      setOwnerKey("");
      setMessage({ tone: "ready", text: "Owner session unlocked. GitHub connection controls are now available." });
      window.location.assign("/?workspace=connections");
    } catch (error) {
      setMessage({
        tone: "attention",
        text: error?.status === 401
          ? "That owner access key was not accepted. Check the key configured for this hosted workspace and try again."
          : friendlyError(error),
      });
    } finally {
      setBusy("");
    }
  }

  async function loadRepositories(sourceConnectionId) {
    setBusy(`repositories:${sourceConnectionId}`);
    setMessage(null);
    try {
      const response = await fetch(`/api/sources/github/repositories?source_connection=${encodeURIComponent(sourceConnectionId)}`, { cache: "no-store" });
      const body = await readJson(response);
      const items = Array.isArray(body.repositories) ? body.repositories : [];
      setRepositories(items);
      setRepositoryConnectionId(sourceConnectionId);
      if (!items.length) {
        setMessage({ tone: "attention", text: "This GitHub installation does not currently expose an observable repository." });
        return false;
      }
      return true;
    } catch (error) {
      setMessage({ tone: "attention", text: friendlyError(error) });
      return false;
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

      if (body.firstOpportunity?.opportunityId) {
        setMessage({
          tone: "ready",
          text: `${projectName} is connected and understood from ${body.evidenceCount || 0} bounded evidence items.${reuseText} SignalFlow found the first editorial decision and is opening it now.`,
        });
        window.location.assign(`/plan?opportunity=${encodeURIComponent(body.firstOpportunity.opportunityId)}&from=github`);
        return body;
      }

      if (body.firstOpportunityStatus === "retryable_error") {
        setMessage({
          tone: "attention",
          text: `${projectName} is connected and project context is preserved.${reuseText} SignalFlow could not prepare the first editorial judgment yet. Refresh understanding to retry without reconnecting GitHub.`,
        });
        return body;
      }

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
    const params = new URLSearchParams(window.location.search);
    const callbackConnection = params.get("source_connection");
    const callbackStatus = params.get("github_source_status");
    const callbackError = params.get("github_source_error");

    function clearCallbackParams() {
      const next = new URL(window.location.href);
      next.searchParams.delete("github_source_status");
      next.searchParams.delete("github_source_error");
      next.searchParams.delete("source_connection");
      window.history.replaceState({}, "", `${next.pathname}${next.search}${next.hash}`);
    }

    async function initialize() {
      if (!callbackStatus) {
        await refresh();
        return;
      }

      clearCallbackParams();
      await refresh();

      if (callbackStatus === "installed" && callbackConnection) {
        const loaded = await loadRepositories(callbackConnection);
        if (loaded) {
          setMessage({ tone: "ready", text: "GitHub installation and owner authorization verified. Choose the repository SignalFlow should understand and observe." });
        }
        return;
      }

      if (callbackStatus === "error") {
        setMessage({
          tone: "attention",
          text: friendlyError({ code: callbackError || "github_connection_failed" }),
        });
        return;
      }

      setMessage({ tone: "attention", text: friendlyError({ code: "github_connection_failed" }) });
    }

    void initialize();
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
          <p className={styles.eyebrow}>GitHub source</p>
          <h2 id="github-source-title">Connect shipped work to SignalFlow.</h2>
          <p>Set this up once. SignalFlow can then notice meaningful repository events, build bounded project understanding, and bring only worthwhile editorial decisions back to you.</p>
        </div>
        <div className={styles.headingActions}>
          <span className={styles.summary}>{activeCount ? `${activeCount} active` : "Not connected"}</span>
          <button type="button" className={styles.secondaryButton} onClick={() => void refresh()} disabled={loading || Boolean(busy)}>Refresh</button>
        </div>
      </div>

      <div className={styles.journey} aria-label="GitHub connection steps">
        {journey.map((step) => (
          <div className={styles.journeyStep} data-done={step.done} data-active={step.active} key={step.number}>
            <span className={styles.journeyNumber}>{step.done ? "✓" : step.number}</span>
            <div><strong>{step.label}</strong><small>{step.done ? "Complete" : step.detail}</small></div>
          </div>
        ))}
      </div>

      {message && <div className={styles.message} data-tone={message.tone} role="status">{message.text}</div>}

      {loading ? (
        <div className={styles.loadingState}><span className={styles.loadingDot} /> Checking the secure GitHub connection…</div>
      ) : configured === "locked" ? (
        <div className={styles.actionCard} data-step="01">
          <div className={styles.actionCopy}>
            <span className={styles.actionKicker}>Step 1 · Private workspace</span>
            <strong>Unlock here. You should not have to leave this page.</strong>
            <p>The owner key is required before SignalFlow can create or change source connections. This form exchanges it for the existing secure owner session; the key is not written to local storage by this panel.</p>
          </div>
          <form className={styles.unlockForm} onSubmit={unlockOwnerSession}>
            <label htmlFor="github-owner-key">Owner access key</label>
            <div className={styles.passwordRow}>
              <input
                id="github-owner-key"
                type={showOwnerKey ? "text" : "password"}
                value={ownerKey}
                onChange={(event) => setOwnerKey(event.target.value)}
                placeholder="Enter the private workspace key"
                autoComplete="current-password"
                required
              />
              <button type="button" className={styles.revealButton} onClick={() => setShowOwnerKey((value) => !value)} aria-label={showOwnerKey ? "Hide owner access key" : "Show owner access key"}>
                {showOwnerKey ? "Hide" : "Show"}
              </button>
            </div>
            <button type="submit" className={styles.primaryButton} disabled={!ownerKey.trim() || busy === "unlock"}>
              {busy === "unlock" ? "Unlocking…" : "Unlock & continue"}
            </button>
            <small>Never paste this key into chat, GitHub, or a third-party form.</small>
          </form>
        </div>
      ) : configured === false ? (
        <div className={styles.actionCard} data-step="blocked">
          <div className={styles.actionCopy}>
            <span className={styles.actionKicker}>Hosted setup</span>
            <strong>GitHub installation is not available on this deployment yet.</strong>
            <p>SignalFlow creates its private GitHub App through GitHub's secure manifest flow. You do not need to pre-create or paste App, OAuth, or webhook secrets. The hosted database, canonical origin, owner signing authority, and encrypted credential vault must be healthy first.</p>
          </div>
          <div className={styles.blockedAction}>
            <span>No browser action can fix this state.</span>
            <button type="button" className={styles.secondaryButton} onClick={() => void refresh()}>Recheck setup</button>
          </div>
        </div>
      ) : (
        <>
          {connections.every((item) => item.status === "revoked") && (
            <div className={styles.actionCard} data-step="02">
              <div className={styles.actionCopy}>
                <span className={styles.actionKicker}>Step 2 · GitHub authorization</span>
                <strong>{connections.length ? "Connect another GitHub repository." : "Authorize GitHub to continue."}</strong>
                <p>GitHub will open its own consent screen. Choose your account, grant access only to the repositories you want SignalFlow to observe, then GitHub will return you here.</p>
              </div>
              <div className={styles.primaryAction}>
                <button type="button" className={styles.primaryButton} onClick={() => void startInstallation()} disabled={Boolean(busy)}>
                  {busy === "install" ? "Opening GitHub…" : "Connect GitHub"}
                </button>
                <small>You stay in control of repository access in GitHub.</small>
              </div>
            </div>
          )}

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
                            ? "GitHub authorization is verified. Choose a repository to finish the connection."
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
                      <button type="button" className={styles.primaryButton} onClick={() => void loadRepositories(connection.sourceConnectionId)} disabled={Boolean(busy)}>
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

          {repositories.length > 0 && (
            <div className={styles.repositoryPicker}>
              <div className={styles.pickerHeading}>
                <div>
                  <span>Step 3 · Authorized repositories</span>
                  <h3>Choose what SignalFlow should understand and observe.</h3>
                  <p>Start with one repository. You can change or add scope later without rebuilding the rest of SignalFlow.</p>
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
                    <small>{repository.archived ? "Archived" : repository.disabled ? "Disabled" : busy === `select:${repository.id}` ? "Connecting…" : "Use this repository →"}</small>
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