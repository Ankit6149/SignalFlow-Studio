import { createHmac, timingSafeEqual } from "node:crypto";

function rawBytes(value) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === "string") return Buffer.from(value, "utf8");
  throw new TypeError("GitHub webhook verification requires raw request bytes.");
}

function signatureBytes(signatureHeader) {
  const value = String(signatureHeader || "").trim().toLowerCase();
  if (!/^sha256=[a-f0-9]{64}$/.test(value)) return null;
  return Buffer.from(value.slice("sha256=".length), "hex");
}

export function verifyGithubWebhookSignature({ rawBody, signatureHeader, secret } = {}) {
  const key = String(secret || "");
  if (!key) throw new TypeError("GitHub webhook verification requires a configured secret.");
  const provided = signatureBytes(signatureHeader);
  if (!provided) return false;
  const expectedHex = createHmac("sha256", key).update(rawBytes(rawBody)).digest("hex");
  const expected = Buffer.from(expectedHex, "hex");
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export function readGithubWebhookHeaders(headers) {
  if (!headers || typeof headers.get !== "function") throw new TypeError("GitHub webhook headers must support get().");
  const eventName = String(headers.get("x-github-event") || "").trim().toLowerCase();
  const deliveryId = String(headers.get("x-github-delivery") || "").trim();
  const signatureHeader = String(headers.get("x-hub-signature-256") || "").trim();
  if (!eventName || !deliveryId) throw new TypeError("GitHub webhook event and delivery headers are required.");
  return Object.freeze({ eventName, deliveryId, signatureHeader });
}
