import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  GP2_RECOVERABLE_OPPORTUNITY_ERROR_CODES,
  createGp2OpportunityRecoveryApplication,
} from "../lib/application/gp2OpportunityRecoveryApplication.mjs";
import { createPostgresSignalOpportunityJobRepository } from "../lib/infrastructure/postgresSignalOpportunityJobAdapter.mjs";

const NOW = "2026-09-16T17:05:00.000Z";
const WORKSPACE = "owner-local";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function row(overrides = {}) {
  return {
    job_id: overrides.job_id || "signal-opportunity:signal-1",
    workspace_id: overrides.workspace_id || WORKSPACE,
    signal_id: overrides.signal_id || "signal-1",
    job_type: "opportunity_evaluation",
    status: overrides.status || "pending",
    attempt_count: overrides.attempt_count ?? 0,
    available_at: overrides.available_at || NOW,
    lease_until: null,
    opportunity_id: null,
    last_error_code: null,
    created_at: NOW,
    updated_at: NOW,
    completed_at: null,
  };
}

test("recovery application requeues only the bounded allowlist in the owner workspace", async () => {
  const calls = [];
  const app = createGp2OpportunityRecoveryApplication({
    workspaceId: WORKSPACE,
    opportunityJobRepository: {
      async requeueDead(input) {
        calls.push(input);
        return [row(), row({ job_id: "signal-opportunity:signal-2", signal_id: "signal-2" })];
      },
    },
    clock: { now: () => NOW },
  });

  const result = await app.requeueBlocked({ limit: 99 });

  assert.deepEqual(result, { recoveredCount: 2, processingBudget: 2 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].workspaceId, WORKSPACE);
  assert.equal(calls[0].now, NOW);
  assert.equal(calls[0].limit, 5);
  assert.deepEqual(calls[0].errorCodes, GP2_RECOVERABLE_OPPORTUNITY_ERROR_CODES);
  assert.deepEqual(GP2_RECOVERABLE_OPPORTUNITY_ERROR_CODES, [
    "inference_route_unavailable",
    "vercel_gateway_http_401",
    "vercel_gateway_http_403",
  ]);
});

test("Postgres recovery is workspace-scoped, dead-only, error-allowlisted, locked and resets the retry budget", async () => {
  const calls = [];
  const database = {
    async query(statement, params) {
      calls.push({ statement, params });
      return [row({ status: "pending" })];
    },
  };
  const repository = createPostgresSignalOpportunityJobRepository({ database });
  const recovered = await repository.requeueDead({
    workspaceId: WORKSPACE,
    errorCodes: ["vercel_gateway_http_403"],
    now: NOW,
    limit: 3,
  });

  assert.equal(recovered.length, 1);
  assert.equal(recovered[0].workspaceId, WORKSPACE);
  assert.match(calls[0].statement, /workspace_id = \$1/);
  assert.match(calls[0].statement, /status = 'dead'/);
  assert.match(calls[0].statement, /last_error_code = ANY\(\$3::text\[\]\)/);
  assert.match(calls[0].statement, /FOR UPDATE SKIP LOCKED/);
  assert.match(calls[0].statement, /attempt_count = 0/);
  assert.match(calls[0].statement, /status = 'pending'/);
  assert.deepEqual(calls[0].params.slice(0, 4), [WORKSPACE, "opportunity_evaluation", ["vercel_gateway_http_403"], 3]);
});

test("recovery route is owner-only, live-gates inference before requeue and restarts durable processing after response", () => {
  const route = fs.readFileSync(path.join(ROOT, "app/api/gp2/recovery/route.js"), "utf8");
  assert.match(route, /requireOwnerAccess\(request\)/);
  assert.match(route, /readVercelRuntimeOidcToken\(request, process\.env\)/);
  assert.match(route, /probeVercelGatewayAccess\(\{ credential \}\)/);
  assert.match(route, /if \(!gatewayAccess\.available\)/);
  assert.match(route, /gp2_inference_not_ready/);
  assert.match(route, /requeueBlocked\(\{ limit: MAX_RECOVERY_JOBS \}\)/);
  assert.match(route, /after\(async \(\) =>/);
  assert.match(route, /createProductionSignalOpportunityWorker\(\{ origin \}\)/);
  assert.match(route, /await worker\.processNext\(\)/);
  assert.doesNotMatch(route, /credential["']\s*:/);
  assert.doesNotMatch(route, /statusCode/);
});

test("readiness UI exposes recovery only behind healthy inference and never asks for manual SQL", () => {
  const panel = fs.readFileSync(path.join(ROOT, "components/Gp2ReadinessPanel.js"), "utf8");
  assert.match(panel, /fetch\("\/api\/gp2\/recovery"/);
  assert.match(panel, /method: "POST"/);
  assert.match(panel, /Retry blocked work/);
  assert.match(panel, /!inferenceReady/);
  assert.match(panel, /No manual database change is required/);
  assert.doesNotMatch(panel, /UPDATE sf_signal_opportunity_jobs/);
});
