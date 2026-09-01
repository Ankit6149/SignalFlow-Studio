import { assertPort, createSystemClock } from "../domain/ports.mjs";

function requireMethod(target, method, label) {
  if (!target || typeof target[method] !== "function") throw new TypeError(`${label} requires ${method}().`);
  return target;
}

function safeErrorCode(error) {
  return String(error?.code || "opportunity_evaluation_failed").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_").slice(0, 160)
    || "opportunity_evaluation_failed";
}

export function createSignalOpportunityWorkerApplication({
  opportunityJobRepository,
  createContinuationApplication,
  createEvidenceRefreshApplication = null,
  clock = createSystemClock(),
} = {}) {
  const jobs = opportunityJobRepository;
  requireMethod(jobs, "claimNext", "Signal opportunity job repository");
  requireMethod(jobs, "complete", "Signal opportunity job repository");
  requireMethod(jobs, "fail", "Signal opportunity job repository");
  if (typeof createContinuationApplication !== "function") {
    throw new TypeError("Signal opportunity worker requires createContinuationApplication().");
  }
  if (createEvidenceRefreshApplication !== null && typeof createEvidenceRefreshApplication !== "function") {
    throw new TypeError("Signal opportunity worker createEvidenceRefreshApplication must be a function when provided.");
  }
  const systemClock = assertPort("clock", clock);

  async function processNext() {
    const job = await jobs.claimNext({ now: systemClock.now() });
    if (!job) return Object.freeze({ status: "idle" });

    try {
      if (createEvidenceRefreshApplication) {
        const evidence = await createEvidenceRefreshApplication(job.workspaceId);
        requireMethod(evidence, "refreshForSignal", "Signal evidence refresh application");
        await evidence.refreshForSignal(job.signalId);
      }
      const continuation = await createContinuationApplication(job.workspaceId);
      requireMethod(continuation, "continueToOpportunity", "Signal opportunity continuation application");
      const result = await continuation.continueToOpportunity(job.signalId);
      const completed = await jobs.complete(job.jobId, {
        opportunityId: result.opportunity.opportunityId,
        now: systemClock.now(),
      });
      return Object.freeze({
        status: "completed",
        jobId: completed.jobId,
        signalId: job.signalId,
        opportunityId: result.opportunity.opportunityId,
        recommendation: result.opportunity.recommendation,
      });
    } catch (error) {
      const failed = await jobs.fail(job.jobId, {
        errorCode: safeErrorCode(error),
        now: systemClock.now(),
      });
      return Object.freeze({
        status: failed.status === "dead" ? "dead" : "retry_scheduled",
        jobId: failed.jobId,
        signalId: job.signalId,
        errorCode: failed.lastErrorCode,
      });
    }
  }

  return { processNext };
}
