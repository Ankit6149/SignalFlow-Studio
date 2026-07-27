export const MODEL_PROVIDERS = [
  "gemini",
  "openai",
  "claude",
  "openrouter",
  "groq",
  "custom",
  "ollama",
  "lmstudio",
];

const LOCAL_PROVIDERS = new Set(["ollama", "lmstudio"]);
const FORBIDDEN_GENERATION_MODES = new Set(["", "template", "offline", "prompt"]);

export function isModelProvider(provider) {
  return MODEL_PROVIDERS.includes(String(provider || "").trim().toLowerCase());
}

export function isForbiddenGenerationMode(provider) {
  return FORBIDDEN_GENERATION_MODES.has(String(provider || "").trim().toLowerCase());
}

export function evaluateProviderReadiness({ provider, apiKey = "", baseUrl = "", status = null } = {}) {
  const id = String(provider || "").trim().toLowerCase();
  const hasApiKey = Boolean(String(apiKey || "").trim());
  const hasBaseUrl = Boolean(String(baseUrl || "").trim());
  const serverConfigured = Boolean(status?.configured);

  if (!id || isForbiddenGenerationMode(id) || !isModelProvider(id)) {
    return {
      ready: false,
      reason: "Choose a supported model provider before building the campaign.",
      source: "missing",
    };
  }

  if (serverConfigured) {
    return {
      ready: true,
      reason: "Configured securely on the SignalFlow server.",
      source: "server",
    };
  }

  if (LOCAL_PROVIDERS.has(id)) {
    return {
      ready: true,
      reason: hasBaseUrl
        ? "Local endpoint supplied. Test it before generation."
        : "Uses the provider default local endpoint. Test it before generation.",
      source: "local",
    };
  }

  if (id === "custom") {
    if (!hasBaseUrl) {
      return {
        ready: false,
        reason: "Add the OpenAI-compatible base URL for this provider.",
        source: "missing",
      };
    }
    return {
      ready: true,
      reason: hasApiKey
        ? "Custom endpoint and temporary key are ready for this request."
        : "Custom endpoint supplied. Add a key when the endpoint requires one.",
      source: "temporary",
    };
  }

  if (hasApiKey) {
    return {
      ready: true,
      reason: "Temporary key will be used only for this generation request.",
      source: "temporary",
    };
  }

  return {
    ready: false,
    reason: "Add a temporary API key or configure this provider on the server.",
    source: "missing",
  };
}

export function pickRecommendedProvider({ defaultProvider = "", statuses = {}, fallback = "gemini" } = {}) {
  const preferred = String(defaultProvider || "").trim().toLowerCase();
  if (isModelProvider(preferred) && statuses?.[preferred]?.configured) return preferred;

  const configured = MODEL_PROVIDERS.find((provider) => statuses?.[provider]?.configured);
  return configured || (isModelProvider(fallback) ? fallback : "gemini");
}
