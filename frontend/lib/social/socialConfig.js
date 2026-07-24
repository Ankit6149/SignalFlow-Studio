/**
 * Social platform OAuth configuration registry.
 * Each platform defines its OAuth endpoints, scopes, and environment keys.
 */

export const SOCIAL_PLATFORMS = {
  linkedin: {
    id: "linkedin",
    label: "LinkedIn",
    icon: "in",
    color: "#0A66C2",
    authUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    profileUrl: "https://api.linkedin.com/v2/userinfo",
    scopes: ["openid", "profile", "w_member_social"],
    clientEnvKey: "LINKEDIN_CLIENT_ID",
    secretEnvKey: "LINKEDIN_CLIENT_SECRET",
    versionEnvKey: "LINKEDIN_API_VERSION",
    defaultApiVersion: "202607",
    grantType: "authorization_code",
    responseType: "code",
    tokenExpiry: 60 * 24 * 60 * 60,
    postMaxLength: 3000,
    supportsMedia: true,
    postEndpoint: "https://api.linkedin.com/rest/posts",
    setupUrl: "https://www.linkedin.com/developers/apps",
    setupSteps: [
      "Go to LinkedIn Developer Portal → Create App",
      "Add 'Sign In with LinkedIn using OpenID Connect' and 'Share on LinkedIn' products",
      "Set Redirect URL to: {callbackUrl}",
      "Copy Client ID and Client Secret to the deployment environment",
    ],
  },

  x: {
    id: "x",
    label: "X (Twitter)",
    icon: "𝕏",
    color: "#000000",
    authUrl: "https://x.com/i/oauth2/authorize",
    tokenUrl: "https://api.x.com/2/oauth2/token",
    profileUrl: "https://api.x.com/2/users/me",
    scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
    clientEnvKey: "X_CLIENT_ID",
    secretEnvKey: "X_CLIENT_SECRET",
    grantType: "authorization_code",
    responseType: "code",
    usePKCE: true,
    tokenExpiry: 2 * 60 * 60,
    postMaxLength: 280,
    threadMaxLength: 25,
    supportsMedia: true,
    postEndpoint: "https://api.x.com/2/tweets",
    setupUrl: "https://developer.x.com/en/portal/dashboard",
    setupSteps: [
      "Go to X Developer Portal → Create a Project & App",
      "Set up User Authentication with OAuth 2.0",
      "Set Type to 'Web App' and Redirect URL to: {callbackUrl}",
      "Copy Client ID and Client Secret to the deployment environment",
    ],
  },

  reddit: {
    id: "reddit",
    label: "Reddit",
    icon: "R",
    color: "#FF4500",
    authUrl: "https://www.reddit.com/api/v1/authorize",
    tokenUrl: "https://www.reddit.com/api/v1/access_token",
    profileUrl: "https://oauth.reddit.com/api/v1/me",
    scopes: ["identity", "submit", "read"],
    clientEnvKey: "REDDIT_CLIENT_ID",
    secretEnvKey: "REDDIT_CLIENT_SECRET",
    requiredEnvKeys: ["REDDIT_USER_AGENT"],
    grantType: "authorization_code",
    responseType: "code",
    tokenExpiry: 60 * 60,
    postMaxLength: 40000,
    supportsMedia: false,
    postEndpoint: "https://oauth.reddit.com/api/submit",
    setupUrl: "https://www.reddit.com/prefs/apps",
    setupSteps: [
      "Request and receive Reddit Data API approval under the Responsible Builder Policy",
      "Create a web app and set Redirect URI to: {callbackUrl}",
      "Copy App ID and Secret to the deployment environment",
      "Set REDDIT_USER_AGENT to an identifiable app/version and Reddit username",
    ],
  },
};

function normalizeOrigin(value) {
  const text = String(value || "").trim().replace(/\/+$/, "");
  if (!text) return "";
  return /^https?:\/\//i.test(text) ? text : `https://${text}`;
}

/**
 * Returns a stable OAuth callback URL. NEXTAUTH_URL wins because it can point
 * at the canonical custom domain; Vercel production/preview hosts are fallbacks.
 */
export function getCallbackUrl(platform) {
  const base =
    normalizeOrigin(process.env.NEXTAUTH_URL) ||
    normalizeOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL) ||
    normalizeOrigin(process.env.VERCEL_URL) ||
    "http://localhost:3000";

  return `${base}/api/social/callback/${platform}`;
}

export function getLinkedInApiVersion() {
  const platform = SOCIAL_PLATFORMS.linkedin;
  return process.env[platform.versionEnvKey] || platform.defaultApiVersion;
}

export function isPlatformConfigured(platformId) {
  const platform = SOCIAL_PLATFORMS[platformId];
  if (!platform) return false;
  const requiredKeys = [
    platform.clientEnvKey,
    platform.secretEnvKey,
    ...(platform.requiredEnvKeys || []),
  ];
  return requiredKeys.every((key) => Boolean(process.env[key]));
}

export function getAllPlatformStatus() {
  const status = {};
  for (const [key, platform] of Object.entries(SOCIAL_PLATFORMS)) {
    const configured = isPlatformConfigured(key);
    const callbackUrl = getCallbackUrl(key);
    status[key] = {
      id: platform.id,
      label: platform.label,
      icon: platform.icon,
      color: platform.color,
      configured,
      callbackUrl,
      scopes: [...platform.scopes],
      postMaxLength: platform.postMaxLength,
      supportsMedia: platform.supportsMedia,
      setupUrl: platform.setupUrl,
      setupSteps: platform.setupSteps.map((step) =>
        step.replace("{callbackUrl}", callbackUrl),
      ),
      readiness: {
        implementation: "ready",
        credentials: configured ? "ready" : "missing",
        callback: configured ? "needs_platform_confirmation" : "blocked",
        authorization: "pending",
        publishTest: "required",
        refreshTest: "required",
        rejectionTest: "required",
      },
    };
  }
  return status;
}
