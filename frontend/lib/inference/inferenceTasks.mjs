import { portableClone } from "../domain/contracts.mjs";
import { PRIVACY_CLASSES } from "../domain/sourceArtifacts.mjs";

export const INFERENCE_TASK_TYPES = Object.freeze({
  OPPORTUNITY_EVALUATION: "opportunity_evaluation",
  NARRATIVE_STRATEGY: "narrative_strategy",
  PLATFORM_VARIANT: "platform_variant",
  PLATFORM_VARIANT_REVISION: "platform_variant_revision",
  AUTHENTICITY_CRITIQUE: "authenticity_critique",
  EVIDENCE_CRITIQUE: "evidence_critique",
});

export const INFERENCE_ROUTE_KINDS = Object.freeze({
  REMOTE: "remote",
  LOCAL: "local",
});

const TASK_TYPES = new Set(Object.values(INFERENCE_TASK_TYPES));
const PRIVACY_VALUES = new Set(Object.values(PRIVACY_CLASSES));
const REMOTE_DENIED = new Set([
  PRIVACY_CLASSES.DEVICE_PRIVATE,
  PRIVACY_CLASSES.RESTRICTED,
]);

function text(value, fallback = "", maxLength = 240) {
  const normalized = String(value ?? "").trim();
  const resolved = normalized || fallback;
  if (resolved.length > maxLength) throw new TypeError(`InferenceTask text exceeds ${maxLength} characters.`);
  return resolved;
}

function id(value, field) {
  const normalized = text(value, "", 240);
  if (!normalized) throw new TypeError(`InferenceTask.${field} is required.`);
  if (/[/\\]|^[a-zA-Z]:/.test(normalized)) throw new TypeError(`InferenceTask.${field} must be an opaque ID.`);
  return normalized;
}

function timestamp(value, field = "createdAt") {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new TypeError(`InferenceTask.${field} must be an ISO timestamp.`);
  return new Date(parsed).toISOString();
}

export function createInferenceTask({
  taskId,
  workspaceId,
  taskType,
  dataClassification = PRIVACY_CLASSES.WORKSPACE_PRIVATE,
  inputRefs = [],
  requirements = [],
  createdAt,
} = {}) {
  const normalizedType = text(taskType, "", 80).toLowerCase();
  if (!TASK_TYPES.has(normalizedType)) throw new TypeError(`Unsupported inference task type: ${normalizedType || "missing"}.`);
  const normalizedPrivacy = text(dataClassification, PRIVACY_CLASSES.WORKSPACE_PRIVATE, 80).toLowerCase();
  if (!PRIVACY_VALUES.has(normalizedPrivacy)) throw new TypeError(`Unsupported inference data classification: ${normalizedPrivacy}.`);
  if (!Array.isArray(inputRefs) || !Array.isArray(requirements)) throw new TypeError("InferenceTask refs/requirements must be arrays.");
  return portableClone({
    taskId: id(taskId, "taskId"),
    workspaceId: id(workspaceId, "workspaceId"),
    taskType: normalizedType,
    dataClassification: normalizedPrivacy,
    inputRefs: Array.from(new Set(inputRefs.map((value) => id(value, "inputRefs")))).sort(),
    requirements: Array.from(new Set(requirements.map((value) => text(value, "", 80).toLowerCase()).filter(Boolean))).sort(),
    createdAt: timestamp(createdAt),
  });
}

export function normalizeInferenceTask(input = {}) {
  return createInferenceTask(input);
}

export function assertInferenceRouteAllowed(taskInput, { provider, isLocal = false } = {}) {
  const task = normalizeInferenceTask(taskInput);
  const providerId = text(provider, "", 80).toLowerCase();
  if (!providerId) throw new TypeError("Inference route requires a provider ID.");
  const routeKind = isLocal ? INFERENCE_ROUTE_KINDS.LOCAL : INFERENCE_ROUTE_KINDS.REMOTE;
  if (routeKind === INFERENCE_ROUTE_KINDS.REMOTE && REMOTE_DENIED.has(task.dataClassification)) {
    const error = new Error(
      `${task.dataClassification} content cannot be sent to a remote inference provider. Use a permitted local/private route or change the signal privacy classification deliberately.`,
    );
    error.code = "inference_privacy_route_denied";
    throw error;
  }
  return { task, provider: providerId, routeKind };
}

export function minimizeSignalForOpportunity(signal = {}) {
  return portableClone({
    signalId: text(signal.signalId, "", 240),
    workspaceId: text(signal.workspaceId, "", 240),
    projectId: signal.projectId ? text(signal.projectId, "", 240) : null,
    signalKind: text(signal.signalKind, "thought", 80),
    headline: text(signal.headline, "", 240),
    summary: text(signal.summary, "", 12000),
    importanceHints: Array.isArray(signal.importanceHints)
      ? signal.importanceHints.map((value) => text(value, "", 120)).filter(Boolean).slice(0, 16)
      : [],
    boundaryNote: signal.boundaryNote ? text(signal.boundaryNote, "", 4000) : null,
    privacyClassification: text(signal.privacyClassification, PRIVACY_CLASSES.WORKSPACE_PRIVATE, 80),
    occurredAt: signal.occurredAt || null,
    observedAt: signal.observedAt || null,
    sourceArtifactCount: Array.isArray(signal.sourceArtifactIds) ? signal.sourceArtifactIds.length : 0,
    assetCount: Array.isArray(signal.assetIds) ? signal.assetIds.length : 0,
  });
}
