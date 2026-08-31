import { assertPort } from "../domain/ports.mjs";
import { CAPTURE_JOB_STATUSES, normalizeCaptureJob } from "../domain/captureRecipes.mjs";
import { JOB_STATUSES, JOB_TYPES, failDurableJob, isTerminalJob } from "../domain/durableJobs.mjs";

function required(value, field) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new TypeError(`${field} is required.`);
  return normalized;
}

function safeCode(value, fallback = "capture_failed") {
  const normalized = String(value || fallback).trim().toLowerCase();
  return /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(normalized) ? normalized : fallback;
}

function safeFailure(error) {
  const code = safeCode(error?.code);
  const retryableCodes = new Set([
    "navigation_timeout",
    "navigation_failed",
    "browser_crash",
    "browser_protocol_failed",
    "capture_failed",
    "storage_failed",
    "worker_unavailable",
  ]);
  return {
    code,
    retryable: retryableCodes.has(code),
    externalOutcomeUnknown: false,
    message: code.replaceAll("_", " "),
  };
}

export function createExactCaptureJobExecutionApplication({
  durableJobRepository,
  captureRepository,
  captureExecutionApplication,
  clock,
  leaseOwner = "hosted-capture-request",
  leaseSeconds = 90,
} = {}) {
  const jobs = assertPort("durableJobRepository", durableJobRepository);
  const captures = assertPort("captureRepository", captureRepository);
  const time = assertPort("clock", clock);
  if (!captureExecutionApplication || typeof captureExecutionApplication.executeClaimedJob !== "function") {
    throw new TypeError("Exact capture execution requires captureExecutionApplication.executeClaimedJob().");
  }

  async function updateCaptureTerminal(captureJob, status, issueCode, completedAt) {
    if (!captureJob) return null;
    return captures.upsertJob(normalizeCaptureJob({
      ...captureJob,
      status,
      issueCode: issueCode || null,
      completedAt,
      updatedAt: completedAt,
    }));
  }

  async function runJob(jobIdInput) {
    const jobId = required(jobIdInput, "jobId");
    const before = await jobs.get(jobId);
    if (!before) {
      const error = new Error(`Capture durable job ${jobId} does not exist.`);
      error.code = "capture_job_missing";
      error.status = 404;
      throw error;
    }
    if (![JOB_TYPES.CAPTURE_SCREENSHOT, JOB_TYPES.CAPTURE_SCREENCAST].includes(before.jobType)) {
      const error = new Error("Exact capture execution accepts capture jobs only.");
      error.code = "capture_job_type_invalid";
      error.status = 400;
      throw error;
    }

    if (isTerminalJob(before)) {
      return {
        executed: false,
        durableJob: before,
        captureJob: await captures.getJob(before.resourceId),
        assets: [],
      };
    }

    const claimed = await jobs.claimById(jobId, {
      leaseOwner,
      leaseSeconds,
      now: time.now(),
      jobTypes: [before.jobType],
    });
    if (!claimed) {
      const current = await jobs.get(jobId);
      return {
        executed: false,
        durableJob: current,
        captureJob: current ? await captures.getJob(current.resourceId) : null,
        assets: [],
      };
    }

    try {
      const result = await captureExecutionApplication.executeClaimedJob(claimed);
      return { executed: true, ...result };
    } catch (error) {
      const now = time.now();
      const freshJob = await jobs.get(claimed.jobId);
      const captureJob = await captures.getJob(claimed.resourceId);

      if (error?.code === "cancelled" || freshJob?.status === JOB_STATUSES.CANCELLED) {
        await updateCaptureTerminal(captureJob, CAPTURE_JOB_STATUSES.CANCELLED, "cancelled", now);
        return {
          executed: true,
          durableJob: await jobs.get(claimed.jobId),
          captureJob: captureJob ? await captures.getJob(captureJob.captureJobId) : null,
          assets: [],
        };
      }

      if (freshJob && [JOB_STATUSES.RUNNING, JOB_STATUSES.CANCEL_REQUESTED].includes(freshJob.status)) {
        await jobs.upsert(failDurableJob(freshJob, {
          leaseOwner,
          error: safeFailure(error),
          now,
        }));
      }
      await updateCaptureTerminal(captureJob, CAPTURE_JOB_STATUSES.FAILED, safeCode(error?.code), now);
      throw error;
    }
  }

  return Object.freeze({ runJob });
}
