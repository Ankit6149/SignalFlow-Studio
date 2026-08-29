import { createDomainRecord, parseDomainRecord, portableClone } from "./contracts.mjs";

export const DURABLE_JOB_SCHEMA_VERSION = 1;

export const JOB_STATUSES = Object.freeze({
  QUEUED: "queued",
  SCHEDULED: "scheduled",
  RUNNING: "running",
  RETRYING: "retrying",
  SUCCEEDED: "succeeded",
  PARTIALLY_SUCCEEDED: "partially_succeeded",
  FAILED: "failed",
  CANCEL_REQUESTED: "cancel_requested",
  CANCELLED: "cancelled",
  EXPIRED: "expired",
  DEAD_LETTERED: "dead_lettered",
});

export const JOB_TYPES = Object.freeze({
  SOURCE_INGESTION: "source_ingestion",
  SOURCE_REVALIDATION: "source_revalidation",
  SIGNAL_ENRICHMENT: "signal_enrichment",
  OPPORTUNITY_EVALUATION: "opportunity_evaluation",
  NARRATIVE_GENERATION: "narrative_generation",
  PLATFORM_GENERATION: "platform_generation",
  ASSET_PROCESSING: "asset_processing",
  CAPTURE_SCREENSHOT: "capture_screenshot",
  CAPTURE_SCREENCAST: "capture_screencast",
  MEDIA_RENDER: "media_render",
  EXPORT: "export",
  PUBLICATION: "publication",
  PERFORMANCE_SYNC: "performance_sync",
  RETENTION_DELETE: "retention_delete",
});

const STATUS_VALUES = new Set(Object.values(JOB_STATUSES));
const TYPE_VALUES = new Set(Object.values(JOB_TYPES));
const SAFE_ERROR_CODE = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const TERMINAL = new Set([
  JOB_STATUSES.SUCCEEDED,
  JOB_STATUSES.PARTIALLY_SUCCEEDED,
  JOB_STATUSES.FAILED,
  JOB_STATUSES.CANCELLED,
  JOB_STATUSES.EXPIRED,
  JOB_STATUSES.DEAD_LETTERED,
]);

export class DurableJobError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "DurableJobError";
    this.code = code;
    this.details = portableClone(details);
  }
}

function text(value, fallback = "", maxLength = 1200) {
  const normalized = String(value ?? "").replace(/\r\n?/g, "\n").trim();
  const resolved = normalized || fallback;
  if (resolved.length > maxLength) throw new DurableJobError("job_text_too_long", `Job field exceeds ${maxLength} characters.`);
  return resolved;
}

function id(value, field) {
  const normalized = text(value, "", 240);
  if (!normalized) throw new DurableJobError("missing_job_id", `${field} is required.`, { field });
  if (/[/\\]|^[a-zA-Z]:/.test(normalized)) throw new DurableJobError("non_opaque_job_id", `${field} must be an opaque ID.`, { field });
  return normalized;
}

function optionalId(value, field) {
  const normalized = text(value, "", 240);
  return normalized ? id(normalized, field) : null;
}

function timestamp(value, fallback = null, field = "timestamp") {
  const candidate = value || fallback;
  if (!candidate) return null;
  const parsed = Date.parse(candidate);
  if (!Number.isFinite(parsed)) throw new DurableJobError("invalid_job_timestamp", `${field} must be an ISO timestamp.`, { field });
  return new Date(parsed).toISOString();
}

function enumValue(value, allowed, fallback, field) {
  const normalized = text(value, fallback, 100).toLowerCase();
  if (!allowed.has(normalized)) throw new DurableJobError("invalid_job_enum", `${field} contains unsupported value: ${normalized}.`, { field, value: normalized });
  return normalized;
}

function integer(value, fallback, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function safeError(error = null) {
  if (!error) return null;
  const code = text(error.code, "job_failed", 160).toLowerCase();
  if (!SAFE_ERROR_CODE.test(code)) throw new DurableJobError("unsafe_job_error_code", "Job error codes must be stable lowercase identifiers.");
  return portableClone({
    code,
    retryable: error.retryable === true,
    externalOutcomeUnknown: error.externalOutcomeUnknown === true,
    message: text(error.message, "Job failed.", 500),
  });
}

function normalizeRetryPolicy(value = {}) {
  return portableClone({
    maxAttempts: integer(value.maxAttempts, 3, 1, 20),
    initialBackoffSeconds: integer(value.initialBackoffSeconds, 15, 1, 3600),
    maxBackoffSeconds: integer(value.maxBackoffSeconds, 600, 1, 86400),
  });
}

function normalizeProgress(value = {}) {
  return portableClone({
    stage: text(value.stage, "queued", 120).toLowerCase(),
    completedUnits: integer(value.completedUnits, 0),
    totalUnits: value.totalUnits === null || value.totalUnits === undefined ? null : integer(value.totalUnits, 0),
    message: text(value.message, "", 400) || null,
  });
}

export function normalizeDurableJob(input = {}) {
  const parsed = input?.kind === "DurableJob" && input?.schemaVersion ? parseDomainRecord(input, "DurableJob") : input;
  const createdAt = timestamp(parsed.createdAt, null, "DurableJob.createdAt");
  if (!createdAt) throw new DurableJobError("missing_job_created_at", "DurableJob.createdAt is required.");
  const status = enumValue(parsed.status, STATUS_VALUES, JOB_STATUSES.QUEUED, "DurableJob.status");
  return createDomainRecord("DurableJob", {
    durableJobSchemaVersion: DURABLE_JOB_SCHEMA_VERSION,
    jobId: id(parsed.jobId, "DurableJob.jobId"),
    workspaceId: id(parsed.workspaceId, "DurableJob.workspaceId"),
    actorRef: optionalId(parsed.actorRef, "DurableJob.actorRef"),
    resourceType: text(parsed.resourceType, "resource", 120).toLowerCase(),
    resourceId: id(parsed.resourceId, "DurableJob.resourceId"),
    jobType: enumValue(parsed.jobType, TYPE_VALUES, JOB_TYPES.ASSET_PROCESSING, "DurableJob.jobType"),
    inputVersion: integer(parsed.inputVersion, 1, 1),
    inputRef: optionalId(parsed.inputRef, "DurableJob.inputRef"),
    idempotencyKey: id(parsed.idempotencyKey, "DurableJob.idempotencyKey"),
    priority: integer(parsed.priority, 50, 0, 100),
    status,
    progress: normalizeProgress(parsed.progress),
    attemptCount: integer(parsed.attemptCount, 0, 0, 100),
    retryPolicy: normalizeRetryPolicy(parsed.retryPolicy),
    scheduledAt: timestamp(parsed.scheduledAt, null, "DurableJob.scheduledAt"),
    nextAttemptAt: timestamp(parsed.nextAttemptAt, null, "DurableJob.nextAttemptAt"),
    leaseOwner: parsed.leaseOwner ? text(parsed.leaseOwner, "", 240) : null,
    leaseExpiresAt: timestamp(parsed.leaseExpiresAt, null, "DurableJob.leaseExpiresAt"),
    heartbeatAt: timestamp(parsed.heartbeatAt, null, "DurableJob.heartbeatAt"),
    cancellationRequestedAt: timestamp(parsed.cancellationRequestedAt, null, "DurableJob.cancellationRequestedAt"),
    correlationId: optionalId(parsed.correlationId, "DurableJob.correlationId"),
    outputRefs: Array.isArray(parsed.outputRefs) ? [...new Set(parsed.outputRefs.map((item) => id(item, "DurableJob.outputRefs")))].slice(0, 50) : [],
    lastError: safeError(parsed.lastError),
    createdAt,
    updatedAt: timestamp(parsed.updatedAt, createdAt, "DurableJob.updatedAt"),
    startedAt: timestamp(parsed.startedAt, null, "DurableJob.startedAt"),
    completedAt: timestamp(parsed.completedAt, null, "DurableJob.completedAt"),
  });
}

export function createDurableJob({
  jobId,
  workspaceId,
  actorRef = null,
  resourceType,
  resourceId,
  jobType,
  inputVersion = 1,
  inputRef = null,
  idempotencyKey,
  priority = 50,
  retryPolicy = {},
  scheduledAt = null,
  correlationId = null,
  createdAt,
} = {}) {
  const schedule = timestamp(scheduledAt, null, "DurableJob.scheduledAt");
  return normalizeDurableJob({
    jobId,
    workspaceId,
    actorRef,
    resourceType,
    resourceId,
    jobType,
    inputVersion,
    inputRef,
    idempotencyKey,
    priority,
    status: schedule && Date.parse(schedule) > Date.parse(createdAt) ? JOB_STATUSES.SCHEDULED : JOB_STATUSES.QUEUED,
    progress: { stage: schedule ? "scheduled" : "queued" },
    attemptCount: 0,
    retryPolicy,
    scheduledAt: schedule,
    nextAttemptAt: schedule,
    correlationId,
    outputRefs: [],
    createdAt,
    updatedAt: createdAt,
  });
}

export function isTerminalJob(jobInput) {
  return TERMINAL.has(normalizeDurableJob(jobInput).status);
}

export function isJobRunnable(jobInput, now) {
  const job = normalizeDurableJob(jobInput);
  if (![JOB_STATUSES.QUEUED, JOB_STATUSES.RETRYING, JOB_STATUSES.SCHEDULED].includes(job.status)) return false;
  const dueAt = job.nextAttemptAt || job.scheduledAt;
  return !dueAt || Date.parse(dueAt) <= Date.parse(timestamp(now, null, "run.now"));
}

export function claimDurableJob(jobInput, { leaseOwner, leaseSeconds = 60, now } = {}) {
  const job = normalizeDurableJob(jobInput);
  if (!isJobRunnable(job, now)) throw new DurableJobError("job_not_runnable", `Job ${job.jobId} is not runnable in status ${job.status}.`);
  if (job.cancellationRequestedAt) throw new DurableJobError("job_cancel_requested", `Job ${job.jobId} has a pending cancellation request.`);
  const owner = id(leaseOwner, "DurableJob.leaseOwner");
  const started = timestamp(now, null, "claim.now");
  const expires = new Date(Date.parse(started) + integer(leaseSeconds, 60, 5, 3600) * 1000).toISOString();
  return normalizeDurableJob({
    ...job,
    status: JOB_STATUSES.RUNNING,
    attemptCount: job.attemptCount + 1,
    leaseOwner: owner,
    leaseExpiresAt: expires,
    heartbeatAt: started,
    startedAt: job.startedAt || started,
    nextAttemptAt: null,
    progress: { ...job.progress, stage: "running" },
    updatedAt: started,
  });
}

function assertLease(job, leaseOwner, now) {
  const owner = id(leaseOwner, "DurableJob.leaseOwner");
  if (job.status !== JOB_STATUSES.RUNNING && job.status !== JOB_STATUSES.CANCEL_REQUESTED) throw new DurableJobError("job_not_running", `Job ${job.jobId} is not running.`);
  if (job.leaseOwner !== owner) throw new DurableJobError("job_lease_owner_mismatch", `Job ${job.jobId} is leased by another worker.`);
  if (job.leaseExpiresAt && Date.parse(job.leaseExpiresAt) < Date.parse(timestamp(now, null, "lease.now"))) throw new DurableJobError("job_lease_expired", `Job ${job.jobId} lease has expired.`);
  return owner;
}

export function heartbeatDurableJob(jobInput, { leaseOwner, leaseSeconds = 60, progress = null, now } = {}) {
  const job = normalizeDurableJob(jobInput);
  const owner = assertLease(job, leaseOwner, now);
  const heartbeatAt = timestamp(now, null, "heartbeat.now");
  return normalizeDurableJob({
    ...job,
    leaseOwner: owner,
    leaseExpiresAt: new Date(Date.parse(heartbeatAt) + integer(leaseSeconds, 60, 5, 3600) * 1000).toISOString(),
    heartbeatAt,
    progress: progress ? normalizeProgress(progress) : job.progress,
    updatedAt: heartbeatAt,
  });
}

export function succeedDurableJob(jobInput, { leaseOwner, outputRefs = [], partial = false, now } = {}) {
  const job = normalizeDurableJob(jobInput);
  assertLease(job, leaseOwner, now);
  const completedAt = timestamp(now, null, "complete.now");
  return normalizeDurableJob({
    ...job,
    status: partial ? JOB_STATUSES.PARTIALLY_SUCCEEDED : JOB_STATUSES.SUCCEEDED,
    progress: { stage: partial ? "partially_succeeded" : "succeeded" },
    outputRefs,
    leaseOwner: null,
    leaseExpiresAt: null,
    heartbeatAt: null,
    completedAt,
    lastError: null,
    updatedAt: completedAt,
  });
}

function retryDelaySeconds(job) {
  const exponent = Math.max(0, job.attemptCount - 1);
  return Math.min(job.retryPolicy.maxBackoffSeconds, job.retryPolicy.initialBackoffSeconds * (2 ** exponent));
}

export function failDurableJob(jobInput, { leaseOwner, error, now } = {}) {
  const job = normalizeDurableJob(jobInput);
  assertLease(job, leaseOwner, now);
  const failedAt = timestamp(now, null, "fail.now");
  const normalizedError = safeError(error || { code: "job_failed", message: "Job failed." });
  const retryForbidden = normalizedError.externalOutcomeUnknown === true && job.jobType === JOB_TYPES.PUBLICATION;
  const canRetry = normalizedError.retryable === true && !retryForbidden && job.attemptCount < job.retryPolicy.maxAttempts && !job.cancellationRequestedAt;
  const status = canRetry ? JOB_STATUSES.RETRYING : (job.attemptCount >= job.retryPolicy.maxAttempts && normalizedError.retryable ? JOB_STATUSES.DEAD_LETTERED : JOB_STATUSES.FAILED);
  return normalizeDurableJob({
    ...job,
    status,
    progress: { stage: status },
    nextAttemptAt: canRetry ? new Date(Date.parse(failedAt) + retryDelaySeconds(job) * 1000).toISOString() : null,
    leaseOwner: null,
    leaseExpiresAt: null,
    heartbeatAt: null,
    completedAt: canRetry ? null : failedAt,
    lastError: normalizedError,
    updatedAt: failedAt,
  });
}

export function requestDurableJobCancellation(jobInput, now) {
  const job = normalizeDurableJob(jobInput);
  if (TERMINAL.has(job.status)) return job;
  const requestedAt = timestamp(now, null, "cancel.now");
  if ([JOB_STATUSES.QUEUED, JOB_STATUSES.SCHEDULED, JOB_STATUSES.RETRYING].includes(job.status)) {
    return normalizeDurableJob({
      ...job,
      status: JOB_STATUSES.CANCELLED,
      cancellationRequestedAt: requestedAt,
      completedAt: requestedAt,
      progress: { stage: "cancelled" },
      nextAttemptAt: null,
      updatedAt: requestedAt,
    });
  }
  return normalizeDurableJob({
    ...job,
    status: JOB_STATUSES.CANCEL_REQUESTED,
    cancellationRequestedAt: requestedAt,
    progress: { ...job.progress, stage: "cancel_requested" },
    updatedAt: requestedAt,
  });
}

export function acknowledgeDurableJobCancellation(jobInput, { leaseOwner, now } = {}) {
  const job = normalizeDurableJob(jobInput);
  assertLease(job, leaseOwner, now);
  if (!job.cancellationRequestedAt) throw new DurableJobError("job_cancel_not_requested", `Job ${job.jobId} has no cancellation request.`);
  const completedAt = timestamp(now, null, "cancel_ack.now");
  return normalizeDurableJob({
    ...job,
    status: JOB_STATUSES.CANCELLED,
    progress: { stage: "cancelled" },
    leaseOwner: null,
    leaseExpiresAt: null,
    heartbeatAt: null,
    completedAt,
    updatedAt: completedAt,
  });
}

export function recoverExpiredLease(jobInput, now) {
  const job = normalizeDurableJob(jobInput);
  if (![JOB_STATUSES.RUNNING, JOB_STATUSES.CANCEL_REQUESTED].includes(job.status) || !job.leaseExpiresAt) return job;
  const recoveredAt = timestamp(now, null, "recover.now");
  if (Date.parse(job.leaseExpiresAt) >= Date.parse(recoveredAt)) return job;
  if (job.cancellationRequestedAt) {
    return normalizeDurableJob({
      ...job,
      status: JOB_STATUSES.CANCELLED,
      leaseOwner: null,
      leaseExpiresAt: null,
      heartbeatAt: null,
      completedAt: recoveredAt,
      progress: { stage: "cancelled" },
      updatedAt: recoveredAt,
    });
  }
  const retryable = job.attemptCount < job.retryPolicy.maxAttempts;
  return normalizeDurableJob({
    ...job,
    status: retryable ? JOB_STATUSES.RETRYING : JOB_STATUSES.DEAD_LETTERED,
    leaseOwner: null,
    leaseExpiresAt: null,
    heartbeatAt: null,
    nextAttemptAt: retryable ? recoveredAt : null,
    completedAt: retryable ? null : recoveredAt,
    progress: { stage: retryable ? "retrying" : "dead_lettered" },
    lastError: { code: "worker_lease_expired", retryable, externalOutcomeUnknown: false, message: "Worker lease expired before completion." },
    updatedAt: recoveredAt,
  });
}

export function createMemoryDurableJobRepository(initial = []) {
  const records = new Map();
  for (const item of initial) {
    const job = normalizeDurableJob(item);
    records.set(job.jobId, job);
  }
  return {
    async get(jobId) { return records.get(String(jobId || "")) || null; },
    async list(workspaceId) { return [...records.values()].filter((job) => !workspaceId || job.workspaceId === workspaceId).map(portableClone); },
    async findByIdempotency(workspaceId, jobType, idempotencyKey) {
      return [...records.values()].find((job) => job.workspaceId === workspaceId && job.jobType === jobType && job.idempotencyKey === idempotencyKey) || null;
    },
    async upsert(jobInput) {
      const job = normalizeDurableJob(jobInput);
      records.set(job.jobId, job);
      return portableClone(job);
    },
    async remove(jobId) { return records.delete(String(jobId || "")); },
  };
}

export async function enqueueDurableJob(repository, jobInput) {
  if (!repository || typeof repository.findByIdempotency !== "function" || typeof repository.upsert !== "function") throw new DurableJobError("invalid_job_repository", "Durable job repository requires findByIdempotency and upsert operations.");
  const job = normalizeDurableJob(jobInput);
  const existing = await repository.findByIdempotency(job.workspaceId, job.jobType, job.idempotencyKey);
  if (existing) {
    const normalizedExisting = normalizeDurableJob(existing);
    if (normalizedExisting.resourceType !== job.resourceType || normalizedExisting.resourceId !== job.resourceId || normalizedExisting.inputVersion !== job.inputVersion) {
      throw new DurableJobError("job_idempotency_conflict", "Idempotency key was already used for a different durable job input.");
    }
    return { job: normalizedExisting, deduplicated: true };
  }
  return { job: await repository.upsert(job), deduplicated: false };
}
