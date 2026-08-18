import { assertPort } from "../domain/ports.mjs";
import {
  createProjectContextFingerprint,
  normalizeProjectContextSnapshot,
} from "../domain/projectContexts.mjs";
import { PRIVACY_CLASSES } from "../domain/sourceArtifacts.mjs";
import {
  createInferenceTask,
  INFERENCE_TASK_TYPES,
} from "../inference/inferenceTasks.mjs";
import {
  acceptProjectContextSynthesis,
  normalizeProjectContextTaskInput,
  PROJECT_CONTEXT_PROMPT_VERSION,
} from "../ai/projectContextSynthesis.mjs";

function requiredId(value, field) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new TypeError(`${field} is required.`);
  if (/[/\\]|^[a-zA-Z]:/.test(normalized)) throw new TypeError(`${field} must be an opaque ID.`);
  return normalized;
}

function normalizeIds(values, field) {
  const result = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const normalized = requiredId(value, field);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result.sort((left, right) => left.localeCompare(right));
}

function ensureWorkspace(record, workspaceId, label) {
  if (record && record.workspaceId !== workspaceId) {
    throw new Error(`${label} belongs to another workspace.`);
  }
  return record;
}

export function createProjectContextApplication({
  workspaceId,
  repository,
  inferenceAdapter = null,
  clock,
  idService,
} = {}) {
  const ownerWorkspaceId = requiredId(workspaceId, "workspaceId");
  const projectContextRepository = assertPort("projectContextRepository", repository);
  const inference = inferenceAdapter ? assertPort("inferenceAdapter", inferenceAdapter) : null;
  const systemClock = assertPort("clock", clock);
  const ids = assertPort("idService", idService);

  async function listProjectContexts({ projectId = null } = {}) {
    const normalizedProjectId = projectId ? requiredId(projectId, "projectId") : null;
    const records = (await projectContextRepository.list())
      .map(normalizeProjectContextSnapshot)
      .filter((record) => record.workspaceId === ownerWorkspaceId)
      .filter((record) => !normalizedProjectId || record.projectId === normalizedProjectId)
      .sort((left, right) => {
        const projectOrder = String(left.projectId).localeCompare(String(right.projectId));
        if (projectOrder) return projectOrder;
        return Number(right.version) - Number(left.version);
      });
    return records;
  }

  async function readProjectContext(projectContextSnapshotId) {
    const record = await projectContextRepository.get(requiredId(projectContextSnapshotId, "projectContextSnapshotId"));
    if (!record) return null;
    return ensureWorkspace(normalizeProjectContextSnapshot(record), ownerWorkspaceId, "Project context");
  }

  async function getLatestProjectContext(projectId) {
    const normalizedProjectId = requiredId(projectId, "projectId");
    const records = await listProjectContexts({ projectId: normalizedProjectId });
    return records[0] || null;
  }

  async function bootstrapProjectContext({
    projectId,
    repositoryRef = null,
    sourceArtifactIds = [],
    supplementalSourceArtifactIds = [],
    assetIds = [],
    synthesis = {},
    synthesisProvenance = { mode: "deterministic" },
    privacyClass = PRIVACY_CLASSES.WORKSPACE_PRIVATE,
  } = {}) {
    const normalizedProjectId = requiredId(projectId, "projectId");
    const fingerprintInput = {
      projectId: normalizedProjectId,
      repositoryRef,
      sourceArtifactIds: normalizeIds(sourceArtifactIds, "sourceArtifactIds"),
      supplementalSourceArtifactIds: normalizeIds(supplementalSourceArtifactIds, "supplementalSourceArtifactIds"),
      assetIds: normalizeIds(assetIds, "assetIds"),
    };
    const fingerprint = createProjectContextFingerprint(fingerprintInput);
    const existing = (await listProjectContexts({ projectId: normalizedProjectId }))
      .find((record) => record.fingerprint === fingerprint);
    if (existing) return { context: existing, reused: true };

    const latest = await getLatestProjectContext(normalizedProjectId);
    const createdAt = systemClock.now();
    const context = normalizeProjectContextSnapshot({
      projectContextSnapshotId: ids.create("project-context"),
      workspaceId: ownerWorkspaceId,
      projectId: normalizedProjectId,
      version: Number(latest?.version || 0) + 1,
      supersedesId: latest?.projectContextSnapshotId || null,
      fingerprint,
      repositoryRef,
      sourceArtifactIds: fingerprintInput.sourceArtifactIds,
      supplementalSourceArtifactIds: fingerprintInput.supplementalSourceArtifactIds,
      assetIds: fingerprintInput.assetIds,
      privacyClass,
      synthesis,
      synthesisProvenance,
      createdAt,
    });
    await projectContextRepository.upsert(context);
    return { context, reused: false };
  }

  async function synthesizeAndBootstrapProjectContext({
    projectId,
    repositoryRef = null,
    evidence = [],
    supplementalSourceArtifactIds = [],
    assetIds = [],
    privacyClass = PRIVACY_CLASSES.WORKSPACE_PRIVATE,
  } = {}) {
    if (!inference) throw new Error("Project-context synthesis requires a configured inference adapter.");
    const normalizedProjectId = requiredId(projectId, "projectId");
    const normalizedInput = normalizeProjectContextTaskInput({
      workspaceId: ownerWorkspaceId,
      projectId: normalizedProjectId,
      evidence,
    });
    const sourceArtifactIds = normalizeIds(
      normalizedInput.evidence.map((item) => item.sourceArtifactId),
      "sourceArtifactIds",
    );
    const normalizedSupplementalIds = normalizeIds(supplementalSourceArtifactIds, "supplementalSourceArtifactIds");
    const normalizedAssetIds = normalizeIds(assetIds, "assetIds");
    const fingerprint = createProjectContextFingerprint({
      projectId: normalizedProjectId,
      repositoryRef,
      sourceArtifactIds,
      supplementalSourceArtifactIds: normalizedSupplementalIds,
      assetIds: normalizedAssetIds,
    });
    const existing = (await listProjectContexts({ projectId: normalizedProjectId }))
      .find((record) => record.fingerprint === fingerprint);
    if (existing) return { context: existing, reused: true, inferenceSkipped: true };

    const now = systemClock.now();
    const task = createInferenceTask({
      taskId: ids.create("task"),
      workspaceId: ownerWorkspaceId,
      taskType: INFERENCE_TASK_TYPES.PROJECT_CONTEXT_SYNTHESIS,
      dataClassification: privacyClass,
      inputRefs: [normalizedProjectId, ...sourceArtifactIds, ...normalizedSupplementalIds],
      requirements: ["bounded_evidence", "structured_output", "project_understanding", "no_destination_decision"],
      createdAt: now,
    });
    const result = await inference.execute({ task, input: normalizedInput });
    const synthesis = acceptProjectContextSynthesis(result.output);
    const provenance = result.provenance || {};
    return bootstrapProjectContext({
      projectId: normalizedProjectId,
      repositoryRef,
      sourceArtifactIds,
      supplementalSourceArtifactIds: normalizedSupplementalIds,
      assetIds: normalizedAssetIds,
      privacyClass,
      synthesis,
      synthesisProvenance: {
        mode: "model",
        taskId: task.taskId,
        provider: provenance.provider || null,
        model: provenance.model || null,
        routeKind: provenance.routeKind || null,
        promptVersion: provenance.promptVersion || PROJECT_CONTEXT_PROMPT_VERSION,
        generatedAt: provenance.generatedAt || provenance.evaluatedAt || now,
      },
    });
  }

  async function resolveLatestForSignal(signal) {
    if (!signal || typeof signal !== "object") throw new TypeError("signal is required.");
    ensureWorkspace(signal, ownerWorkspaceId, "ContentSignal");
    if (!signal.projectId) return null;
    return getLatestProjectContext(signal.projectId);
  }

  return {
    listProjectContexts,
    readProjectContext,
    getLatestProjectContext,
    bootstrapProjectContext,
    synthesizeAndBootstrapProjectContext,
    resolveLatestForSignal,
  };
}
