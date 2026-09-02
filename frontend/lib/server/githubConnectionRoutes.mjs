const CALLBACK_ERROR_CODES = new Set([
  "github_app_unconfigured",
  "github_install_callback_incomplete",
  "github_oauth_callback_incomplete",
  "github_user_authorization_denied",
  "github_user_authorization_failed",
  "github_install_state_invalid",
  "github_install_state_expired",
  "github_install_state_workspace_mismatch",
  "github_installation_permissions_insufficient",
  "github_installation_suspended",
  "github_connection_revoked",
  "github_connection_not_found",
  "owner_session_required",
  "owner_access_unconfigured",
]);

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function connectionView(input) {
  if (!input) return null;
  return {
    sourceConnectionId: input.sourceConnectionId,
    provider: input.provider,
    providerAccountRef: input.providerAccountRef,
    installationRef: input.installationRef,
    status: input.status,
    permissionScopes: input.permissionScopes,
    capabilities: input.capabilities,
    resourceScopes: input.resourceScopes,
    verifiedAt: input.verifiedAt,
    lastEventAt: input.lastEventAt,
    lastErrorCode: input.lastErrorCode,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}

function statusFor(error) {
  if ([
    "github_install_state_invalid",
    "github_install_state_expired",
    "github_install_state_workspace_mismatch",
    "github_repository_not_observable",
    "github_installation_permissions_insufficient",
    "github_user_authorization_failed",
  ].includes(error?.code)) return 400;
  if (["github_connection_not_found"].includes(error?.code)) return 404;
  if ([
    "github_connection_revoked",
    "github_connection_not_verified",
    "github_installation_suspended",
  ].includes(error?.code)) return 409;
  if (error?.code === "signalflow_database_unconfigured" || error?.code === "signalflow_database_invalid") return 503;
  if (String(error?.code || "").startsWith("github_app_http_")) return 502;
  return 500;
}

function safeError(error) {
  return json({ error: error?.code || "github_connection_failed" }, statusFor(error));
}

function safeCallbackErrorCode(error) {
  const code = String(error?.code || error || "").trim();
  if (CALLBACK_ERROR_CODES.has(code)) return code;
  if (code === "signalflow_database_unconfigured" || code === "signalflow_database_invalid") {
    return "github_connection_unavailable";
  }
  if (code.startsWith("github_app_http_")) return "github_provider_unavailable";
  return "github_connection_failed";
}

function callbackRecovery(request, error) {
  const redirect = new URL("/?workspace=connections", request.url);
  redirect.searchParams.set("github_source_status", "error");
  redirect.searchParams.set("github_source_error", safeCallbackErrorCode(error));
  return Response.redirect(redirect, 303);
}

function callbackAccessRecovery(request, denied) {
  if (denied?.status === 401) return callbackRecovery(request, "owner_session_required");
  if (denied?.status === 503) return callbackRecovery(request, "owner_access_unconfigured");
  return callbackRecovery(request, "github_connection_failed");
}

export function createGithubConnectionHandlers({
  requireOwnerAccess,
  configurationStatus,
  createApplication,
} = {}) {
  if (typeof requireOwnerAccess !== "function") throw new TypeError("GitHub connection handlers require owner access enforcement.");
  if (typeof configurationStatus !== "function") throw new TypeError("GitHub connection handlers require configurationStatus().");
  if (typeof createApplication !== "function") throw new TypeError("GitHub connection handlers require createApplication().");

  function authorize(request) {
    return requireOwnerAccess(request);
  }

  function ensureConfigured() {
    const status = configurationStatus();
    if (status?.configured) return null;
    return json({ configured: false, error: "github_app_unconfigured", missing: status?.missing || [] }, 503);
  }

  function ensureCallbackConfigured(request) {
    const status = configurationStatus();
    if (status?.configured) return null;
    return callbackRecovery(request, "github_app_unconfigured");
  }

  async function status(request) {
    const denied = authorize(request);
    if (denied) return denied;
    const config = configurationStatus();
    if (!config.configured) return json({ configured: false, missing: config.missing || [] });
    try {
      const app = createApplication();
      const connections = await app.listConnections();
      return json({ configured: true, connections: connections.map(connectionView) });
    } catch (error) {
      return safeError(error);
    }
  }

  async function start(request) {
    const denied = authorize(request);
    if (denied) return denied;
    const unconfigured = ensureConfigured();
    if (unconfigured) return unconfigured;
    let body = {};
    try { body = await request.json(); } catch { body = {}; }
    try {
      const result = await createApplication().startInstallation({ returnTo: body?.returnTo });
      return json({ configured: true, ...result }, 201);
    } catch (error) {
      return safeError(error);
    }
  }

  async function callback(request) {
    const denied = authorize(request);
    if (denied) return callbackAccessRecovery(request, denied);
    const unconfigured = ensureCallbackConfigured(request);
    if (unconfigured) return unconfigured;
    const url = new URL(request.url);
    const state = url.searchParams.get("state") || "";
    const installationId = url.searchParams.get("installation_id") || "";
    if (!state || !installationId) return callbackRecovery(request, "github_install_callback_incomplete");
    try {
      const result = await createApplication().beginAuthorization({ state, installationId });
      return Response.redirect(result.authorizationUrl, 303);
    } catch (error) {
      return callbackRecovery(request, error);
    }
  }

  async function oauthCallback(request) {
    const denied = authorize(request);
    if (denied) return callbackAccessRecovery(request, denied);
    const unconfigured = ensureCallbackConfigured(request);
    if (unconfigured) return unconfigured;
    const url = new URL(request.url);
    const state = url.searchParams.get("state") || "";
    const code = url.searchParams.get("code") || "";
    const providerError = url.searchParams.get("error") || "";
    if (providerError) return callbackRecovery(request, "github_user_authorization_denied");
    if (!state || !code) return callbackRecovery(request, "github_oauth_callback_incomplete");
    try {
      const result = await createApplication().completeAuthorization({ state, code });
      const redirect = new URL(result.returnTo, request.url);
      redirect.searchParams.set("github_source_status", "installed");
      redirect.searchParams.set("source_connection", result.connection.sourceConnectionId);
      return Response.redirect(redirect, 303);
    } catch (error) {
      return callbackRecovery(request, error);
    }
  }

  async function repositories(request) {
    const denied = authorize(request);
    if (denied) return denied;
    const unconfigured = ensureConfigured();
    if (unconfigured) return unconfigured;
    const url = new URL(request.url);
    const sourceConnectionId = url.searchParams.get("source_connection") || "";
    if (!sourceConnectionId) return json({ error: "source_connection_required" }, 400);
    try {
      const items = await createApplication().listRepositories(sourceConnectionId);
      return json({ repositories: items });
    } catch (error) {
      return safeError(error);
    }
  }

  async function selectRepository(request) {
    const denied = authorize(request);
    if (denied) return denied;
    const unconfigured = ensureConfigured();
    if (unconfigured) return unconfigured;
    let body;
    try { body = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }
    try {
      const result = await createApplication().selectRepository({
        sourceConnectionId: body?.sourceConnectionId,
        repositoryId: body?.repositoryId,
      });
      return json({
        connection: connectionView(result.connection),
        repository: result.repository,
        projectId: result.projectId,
      });
    } catch (error) {
      return safeError(error);
    }
  }

  async function mutate(request) {
    const denied = authorize(request);
    if (denied) return denied;
    const unconfigured = ensureConfigured();
    if (unconfigured) return unconfigured;
    let body;
    try { body = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }
    const action = String(body?.action || "").trim().toLowerCase();
    if (!body?.sourceConnectionId || !["pause", "resume", "revoke"].includes(action)) {
      return json({ error: "github_connection_action_invalid" }, 400);
    }
    try {
      const connection = await createApplication()[action](body.sourceConnectionId);
      return json({ connection: connectionView(connection) });
    } catch (error) {
      return safeError(error);
    }
  }

  return Object.freeze({ status, start, callback, oauthCallback, repositories, selectRepository, mutate });
}
