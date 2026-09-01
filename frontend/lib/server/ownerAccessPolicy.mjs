import crypto from "node:crypto";

const ENABLED_FLAGS = new Set(["1", "true", "yes", "on"]);

function accessKey(env = process.env) {
  return String(env?.SIGNALFLOW_ACCESS_KEY || "").trim();
}

function constantTimeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left ?? ""));
  const rightBuffer = Buffer.from(String(right ?? ""));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function ownerAccessConfigurationStatus(env = process.env) {
  const publicHosted = ENABLED_FLAGS.has(String(env?.SIGNALFLOW_PUBLIC_HOSTED || "").trim().toLowerCase());
  const configured = Boolean(accessKey(env));
  return Object.freeze({
    publicHosted,
    configured,
    locked: publicHosted || configured,
  });
}

export function verifyConfiguredOwnerAccessKey(value, env = process.env) {
  const expected = accessKey(env);
  return Boolean(expected) && constantTimeEqual(String(value ?? ""), expected);
}
