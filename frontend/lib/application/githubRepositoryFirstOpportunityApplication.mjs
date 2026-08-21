import {
  CONTENT_SIGNAL_KINDS,
  CONTENT_SIGNAL_SOURCE_TYPES,
  createConnectedContentSignal,
} from "../domain/contentSignals.mjs";
import { normalizeProjectContextSnapshot } from "../domain/projectContexts.mjs";
import { assertPort, createSystemClock, createSystemIdService } from "../domain/ports.mjs";

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

function repositoryIdentity(repository = {}) {
  const id = requiredOpaque(repository.id, "repository.id");
  const fullName = String(repository.fullName || "").trim();
  if (!/^[^/]+\/[^/]+$/.test(fullName)) throw new TypeError("repository.fullName must be owner/repository.");
  return { id, fullName };
}

function summaryFromContext(context, repository) {
  const synthesis = context.synthesis || {};
  const lines = [
    synthesis.purpose,
    synthesis.problem ? `Problem: ${synthesis.problem}` : null,
    synthesis.capabilities?.length ? `Capabilities: ${synthesis.capabilities.slice(0, 8).join("; ")}` : null,
    synthesis.maturityStage ? `Maturity: ${synthesis.maturityStage}` : null,
    synthesis.safeClaims?.length ? `Evidence-backed claims: ${synthesis.safeClaims.slice(0, 6).join("; ")}` : null,
  ].filter(Boolean);
  return lines.join("\n") || `SignalFlow built bounded project understanding for ${repository.fullName}.`;
}

export function createGithubRepositoryFirstOpportunityApplication({
  workspaceId,
  contentSignalRepository,
  continuationApplication,
  clock = createSystemClock(),
  idService = createSystemIdService("signalflow"),
} = {}) {
  const ownerWorkspaceId = requiredOpaque(workspaceId, "workspaceId");
  const signals = requiredMethod(
    requiredMethod(contentSignalRepository, "findByExternalEvent", "ContentSignal repository"),
    "insertExternalIfAbsent",
    "ContentSignal repository",
  );
  const continuation = requiredMethod(continuationApplication, "continueToOpportunity", "Signal opportunity continuation");
  const systemClock = assertPort("clock", clock);
  const ids = assertPort("idService", idService);

  async function ensureInitialOpportunity({
    sourceConnectionId,
    repository,
    projectContext,
  } = {}) {
    const connectionId = requiredOpaque(sourceConnectionId, "sourceConnectionId");
    const repo = repositoryIdentity(repository);
    const context = normalizeProjectContextSnapshot(projectContext);
    if (context.workspaceId !== ownerWorkspaceId) {
      throw new Error("ProjectContextSnapshot belongs to another workspace.");
    }
    if (context.repositoryRef?.provider !== "github"
      || context.repositoryRef?.sourceConnectionId !== connectionId
      || `${context.repositoryRef?.owner}/${context.repositoryRef?.repository}` !== repo.fullName) {
      const error = new Error("ProjectContextSnapshot does not match the connected GitHub repository.");
      error.code = "github_repository_context_mismatch";
      throw error;
    }

    const eventId = `repository-context:${repo.id}:${context.fingerprint}`;
    let signal = await signals.findByExternalEvent({
      workspaceId: ownerWorkspaceId,
      provider: "github",
      eventId,
    });
    let createdSignal = false;

    if (!signal) {
      const now = systemClock.now();
      const created = createConnectedContentSignal({
        signalId: ids.create("signal"),
        workspaceId: ownerWorkspaceId,
        projectId: context.projectId,
        sourceType: CONTENT_SIGNAL_SOURCE_TYPES.GITHUB,
        sourceConnectionId: connectionId,
        externalEventRef: {
          provider: "github",
          eventId,
          idempotencyKey: eventId,
        },
        headline: context.synthesis?.projectName
          ? `${context.synthesis.projectName}: connected project snapshot`
          : `${repo.fullName}: connected project snapshot`,
        summary: summaryFromContext(context, repo),
        signalKind: CONTENT_SIGNAL_KINDS.OTHER,
        sourceArtifactIds: context.sourceArtifactIds,
        privacyClassification: context.privacyClass,
        importanceHints: ["connected_repository_context", "initial_editorial_review"],
        observedAt: now,
        actorRef: "repository-bootstrap",
        ingestionMethod: "repository_bootstrap",
      });
      const inserted = await signals.insertExternalIfAbsent(created);
      signal = inserted.signal;
      createdSignal = Boolean(inserted.created);
    }

    const result = await continuation.continueToOpportunity(signal.signalId, { refresh: false });
    return Object.freeze({
      signal: result.signal,
      projectContext: result.projectContext,
      opportunity: result.opportunity,
      createdSignal,
    });
  }

  return Object.freeze({ ensureInitialOpportunity });
}
