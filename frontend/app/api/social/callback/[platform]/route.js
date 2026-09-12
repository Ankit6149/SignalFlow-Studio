import { SOCIAL_PLATFORMS, getCallbackUrl } from "../../../../../lib/social/socialConfig.js";
import {
  clearOAuthStateCookie,
  createTokenCookie,
  createTokenSession,
  readOAuthState,
} from "../../../../../lib/social/tokenStore.js";

const GENERIC_CONNECTION_ERROR = "Could not complete this social connection. Return to SignalFlow and try again.";

function oauthFailure(code, status = null) {
  const error = new Error(GENERIC_CONNECTION_ERROR);
  error.code = code;
  if (Number.isInteger(status)) error.status = status;
  return error;
}

function logOAuthFailure(platformId, error) {
  console.error("SignalFlow social OAuth callback failed", {
    platform: platformId,
    code: String(error?.code || "social_oauth_failed"),
    status: Number.isInteger(error?.status) ? error.status : null,
  });
}

/**
 * GET /api/social/callback/[platform]
 * Exchanges an OAuth authorization code and stores the encrypted token session
 * in an HTTP-only cookie scoped to this browser.
 */
export async function GET(request, { params }) {
  const { platform: platformId } = await params;
  const platform = SOCIAL_PLATFORMS[platformId];

  if (!platform) {
    return buildRedirect(request, "error", "Unsupported social platform.");
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return buildRedirect(
      request,
      "error",
      `Authorization was not completed for ${platform.label}. Return to SignalFlow and try again.`,
      [clearOAuthStateCookie()],
    );
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
      `Connected to ${platform.label}.`,
      [createTokenCookie(platformId, tokenSession), clearOAuthStateCookie()],
    );
  } catch (err) {
    logOAuthFailure(platformId, err);
    return buildRedirect(request, "error", GENERIC_CONNECTION_ERROR, [clearOAuthStateCookie()]);
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
    throw oauthFailure("social_token_exchange_failed", response.status);
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
  const response = new Response(null, {
    status: 302,
    headers: {
      Location: `${baseUrl}/?${params.toString()}`,
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
  cookies.forEach((cookie) => response.headers.append("Set-Cookie", cookie));
  return response;
}
