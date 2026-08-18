import { assertPort, createSystemClock, createSystemIdService } from "../domain/ports.mjs";
import {
  createSourceConnection,
  normalizeSourceConnection,
  resolveSourceConnectionResource,
  SOURCE_CONNECTION_STATUSES,
  transitionSourceConnection,
  updateSourceConnection,
} from "../domain/sourceConnections.mjs";

function workspaceId(value) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new TypeError("SourceConnection application requires a workspaceId.");
  return normalized;
}

export function createSourceConnectionApplication({
  sourceConnectionRepository,
  workspaceId: ownerWorkspaceId = "local-personal",
  clock = createSystemClock(),
  idService = createSystemIdService("signalflow"),
} = {}) {
  const repository = assertPort("sourceConnectionRepository", sourceConnectionRepository);
  const applicationClock = assertPort("clock", clock);
  const applicationIds = assertPort("idService", idService);
  const owner = workspaceId(ownerWorkspaceId);

  function assertOwned(connection) {
    if (!connection) return null;
    const normalized = normalizeSourceConnection(connection);
    if (normalized.workspaceId !== owner) {
      throw new Error(`SourceConnection ${normalized.sourceConnectionId} does not belong to workspace ${owner}.`);
    }
    return normalized;
  }

  async function requireOwned(sourceConnectionId) {
    const normalizedId = String(sourceConnectionId || "").trim();
    if (!normalizedId) throw new TypeError("A sourceConnectionId is required.");
    const stored = await repository.get(normalizedId);
    if (!stored) throw new Error(`SourceConnection ${normalizedId} does not exist.`);
    return assertOwned(stored);
  }

  async function createConnection(input = {}) {
    const now = applicationClock.now();
    const connection = createSourceConnection({
      ...input,
      sourceConnectionId: input.sourceConnectionId || applicationIds.create("source-connection"),
      workspaceId: owner,
      createdAt: now,
    });
    return repository.upsert(connection);
  }

  async function listConnections({ provider = null, includeRevoked = false } = {}) {
    const normalizedProvider = provider ? String(provider).trim().toLowerCase() : null;
    return (await repository.list())
      .map((item) => normalizeSourceConnection(item))
      .filter((item) => item.workspaceId === owner)
      .filter((item) => includeRevoked || item.status !== SOURCE_CONNECTION_STATUSES.REVOKED)
      .filter((item) => !normalizedProvider || item.provider === normalizedProvider);
  }

  async function readConnection(sourceConnectionId) {
    const stored = await repository.get(sourceConnectionId);
    return stored ? assertOwned(stored) : null;
  }

  async function updateConnection(sourceConnectionId, patch = {}) {
    const current = await requireOwned(sourceConnectionId);
    return repository.upsert(updateSourceConnection(current, patch, applicationClock.now()));
  }

  async function markVerified(sourceConnectionId, patch = {}) {
    const current = await requireOwned(sourceConnectionId);
    const now = applicationClock.now();
    return repository.upsert(transitionSourceConnection(current, SOURCE_CONNECTION_STATUSES.ACTIVE, now, {
      ...patch,
      verifiedAt: patch.verifiedAt || now,
      lastErrorCode: null,
    }));
  }

  async function pauseConnection(sourceConnectionId) {
    const current = await requireOwned(sourceConnectionId);
    return repository.upsert(transitionSourceConnection(current, SOURCE_CONNECTION_STATUSES.PAUSED, applicationClock.now()));
  }

  async function resumeConnection(sourceConnectionId) {
    const current = await requireOwned(sourceConnectionId);
    if (!current.verifiedAt) throw new Error("An unverified SourceConnection cannot be resumed as active.");
    return repository.upsert(transitionSourceConnection(current, SOURCE_CONNECTION_STATUSES.ACTIVE, applicationClock.now()));
  }

  async function markError(sourceConnectionId, errorCode) {
    const current = await requireOwned(sourceConnectionId);
    const normalizedCode = String(errorCode || "source_connection_error").trim().toLowerCase();
    return repository.upsert(transitionSourceConnection(current, SOURCE_CONNECTION_STATUSES.ERROR, applicationClock.now(), {
      lastErrorCode: normalizedCode,
    }));
  }

  async function markEventReceived(sourceConnectionId, occurredAt = null) {
    const current = await requireOwned(sourceConnectionId);
    const now = applicationClock.now();
    return repository.upsert(updateSourceConnection(current, { lastEventAt: occurredAt || now, lastErrorCode: null }, now));
  }

  async function revokeConnection(sourceConnectionId) {
    const current = await requireOwned(sourceConnectionId);
    return repository.upsert(transitionSourceConnection(current, SOURCE_CONNECTION_STATUSES.REVOKED, applicationClock.now()));
  }

  async function resolveResource(sourceConnectionId, resourceRef) {
    const current = await requireOwned(sourceConnectionId);
    if (current.status !== SOURCE_CONNECTION_STATUSES.ACTIVE) return null;
    return resolveSourceConnectionResource(current, resourceRef);
  }

  return {
    createConnection,
    listConnections,
    readConnection,
    updateConnection,
    markVerified,
    pauseConnection,
    resumeConnection,
    markError,
    markEventReceived,
    revokeConnection,
    resolveResource,
  };
}
