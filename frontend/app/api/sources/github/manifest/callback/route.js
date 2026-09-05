import { requireOwnerAccess } from "../../../../_auth";
import {
  createProductionGithubSourceConnectionApplication,
  githubSourceConnectionConfigurationStatus,
} from "../../../../../../lib/server/githubConnectionDependencies.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const SAFE_ERRORS = new Set([
  "github_install_state_invalid",
  "github_install_state_expired",
  "github_install_state_workspace_mismatch",
  "github_connection_not_found",
  "github_manifest_connection_ineligible",
  "github_manifest_already_completed",
  "credential_vault_unconfigured",
  "credential_vault_identity_conflict",
  "owner_session_required",
  "owner_access_unconfigured",
]);

function recovery(request, error) {
  const next = new URL("/?workspace=connections", request.url);
  next.searchParams.set("github_source_status", "error");
  const code = String(error?.code || error || "github_manifest_failed").trim();
  next.searchParams.set(
    "github_source_error",
    SAFE_ERRORS.has(code) ? code : code.startsWith("github_manifest_http_") ? "github_provider_unavailable" : "github_manifest_failed",
  );
  return Response.redirect(next, 303);
}

export async function GET(request) {
  const denied = requireOwnerAccess(request);
  if (denied) return recovery(request, denied.status === 401 ? "owner_session_required" : "owner_access_unconfigured");

  const status = githubSourceConnectionConfigurationStatus(process.env);
  if (!status.configured) return recovery(request, "github_app_unconfigured");

  const url = new URL(request.url);
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  if (!code || !state) return recovery(request, "github_manifest_callback_incomplete");

  try {
    const result = await createProductionGithubSourceConnectionApplication().completeManifestRegistration({ state, code });
    return Response.redirect(result.installUrl, 303);
  } catch (error) {
    return recovery(request, error);
  }
}
