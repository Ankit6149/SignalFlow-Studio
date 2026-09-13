import { requireOwnerAccess } from "../../_auth.js";
import { getConnectionStatus, clearTokenCookie } from "../../../../lib/social/tokenStore.js";
import { internalErrorResponse } from "../../../../lib/server/safeApiErrors.mjs";

/**
 * POST /api/social/disconnect
 * Removes the current browser's encrypted connector session.
 */
export async function POST(request) {
  const accessError = requireOwnerAccess(request);
  if (accessError) return accessError;

  try {
    const { platform } = await request.json();

    if (!platform) {
      return new Response(JSON.stringify({ error: "Missing platform parameter" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const status = getConnectionStatus(request, platform);
    const response = new Response(JSON.stringify({
      ok: true,
      message: status.connected
        ? `Disconnected ${platform}.`
        : `${platform} was not connected in this browser.`,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
    response.headers.append("Set-Cookie", clearTokenCookie(platform));
    return response;
  } catch (err) {
    return internalErrorResponse("social.disconnect", err, {
      message: "SignalFlow could not disconnect that social account.",
    });
  }
}
