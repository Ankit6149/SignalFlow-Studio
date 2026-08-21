import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export const GITHUB_INSTALL_STATE_VERSION = 1;
const INSTALL_PURPOSE = "github_install";
const AUTHORIZE_PURPOSE = "github_authorize";
const DEFAULT_TTL_SECONDS = 10 * 60;
const MAX_TTL_SECONDS = 15 * 60;

function required(value, field, maxLength = 300) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new TypeError(`${field} is required.`);
  if (normalized.length > maxLength) throw new TypeError(`${field} is too long.`);
  return normalized;
}

function safeOpaque(value, field) {
  const normalized = required(value, field);
  if (/[/\\]|^[a-zA-Z]:/.test(normalized)) throw new TypeError(`${field} must be an opaque identifier.`);
  return normalized;
}

function numericId(value, field) {
  const normalized = safeOpaque(value, field);
  if (!/^\d+$/.test(normalized)) throw new TypeError(`${field} must be numeric.`);
  return normalized;
}

function safeReturnTo(value) {
  const normalized = String(value || "/?workspace=connections").trim();
  if (!normalized.startsWith("/") || normalized.startsWith("//") || normalized.includes("\\")) {
    throw new TypeError("GitHub connection returnTo must be a same-origin path.");
  }
  const parsed = new URL(normalized, "https://signalflow.invalid");
  if (parsed.origin !== "https://signalflow.invalid") throw new TypeError("GitHub connection returnTo must stay on the SignalFlow origin.");
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

function secretValue(value) {
  const normalized = required(value, "GitHub install-state secret", 10000);
  if (normalized.length < 24) throw new TypeError("GitHub install-state secret must be at least 24 characters.");
  return normalized;
}

function sign(body, secret) {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && timingSafeEqual(a, b);
}

function seconds(value = Date.now()) {
  const resolved = value instanceof Date ? value.getTime() : Number(value);
  if (!Number.isFinite(resolved)) throw new TypeError("GitHub connection-state clock is invalid.");
  return Math.floor(resolved / 1000);
}

function createState({
  purpose,
  secret,
  workspaceId,
  sourceConnectionId,
  installationId = null,
  returnTo = "/?workspace=connections",
  ttlSeconds = DEFAULT_TTL_SECONDS,
  now = Date.now(),
  nonce = randomUUID(),
} = {}) {
  const key = secretValue(secret);
  const issuedAt = seconds(now);
  const ttl = Number(ttlSeconds);
  if (!Number.isInteger(ttl) || ttl < 60 || ttl > MAX_TTL_SECONDS) {
    throw new TypeError(`GitHub connection-state ttlSeconds must be between 60 and ${MAX_TTL_SECONDS}.`);
  }
  const payload = Object.freeze({
    v: GITHUB_INSTALL_STATE_VERSION,
    p: purpose,
    w: safeOpaque(workspaceId, "workspaceId"),
    c: safeOpaque(sourceConnectionId, "sourceConnectionId"),
    x: installationId ? numericId(installationId, "installationId") : null,
    r: safeReturnTo(returnTo),
    n: safeOpaque(nonce, "nonce"),
    i: issuedAt,
    e: issuedAt + ttl,
  });
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${sign(body, key)}`;
}

function verifyState({ state, secret, workspaceId, purpose, requireInstallation = false, now = Date.now() } = {}) {
  const key = secretValue(secret);
  const token = required(state, "GitHub connection state", 5000);
  const parts = token.split(".");
  if (parts.length !== 2 || !safeEqual(parts[1], sign(parts[0], key))) {
    const error = new Error("GitHub connection state is invalid.");
    error.code = "github_install_state_invalid";
    throw error;
  }
  let payload;
  try {
    payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
  } catch {
    const error = new Error("GitHub connection state is malformed.");
    error.code = "github_install_state_invalid";
    throw error;
  }
  const current = seconds(now);
  if (payload?.v !== GITHUB_INSTALL_STATE_VERSION || payload?.p !== purpose) {
    const error = new Error("GitHub connection state purpose/version is invalid.");
    error.code = "github_install_state_invalid";
    throw error;
  }
  if (!Number.isInteger(payload.i) || !Number.isInteger(payload.e) || payload.i > current + 60 || payload.e <= current) {
    const error = new Error("GitHub connection state is expired or not yet valid.");
    error.code = "github_install_state_expired";
    throw error;
  }
  const expectedWorkspace = safeOpaque(workspaceId, "workspaceId");
  if (safeOpaque(payload.w, "state.workspaceId") !== expectedWorkspace) {
    const error = new Error("GitHub connection state belongs to another workspace.");
    error.code = "github_install_state_workspace_mismatch";
    throw error;
  }
  const installationId = payload.x ? numericId(payload.x, "state.installationId") : null;
  if (requireInstallation && !installationId) {
    const error = new Error("GitHub authorization state is missing installation identity.");
    error.code = "github_install_state_invalid";
    throw error;
  }
  return Object.freeze({
    workspaceId: expectedWorkspace,
    sourceConnectionId: safeOpaque(payload.c, "state.sourceConnectionId"),
    installationId,
    returnTo: safeReturnTo(payload.r),
    nonce: safeOpaque(payload.n, "state.nonce"),
    issuedAt: new Date(payload.i * 1000).toISOString(),
    expiresAt: new Date(payload.e * 1000).toISOString(),
  });
}

export function createGithubInstallState(input = {}) {
  return createState({ ...input, purpose: INSTALL_PURPOSE });
}

export function verifyGithubInstallState(input = {}) {
  return verifyState({ ...input, purpose: INSTALL_PURPOSE });
}

export function createGithubAuthorizationState(input = {}) {
  return createState({ ...input, purpose: AUTHORIZE_PURPOSE });
}

export function verifyGithubAuthorizationState(input = {}) {
  return verifyState({ ...input, purpose: AUTHORIZE_PURPOSE, requireInstallation: true });
}
