import { randomUUID } from "node:crypto";

function nowIso(now = () => new Date()) {
  return now().toISOString();
}

function clone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

export function createExecutionRegistry({ now = () => new Date(), idFactory = () => `campaign-${randomUUID()}` } = {}) {
  const jobs = new Map();

  function snapshot(job) {
    if (!job) return null;
    return clone({
      id: job.id,
      status: job.status,
      phase: job.phase,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      cancelledAt: job.cancelledAt,
      cancellationRequested: job.cancellationRequested,
      metadata: job.metadata,
      progress: job.progress,
      result: job.result,
      error: job.error,
    });
  }

  function update(job, patch = {}) {
    Object.assign(job, patch, { updatedAt: nowIso(now) });
    return snapshot(job);
  }

  function start(run, { metadata = {} } = {}) {
    if (typeof run !== "function") throw new TypeError("Execution registry requires a run function.");
    const id = idFactory();
    const controller = new AbortController();
    const createdAt = nowIso(now);
    const job = {
      id,
      status: "queued",
      phase: "queued",
      createdAt,
      updatedAt: createdAt,
      startedAt: null,
      completedAt: null,
      cancelledAt: null,
      cancellationRequested: false,
      metadata: clone(metadata),
      progress: null,
      result: null,
      error: null,
      controller,
    };
    jobs.set(id, job);

    const reportProgress = (progress = {}) => {
      if (!jobs.has(id) || job.status === "cancelled") return;
      update(job, {
        progress: clone(progress),
        phase: String(progress.phase || job.phase || "running"),
      });
    };

    queueMicrotask(async () => {
      if (job.cancellationRequested) {
        update(job, {
          status: "cancelled",
          phase: "cancelled",
          cancelledAt: nowIso(now),
        });
        return;
      }

      update(job, {
        status: "running",
        phase: "generating",
        startedAt: nowIso(now),
      });

      try {
        const result = await run({ signal: controller.signal, reportProgress });
        if (job.cancellationRequested || controller.signal.aborted) {
          update(job, {
            status: "cancelled",
            phase: "cancelled",
            cancelledAt: nowIso(now),
            result: null,
          });
          return;
        }
        update(job, {
          status: "completed",
          phase: "completed",
          completedAt: nowIso(now),
          result: clone(result),
          error: null,
        });
      } catch (error) {
        if (job.cancellationRequested || controller.signal.aborted || error?.name === "AbortError") {
          update(job, {
            status: "cancelled",
            phase: "cancelled",
            cancelledAt: nowIso(now),
            result: null,
            error: null,
          });
          return;
        }
        update(job, {
          status: "failed",
          phase: "failed",
          completedAt: nowIso(now),
          result: null,
          error: {
            message: String(error?.message || "SignalFlow campaign execution failed."),
          },
        });
      }
    });

    return snapshot(job);
  }

  function get(id) {
    return snapshot(jobs.get(String(id || "")));
  }

  function cancel(id) {
    const job = jobs.get(String(id || ""));
    if (!job) return null;
    if (["completed", "failed", "cancelled"].includes(job.status)) return snapshot(job);
    job.cancellationRequested = true;
    job.controller.abort();
    return update(job, {
      phase: "cancelling",
      cancellationRequested: true,
    });
  }

  return { start, get, cancel };
}

export const campaignExecutionRegistry = createExecutionRegistry();
