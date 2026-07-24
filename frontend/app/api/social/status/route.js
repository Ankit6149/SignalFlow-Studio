import { requireOwnerAccess } from "../../_auth.js";
import { getAllConnectionStatus } from "../../../../lib/social/tokenStore.js";
import { getAllPlatformStatus } from "../../../../lib/social/socialConfig.js";

/**
 * GET /api/social/status
 * Returns official connector configuration and the current browser's encrypted
 * OAuth session status. Raw tokens never leave the server route.
 */
export async function GET(request) {
  const accessError = requireOwnerAccess(request);
  if (accessError) return accessError;

  try {
    const platformConfig = getAllPlatformStatus();
    const connections = getAllConnectionStatus(request, Object.keys(platformConfig));

    const result = {};
    for (const [key, config] of Object.entries(platformConfig)) {
      const connection = connections[key] || { connected: false };
      result[key] = {
        ...config,
        connected: connection.connected,
        profile: connection.profile || null,
        connectedAt: connection.connectedAt || null,
        expired: connection.expired || false,
        hasRefreshToken: connection.hasRefreshToken || false,
        readiness: {
          ...config.readiness,
          authorization: connection.expired
            ? "expired"
            : connection.connected
              ? "ready"
              : "pending",
          refreshTest: connection.hasRefreshToken ? "available_for_live_test" : "required",
          publishTest: "required",
          rejectionTest: "required",
        },
      };
    }

    result.instagram = {
      id: "instagram",
      label: "Instagram",
      icon: "📷",
      color: "#E1306C",
      configured: false,
      connected: false,
      manualOnly: true,
      reason: "Instagram publishing requires a Meta Business account and hosted media URLs. Use the approved manual draft until that media pipeline is configured.",
      supportsMedia: true,
      postMaxLength: 2200,
    };

    result.hn = {
      id: "hn",
      label: "Hacker News",
      icon: "Y",
      color: "#FF6600",
      configured: false,
      connected: false,
      manualOnly: true,
      reason: "Hacker News has no official posting API. Submit the approved draft manually.",
      supportsMedia: false,
      postMaxLength: null,
    };

    result.blog = {
      id: "blog",
      label: "Blog",
      icon: "✍",
      color: "#333333",
      configured: false,
      connected: false,
      manualOnly: true,
      reason: "Blog publishing depends on your CMS. Use the exported Markdown file.",
      supportsMedia: true,
      postMaxLength: null,
    };

    result.newsletter = {
      id: "newsletter",
      label: "Newsletter",
      icon: "📧",
      color: "#6366F1",
      configured: false,
      connected: false,
      manualOnly: true,
      reason: "Newsletter sending depends on your email provider. Copy or export the approved content.",
      supportsMedia: true,
      postMaxLength: null,
    };

    result.release_notes = {
      id: "release_notes",
      label: "Release Notes",
      icon: "📋",
      color: "#059669",
      configured: false,
      connected: false,
      manualOnly: true,
      reason: "Release notes are exported as Markdown for GitHub Releases or your changelog.",
      supportsMedia: false,
      postMaxLength: null,
    };

    return new Response(JSON.stringify({ platforms: result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
