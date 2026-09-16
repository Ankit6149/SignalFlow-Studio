import { PROVIDERS } from "../ai/types.js";
import { assertModelGenerationProvider } from "../ai/generationPolicy.mjs";
import { probeVercelGatewayAccess } from "./vercelGatewayAccess.mjs";

export const HOSTED_DIRECT_PROVIDER_ORDER = Object.freeze([
  "gemini",
  "openai",
  "claude",
  "openrouter",
  "groq",
  "custom",
]);

function text(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeSupported(value) {
  const candidate = text(value);
  if (!candidate) return "";
  try {
    return assertModelGenerationProvider(candidate);
  } catch {
    return "";
  }
}

function directConfigured(providerId, env = process.env) {
  switch (providerId) {
    case "gemini": return Boolean(String(env?.GEMINI_API_KEY || "").trim());
    case "openai": return Boolean(String(env?.OPENAI_API_KEY || "").trim());
    case "claude": return Boolean(String(env?.ANTHROPIC_API_KEY || env?.CLAUDE_API_KEY || "").trim());
    case "openrouter": return Boolean(String(env?.OPENROUTER_API_KEY || "").trim());
    case "groq": return Boolean(String(env?.GROQ_API_KEY || "").trim());
    case "custom": return Boolean(
      String(env?.CUSTOM_OPENAI_BASE_URL || "").trim()
      && String(env?.CUSTOM_OPENAI_API_KEY || "").trim()
    );
    default: return false;
  }
}

function selection(providerId, reason, gatewayAccess = null) {
  const meta = PROVIDERS[providerId];
  return meta ? Object.freeze({ providerId, meta, reason, gatewayAccess }) : null;
}

/**
 * Pure hosted/remote provider selection. Explicit requests remain exact: an
 * unavailable explicit provider returns null instead of being replaced by an
 * unrelated provider. Automatic selection never crosses into local inference.
 */
export function selectHostedInferenceProvider({
  requestedProvider = "",
  env = process.env,
  gatewayCredential = "",
  gatewayOperational = true,
  gatewayAccess = null,
} = {}) {
  const requested = normalizeSupported(requestedProvider);
  if (text(requestedProvider)) {
    if (!requested) return null;
    if (requested === "vercel_gateway") {
      return gatewayCredential && gatewayOperational ? selection(requested, "requested", gatewayAccess) : null;
    }
    if (!HOSTED_DIRECT_PROVIDER_ORDER.includes(requested)) return null;
    return directConfigured(requested, env) ? selection(requested, "requested", gatewayAccess) : null;
  }

  const preferred = normalizeSupported(env?.DEFAULT_MODEL_PROVIDER);
  if (preferred) {
    if (preferred === "vercel_gateway") {
      if (gatewayCredential && gatewayOperational) return selection(preferred, "default", gatewayAccess);
    } else if (HOSTED_DIRECT_PROVIDER_ORDER.includes(preferred) && directConfigured(preferred, env)) {
      return selection(preferred, "default", gatewayAccess);
    }
  }

  if (gatewayCredential && gatewayOperational) {
    return selection("vercel_gateway", "gateway", gatewayAccess);
  }

  for (const providerId of HOSTED_DIRECT_PROVIDER_ORDER) {
    if (directConfigured(providerId, env)) return selection(providerId, "direct_fallback", gatewayAccess);
  }

  return null;
}

/**
 * Runtime selector used by hosted inference routes. It avoids a Gateway probe
 * when an explicit/configured direct provider already wins. Otherwise the
 * non-generation credits endpoint is probed once before choosing Gateway, so a
 * forbidden Gateway cannot mask a configured direct remote fallback.
 */
export async function selectOperationalHostedInferenceProvider({
  requestedProvider = "",
  env = process.env,
  gatewayCredential = "",
  probeGatewayAccess = probeVercelGatewayAccess,
} = {}) {
  const requested = normalizeSupported(requestedProvider);
  if (text(requestedProvider) && requested && requested !== "vercel_gateway") {
    return selectHostedInferenceProvider({ requestedProvider, env, gatewayCredential, gatewayOperational: false });
  }

  const preferred = normalizeSupported(env?.DEFAULT_MODEL_PROVIDER);
  if (!text(requestedProvider) && preferred && preferred !== "vercel_gateway" && HOSTED_DIRECT_PROVIDER_ORDER.includes(preferred) && directConfigured(preferred, env)) {
    return selectHostedInferenceProvider({ env, gatewayCredential, gatewayOperational: false });
  }

  let gatewayAccess = null;
  let gatewayOperational = false;
  if (gatewayCredential) {
    gatewayAccess = await probeGatewayAccess({ credential: gatewayCredential });
    gatewayOperational = gatewayAccess?.available === true;
  }

  return selectHostedInferenceProvider({
    requestedProvider,
    env,
    gatewayCredential,
    gatewayOperational,
    gatewayAccess,
  });
}

export function hostedDirectInferenceConfigured(env = process.env) {
  return HOSTED_DIRECT_PROVIDER_ORDER.some((providerId) => directConfigured(providerId, env));
}
