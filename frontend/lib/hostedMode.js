/**
 * Helper utilities to manage hosted environment state.
 */

const ENABLED_FLAGS = new Set(["1", "true", "yes", "on"]);

export function isPublicHostedMode(env = process.env) {
  const explicitHosted = ENABLED_FLAGS.has(String(env?.SIGNALFLOW_PUBLIC_HOSTED || "").trim().toLowerCase());
  const vercelHosted = Boolean(String(env?.VERCEL || "").trim());
  return explicitHosted || vercelHosted;
}

export function isOwnerAccessConfigured(env = process.env) {
  return Boolean(String(env?.SIGNALFLOW_ACCESS_KEY || "").trim());
}

export function isAccessLocked(env = process.env) {
  return isPublicHostedMode(env) || isOwnerAccessConfigured(env);
}

export function shouldHideOwnerConnections(env = process.env) {
  return isPublicHostedMode(env) && isAccessLocked(env);
}
