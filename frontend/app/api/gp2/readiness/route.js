import { requireOwnerAccess } from "../../_auth";
import { gp2ReadinessStatus } from "../../../../lib/server/gp2Readiness.mjs";
import { vercelRuntimeOidcAvailable } from "../../../../lib/server/vercelRuntimeOidc.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export async function GET(request) {
  const denied = requireOwnerAccess(request);
  if (denied) return denied;
  try {
    return json({
      ok: true,
      gp2: gp2ReadinessStatus(process.env, {
        vercelOidcAvailable: vercelRuntimeOidcAvailable(request, process.env),
      }),
    });
  } catch {
    return json({ ok: false, code: "gp2_readiness_unavailable", error: "SignalFlow could not evaluate GP2 readiness safely." }, 503);
  }
}
