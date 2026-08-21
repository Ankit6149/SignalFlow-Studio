import { requireOwnerAccess } from "../../../_auth";
import { createProductionSignalOpportunityWorker } from "../../../../../lib/server/signalOpportunityWorkerDependencies.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 45;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export async function POST(request) {
  const accessError = requireOwnerAccess(request);
  if (accessError) return accessError;

  try {
    const origin = new URL(request.url).origin;
    const worker = createProductionSignalOpportunityWorker({ origin });
    const result = await worker.processNext();
    return json({ ok: true, ...result });
  } catch (error) {
    return json({
      ok: false,
      code: String(error?.code || "opportunity_worker_unavailable"),
      error: "SignalFlow could not process the next opportunity job.",
    }, 503);
  }
}
