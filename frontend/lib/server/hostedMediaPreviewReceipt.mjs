import { createHmac, timingSafeEqual } from "node:crypto";
import { resolveMediaPreviewReceiptSecret } from "./runtimeSigningSecrets.mjs";

const RECEIPT_VERSION = 1;
const DEFAULT_TTL_MS = 5 * 60 * 1000;

function required(value, field, maxLength = 320) {
  const normalized = String(value || "").trim();
  if (!normalized || normalized.length > maxLength || /[/\\]|^[a-zA-Z]:/.test(normalized)) {
    const error = new Error(`${field} must be a bounded opaque identifier.`);
    error.code = "preview_receipt_invalid";
    throw error;
  }
  return normalized;
}

function secret(value) {
  const normalized = String(value || "").trim();
  if (normalized.length < 32) {
    const error = new Error("SIGNALFLOW_MEDIA_PREVIEW_RECEIPT_SECRET or SIGNALFLOW_ACCESS_KEY must provide a 32+ character signing key.");
    error.code = "preview_receipt_secret_unconfigured";
    error.status = 503;
    throw error;
  }
  return normalized;
}

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

function parseBase64url(value) {
  return Buffer.from(String(value || ""), "base64url").toString("utf8");
}

function signature(payload, signingSecret) {
  return createHmac("sha256", signingSecret).update(payload).digest("base64url");
}

function safeSignatureEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && timingSafeEqual(a, b);
}

function nowMs(clock) {
  const value = typeof clock?.now === "function" ? clock.now() : new Date().toISOString();
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new TypeError("Preview receipt clock must return an ISO timestamp.");
  return parsed;
}

function canonicalClaims({ workspaceId, assetId, assetVersionId, issuedAt, expiresAt }) {
  return {
    v: RECEIPT_VERSION,
    workspaceId: required(workspaceId, "workspaceId"),
    assetId: required(assetId, "assetId"),
    assetVersionId: required(assetVersionId, "assetVersionId"),
    issuedAt,
    expiresAt,
  };
}

export function createHostedMediaPreviewReceiptService({
  signingSecret,
  env = process.env,
  clock = { now: () => new Date().toISOString() },
  ttlMs = DEFAULT_TTL_MS,
} = {}) {
  const key = secret(String(signingSecret || "").trim() || resolveMediaPreviewReceiptSecret(env));
  const ttl = Number(ttlMs);
  if (!Number.isFinite(ttl) || ttl < 30_000 || ttl > 15 * 60 * 1000) {
    throw new TypeError("Preview receipt ttlMs must be between 30 seconds and 15 minutes.");
  }

  function issue({ workspaceId, assetId, assetVersionId } = {}) {
    const issued = nowMs(clock);
    const claims = canonicalClaims({
      workspaceId,
      assetId,
      assetVersionId,
      issuedAt: new Date(issued).toISOString(),
      expiresAt: new Date(issued + ttl).toISOString(),
    });
    const encoded = base64url(JSON.stringify(claims));
    return `${encoded}.${signature(encoded, key)}`;
  }

  function verify(receipt, expected = {}) {
    const [encoded, suppliedSignature, ...extra] = String(receipt || "").split(".");
    if (!encoded || !suppliedSignature || extra.length) {
      const error = new Error("Exact media preview receipt is malformed.");
      error.code = "preview_receipt_invalid";
      throw error;
    }
    const expectedSignature = signature(encoded, key);
    if (!safeSignatureEqual(suppliedSignature, expectedSignature)) {
      const error = new Error("Exact media preview receipt signature is invalid.");
      error.code = "preview_receipt_invalid";
      throw error;
    }

    let claims;
    try {
      claims = JSON.parse(parseBase64url(encoded));
    } catch {
      const error = new Error("Exact media preview receipt payload is invalid.");
      error.code = "preview_receipt_invalid";
      throw error;
    }
    if (claims?.v !== RECEIPT_VERSION) {
      const error = new Error("Exact media preview receipt version is unsupported.");
      error.code = "preview_receipt_invalid";
      throw error;
    }

    const normalized = canonicalClaims(claims);
    const issuedAt = Date.parse(normalized.issuedAt);
    const expiresAt = Date.parse(normalized.expiresAt);
    const current = nowMs(clock);
    if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt) || expiresAt <= issuedAt || current > expiresAt) {
      const error = new Error("Exact media preview receipt has expired or has invalid timing.");
      error.code = "preview_receipt_expired";
      throw error;
    }
    if (current + 60_000 < issuedAt) {
      const error = new Error("Exact media preview receipt was issued in the future.");
      error.code = "preview_receipt_invalid";
      throw error;
    }

    for (const field of ["workspaceId", "assetId", "assetVersionId"]) {
      if (expected[field] !== undefined && required(expected[field], field) !== normalized[field]) {
        const error = new Error(`Exact media preview receipt does not match ${field}.`);
        error.code = "preview_receipt_identity_mismatch";
        throw error;
      }
    }
    return Object.freeze(normalized);
  }

  return Object.freeze({ issue, verify });
}
