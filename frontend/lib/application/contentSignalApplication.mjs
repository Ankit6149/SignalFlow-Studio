import {
  assertPort,
  createSystemClock,
  createSystemIdService,
} from "../domain/ports.mjs";
import {
  attachContentSignalReferences,
  CONTENT_SIGNAL_STATUSES,
  createConnectedContentSignal,
  createManualContentSignal,
  normalizeContentSignal,
  transitionContentSignal,
  updateContentSignalMetadata,
} from "../domain/contentSignals.mjs";

function normalizeWorkspaceId(value) {
  const workspaceId = String(value || "").trim();
  if (!workspaceId) throw new TypeError("ContentSignal application requires a workspaceId.");
  return workspaceId;
}

function normalizeIdList(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new TypeError("Signal references must be arrays of canonical IDs.");
  return Array.from(new Set(value.map((item) => String(item || "").trim()).filter(Boolean))).sort();
}

export function createContentSignalApplication({
  contentSignalRepository,
  sourceArtifactRepository = null,
  assetRepository = null,
  workspaceId = "local-personal",
  actorRef = "local-owner",
  clock = createSystemClock(),
  idService = createSystemIdService("signalflow"),
} = {}) {
  const repository = assertPort("contentSignalRepository", contentSignalRepository);
  const applicationClock = assertPort("clock", clock);
  const applicationIds = assertPort("idService", idService);
  const ownerWorkspaceId = normalizeWorkspaceId(workspaceId);
  const sources = sourceArtifactRepository ? assertPort("sourceArtifactRepository", sourceArtifactRepository) : null;
  const assets = assetRepository ? assertPort("assetRepository", assetRepository) : null;

  function assertOwned(signal) {
    if (!signal) return null;
    const normalized = normalizeContentSignal(signal);
    if (normalized.workspaceId !== ownerWorkspaceId) {
      throw new Error(`ContentSignal ${normalized.signalId} does not belong to workspace ${ownerWorkspaceId}.`);
    }
    return normalized;
  }

  async function requireOwned(signalId) {
    const normalizedId = String(signalId || "").trim();
    if (!normalizedId) throw new TypeError("A signalId is required.");
    const stored = await repository.get(normalizedId);
    if (!stored) throw new Error(`ContentSignal ${normalizedId} does not exist.`);
    return assertOwned(stored);
  }

  async function validateReferences({ sourceArtifactIds = [], assetIds = [] } = {}) {
    const normalizedSourceIds = normalizeIdList(sourceArtifactIds);
    const normalizedAssetIds = normalizeIdList(assetIds);

    if (sources) {
      for (const sourceArtifactId of normalizedSourceIds) {
        const source = await sources.get(sourceArtifactId);
        if (!source) throw new Error(`SourceArtifact ${sourceArtifactId} does not exist.`);
        if (source.workspaceId && source.workspaceId !== ownerWorkspaceId) {
          throw new Error(`SourceArtifact ${sourceArtifactId} belongs to another workspace.`);
        }
      }
    }

    if (assets) {
      for (const assetId of normalizedAssetIds) {
        const asset = await assets.get(assetId);
        if (!asset) throw new Error(`Asset ${assetId} does not exist.`);
        if (asset.workspaceId && asset.workspaceId !== ownerWorkspaceId) {
          throw new Error(`Asset ${assetId} belongs to another workspace.`);
        }
      }
    }

    return { sourceArtifactIds: normalizedSourceIds, assetIds: normalizedAssetIds };
  }

  async function createManualSignal(input = {}) {
    const now = applicationClock.now();
    const references = await validateReferences(input);
    const signal = createManualContentSignal({
      ...input,
      ...references,
      signalId: applicationIds.create("signal"),
      workspaceId: ownerWorkspaceId,
      observedAt: now,
      actorRef,
    });
    return repository.upsert(signal);
  }

  async function createExternalSignal(input = {}) {
    if (!input.externalEventRef) throw new TypeError("Connected signal creation requires externalEventRef.");
    const now = applicationClock.now();
    const references = await validateReferences(input);
    const signal = createConnectedContentSignal({
      ...input,
      ...references,
      signalId: applicationIds.create("signal"),
      workspaceId: ownerWorkspaceId,
      observedAt: now,
      actorRef: input.actorRef || "source-ingestion",
    });
    return repository.insertExternalIfAbsent(signal);
  }

  async function listSignals({ status = null, projectId = null, includeArchived = false } = {}) {
    const stored = await repository.list();
    return stored
      .map((item) => normalizeContentSignal(item))
      .filter((signal) => signal.workspaceId === ownerWorkspaceId)
      .filter((signal) => includeArchived || signal.status !== CONTENT_SIGNAL_STATUSES.ARCHIVED)
      .filter((signal) => !status || signal.status === status)
      .filter((signal) => !projectId || signal.projectId === projectId);
  }

  async function readSignal(signalId) {
    const stored = await repository.get(signalId);
    if (!stored) return null;
    return assertOwned(stored);
  }

  async function updateSignalMetadata(signalId, patch = {}) {
    const current = await requireOwned(signalId);
    const now = applicationClock.now();
    const referencePatch = {};
    if (Object.prototype.hasOwnProperty.call(patch, "sourceArtifactIds") || Object.prototype.hasOwnProperty.call(patch, "assetIds")) {
      const references = await validateReferences({
        sourceArtifactIds: patch.sourceArtifactIds ?? current.sourceArtifactIds,
        assetIds: patch.assetIds ?? current.assetIds,
      });
      Object.assign(referencePatch, references);
    }
    const next = updateContentSignalMetadata(current, { ...patch, ...referencePatch }, now);
    return repository.upsert(next);
  }

  async function changeStatus(signalId, status, options = {}) {
    const current = await requireOwned(signalId);
    const now = applicationClock.now();
    const next = transitionContentSignal(current, status, now, options);
    return repository.upsert(next);
  }

  async function ignoreSignal(signalId) {
    return changeStatus(signalId, CONTENT_SIGNAL_STATUSES.IGNORED);
  }

  async function snoozeSignal(signalId, snoozedUntil) {
    const until = new Date(snoozedUntil);
    if (!Number.isFinite(until.getTime())) throw new TypeError("A valid snooze date is required.");
    const now = new Date(applicationClock.now());
    if (until.getTime() <= now.getTime()) throw new TypeError("Snooze time must be in the future.");
    const current = await requireOwned(signalId);
    const next = transitionContentSignal(current, CONTENT_SIGNAL_STATUSES.SNOOZED, now.toISOString(), {
      snoozedUntil: until.toISOString(),
    });
    return repository.upsert(next);
  }

  async function archiveSignal(signalId) {
    return changeStatus(signalId, CONTENT_SIGNAL_STATUSES.ARCHIVED);
  }

  async function markInterpreted(signalId) {
    return changeStatus(signalId, CONTENT_SIGNAL_STATUSES.INTERPRETED);
  }

  async function markUsed(signalId) {
    return changeStatus(signalId, CONTENT_SIGNAL_STATUSES.USED);
  }

  async function restoreSignal(signalId) {
    return changeStatus(signalId, CONTENT_SIGNAL_STATUSES.NEW);
  }

  async function attachSignalToProject(signalId, projectId = null) {
    return updateSignalMetadata(signalId, { projectId: projectId ? String(projectId).trim() : null });
  }

  async function attachSourceToSignal(signalId, { sourceArtifactIds = [], assetIds = [], replace = false } = {}) {
    const current = await requireOwned(signalId);
    const requested = await validateReferences({ sourceArtifactIds, assetIds });
    const nextReferences = replace
      ? requested
      : {
          sourceArtifactIds: Array.from(new Set([...current.sourceArtifactIds, ...requested.sourceArtifactIds])).sort(),
          assetIds: Array.from(new Set([...current.assetIds, ...requested.assetIds])).sort(),
        };
    const next = attachContentSignalReferences(current, nextReferences, applicationClock.now());
    return repository.upsert(next);
  }

  async function deleteSignal(signalId) {
    await requireOwned(signalId);
    return repository.remove(signalId);
  }

  return {
    createManualSignal,
    createExternalSignal,
    listSignals,
    readSignal,
    updateSignalMetadata,
    ignoreSignal,
    snoozeSignal,
    archiveSignal,
    markInterpreted,
    markUsed,
    restoreSignal,
    attachSignalToProject,
    attachSourceToSignal,
    deleteSignal,
  };
}
