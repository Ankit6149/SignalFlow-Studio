import crypto from "node:crypto";
import {
  isOwnerAccessConfigured,
  isPublicHostedMode,
} from "../hostedMode.js";

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
  const publicHosted = isPublicHostedMode(env);
  const configured = isOwnerAccessConfigured(env);
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
