import { assertPort } from "../domain/ports.mjs";
import { normalizeContentSignal, CONTENT_SIGNAL_SOURCE_TYPES } from "../domain/contentSignals.mjs";
import { normalizeSourceConnection, SOURCE_CONNECTION_STATUSES } from "../domain/sourceConnections.mjs";

const GIT_SHA = /^[a-f0-9]{40,64}$/i;

function required(value, field) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new TypeError(`${field} is required.`);
  return normalized;
}

function error(code, message) {
  const failure = new Error(message);
  failure.code = code;
  return failure;
}

export function createGithubSignalEvidenceRefreshApplication({
  workspaceId,
  contentSignalRepository,
  sourceConnectionRepository,
  githubRepositoryBootstrapApplication = null,
  createGithubRepositoryBootstrapApplication = null,
} = {}) {
  const ownerWorkspaceId = required(workspaceId, "workspaceId");
  const signals = assertPort("contentSignalRepository", contentSignalRepository);
  const connections = assertPort("sourceConnectionRepository", sourceConnectionRepository);
  if (!githubRepositoryBootstrapApplication && typeof createGithubRepositoryBootstrapApplication !== "function") {
    throw new TypeError("GitHub signal evidence refresh requires a bootstrap application or lazy factory.");
  }

  async function bootstrapApplication() {
    const application = githubRepositoryBootstrapApplication
      || await createGithubRepositoryBootstrapApplication(ownerWorkspaceId);
    if (!application || typeof application.bootstrapRepository !== "function") {
      throw new TypeError("GitHub signal evidence refresh requires bootstrapRepository().");
    }
    return application;
  }

  async function refreshForSignal(signalId) {
    const storedSignal = await signals.get(required(signalId, "signalId"));
    if (!storedSignal) throw error("content_signal_not_found", "ContentSignal was not found before evidence refresh.");
    const signal = normalizeContentSignal(storedSignal);
    if (signal.workspaceId !== ownerWorkspaceId) throw error("cross_workspace_signal", "ContentSignal belongs to another workspace.");
    if (signal.sourceType !== CONTENT_SIGNAL_SOURCE_TYPES.GITHUB || !signal.sourceRevision) {
      return Object.freeze({ status: "not_required", signalId: signal.signalId, revision: signal.sourceRevision || null });
    }
    if (!GIT_SHA.test(signal.sourceRevision)) {
      throw error("github_signal_revision_invalid", "GitHub ContentSignal does not contain an exact immutable source revision.");
    }
    if (!signal.sourceConnectionId || !signal.projectId) {
      throw error("github_signal_scope_missing", "GitHub ContentSignal is missing its verified source/project scope.");
    }

    const storedConnection = await connections.get(signal.sourceConnectionId);
    if (!storedConnection) throw error("github_connection_not_found", "GitHub SourceConnection was not found for the signal.");
    const connection = normalizeSourceConnection(storedConnection);
    if (connection.workspaceId !== ownerWorkspaceId || connection.provider !== "github") {
      throw error("github_connection_not_found", "GitHub SourceConnection does not belong to this workspace.");
    }
    if (connection.status !== SOURCE_CONNECTION_STATUSES.ACTIVE || !connection.verifiedAt || !connection.installationRef) {
      throw error("github_connection_not_active", "GitHub SourceConnection is not active and verified.");
    }

    const matching = connection.resourceScopes.filter((resource) => (
      resource.enabled
      && resource.resourceType === "repository"
      && resource.projectId === signal.projectId
    ));
    if (matching.length !== 1) {
      throw error(
        matching.length ? "github_repository_scope_ambiguous" : "github_repository_scope_mismatch",
        "GitHub signal project does not resolve to exactly one enabled repository resource.",
      );
    }

    const bootstrap = await bootstrapApplication();
    const result = await bootstrap.bootstrapRepository({
      sourceConnectionId: connection.sourceConnectionId,
      repositoryId: matching[0].resourceRef,
      revision: signal.sourceRevision,
    });
    if (result.revision !== signal.sourceRevision || result.projectId !== signal.projectId) {
      throw error("github_evidence_revision_mismatch", "Refreshed repository evidence does not match the exact GitHub work event.");
    }

    return Object.freeze({
      status: result.reused ? "reused" : "refreshed",
      signalId: signal.signalId,
      projectId: result.projectId,
      revision: result.revision,
      projectContextSnapshotId: result.context?.projectContextSnapshotId || null,
      evidenceCount: Number(result.evidenceCount || 0),
    });
  }

  return Object.freeze({ refreshForSignal });
}
