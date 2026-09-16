import { PROVIDERS } from "../ai/types.js";
import { assertModelGenerationProvider } from "../ai/generationPolicy.mjs";

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

function selection(providerId, reason) {
  const meta = PROVIDERS[providerId];
  return meta ? Object.freeze({ providerId, meta, reason }) : null;
}

/**
 * Selects one hosted/remote model route without silently crossing into local
 * inference. Explicit requests remain exact: an unavailable explicit provider
 * returns null instead of being replaced by an unrelated provider.
 *
 * Automatic precedence after an absent explicit request is:
 * configured DEFAULT_MODEL_PROVIDER -> operational Gateway -> configured direct
 * remote provider.
 */
export function selectHostedInferenceProvider({
  requestedProvider = "",
  env = process.env,
  gatewayCredential = "",
  gatewayOperational = true,
} = {}) {
  const requested = normalizeSupported(requestedProvider);
  if (text(requestedProvider)) {
    if (!requested) return null;
    if (requested === "vercel_gateway") {
      return gatewayCredential && gatewayOperational ? selection(requested, "requested") : null;
    }
    if (!HOSTED_DIRECT_PROVIDER_ORDER.includes(requested)) return null;
    return directConfigured(requested, env) ? selection(requested, "requested") : null;
  }

  const preferred = normalizeSupported(env?.DEFAULT_MODEL_PROVIDER);
  if (preferred) {
    if (preferred === "vercel_gateway") {
      if (gatewayCredential && gatewayOperational) return selection(preferred, "default");
    } else if (HOSTED_DIRECT_PROVIDER_ORDER.includes(preferred) && directConfigured(preferred, env)) {
      return selection(preferred, "default");
    }
  }

  if (gatewayCredential && gatewayOperational) {
    return selection("vercel_gateway", "gateway");
  }

  for (const providerId of HOSTED_DIRECT_PROVIDER_ORDER) {
    if (directConfigured(providerId, env)) return selection(providerId, "direct_fallback");
  }

  return null;
}

export function hostedDirectInferenceConfigured(env = process.env) {
  return HOSTED_DIRECT_PROVIDER_ORDER.some((providerId) => directConfigured(providerId, env));
}
