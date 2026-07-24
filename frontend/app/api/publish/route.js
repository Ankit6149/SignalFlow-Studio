import { requireOwnerAccess } from "../_auth.js";
import { publishToSocial } from "../../../lib/social/socialProviders.js";
import {
  createTokenCookie,
  getConnectionStatus,
  readTokenSession,
} from "../../../lib/social/tokenStore.js";

/**
 * POST /api/publish
 * Publishes approved content with the current browser's encrypted OAuth session.
 * A success response is returned only after the platform API confirms the post.
 */
export async function POST(request) {
  const accessError = requireOwnerAccess(request);
  if (accessError) return accessError;

  try {
    const { platform, content, projectName, options } = await request.json();

    if (!platform || !content) {
      return new Response(JSON.stringify({
        ok: false,
        error: "Missing platform or content parameters.",
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const status = getConnectionStatus(request, platform);
    const tokenSession = readTokenSession(request, platform);
    if (!status.connected || !tokenSession) {
      return new Response(JSON.stringify({
        ok: false,
        status: "not_connected",
        error: `Your ${platform} account is not connected in this browser. Connect it from the Connections page first.`,
        manualInstruction: "Copy the approved draft and publish it manually.",
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const published = await publishToSocial(platform, content, {
      projectName: projectName || "",
      ...(options || {}),
    }, tokenSession);

    const response = new Response(JSON.stringify(published.result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

    if (published.tokenSession) {
      response.headers.append("Set-Cookie", createTokenCookie(platform, published.tokenSession));
    }

    return response;
  } catch (err) {
    return new Response(JSON.stringify({
      ok: false,
      error: `Publishing failed: ${err.message}`,
      manualInstruction: "Copy the approved draft and publish it manually as a fallback.",
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
}
