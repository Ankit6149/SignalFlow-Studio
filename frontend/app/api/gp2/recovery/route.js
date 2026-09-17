import { after } from "next/server";
import { requireOwnerAccess } from "../../_auth";
import {
  createProductionGp2OpportunityRecoveryApplication,
  createProductionSignalOpportunityWorker,
} from "../../../../lib/server/signalOpportunityWorkerDependencies.mjs";
import { selectOperationalHostedInferenceProvider } from "../../../../lib/server/hostedInferenceProviderSelection.mjs";
import { readVercelRuntimeOidcToken } from "../../../../lib/server/vercelRuntimeOidc.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_RECOVERY_JOBS = 3;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, no-store, max-age=0",
      "x-content-type-options": "nosniff",
    },
  });
}

export async function POST(request) {
  const denied = requireOwnerAccess(request);
  if (denied) return denied;

  try {
    const runtimeOidc = readVercelRuntimeOidcToken(request, process.env);
    const gatewayCredential = String(process.env.AI_GATEWAY_API_KEY || runtimeOidc || "").trim();
    const selectedProvider = await selectOperationalHostedInferenceProvider({
      env: process.env,
      gatewayCredential,
    });

    if (!selectedProvider) {
      return json({
        ok: false,
        code: "gp2_inference_not_ready",
        inferenceStatus: "unavailable",
      }, 409);
    }

    const recovery = createProductionGp2OpportunityRecoveryApplication();
    const result = await recovery.requeueBlocked({ limit: MAX_RECOVERY_JOBS });
    const recoveredCount = Math.max(0, Math.min(MAX_RECOVERY_JOBS, Number(result?.recoveredCount || 0)));
    const processingBudget = Math.max(0, Math.min(recoveredCount, Number(result?.processingBudget || 0)));

    if (processingBudget > 0) {
      const origin = new URL(request.url).origin;
      after(async () => {
        try {
          const worker = createProductionSignalOpportunityWorker({ origin });
          for (let index = 0; index < processingBudget; index += 1) {
            const outcome = await worker.processNext();
            if (outcome?.status === "idle") break;
          }
        } catch {
          // Requeued jobs remain durable and can be retried by the same owner-safe recovery path.
        }
      });
    }

    return json({
      ok: true,
      recoveredCount,
      processingStarted: processingBudget > 0,
    }, processingBudget > 0 ? 202 : 200);
  } catch {
    return json({
      ok: false,
      code: "gp2_recovery_unavailable",
      error: "SignalFlow could not recover blocked GP2 work safely.",
    }, 503);
  }
}
