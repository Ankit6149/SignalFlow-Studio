import { createSourceConnection, normalizeSourceConnection, SOURCE_CONNECTION_STATUSES, updateSourceConnection } from "../domain/sourceConnections.mjs";
import { assertPort, createSystemClock, createSystemIdService } from "../domain/ports.mjs";
import { buildGithubAppInstallationUrl } from "../integrations/github/githubAppApi.mjs";
import {
  buildGithubManifestRegistration,
  buildSignalFlowGithubAppManifest,
  exchangeGithubManifestCode,
} from "../integrations/github/githubAppManifest.mjs";

const SECRET_KIND = "github_app_credentials";
const MAX_PENDING_ID_ATTEMPTS = 8;

function opaque(value, field, maxLength = 300) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new TypeError(`${field} is required.`);
  if (normalized.length > maxLength || /[/\\]|^[a-zA-Z]:/.test(normalized)) {
    throw new TypeError(`${field} must be a bounded opaque identifier.`);
  }
  return normalized;
}

function requiredMethod(target, method, label) {
  if (!target || typeof target[method] !== "function") throw new TypeError(`${label} requires ${method}().`);
  return target;
}

function appNameForConnection(sourceConnectionId) {
  const suffix = String(sourceConnectionId || "").replace(/[^a-zA-Z0-9]/g, "").slice(-8) || "Personal";
  return `SignalFlow Studio ${suffix}`;
}

export function createGithubManifestProvisioningApplication({
  workspaceId,
  sourceConnectionRepository,
  credentialVault,
  installStateCodec,
  origin,
  fetchImpl = globalThis.fetch,
  clock = createSystemClock(),
  idService = createSystemIdService("signalflow"),
} = {}) {
  const ownerWorkspaceId = opaque(workspaceId, "workspaceId");
  const connections = assertPort("sourceConnectionRepository", sourceConnectionRepository);
  const vault = requiredMethod(
    requiredMethod(
      requiredMethod(credentialVault, "put", "Credential vault"),
      "get",
      "Credential vault",
    ),
    "remove",
    "Credential vault",
  );
  const stateCodec = requiredMethod(
    requiredMethod(installStateCodec, "createInstall", "GitHub install-state codec"),
    "verifyInstall",
    "GitHub install-state codec",
  );
  const systemClock = assertPort("clock", clock);
  const ids = assertPort("idService", idService);
  const baseOrigin = new URL(String(origin || ""));
  if (!new Set(["https:", "http:"]).has(baseOrigin.protocol)) throw new TypeError("GitHub manifest provisioning requires a valid SignalFlow origin.");
  baseOrigin.pathname = "/";
  baseOrigin.search = "";
  baseOrigin.hash = "";
  const canonicalOrigin = baseOrigin.toString().replace(/\/$/, "");

  async function listConnections() {
    return (await connections.list()).map(normalizeSourceConnection)
      .filter((item) => item.workspaceId === ownerWorkspaceId && item.provider === "github");
  }

  async function createPendingConnection(now) {
    for (let attempt = 0; attempt < MAX_PENDING_ID_ATTEMPTS; attempt += 1) {
      const sourceConnectionId = opaque(ids.create("github-connection"), "sourceConnectionId");
      if (await connections.get(sourceConnectionId)) continue;
      return normalizeSourceConnection(await connections.upsert(createSourceConnection({
        sourceConnectionId,
        workspaceId: ownerWorkspaceId,
        provider: "github",
        capabilities: [],
        status: SOURCE_CONNECTION_STATUSES.PENDING,
        createdAt: now,
      })));
    }
    const error = new Error("SignalFlow could not allocate a fresh GitHub SourceConnection identity.");
    error.code = "github_connection_id_collision";
    throw error;
  }

  async function pendingConnection() {
    const existing = (await listConnections()).find((item) => (
      item.status === SOURCE_CONNECTION_STATUSES.PENDING
      && !item.installationRef
      && !item.credentialRef
      && item.resourceScopes.length === 0
    ));
    return existing || createPendingConnection(systemClock.now());
  }

  async function requireManifestConnection(sourceConnectionId) {
    const stored = await connections.get(opaque(sourceConnectionId, "sourceConnectionId"));
    if (!stored) {
      const error = new Error("GitHub SourceConnection was not found for manifest provisioning.");
      error.code = "github_connection_not_found";
      throw error;
    }
    const connection = normalizeSourceConnection(stored);
    if (connection.workspaceId !== ownerWorkspaceId || connection.provider !== "github") {
      const error = new Error("GitHub manifest connection belongs to another workspace.");
      error.code = "github_connection_not_found";
      throw error;
    }
    if (connection.status === SOURCE_CONNECTION_STATUSES.REVOKED || connection.installationRef) {
      const error = new Error("GitHub manifest connection is no longer eligible for App registration.");
      error.code = "github_manifest_connection_ineligible";
      throw error;
    }
    return connection;
  }

  async function startRegistration({ returnTo = "/?workspace=connections" } = {}) {
    const connection = await pendingConnection();
    const state = stateCodec.createInstall({
      workspaceId: ownerWorkspaceId,
      sourceConnectionId: connection.sourceConnectionId,
      returnTo,
    });
    const manifest = buildSignalFlowGithubAppManifest({
      origin: canonicalOrigin,
      appName: appNameForConnection(connection.sourceConnectionId),
    });
    return Object.freeze({
      sourceConnectionId: connection.sourceConnectionId,
      status: connection.status,
      registration: buildGithubManifestRegistration({ state, manifest }),
    });
  }

  async function completeRegistration({ state, code } = {}) {
    const statePayload = stateCodec.verifyInstall(state, { workspaceId: ownerWorkspaceId });
    const connection = await requireManifestConnection(statePayload.sourceConnectionId);
    if (connection.credentialRef) {
      const error = new Error("GitHub App credentials are already bound to this SourceConnection.");
      error.code = "github_manifest_already_completed";
      throw error;
    }

    const credentials = await exchangeGithubManifestCode({
      code,
      origin: canonicalOrigin,
      fetchImpl,
    });
    const secretRecordId = opaque(`github-app-${credentials.appId}`, "secretRecordId", 180);
    let storedSecret = false;
    try {
      await vault.put({
        secretRecordId,
        secretKind: SECRET_KIND,
        value: {
          appId: credentials.appId,
          slug: credentials.slug,
          privateKey: credentials.privateKey,
          clientId: credentials.clientId,
          clientSecret: credentials.clientSecret,
          webhookSecret: credentials.webhookSecret,
        },
      });
      storedSecret = true;
      const now = systemClock.now();
      const next = updateSourceConnection(connection, {
        credentialRef: secretRecordId,
        lastErrorCode: null,
      }, now);
      const saved = normalizeSourceConnection(await connections.upsert(next));
      const installState = stateCodec.createInstall({
        workspaceId: ownerWorkspaceId,
        sourceConnectionId: saved.sourceConnectionId,
        returnTo: statePayload.returnTo,
      });
      return Object.freeze({
        connection: saved,
        installUrl: buildGithubAppInstallationUrl({ slug: credentials.slug, state: installState }),
      });
    } catch (error) {
      if (storedSecret) {
        try { await vault.remove(secretRecordId); } catch { /* orphan cleanup is best-effort */ }
      }
      throw error;
    }
  }

  return Object.freeze({ startRegistration, completeRegistration });
}
