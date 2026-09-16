import { requireOwnerAccess } from "../../_auth";
import { probeCdpBrowserAccess } from "../../../../lib/server/cdpBrowserAccess.mjs";
import { gp2ReadinessStatus } from "../../../../lib/server/gp2Readiness.mjs";
import { probeVercelGatewayAccess } from "../../../../lib/server/vercelGatewayAccess.mjs";
import { readVercelRuntimeOidcToken, vercelRuntimeOidcAvailable } from "../../../../lib/server/vercelRuntimeOidc.mjs";

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
    const runtimeOidc = readVercelRuntimeOidcToken(request, process.env);
    const gatewayCredential = String(process.env.AI_GATEWAY_API_KEY || runtimeOidc || "").trim();
    const gatewayAccess = gatewayCredential
      ? await probeVercelGatewayAccess({ credential: gatewayCredential })
      : null;

    const requestUrl = new URL(request.url);
    const captureProbeRequested = requestUrl.searchParams.get("capture_probe") === "1";
    const captureEndpoint = String(process.env.SIGNALFLOW_CDP_BROWSER_WS_ENDPOINT || "").trim();
    const captureWorkerAccess = captureProbeRequested && captureEndpoint
      ? await probeCdpBrowserAccess({
          endpoint: captureEndpoint,
          bearerToken: String(process.env.SIGNALFLOW_CDP_BROWSER_AUTH_TOKEN || "").trim(),
        })
      : null;

    return json({
      ok: true,
      gp2: gp2ReadinessStatus(process.env, {
        vercelOidcAvailable: vercelRuntimeOidcAvailable(request, process.env),
        vercelGatewayAccess: gatewayAccess,
        captureWorkerAccess,
      }),
    });
  } catch {
    return json({ ok: false, code: "gp2_readiness_unavailable", error: "SignalFlow could not evaluate GP2 readiness safely." }, 503);
  }
}
