import crypto from "crypto";
import { SOCIAL_PLATFORMS } from "./socialConfig.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const OAUTH_STATE_COOKIE = "signalflow_oauth_state";
const SOCIAL_COOKIE_PREFIX = "signalflow_social_";
const SOCIAL_COOKIE_DAYS = 90;
const OAUTH_STATE_SECONDS = 10 * 60;

function getEncryptionKey() {
  const seed = process.env.SOCIAL_ENCRYPTION_KEY || process.env.SIGNALFLOW_ACCESS_KEY;
  if (!seed) {
    throw new Error(
      "Social token encryption is not configured. Set SOCIAL_ENCRYPTION_KEY or SIGNALFLOW_ACCESS_KEY before enabling OAuth connectors.",
    );
  }
  return crypto.createHash("sha256").update(String(seed)).digest().subarray(0, 32);
}

function encrypt(value) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

function decrypt(value) {
  const payload = Buffer.from(String(value || ""), "base64url");
  if (payload.length <= IV_LENGTH + 16) {
    throw new Error("Invalid encrypted cookie payload");
  }

  const key = getEncryptionKey();
  const iv = payload.subarray(0, IV_LENGTH);
  const tag = payload.subarray(IV_LENGTH, IV_LENGTH + 16);
  const encrypted = payload.subarray(IV_LENGTH + 16);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

function parseCookies(request) {
  const cookieHeader = request?.headers?.get("cookie") || "";
  const result = {};

  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const separator = trimmed.indexOf("=");
    const name = separator >= 0 ? trimmed.slice(0, separator) : trimmed;
    const rawValue = separator >= 0 ? trimmed.slice(separator + 1) : "";
    try {
      result[name] = decodeURIComponent(rawValue);
    } catch {
      result[name] = rawValue;
    }
  }

  return result;
}

function secureAttribute() {
  return process.env.NODE_ENV === "production" ? "; Secure" : "";
}

function serializeCookie(name, value, maxAge) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}; Priority=High${secureAttribute()}`;
}

function socialCookieName(platform) {
  return `${SOCIAL_COOKIE_PREFIX}${String(platform || "").toLowerCase()}`;
}

export function createOAuthStateCookie(stateData) {
  return serializeCookie(OAUTH_STATE_COOKIE, encrypt(JSON.stringify(stateData)), OAUTH_STATE_SECONDS);
}

export function readOAuthState(request) {
  const encrypted = parseCookies(request)[OAUTH_STATE_COOKIE];
  if (!encrypted) return null;

  try {
    const stateData = JSON.parse(decrypt(encrypted));
    if (!stateData?.state || !stateData?.platform || !stateData?.created) return null;
    if (Date.now() - Number(stateData.created) > OAUTH_STATE_SECONDS * 1000) return null;
    return stateData;
  } catch {
    return null;
  }
}

export function clearOAuthStateCookie() {
  return serializeCookie(OAUTH_STATE_COOKIE, "", 0);
}

export function normalizeGrantedScopes(scope) {
  const values = Array.isArray(scope)
    ? scope
    : String(scope || "").split(/[\s,]+/);

  return Array.from(new Set(
    values
      .map((value) => String(value || "").trim())
      .filter(Boolean),
  )).sort();
}

function stableConnectionId(platform, profileId) {
  const id = String(profileId || "").trim();
  if (!id) return "";
  return crypto
    .createHash("sha256")
    .update(`${String(platform || "").toLowerCase()}:${id}`)
    .digest("hex")
    .slice(0, 24);
}

export function createTokenSession(platform, tokenData, profile = {}) {
  const now = Date.now();
  const profileId = String(profile.id || "").trim();
  const grantedScopes = normalizeGrantedScopes(tokenData.scope);

  return {
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token || "",
    token_type: tokenData.token_type || "Bearer",
    scope: tokenData.scope || "",
    granted_scopes: grantedScopes,
    expires_at: tokenData.expires_in
      ? now + Number(tokenData.expires_in) * 1000
      : null,
    connected_at: now,
    verified_at: profileId ? now : null,
    connection_id: stableConnectionId(platform, profileId),
    profile: {
      name: profile.name || "",
      username: profile.username || "",
      id: profileId,
    },
  };
}

export function readTokenSession(request, platform) {
  const encrypted = parseCookies(request)[socialCookieName(platform)];
  if (!encrypted) return null;

  try {
    const session = JSON.parse(decrypt(encrypted));
    return session?.access_token ? session : null;
  } catch {
    return null;
  }
}

export function createTokenCookie(platform, session) {
  const maxAge = SOCIAL_COOKIE_DAYS * 24 * 60 * 60;
  return serializeCookie(socialCookieName(platform), encrypt(JSON.stringify(session)), maxAge);
}

export function clearTokenCookie(platform) {
  return serializeCookie(socialCookieName(platform), "", 0);
}

export function isTokenExpired(session) {
  if (!session?.access_token) return true;
  if (!session.expires_at) return false;
  return Date.now() > Number(session.expires_at) - 5 * 60 * 1000;
}

export function updateTokenSession(session, newTokenData) {
  const nextScope = newTokenData.scope || session.scope || "";
  return {
    ...session,
    access_token: newTokenData.access_token || session.access_token,
    refresh_token: newTokenData.refresh_token || session.refresh_token || "",
    token_type: newTokenData.token_type || session.token_type || "Bearer",
    scope: nextScope,
    granted_scopes: normalizeGrantedScopes(nextScope),
    expires_at: newTokenData.expires_in
      ? Date.now() + Number(newTokenData.expires_in) * 1000
      : session.expires_at || null,
  };
}

export function getConnectionStatus(request, platform) {
  const platformId = String(platform || "").toLowerCase();
  const config = SOCIAL_PLATFORMS[platformId] || null;
  const session = readTokenSession(request, platformId);

  if (!session) {
    return {
      connected: false,
      verified: false,
      expired: false,
      profile: null,
      connectionId: "",
      connectedAt: null,
      verifiedAt: null,
      expiresAt: null,
      hasRefreshToken: false,
      requiredScopes: [...(config?.scopes || [])],
      grantedScopes: [],
      missingScopes: [...(config?.scopes || [])],
      scopeStatus: "not_connected",
      publishCapabilities: [],
      canPublishText: false,
    };
  }

  const grantedScopes = session.granted_scopes?.length
    ? normalizeGrantedScopes(session.granted_scopes)
    : normalizeGrantedScopes(session.scope);
  const requiredScopes = [...(config?.scopes || [])].sort();
  const missingScopes = requiredScopes.filter((scope) => !grantedScopes.includes(scope));
  const expired = isTokenExpired(session);
  const verified = Boolean(session.profile?.id);
  const scopeStatus = grantedScopes.length === 0
    ? "unverified"
    : missingScopes.length > 0
      ? "insufficient"
      : "verified";
  const publishCapabilities = verified && !expired && scopeStatus === "verified"
    ? [...(config?.publishCapabilities || [])]
    : [];

  return {
    connected: verified,
    verified,
    profile: session.profile || {},
    connectionId: session.connection_id || stableConnectionId(platformId, session.profile?.id),
    connectedAt: session.connected_at || null,
    verifiedAt: session.verified_at || (verified ? session.connected_at || null : null),
    expiresAt: session.expires_at || null,
    expired,
    hasRefreshToken: Boolean(session.refresh_token),
    requiredScopes,
    grantedScopes,
    missingScopes,
    scopeStatus,
    publishCapabilities,
    canPublishText: publishCapabilities.includes("text"),
  };
}

export function getAllConnectionStatus(request, platforms = []) {
  const status = {};
  for (const platform of platforms) {
    status[platform] = getConnectionStatus(request, platform);
  }
  return status;
}
