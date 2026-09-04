import { requireOwnerAccess } from "../../../../_auth";
import {
  createProductionGithubSourceConnectionApplication,
  githubSourceConnectionConfigurationStatus,
} from "../../../../../../lib/server/githubConnectionDependencies.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function recovery(request, code) {
  const next = new URL("/?workspace=connections", request.url);
  next.searchParams.set("github_source_status", "error");
  next.searchParams.set("github_source_error", code);
  return Response.redirect(next, 303);
}

function registrationPage(registration) {
  const action = escapeHtml(registration.action);
  const manifest = escapeHtml(registration.fields.manifest);
  const state = escapeHtml(registration.fields.state);
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Continue to GitHub · SignalFlow</title>
<style>body{font-family:system-ui,sans-serif;max-width:560px;margin:12vh auto;padding:24px;color:#171713;background:#faf8f2}main{border:1px solid #ded8cb;border-radius:16px;padding:28px;background:#fffdf8}button{padding:12px 16px;border:0;border-radius:10px;background:#171713;color:white;font-weight:700;cursor:pointer}p{line-height:1.55;color:#5d584d}</style>
</head>
<body>
<main>
<h1>Continue to GitHub</h1>
<p>SignalFlow is opening GitHub's App registration screen with the minimum read-only repository permissions required for connected-source observation.</p>
<form id="github-manifest" method="post" action="${action}">
<input type="hidden" name="manifest" value="${manifest}" />
<input type="hidden" name="state" value="${state}" />
<button type="submit">Continue to GitHub</button>
</form>
</main>
<script>document.getElementById('github-manifest').submit();</script>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "private, no-store, max-age=0",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; form-action https://github.com; base-uri 'none'; frame-ancestors 'none'",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
    },
  });
}

export async function GET(request) {
  const denied = requireOwnerAccess(request);
  if (denied) return recovery(request, denied.status === 401 ? "owner_session_required" : "owner_access_unconfigured");

  const status = githubSourceConnectionConfigurationStatus(process.env);
  if (!status.configured) return recovery(request, "github_app_unconfigured");

  const state = new URL(request.url).searchParams.get("state") || "";
  if (!state) return recovery(request, "github_install_state_invalid");
  try {
    const registration = await createProductionGithubSourceConnectionApplication().prepareManifestRegistration({ state });
    return registrationPage(registration);
  } catch (error) {
    const code = String(error?.code || "github_manifest_failed");
    return recovery(request, code.startsWith("github_install_state_") ? code : "github_manifest_failed");
  }
}
