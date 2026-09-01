import crypto from "crypto";
import {
  ownerAccessConfigurationStatus,
  verifyConfiguredOwnerAccessKey,
} from "../../lib/server/ownerAccessPolicy.mjs";

const ACCESS_HEADER = "x-signalflow-access-key";
const AUTH_HEADER = "authorization";
const SESSION_DAYS = 30;
export const SESSION_COOKIE_NAME = "signalflow_owner_session";

function base64Url(input) {
  return Buffer.from(input).toString("base64url");
}

function sign(value, secret) {
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left ?? ""));
  const rightBuffer = Buffer.from(String(right ?? ""));

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function ownerAccessUnavailableResponse() {
  return new Response(
    JSON.stringify({
      code: "owner_access_unconfigured",
      error: "Owner access is unavailable because this public hosted deployment has no owner access lock configured.",
    }),
    {
      status: 503,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, no-store, max-age=0",
      },
    },
  );
}

export function getOwnerAccessConfiguration() {
  return ownerAccessConfigurationStatus(process.env);
}

export function verifyOwnerAccessKey(value) {
  return verifyConfiguredOwnerAccessKey(value, process.env);
}

export function getRequestCookie(request, name) {
  const cookieHeader = request?.headers?.get("cookie") || "";
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const separator = trimmed.indexOf("=");
    const key = separator >= 0 ? trimmed.slice(0, separator) : trimmed;
    if (key !== name) continue;
    const raw = separator >= 0 ? trimmed.slice(separator + 1) : "";
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return "";
}

function cookieSecurityAttributes() {
  return process.env.NODE_ENV === "production" ? "; Secure" : "";
}

export function createSessionCookie(token) {
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}; Priority=High${cookieSecurityAttributes()}`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Priority=High${cookieSecurityAttributes()}`;
}

export function createSessionToken() {
  const secret = process.env.SIGNALFLOW_ACCESS_KEY;
  if (!secret) {
    return "";
  }

  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64Url(
    JSON.stringify({
      sub: "owner",
      scope: "signalflow:generate",
      exp: Math.floor(Date.now() / 1000) + SESSION_DAYS * 24 * 60 * 60,
    }),
  );
  const body = `${header}.${payload}`;
  return `${body}.${sign(body, secret)}`;
}

function verifySessionToken(token) {
  const secret = process.env.SIGNALFLOW_ACCESS_KEY;
  if (!secret || !token) {
    return false;
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    return false;
  }

  const body = `${parts[0]}.${parts[1]}`;
  const expected = sign(body, secret);
  if (!safeEqual(parts[2], expected)) {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return payload?.sub === "owner" && payload?.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function requireOwnerAccess(request) {
  const configuration = getOwnerAccessConfiguration();
  if (!configuration.configured) {
    return configuration.publicHosted ? ownerAccessUnavailableResponse() : null;
  }

  const provided = request.headers.get(ACCESS_HEADER) || "";
  const bearer = request.headers.get(AUTH_HEADER) || "";
  const bearerToken = bearer.startsWith("Bearer ") ? bearer.slice("Bearer ".length) : "";
  const cookieToken = getRequestCookie(request, SESSION_COOKIE_NAME);

  if (verifyOwnerAccessKey(provided) || verifySessionToken(bearerToken) || verifySessionToken(cookieToken)) {
    return null;
  }

  return new Response(
    JSON.stringify({
      error: "This hosted workspace is private. Self-host SignalFlow Studio or enter the owner's access key.",
    }),
    {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, no-store, max-age=0",
      },
    },
  );
}
