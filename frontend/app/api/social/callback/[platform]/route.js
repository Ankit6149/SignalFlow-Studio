import { SOCIAL_PLATFORMS, getCallbackUrl } from "../../../../../lib/social/socialConfig.js";
import {
  clearOAuthStateCookie,
  createTokenCookie,
  createTokenSession,
  readOAuthState,
} from "../../../../../lib/social/tokenStore.js";

/**
 * GET /api/social/callback/[platform]
 * Exchanges an OAuth authorization code and stores the encrypted token session
 * in an HTTP-only cookie scoped to this browser.
 */
export async function GET(request, { params }) {
  const platformId = params.platform;
  const platform = SOCIAL_PLATFORMS[platformId];

  if (!platform) {
    return buildRedirect(request, "error", `Unknown platform: ${platformId}`);
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  if (error) {
    return buildRedirect(request, "error", errorDescription || error, [clearOAuthStateCookie()]);
  }

  if (!code || !state) {
    return buildRedirect(request, "error", "Missing authorization code or state parameter.", [clearOAuthStateCookie()]);
  }

  const stateData = readOAuthState(request);
  if (
    !stateData ||
    stateData.platform !== platformId ||
    stateData.state !== state
  ) {
    return buildRedirect(
      request,
      "error",
      "Invalid or expired OAuth state. Start the connection again from SignalFlow.",
      [clearOAuthStateCookie()],
    );
  }

  try {
    const tokenData = await exchangeCodeForToken(platformId, platform, code, stateData);
    const profile = await fetchUserProfile(platformId, platform, tokenData.access_token);
    const tokenSession = createTokenSession(tokenData, profile);

    return buildRedirect(
      request,
      "success",
      `Connected to ${platform.label} as ${profile.name || profile.username || "user"}`,
      [createTokenCookie(platformId, tokenSession), clearOAuthStateCookie()],
    );
  } catch (err) {
    console.error(`OAuth callback error for ${platformId}:`, err.message);
    return buildRedirect(request, "error", err.message, [clearOAuthStateCookie()]);
  }
}

async function exchangeCodeForToken(platformId, platform, code, stateData) {
  const tokenParams = {
    grant_type: "authorization_code",
    code,
    redirect_uri: getCallbackUrl(platformId),
  };

  const headers = { "Content-Type": "application/x-www-form-urlencoded" };

  if (platformId === "linkedin") {
    tokenParams.client_id = process.env[platform.clientEnvKey];
    tokenParams.client_secret = process.env[platform.secretEnvKey];
  } else if (platformId === "x") {
    const credentials = Buffer.from(
      `${process.env[platform.clientEnvKey]}:${process.env[platform.secretEnvKey]}`,
    ).toString("base64");
    headers.Authorization = `Basic ${credentials}`;
    if (stateData.codeVerifier) {
      tokenParams.code_verifier = stateData.codeVerifier;
    }
  } else if (platformId === "reddit") {
    const credentials = Buffer.from(
      `${process.env[platform.clientEnvKey]}:${process.env[platform.secretEnvKey]}`,
    ).toString("base64");
    headers.Authorization = `Basic ${credentials}`;
  }

  const response = await fetch(platform.tokenUrl, {
    method: "POST",
    headers,
    body: new URLSearchParams(tokenParams),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token exchange failed for ${platform.label} (${response.status}): ${errorText}`);
  }

  return response.json();
}

async function fetchUserProfile(platformId, platform, accessToken) {
  const headers = { Authorization: `Bearer ${accessToken}` };

  if (platformId === "reddit") {
    headers["User-Agent"] = "SignalFlowStudio/1.0";
  }

  try {
    const response = await fetch(platform.profileUrl, { headers });
    if (!response.ok) {
      return { name: "Unknown", username: "unknown", id: "" };
    }

    const data = await response.json();
    switch (platformId) {
      case "linkedin":
        return {
          name: data.name || `${data.given_name || ""} ${data.family_name || ""}`.trim(),
          username: data.email || data.sub || "",
          id: data.sub || "",
        };
      case "x":
        return {
          name: data.data?.name || "",
          username: data.data?.username || "",
          id: data.data?.id || "",
        };
      case "reddit":
        return {
          name: data.name || "",
          username: `u/${data.name || ""}`,
          id: data.id || "",
        };
      default:
        return { name: "Unknown", username: "unknown", id: "" };
    }
  } catch {
    return { name: "Connected User", username: "", id: "" };
  }
}

function buildRedirect(request, status, message, cookies = []) {
  const baseUrl = process.env.NEXTAUTH_URL || new URL(request.url).origin;
  const params = new URLSearchParams({
    social_status: status,
    social_message: message,
  });
  const response = Response.redirect(`${baseUrl}/?${params.toString()}`, 302);
  cookies.forEach((cookie) => response.headers.append("Set-Cookie", cookie));
  return response;
}
