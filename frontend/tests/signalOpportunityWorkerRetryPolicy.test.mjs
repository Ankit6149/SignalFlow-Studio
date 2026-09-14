import test from "node:test";
import assert from "node:assert/strict";

import { createSignalOpportunityWorkerApplication } from "../lib/application/signalOpportunityWorkerApplication.mjs";

const NOW = "2026-09-14T18:30:00.000Z";

function workerFor(errorCode) {
  const failures = [];
  const job = {
    jobId: "signal-opportunity:signal-1",
    workspaceId: "workspace-1",
    signalId: "signal-1",
    status: "processing",
  };
  const worker = createSignalOpportunityWorkerApplication({
    opportunityJobRepository: {
      async claimNext() { return job; },
      async complete() { throw new Error("completion should not run"); },
      async fail(jobId, input) {
        failures.push({ jobId, input });
        return {
          ...job,
          status: input.maxAttempts === 1 ? "dead" : "pending",
          lastErrorCode: input.errorCode,
        };
      },
    },
    createContinuationApplication: async () => ({
      async continueToOpportunity() {
        const error = new Error("inference failed");
        error.code = errorCode;
        throw error;
      },
    }),
    clock: { now: () => NOW },
  });
  return { worker, failures };
}

test("permanent Vercel Gateway client errors fail immediately instead of burning all retries", async () => {
  for (const code of ["vercel_gateway_http_400", "vercel_gateway_http_401", "vercel_gateway_http_403", "vercel_gateway_http_404", "vercel_gateway_http_422"]) {
    const { worker, failures } = workerFor(code);
    const result = await worker.processNext();
    assert.equal(result.status, "dead");
    assert.equal(result.errorCode, code);
    assert.equal(failures[0].input.maxAttempts, 1);
  }
});

test("transient Gateway errors remain retryable", async () => {
  for (const code of ["vercel_gateway_http_408", "vercel_gateway_http_409", "vercel_gateway_http_425", "vercel_gateway_http_429", "vercel_gateway_http_500", "vercel_gateway_http_503"]) {
    const { worker, failures } = workerFor(code);
    const result = await worker.processNext();
    assert.equal(result.status, "retry_scheduled");
    assert.equal(result.errorCode, code);
    assert.equal(failures[0].input.maxAttempts, undefined);
  }
});
