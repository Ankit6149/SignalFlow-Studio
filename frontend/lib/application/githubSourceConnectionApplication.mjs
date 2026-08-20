import { assertPort, createSystemClock, createSystemIdService } from "../domain/ports.mjs";
import {
  createSourceConnection,
  normalizeSourceConnection,
  SOURCE_CONNECTION_STATUSES,
  transitionSourceConnection,
  updateSourceConnection,
} from "../domain/sourceConnections.mjs";

export const DEFAULT_GITHUB_EVENT_FAMILIES = Object.freeze([
  "pull_request_merged",
  "release_published",
]);

const REQUIRED_PERMISSION_GROUPS = Object.freeze([
  ["metadata:read", "metadata:write", "metadata:admin"],
  ["contents:read", "contents:write", "contents:admin"],
  ["pull_requests:read", "pull_requests:write", "pull_requests:admin"],
]);

function requiredOpaque(value, field) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new TypeError(`${field} is required.`);
  if (/[/\\]|^[a-zA-Z]:/.test(normalized)) throw new TypeError(`${field} must be an opaque identifier.`);
  return normalized;
}

function requiredMethod(target, method, label) {
  if (!target || typeof target[method] !== "function") throw new TypeError(`${label} requires ${method}().`);
  return target;
}

function stableProjectId(repositoryId) {
  const id = requiredOpaque(repositoryId, "repositoryId");
  if (!/^\d+$/.test(id)) throw new TypeError("GitHub repositoryId must be numeric.");
  return `sf-project-github-${id}`;
}

function installationPermissions(installation) {
  return Array.isArray(installation?.permissionScopes) ? installation.permissionScopes : [];
}

function assertRequiredInstallationPermissions(installation) {
  const scopes = new Set(installationPermissions(installation));
  const missing = REQUIRED_PERMISSION_GROUPS
    .filter((group) => !group.some((candidate) => scopes.has(candidate)))
    .map((group) => group[0]);
  if (missing.length) {
    const error = new Error("GitHub App installation is missing required repository permissions.");
    error.code = "github_installation_permissions_insufficient";
    error.missing = missing;
    throw error;
  }
}

function safeCapabilities(permissionScopes = []) {
  const scopes = new Set(permissionScopes);
  const capabilities = ["repository_events", "repository_metadata"];
  if (["contents:read", "contents:write", "contents:admin"].some((item) => scopes.has(item))) {
    capabilities.push("repository_contents");
  }
  return capabilities.sort();
}

export function createGithubSourceConnectionApplication({
  workspaceId,
  sourceConnectionRepository,
  githubAppClient,
  installStateCodec,
  installationUrlBuilder,
  clock = createSystemClock(),
  idService = createSystemIdService("signalflow"),
} = {}) {
  const ownerWorkspaceId = requiredOpaque(workspaceId, "workspaceId");
  const connections = assertPort("sourceConnectionRepository", sourceConnectionRepository);
  const github = requiredMethod(
    requiredMethod(
      requiredMethod(
        requiredMethod(
          requiredMethod(
            requiredMethod(githubAppClient, "getInstallation", "GitHub App client"),
            "exchangeUserCode",
            "GitHub App client",
          ),
          "verifyUserInstallationAccess",
          "GitHub App client",
        ),
        "buildUserAuthorizationUrl",
        "GitHub App client",
      ),
      "listInstallationRepositories",
      "GitHub App client",
    ),
    "getRepositoryForInstallation",
    "GitHub App client",
  );
  const stateCodec = requiredMethod(
    requiredMethod(
      requiredMethod(
        requiredMethod(installStateCodec, "createInstall", "GitHub install-state codec"),
        "verifyInstall",
        "GitHub install-state codec",
      ),
      "createAuthorization",
      "GitHub install-state codec",
    ),
    "verifyAuthorization",
    "GitHub install-state codec",
  );
  if (typeof installationUrlBuilder !== "function") throw new TypeError("GitHub source connection application requires installationUrlBuilder().");
  const systemClock = assertPort("clock", clock);
  const ids = assertPort("idService", idService);

  function assertOwned(input) {
    const connection = normalizeSourceConnection(input);
    if (connection.workspaceId !== ownerWorkspaceId || connection.provider !== "github") {
      const error = new Error("GitHub SourceConnection does not belong to this workspace.");
      error.code = "github_connection_not_found";
      throw error;
    }
    return connection;
  }

  async function requireConnection(sourceConnectionId) {
    const id = requiredOpaque(sourceConnectionId, "sourceConnectionId");
    const stored = await connections.get(id);
    if (!stored) {
      const error = new Error("GitHub SourceConnection was not found.");
      error.code = "github_connection_not_found";
      throw error;
    }
    return assertOwned(stored);
  }

  async function listConnections() {
    return (await connections.list()).map(normalizeSourceConnection)
      .filter((item) => item.workspaceId === ownerWorkspaceId && item.provider === "github");
  }

  async function startInstallation({ returnTo = "/?workspace=connections" } = {}) {
    const existingPending = (await listConnections()).find((item) => (
      item.status === SOURCE_CONNECTION_STATUSES.PENDING
      && !item.installationRef
      && item.resourceScopes.length === 0
    ));
    const now = systemClock.now();
    const stored = existingPending || assertOwned(await connections.upsert(createSourceConnection({
      sourceConnectionId: ids.create("github-connection"),
      workspaceId: ownerWorkspaceId,
      provider: "github",
      capabilities: [],
      status: SOURCE_CONNECTION_STATUSES.PENDING,
      createdAt: now,
    })));
    const state = stateCodec.createInstall({
      workspaceId: ownerWorkspaceId,
      sourceConnectionId: stored.sourceConnectionId,
      returnTo,
    });
    return Object.freeze({
      sourceConnectionId: stored.sourceConnectionId,
      installUrl: installationUrlBuilder(state),
      status: stored.status,
    });
  }

  async function beginAuthorization({ state, installationId } = {}) {
    const statePayload = stateCodec.verifyInstall(state, { workspaceId: ownerWorkspaceId });
    const current = await requireConnection(statePayload.sourceConnectionId);
    if (current.status === SOURCE_CONNECTION_STATUSES.REVOKED) {
      const error = new Error("Revoked GitHub SourceConnection cannot accept an installation callback.");
      error.code = "github_connection_revoked";
      throw error;
    }
    const normalizedInstallationId = requiredOpaque(installationId, "installationId");
    if (!/^\d+$/.test(normalizedInstallationId)) throw new TypeError("installationId must be numeric.");
    const authorizationState = stateCodec.createAuthorization({
      workspaceId: ownerWorkspaceId,
      sourceConnectionId: current.sourceConnectionId,
      installationId: normalizedInstallationId,
      returnTo: statePayload.returnTo,
    });
    return Object.freeze({
      sourceConnectionId: current.sourceConnectionId,
      authorizationUrl: github.buildUserAuthorizationUrl(authorizationState),
    });
  }

  async function completeAuthorization({ state, code } = {}) {
    const statePayload = stateCodec.verifyAuthorization(state, { workspaceId: ownerWorkspaceId });
    const current = await requireConnection(statePayload.sourceConnectionId);
    if (current.status === SOURCE_CONNECTION_STATUSES.REVOKED) {
      const error = new Error("Revoked GitHub SourceConnection cannot accept authorization.");
      error.code = "github_connection_revoked";
      throw error;
    }

    const userToken = await github.exchangeUserCode(requiredOpaque(code, "authorizationCode"));
    await github.verifyUserInstallationAccess(userToken, statePayload.installationId);
    const installation = await github.getInstallation(statePayload.installationId);
    if (String(installation.installationId) !== String(statePayload.installationId)) {
      const error = new Error("Verified GitHub installation identity does not match authorization state.");
      error.code = "github_installation_identity_mismatch";
      throw error;
    }
    assertRequiredInstallationPermissions(installation);

    const now = systemClock.now();
    const allConnections = await listConnections();
    const existingInstallation = allConnections.find((item) => (
      item.sourceConnectionId !== current.sourceConnectionId
      && item.installationRef === installation.installationId
    )) || null;
    const target = existingInstallation || current;
    const nextStatus = target.status === SOURCE_CONNECTION_STATUSES.ACTIVE
      ? SOURCE_CONNECTION_STATUSES.ACTIVE
      : target.status === SOURCE_CONNECTION_STATUSES.PAUSED
        ? SOURCE_CONNECTION_STATUSES.PAUSED
        : SOURCE_CONNECTION_STATUSES.PENDING;
    const next = updateSourceConnection(target, {
      providerAccountRef: installation.accountRef,
      installationRef: installation.installationId,
      credentialRef: null,
      permissionScopes: installationPermissions(installation),
      capabilities: safeCapabilities(installationPermissions(installation)),
      verifiedAt: now,
      lastErrorCode: null,
      status: nextStatus,
    }, now);
    const stored = assertOwned(await connections.upsert(next));

    if (existingInstallation && current.resourceScopes.length === 0 && !current.installationRef) {
      await connections.remove(current.sourceConnectionId);
    }

    return Object.freeze({ connection: stored, installation, returnTo: statePayload.returnTo });
  }

  async function listRepositories(sourceConnectionId) {
    const connection = await requireConnection(sourceConnectionId);
    if (connection.status === SOURCE_CONNECTION_STATUSES.REVOKED || !connection.installationRef || !connection.verifiedAt) {
      const error = new Error("GitHub SourceConnection is not ready for repository discovery.");
      error.code = "github_connection_not_verified";
      throw error;
    }
    return github.listInstallationRepositories(connection.installationRef);
  }

  async function selectRepository({ sourceConnectionId, repositoryId } = {}) {
    const current = await requireConnection(sourceConnectionId);
    if (!current.installationRef || !current.verifiedAt || current.status === SOURCE_CONNECTION_STATUSES.REVOKED) {
      const error = new Error("GitHub SourceConnection must be verified before repository selection.");
      error.code = "github_connection_not_verified";
      throw error;
    }
    const repository = await github.getRepositoryForInstallation(current.installationRef, requiredOpaque(repositoryId, "repositoryId"));
    if (repository.disabled || repository.archived) {
      const error = new Error("Disabled or archived repositories cannot be enabled for automatic SignalFlow observation.");
      error.code = "github_repository_not_observable";
      throw error;
    }
    const existing = current.resourceScopes.find((item) => item.resourceRef === repository.id);
    const projectId = existing?.projectId || stableProjectId(repository.id);
    const resource = {
      resourceRef: repository.id,
      resourceType: "repository",
      projectId,
      displayName: repository.fullName,
      eventFamilies: [...DEFAULT_GITHUB_EVENT_FAMILIES],
      enabled: true,
    };
    const resourceScopes = [
      ...current.resourceScopes.filter((item) => item.resourceRef !== repository.id),
      resource,
    ];
    const now = systemClock.now();
    const active = transitionSourceConnection(current, SOURCE_CONNECTION_STATUSES.ACTIVE, now, {
      resourceScopes,
      verifiedAt: current.verifiedAt,
      lastErrorCode: null,
    });
    const stored = assertOwned(await connections.upsert(active));
    return Object.freeze({ connection: stored, repository, projectId });
  }

  async function pause(sourceConnectionId) {
    const current = await requireConnection(sourceConnectionId);
    if (current.status !== SOURCE_CONNECTION_STATUSES.ACTIVE) return current;
    return assertOwned(await connections.upsert(
      transitionSourceConnection(current, SOURCE_CONNECTION_STATUSES.PAUSED, systemClock.now()),
    ));
  }

  async function resume(sourceConnectionId) {
    const current = await requireConnection(sourceConnectionId);
    if (current.status === SOURCE_CONNECTION_STATUSES.REVOKED) {
      const error = new Error("Revoked GitHub SourceConnection must be reinstalled instead of resumed.");
      error.code = "github_connection_revoked";
      throw error;
    }
    if (!current.installationRef || !current.verifiedAt || !current.resourceScopes.some((item) => item.enabled)) {
      const error = new Error("GitHub SourceConnection has no verified enabled repository scope to resume.");
      error.code = "github_connection_not_verified";
      throw error;
    }
    await github.getInstallation(current.installationRef);
    return assertOwned(await connections.upsert(
      transitionSourceConnection(current, SOURCE_CONNECTION_STATUSES.ACTIVE, systemClock.now(), { lastErrorCode: null }),
    ));
  }

  async function revoke(sourceConnectionId) {
    const current = await requireConnection(sourceConnectionId);
    if (current.status === SOURCE_CONNECTION_STATUSES.REVOKED) return current;
    const now = systemClock.now();
    const next = updateSourceConnection(current, {
      status: SOURCE_CONNECTION_STATUSES.REVOKED,
      resourceScopes: current.resourceScopes.map((item) => ({ ...item, enabled: false })),
      lastErrorCode: null,
    }, now);
    return assertOwned(await connections.upsert(next));
  }

  return Object.freeze({
    listConnections,
    startInstallation,
    beginAuthorization,
    completeAuthorization,
    listRepositories,
    selectRepository,
    pause,
    resume,
    revoke,
  });
}
