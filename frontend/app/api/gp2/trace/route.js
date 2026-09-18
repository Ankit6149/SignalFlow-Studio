import { requireOwnerAccess } from "../../_auth";
import { createGp2TraceApplication } from "../../../../lib/application/gp2TraceApplication.mjs";
import { createPostgresCaptureRepository } from "../../../../lib/infrastructure/postgresCaptureAdapter.mjs";
import { createPostgresContentPlanningRepository } from "../../../../lib/infrastructure/postgresContentPlanningAdapter.mjs";
import { createPostgresContentReviewRepository } from "../../../../lib/infrastructure/postgresContentReviewAdapter.mjs";
import { createPostgresDurableJobRepository } from "../../../../lib/infrastructure/postgresDurableJobAdapter.mjs";
import { resolveOwnerWorkspaceId } from "../../../../lib/server/githubConnectionDependencies.mjs";
import { createHostedOpportunityCore } from "../../../../lib/server/hostedOpportunityCore.mjs";

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
  const invalid = error?.code === "gp2_trace_revision_invalid";
  return json({
    ok: false,
    code: String(error?.code || "gp2_trace_unavailable"),
    error: invalid
      ? "Provide an exact Git source revision to trace."
      : "SignalFlow could not trace this GP2 revision safely.",
  }, invalid ? 400 : 503);
}

export async function GET(request) {
  const denied = requireOwnerAccess(request);
  if (denied) return denied;

  try {
    const revision = new URL(request.url).searchParams.get("revision");
    const workspaceId = resolveOwnerWorkspaceId(process.env);
    const core = createHostedOpportunityCore({
      workspaceId,
      origin: new URL(request.url).origin,
      env: process.env,
    });
    const application = createGp2TraceApplication({
      contentSignalRepository: core.contentSignalRepository,
      durableJobRepository: createPostgresDurableJobRepository({ database: core.database, workspaceId }),
      projectContextRepository: core.projectContextRepository,
      contentOpportunityRepository: core.contentOpportunityRepository,
      contentPlanningRepository: createPostgresContentPlanningRepository({ database: core.database, workspaceId }),
      contentReviewRepository: createPostgresContentReviewRepository({ database: core.database, workspaceId }),
      captureRepository: createPostgresCaptureRepository({ database: core.database, workspaceId }),
    });
    return json({ ok: true, trace: await application.traceSourceRevision(revision) });
  } catch (error) {
    return publicError(error);
  }
}
