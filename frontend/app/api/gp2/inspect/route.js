import { requireOwnerAccess } from "../../_auth";
import { inspectGp2Acceptance } from "../../../../lib/server/gp2AcceptanceInspector.mjs";
import { resolveOwnerWorkspaceId } from "../../../../lib/server/githubConnectionDependencies.mjs";
import { createNeonQueryExecutor } from "../../../../lib/server/neonDatabase.mjs";

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
    const sourceRevision = new URL(request.url).searchParams.get("source_revision");
    const database = createNeonQueryExecutor({ databaseUrl: process.env.DATABASE_URL });
    const inspection = await inspectGp2Acceptance({
      database,
      workspaceId: resolveOwnerWorkspaceId(process.env),
      sourceRevision,
    });
    return json({ ok: true, inspection });
  } catch (error) {
    const status = Number(error?.status || 0);
    return json({
      ok: false,
      code: String(error?.code || "gp2_inspector_unavailable"),
      error: status >= 400 && status < 500
        ? String(error?.message || "GP2 inspection request is invalid.")
        : "SignalFlow could not inspect GP2 acceptance safely.",
    }, status >= 400 && status <= 599 ? status : 503);
  }
}
