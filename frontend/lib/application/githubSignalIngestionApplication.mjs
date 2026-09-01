import { createContentSignalApplication } from "./contentSignalApplication.mjs";
import { assertPort, createSystemClock, createSystemIdService } from "../domain/ports.mjs";
import {
  normalizeSourceConnection,
  SOURCE_CONNECTION_STATUSES,
  updateSourceConnection,
} from "../domain/sourceConnections.mjs";
import { normalizeGithubWorkEvent } from "../integrations/github/githubEvents.mjs";

export function createGithubSignalIngestionApplication({
  sourceConnectionRepository,
  contentSignalRepository,
  sourceArtifactRepository = null,
  assetRepository = null,
  clock = createSystemClock(),
  idService = createSystemIdService("signalflow"),
} = {}) {
  const connections = assertPort("sourceConnectionRepository", sourceConnectionRepository);
  const applicationClock = assertPort("clock", clock);
  const applicationIds = assertPort("idService", idService);
  assertPort("contentSignalRepository", contentSignalRepository);

  async function resolveAuthorizedConnection(event) {
    const candidates = (await connections.findByProviderInstallation("github", event.installationRef))
      .map((item) => normalizeSourceConnection(item))
      .filter((connection) => connection.status === SOURCE_CONNECTION_STATUSES.ACTIVE)
      .map((connection) => ({
        connection,
        resource: connection.resourceScopes.find((item) => (
          item.resourceRef === event.resourceRef
          && item.enabled
          && item.eventFamilies.includes(event.eventFamily)
        )) || null,
      }))
      .filter((item) => item.resource);

    if (candidates.length > 1) {
      const error = new Error("GitHub event maps to more than one active SourceConnection resource scope.");
      error.code = "github_source_ambiguous";
      throw error;
    }
    return candidates[0] || null;
  }

  async function markEventReceived(connection, occurredAt) {
    const current = normalizeSourceConnection(await connections.get(connection.sourceConnectionId));
    const now = applicationClock.now();
    const next = updateSourceConnection(current, {
      lastEventAt: occurredAt || now,
      lastErrorCode: null,
    }, now);
    return connections.upsert(next);
  }

  async function ingest({ eventName, deliveryId, payload } = {}) {
    const event = normalizeGithubWorkEvent({ eventName, deliveryId, payload });
    if (!event) {
      return Object.freeze({ status: "ignored_unsupported", signal: null, shouldEvaluateOpportunity: false });
    }

    const authorized = await resolveAuthorizedConnection(event);
    if (!authorized) {
      const error = new Error("GitHub event is not authorized for an active SourceConnection resource scope.");
      error.code = "github_source_not_authorized";
      throw error;
    }

    const signals = createContentSignalApplication({
      contentSignalRepository,
      sourceArtifactRepository,
      assetRepository,
      workspaceId: authorized.connection.workspaceId,
      actorRef: "github-webhook",
      clock: applicationClock,
      idService: applicationIds,
    });
    const result = await signals.createExternalSignal({
      projectId: authorized.resource.projectId,
      sourceType: event.sourceType,
      sourceConnectionId: authorized.connection.sourceConnectionId,
      sourceRevision: event.sourceRevision || null,
      externalEventRef: event.externalEventRef,
      occurredAt: event.occurredAt,
      headline: event.headline,
      summary: event.summary,
      signalKind: event.signalKind,
      importanceHints: event.importanceHints,
      boundaryNote: "GitHub event metadata is a signal, not complete claim evidence. Gather only bounded authorized evidence before production.",
      actorRef: "github-webhook",
    });

    await markEventReceived(authorized.connection, event.occurredAt);

    return Object.freeze({
      status: result.created ? "created" : "duplicate",
      signal: result.signal,
      noiseDecision: event.noiseDecision,
      shouldEvaluateOpportunity: !event.noiseDecision.deprioritize && Boolean(event.sourceRevision),
      eventFamily: event.eventFamily,
      providerResourceRef: event.providerResourceRef,
    });
  }

  return { ingest };
}
