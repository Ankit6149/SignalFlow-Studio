import { requireOwnerAccess } from "../../_auth";
import { createProductionHostedPlatformReviewApplications } from "../../../../lib/server/hostedPlatformReviewDependencies.mjs";

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

function publicError(error) {
  const status = Number.isInteger(error?.status) && error.status >= 400 && error.status <= 599
    ? error.status
    : 500;
  return json({
    ok: false,
    code: String(error?.code || "hosted_today_decisions_failed"),
    error: status >= 500
      ? "SignalFlow could not reconstruct the hosted decision inbox."
      : String(error?.message || "The hosted decision inbox could not be loaded."),
  }, status);
}

export async function GET(request) {
  const accessError = requireOwnerAccess(request);
  if (accessError) return accessError;
  try {
    const apps = createProductionHostedPlatformReviewApplications({
      origin: new URL(request.url).origin,
    });
    const decisions = await apps.todayApplication.listDecisions();
    return json({
      ok: true,
      workspaceId: apps.workspaceId,
      decisions,
    });
  } catch (error) {
    return publicError(error);
  }
}
