import test from "node:test";
import assert from "node:assert/strict";

import { createGithubConnectionHandlers } from "../lib/server/githubConnectionRoutes.mjs";

const BASE = "https://signalflow.invalid/api/sources/github";

function handlers({ denied = null, configured = true, beginError = null, completeError = null } = {}) {
  return createGithubConnectionHandlers({
    requireOwnerAccess: () => denied,
    configurationStatus: () => ({ configured, missing: configured ? [] : ["GITHUB_APP_ID"] }),
    createApplication: () => ({
      async beginAuthorization({ state, installationId }) {
        if (beginError) throw beginError;
        assert.equal(state, "setup-state");
        assert.equal(installationId, "77");
        return { authorizationUrl: "https://github.com/login/oauth/authorize?state=auth-state" };
      },
      async completeAuthorization({ state, code }) {
        if (completeError) throw completeError;
        assert.equal(state, "auth-state");
        assert.equal(code, "oauth-code");
        return {
          returnTo: "/?workspace=connections",
          connection: { sourceConnectionId: "connection-1" },
        };
      },
    }),
  });
}

function assertRecovery(response, expectedCode) {
  assert.equal(response.status, 303);
  const redirect = new URL(response.headers.get("location"));
  assert.equal(redirect.origin, "https://signalflow.invalid");
  assert.equal(redirect.pathname, "/");
  assert.equal(redirect.searchParams.get("workspace"), "connections");
  assert.equal(redirect.searchParams.get("github_source_status"), "error");
  assert.equal(redirect.searchParams.get("github_source_error"), expectedCode);
  for (const forbidden of ["state", "code", "installation_id", "error_description"]) {
    assert.equal(redirect.searchParams.has(forbidden), false);
  }
  return redirect;
}

test("setup callback success still continues to separate GitHub owner authorization", async () => {
  const response = await handlers().callback(
    new Request(`${BASE}/callback?state=setup-state&installation_id=77`),
  );
  assert.equal(response.status, 303);
  assert.match(response.headers.get("location"), /^https:\/\/github\.com\/login\/oauth\/authorize/);
});

test("OAuth callback success returns to the verified same-origin product path", async () => {
  const response = await handlers().oauthCallback(
    new Request(`${BASE}/oauth/callback?state=auth-state&code=oauth-code`),
  );
  assert.equal(response.status, 303);
  const redirect = new URL(response.headers.get("location"));
  assert.equal(redirect.origin, "https://signalflow.invalid");
  assert.equal(redirect.searchParams.get("workspace"), "connections");
  assert.equal(redirect.searchParams.get("github_source_status"), "installed");
  assert.equal(redirect.searchParams.get("source_connection"), "connection-1");
  assert.equal(redirect.searchParams.has("state"), false);
  assert.equal(redirect.searchParams.has("code"), false);
});

test("provider denial returns to Connections without provider payload leakage", async () => {
  const response = await handlers().oauthCallback(new Request(
    `${BASE}/oauth/callback?state=SECRET_STATE&error=access_denied&error_description=PRIVATE_PROVIDER_TEXT`,
  ));
  const redirect = assertRecovery(response, "github_user_authorization_denied");
  assert.doesNotMatch(redirect.href, /SECRET_STATE|PRIVATE_PROVIDER_TEXT|access_denied/);
});

test("invalid, expired and workspace-mismatched connection states remain safe recovery codes", async () => {
  for (const code of [
    "github_install_state_invalid",
    "github_install_state_expired",
    "github_install_state_workspace_mismatch",
  ]) {
    const error = new Error("private state diagnostic");
    error.code = code;
    const response = await handlers({ beginError: error }).callback(
      new Request(`${BASE}/callback?state=setup-state&installation_id=77`),
    );
    const redirect = assertRecovery(response, code);
    assert.doesNotMatch(redirect.href, /private state diagnostic|setup-state/);
  }
});

test("permission and exact-owner verification failures return allowlisted recovery codes only", async () => {
  for (const code of [
    "github_installation_permissions_insufficient",
    "github_user_authorization_failed",
  ]) {
    const error = new Error("private GitHub response");
    error.code = code;
    const response = await handlers({ completeError: error }).oauthCallback(
      new Request(`${BASE}/oauth/callback?state=auth-state&code=oauth-code`),
    );
    const redirect = assertRecovery(response, code);
    assert.doesNotMatch(redirect.href, /private GitHub response|auth-state|oauth-code/);
  }
});

test("provider HTTP details and database configuration details collapse to public-safe recovery classes", async () => {
  const providerError = new Error("upstream response body");
  providerError.code = "github_app_http_502";
  assertRecovery(
    await handlers({ completeError: providerError }).oauthCallback(
      new Request(`${BASE}/oauth/callback?state=auth-state&code=oauth-code`),
    ),
    "github_provider_unavailable",
  );

  const databaseError = new Error("private database detail");
  databaseError.code = "signalflow_database_invalid";
  assertRecovery(
    await handlers({ completeError: databaseError }).oauthCallback(
      new Request(`${BASE}/oauth/callback?state=auth-state&code=oauth-code`),
    ),
    "github_connection_unavailable",
  );
});

test("owner-session loss and hosted owner-lock misconfiguration recover through callback-safe codes", async () => {
  assertRecovery(
    await handlers({ denied: new Response("{}", { status: 401 }) }).oauthCallback(
      new Request(`${BASE}/oauth/callback?state=x&code=y`),
    ),
    "owner_session_required",
  );
  assertRecovery(
    await handlers({ denied: new Response("{}", { status: 503 }) }).callback(
      new Request(`${BASE}/callback?state=x&installation_id=77`),
    ),
    "owner_access_unconfigured",
  );
});

test("unconfigured and incomplete navigation callbacks recover instead of terminating on JSON", async () => {
  assertRecovery(
    await handlers({ configured: false }).callback(
      new Request(`${BASE}/callback?state=setup-state&installation_id=77`),
    ),
    "github_app_unconfigured",
  );
  assertRecovery(
    await handlers().callback(new Request(`${BASE}/callback?state=setup-state`)),
    "github_install_callback_incomplete",
  );
  assertRecovery(
    await handlers().oauthCallback(new Request(`${BASE}/oauth/callback?state=auth-state`)),
    "github_oauth_callback_incomplete",
  );
});
