import { requireOwnerAccess } from "../../../_auth";
import {
  createProductionGithubRepositoryBootstrapApplication,
  githubSourceConnectionConfigurationStatus,
} from "../../../../../lib/server/githubConnectionDependencies.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function statusFor(error) {
  const code = String(error?.code || "");
  if ([
    "github_connection_not_found",
  ].includes(code)) return 404;
  if ([
    "github_connection_not_active",
    "github_repository_scope_mismatch",
    "github_repository_not_observable",
    "github_repository_default_branch_missing",
  ].includes(code)) return 409;
  if ([
    "github_repository_tree_truncated",
    "github_repository_tree_too_large",
    "github_repository_evidence_unavailable",
    "github_repository_evidence_insufficient",
  ].includes(code)) return 422;
  if (["signalflow_database_unconfigured", "signalflow_database_invalid", "inference_route_unavailable"].includes(code)) return 503;
  if (code.startsWith("github_repository_http_")) return 502;
  if (code.startsWith("project_context_") || code.startsWith("inference_")) return Number(error?.status) || 502;
  return 500;
}

function publicMessage(code) {
  if (code === "github_connection_not_active") return "The GitHub source must be active before SignalFlow can understand its repository.";
  if (code === "github_repository_scope_mismatch") return "The selected repository is not authorized by this GitHub source connection.";
  if (code === "github_repository_tree_truncated" || code === "github_repository_tree_too_large") return "This repository is too large for the current bounded bootstrap path; SignalFlow did not infer from incomplete structure.";
  if (code === "github_repository_evidence_unavailable" || code === "github_repository_evidence_insufficient") return "SignalFlow could not find enough safe representative repository evidence to build trustworthy project understanding.";
  if (code === "inference_route_unavailable") return "Repository evidence is ready, but no permitted project-understanding model route is configured.";
  return "SignalFlow could not finish initial repository understanding. The GitHub connection remains intact and this can be retried.";
}

export async function POST(request) {
  const denied = requireOwnerAccess(request);
  if (denied) return denied;

  const config = githubSourceConnectionConfigurationStatus(process.env);
  if (!config.configured) return json({ ok: false, code: "github_app_unconfigured", missing: config.missing || [] }, 503);

  let body;
  try { body = await request.json(); } catch { return json({ ok: false, code: "invalid_json" }, 400); }
  if (!body?.sourceConnectionId || !body?.repositoryId) {
    return json({ ok: false, code: "github_repository_bootstrap_input_required" }, 400);
  }

  try {
    const origin = new URL(request.url).origin;
    const result = await createProductionGithubRepositoryBootstrapApplication({ origin }).bootstrapRepository({
      sourceConnectionId: body.sourceConnectionId,
      repositoryId: body.repositoryId,
    });
    return json({ ok: true, ...result });
  } catch (error) {
    const code = String(error?.code || "github_repository_bootstrap_failed");
    return json({ ok: false, code, error: publicMessage(code), retryable: true }, statusFor(error));
  }
}
