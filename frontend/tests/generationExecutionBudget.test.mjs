import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  DEFAULT_MAX_PROVIDER_REQUESTS,
  MAX_PROVIDER_REQUESTS,
  createGenerationExecutionBudget,
  estimateGenerationRequestBudget,
  generationRequestBudgetError,
  resolveProviderRequestLimit,
} from "../lib/ai/generationExecutionBudget.mjs";
import {
  PROVIDER_ERROR_CODES,
  normalizeProviderError,
  providerErrorPayload,
} from "../lib/ai/providerErrors.mjs";

test("twelve destinations fit the hard worst-case provider request budget", () => {
  const plan = estimateGenerationRequestBudget(12);
  assert.equal(plan.plannedMaxRequests, 37);
  assert.equal(plan.hardMaxRequests, DEFAULT_MAX_PROVIDER_REQUESTS);
  assert.equal(MAX_PROVIDER_REQUESTS, 40);
  assert.equal(plan.withinBudget, true);
});

test("request budget cannot be raised above the server hard ceiling", () => {
  assert.equal(resolveProviderRequestLimit(4000), MAX_PROVIDER_REQUESTS);
  assert.equal(resolveProviderRequestLimit(0), 1);
  const blocked = estimateGenerationRequestBudget(12, { maxRequests: 36 });
  assert.equal(blocked.withinBudget, false);
  assert.equal(blocked.plannedMaxRequests, 37);
});

test("execution budget blocks another provider call after the hard request count", () => {
  let now = 1_000;
  const budget = createGenerationExecutionBudget({
    maxRequests: 2,
    now: () => now,
  });

  const first = budget.begin({
    provider: "gemini",
    model: "model-a",
    kind: "strategy",
    maxOutputTokens: 1000,
  });
  now += 20;
  budget.finish(first, { ok: true });

  const second = budget.begin({
    provider: "gemini",
    model: "model-a",
    kind: "destination_revision",
    destination: "linkedin",
    maxOutputTokens: 2000,
  });
  now += 30;
  budget.finish(second, { ok: false, errorCode: "provider_timeout" });

  assert.throws(
    () => budget.begin({ provider: "gemini", model: "model-a" }),
    (error) => error?.code === "generation_request_budget_exceeded" && error?.status === 422,
  );

  const snapshot = budget.snapshot();
  assert.equal(snapshot.requestCount, 2);
  assert.equal(snapshot.completedRequests, 1);
  assert.equal(snapshot.failedRequests, 1);
  assert.equal(snapshot.retryRequests, 1);
  assert.equal(snapshot.maxOutputTokens, 3000);
  assert.equal(snapshot.durationMs, 50);
  assert.deepEqual(snapshot.byKind, {
    strategy: 1,
    destination_revision: 1,
  });
  assert.equal(snapshot.requests[1].destination, "linkedin");
  assert.equal(snapshot.requests[1].durationMs, 30);
  assert.equal("prompt" in snapshot.requests[0], false);
});

test("request budget failure normalizes without leaking internal generation content", () => {
  const raw = generationRequestBudgetError({ plannedMaxRequests: 41, maxRequests: 40 });
  const safe = providerErrorPayload(normalizeProviderError(raw, {
    provider: "gemini",
    model: "model-a",
  }));
  assert.equal(safe.code, PROVIDER_ERROR_CODES.REQUEST_BUDGET_EXCEEDED);
  assert.equal(safe.retryable, false);
  assert.equal(safe.recoveryAction, "reduce_destinations");
  assert.equal(safe.httpStatus, 422);
  assert.doesNotMatch(safe.message, /prompt|source text|private/i);
});

test("campaign generation plans before spend and records safe execution telemetry", async () => {
  const source = await readFile(new URL("../lib/ai/generateStudioPackage.js", import.meta.url), "utf8");
  const plan = source.indexOf("estimateGenerationRequestBudget(channels.length");
  const budget = source.indexOf("createGenerationExecutionBudget({");
  const firstProviderCall = source.indexOf("const rawBrief = await generateJSON({");
  assert.ok(plan >= 0);
  assert.ok(budget > plan);
  assert.ok(firstProviderCall > budget);
  assert.match(source, /requestKind: "strategy"/);
  assert.match(source, /requestKind: "destination_initial"/);
  assert.match(source, /requestKind: "destination_revision"/);
  assert.match(source, /requestKind: "duplicate_repair"/);
  assert.match(source, /generation_execution: generationExecution/);
  assert.match(source, /destinations: generationStatus/);
});

test("provider calls are accounted centrally before adapter invocation", async () => {
  const source = await readFile(new URL("../lib/ai/generateText.js", import.meta.url), "utf8");
  const begin = source.indexOf("requestBudget?.begin");
  const firstAdapter = source.indexOf("generateVercelGateway(");
  const success = source.indexOf("requestBudget?.finish?.(budgetTicket, { ok: true })");
  const failure = source.indexOf("requestBudget?.finish?.(budgetTicket, { ok: false");
  assert.ok(begin >= 0);
  assert.ok(firstAdapter > begin);
  assert.ok(success > firstAdapter);
  assert.ok(failure > success);
});

test("Studio exposes a specific request-budget recovery action", async () => {
  const page = await readFile(new URL("../app/page.js", import.meta.url), "utf8");
  assert.match(page, /reduce_destinations: "Reduce the number of destinations or retry only the affected destination\."/);
});
