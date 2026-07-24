import crypto from "crypto";
import { SOCIAL_PLATFORMS, getCallbackUrl, isPlatformConfigured } from "../../../../lib/social/socialConfig.js";
import { createOAuthStateCookie } from "../../../../lib/social/tokenStore.js";
import { requireOwnerAccess } from "../../_auth.js";

/**
 * GET /api/social/connect?platform=linkedin|x|reddit
 * Initiates a stateless OAuth flow. CSRF state and PKCE data are encrypted in
 * a short-lived HTTP-only cookie so the callback works reliably on serverless hosts.
 */
export async function GET(request) {
  const accessError = requireOwnerAccess(request);
  if (accessError) return accessError;

  const { searchParams } = new URL(request.url);
  const platformId = searchParams.get("platform");

  if (!platformId || !SOCIAL_PLATFORMS[platformId]) {
    return new Response(JSON.stringify({
      error: `Unknown platform "${platformId}". Supported: ${Object.keys(SOCIAL_PLATFORMS).join(", ")}`,
    }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  if (!isPlatformConfigured(platformId)) {
    const platform = SOCIAL_PLATFORMS[platformId];
    return new Response(JSON.stringify({
      error: `OAuth not configured for ${platform.label}. Set ${platform.clientEnvKey} and ${platform.secretEnvKey} in the deployment environment.`,
      setupUrl: platform.setupUrl,
      setupSteps: platform.setupSteps.map((step) => step.replace("{callbackUrl}", getCallbackUrl(platformId))),
    }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const platform = SOCIAL_PLATFORMS[platformId];
  const state = crypto.randomBytes(32).toString("hex");
  const stateData = { platform: platformId, state, created: Date.now() };

  if (platform.usePKCE) {
    const codeVerifier = crypto.randomBytes(32).toString("base64url");
    const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url");
    stateData.codeVerifier = codeVerifier;
    stateData.codeChallenge = codeChallenge;
  }

  const params = new URLSearchParams({
    response_type: platform.responseType,
    client_id: process.env[platform.clientEnvKey],
    redirect_uri: getCallbackUrl(platformId),
    scope: platform.scopes.join(" "),
    state,
  });

  if (platform.usePKCE) {
    params.set("code_challenge", stateData.codeChallenge);
    params.set("code_challenge_method", "S256");
  }

  if (platformId === "reddit") {
    params.set("duration", "permanent");
  }

  const authorizationUrl = `${platform.authUrl}?${params.toString()}`;
  const response = new Response(null, {
    status: 302,
    headers: { Location: authorizationUrl },
  });
  response.headers.append("Set-Cookie", createOAuthStateCookie(stateData));
  return response;
}
