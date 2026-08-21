import { assertPort } from "../domain/ports.mjs";
import {
  normalizeSourceConnection,
  resolveSourceConnectionResource,
  SOURCE_CONNECTION_STATUSES,
} from "../domain/sourceConnections.mjs";
import {
  createGithubRepositoryEvidenceBundle,
  planGithubRepositoryEvidence,
} from "../integrations/github/githubRepositoryEvidence.mjs";

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

function repositoryNames(repository) {
  const fullName = String(repository?.fullName || "").trim();
  const [owner, name, ...rest] = fullName.split("/");
  if (!owner || !name || rest.length) throw new TypeError("GitHub repository fullName must be owner/repository.");
  return { owner, repository: name };
}

function sameRepositoryRevision(context, repository, revision) {
  const ref = context?.repositoryRef;
  if (!ref || ref.provider !== "github") return false;
  const names = repositoryNames(repository);
  return ref.owner === names.owner
    && ref.repository === names.repository
    && ref.revision === String(revision || "").trim();
}

function safeContextView(context, { reused = false } = {}) {
  return Object.freeze({
    projectContextSnapshotId: context.projectContextSnapshotId,
    projectId: context.projectId,
    version: context.version,
    fingerprint: context.fingerprint,
    privacyClass: context.privacyClass,
    projectName: context.synthesis?.projectName || null,
    purpose: context.synthesis?.purpose || null,
    reused: Boolean(reused),
  });
}

export function createGithubRepositoryBootstrapApplication({
  workspaceId,
  sourceConnectionRepository,
  sourceArtifactRepository,
  projectContextApplication,
  githubRepositoryApi,
  clock,
} = {}) {
  const ownerWorkspaceId = requiredOpaque(workspaceId, "workspaceId");
  const connections = assertPort("sourceConnectionRepository", sourceConnectionRepository);
  const sourceArtifacts = assertPort("sourceArtifactRepository", sourceArtifactRepository);
  const contexts = requiredMethod(
    requiredMethod(projectContextApplication, "getLatestProjectContext", "ProjectContext application"),
    "synthesizeAndBootstrapProjectContext",
    "ProjectContext application",
  );
  const github = requiredMethod(
    requiredMethod(githubRepositoryApi, "getRepositorySnapshot", "GitHub repository API"),
    "readTextFiles",
    "GitHub repository API",
  );
  const systemClock = assertPort("clock", clock);

  async function requireActiveRepository(sourceConnectionId, repositoryId) {
    const connectionId = requiredOpaque(sourceConnectionId, "sourceConnectionId");
    const repoId = requiredOpaque(repositoryId, "repositoryId");
    if (!/^\d+$/.test(repoId)) throw new TypeError("repositoryId must be a numeric GitHub identifier.");
    const stored = await connections.get(connectionId);
    if (!stored) {
      const error = new Error("GitHub SourceConnection was not found.");
      error.code = "github_connection_not_found";
      throw error;
    }
    const connection = normalizeSourceConnection(stored);
    if (connection.workspaceId !== ownerWorkspaceId || connection.provider !== "github") {
      const error = new Error("GitHub SourceConnection does not belong to this workspace.");
      error.code = "github_connection_not_found";
      throw error;
    }
    if (connection.status !== SOURCE_CONNECTION_STATUSES.ACTIVE || !connection.verifiedAt || !connection.installationRef) {
      const error = new Error("GitHub SourceConnection must be active and verified before repository understanding can run.");
      error.code = "github_connection_not_active";
      throw error;
    }
    const resource = resolveSourceConnectionResource(connection, repoId);
    if (!resource || resource.resourceType !== "repository" || !resource.projectId) {
      const error = new Error("Repository is not an enabled resource of this GitHub SourceConnection.");
      error.code = "github_repository_scope_mismatch";
      throw error;
    }
    return { connection, resource, repositoryId: repoId };
  }

  async function persistArtifacts(artifacts) {
    const persisted = [];
    for (const artifact of artifacts) {
      const stored = await sourceArtifacts.upsert(artifact);
      if (stored.workspaceId !== ownerWorkspaceId) {
        throw new Error("Persisted SourceArtifact belongs to another workspace.");
      }
      persisted.push(stored);
    }
    return persisted;
  }

  async function bootstrapRepository({ sourceConnectionId, repositoryId } = {}) {
    const { connection, resource, repositoryId: repoId } = await requireActiveRepository(sourceConnectionId, repositoryId);
    const snapshot = await github.getRepositorySnapshot(connection.installationRef, repoId);
    if (String(snapshot.repository?.id || "") !== repoId) {
      const error = new Error("GitHub repository identity does not match the selected SourceConnection resource.");
      error.code = "github_repository_identity_mismatch";
      throw error;
    }
    if (resource.displayName && snapshot.repository.fullName !== resource.displayName) {
      const error = new Error("GitHub repository name no longer matches the selected SourceConnection resource.");
      error.code = "github_repository_scope_mismatch";
      throw error;
    }

    const latest = await contexts.getLatestProjectContext(resource.projectId);
    if (latest && sameRepositoryRevision(latest, snapshot.repository, snapshot.revision)) {
      return Object.freeze({
        projectId: resource.projectId,
        repository: snapshot.repository,
        revision: snapshot.revision,
        evidenceCount: latest.sourceArtifactIds.length,
        context: safeContextView(latest, { reused: true }),
        reused: true,
        inferenceSkipped: true,
      });
    }

    const plan = planGithubRepositoryEvidence({
      repository: snapshot.repository,
      revision: snapshot.revision,
      treeEntries: snapshot.treeEntries,
    });
    const files = await github.readTextFiles(
      connection.installationRef,
      repoId,
      snapshot.revision,
      plan.paths,
    );
    const now = systemClock.now();
    const bundle = createGithubRepositoryEvidenceBundle({
      workspaceId: ownerWorkspaceId,
      sourceConnectionId: connection.sourceConnectionId,
      repository: snapshot.repository,
      revision: snapshot.revision,
      treeEntries: snapshot.treeEntries,
      files,
      plan,
      now,
    });
    const persistedArtifacts = await persistArtifacts(bundle.sourceArtifacts);
    const persistedIds = new Set(persistedArtifacts.map((item) => item.sourceArtifactId));
    for (const evidence of bundle.evidence) {
      if (!persistedIds.has(evidence.sourceArtifactId)) {
        throw new Error("Repository evidence references a SourceArtifact that was not durably persisted.");
      }
    }

    const result = await contexts.synthesizeAndBootstrapProjectContext({
      projectId: resource.projectId,
      repositoryRef: bundle.repositoryRef,
      evidence: bundle.evidence,
      privacyClass: bundle.privacyClass,
    });

    return Object.freeze({
      projectId: resource.projectId,
      repository: snapshot.repository,
      revision: snapshot.revision,
      evidenceCount: bundle.evidence.length,
      context: safeContextView(result.context, { reused: result.reused }),
      reused: Boolean(result.reused),
      inferenceSkipped: Boolean(result.inferenceSkipped),
    });
  }

  return Object.freeze({ bootstrapRepository });
}
