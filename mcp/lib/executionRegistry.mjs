import { randomUUID } from "node:crypto";

export const DEFAULT_MAX_CONCURRENT_EXECUTIONS = 2;

function nowIso(now = () => new Date()) {
  return now().toISOString();
}

function clone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function createExecutionRegistry({
  now = () => new Date(),
  idFactory = () => `campaign-${randomUUID()}`,
  maxConcurrent = DEFAULT_MAX_CONCURRENT_EXECUTIONS,
} = {}) {
  const jobs = new Map();
  const pending = [];
  const activeExecutionKeys = new Set();
  const concurrencyLimit = positiveInteger(maxConcurrent, DEFAULT_MAX_CONCURRENT_EXECUTIONS);
  let activeCount = 0;
  let pumpScheduled = false;

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
      executionKey: job.executionKey,
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

  function release(job) {
    activeCount = Math.max(0, activeCount - 1);
    if (job.executionKey) activeExecutionKeys.delete(job.executionKey);
    schedulePump();
  }

  async function runJob(job) {
    activeCount += 1;
    if (job.executionKey) activeExecutionKeys.add(job.executionKey);

    if (job.cancellationRequested) {
      update(job, {
        status: "cancelled",
        phase: "cancelled",
        cancelledAt: nowIso(now),
      });
      release(job);
      return;
    }

    update(job, {
      status: "running",
      phase: "generating",
      startedAt: nowIso(now),
    });

    try {
      const result = await job.run({
        signal: job.controller.signal,
        reportProgress: job.reportProgress,
      });
      if (job.cancellationRequested || job.controller.signal.aborted) {
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
        status: "completed",
        phase: "completed",
        completedAt: nowIso(now),
        result: clone(result),
        error: null,
      });
    } catch (error) {
      if (job.cancellationRequested || job.controller.signal.aborted || error?.name === "AbortError") {
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
    } finally {
      release(job);
    }
  }

  function nextEligiblePendingIndex() {
    for (let index = 0; index < pending.length; index += 1) {
      const job = jobs.get(pending[index]);
      if (!job || job.status !== "queued") continue;
      if (job.cancellationRequested) return index;
      if (!job.executionKey || !activeExecutionKeys.has(job.executionKey)) return index;
    }
    return -1;
  }

  function pump() {
    pumpScheduled = false;
    while (activeCount < concurrencyLimit) {
      const index = nextEligiblePendingIndex();
      if (index < 0) break;

      const [id] = pending.splice(index, 1);
      const job = jobs.get(id);
      if (!job || job.status !== "queued") continue;

      if (job.cancellationRequested) {
        update(job, {
          status: "cancelled",
          phase: "cancelled",
          cancelledAt: nowIso(now),
          result: null,
          error: null,
        });
        continue;
      }

      void runJob(job);
    }
  }

  function schedulePump() {
    if (pumpScheduled) return;
    pumpScheduled = true;
    queueMicrotask(pump);
  }

  function start(run, { metadata = {}, executionKey = "" } = {}) {
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
      executionKey: String(executionKey || "").trim(),
      metadata: clone(metadata),
      progress: null,
      result: null,
      error: null,
      controller,
      run,
      reportProgress: null,
    };

    job.reportProgress = (progress = {}) => {
      if (!jobs.has(id) || ["cancelled", "completed", "failed"].includes(job.status)) return;
      update(job, {
        progress: clone(progress),
        phase: String(progress.phase || job.phase || "running"),
      });
    };

    jobs.set(id, job);
    pending.push(id);
    schedulePump();
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

    if (job.status === "queued") {
      const pendingIndex = pending.indexOf(job.id);
      if (pendingIndex >= 0) pending.splice(pendingIndex, 1);
      const cancelled = update(job, {
        status: "cancelled",
        phase: "cancelled",
        cancelledAt: nowIso(now),
        cancellationRequested: true,
        result: null,
        error: null,
      });
      schedulePump();
      return cancelled;
    }

    return update(job, {
      phase: "cancelling",
      cancellationRequested: true,
    });
  }

  return {
    maxConcurrent: concurrencyLimit,
    start,
    get,
    cancel,
  };
}

export const campaignExecutionRegistry = createExecutionRegistry();
