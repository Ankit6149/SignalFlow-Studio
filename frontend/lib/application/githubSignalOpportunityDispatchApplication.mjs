import { assertPort, createSystemClock } from "../domain/ports.mjs";

function requireMethod(target, method, label) {
  if (!target || typeof target[method] !== "function") throw new TypeError(`${label} requires ${method}().`);
  return target;
}

export function createGithubSignalOpportunityDispatchApplication({
  ingestionApplication,
  opportunityJobRepository,
  clock = createSystemClock(),
} = {}) {
  const ingestion = requireMethod(ingestionApplication, "ingest", "GitHub ingestion application");
  const jobs = requireMethod(opportunityJobRepository, "enqueue", "Signal opportunity job repository");
  const systemClock = assertPort("clock", clock);

  async function ingest(input) {
    const result = await ingestion.ingest(input);
    if (!result?.shouldEvaluateOpportunity || !result?.signal) return result;

    const job = await jobs.enqueue({
      workspaceId: result.signal.workspaceId,
      signalId: result.signal.signalId,
      now: systemClock.now(),
    });

    return Object.freeze({
      ...result,
      opportunityContinuation: Object.freeze({
        jobId: job.jobId,
        status: job.status,
      }),
    });
  }

  return { ingest };
}
