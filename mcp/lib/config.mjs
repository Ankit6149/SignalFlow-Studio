const PROVIDER_KEY_ENV = {
  gemini: ["SIGNALFLOW_GEMINI_API_KEY", "GEMINI_API_KEY"],
  openai: ["SIGNALFLOW_OPENAI_API_KEY", "OPENAI_API_KEY"],
  claude: ["SIGNALFLOW_ANTHROPIC_API_KEY", "ANTHROPIC_API_KEY", "CLAUDE_API_KEY"],
  openrouter: ["SIGNALFLOW_OPENROUTER_API_KEY", "OPENROUTER_API_KEY"],
  groq: ["SIGNALFLOW_GROQ_API_KEY", "GROQ_API_KEY"],
  custom: ["SIGNALFLOW_CUSTOM_API_KEY", "CUSTOM_OPENAI_API_KEY"],
};

export function getSignalFlowBaseUrl(env = process.env) {
  return String(env.SIGNALFLOW_BASE_URL || "http://localhost:3000").trim().replace(/\/+$/, "");
}

export function getSignalFlowAccessKey(env = process.env) {
  return String(env.SIGNALFLOW_ACCESS_KEY || "").trim();
}

export function getProviderApiKey(provider, env = process.env) {
  const candidates = PROVIDER_KEY_ENV[String(provider || "").toLowerCase()] || [];
  for (const key of candidates) {
    const value = String(env[key] || "").trim();
    if (value) return value;
  }
  return "";
}

export function getProviderBaseUrl(provider, suppliedBaseUrl = "", env = process.env) {
  const explicit = String(suppliedBaseUrl || "").trim();
  if (explicit) return explicit;

  switch (String(provider || "").toLowerCase()) {
    case "custom":
      return String(env.SIGNALFLOW_CUSTOM_BASE_URL || env.CUSTOM_OPENAI_BASE_URL || "").trim();
    case "ollama":
      return String(env.SIGNALFLOW_OLLAMA_BASE_URL || env.OLLAMA_BASE_URL || "").trim();
    case "lmstudio":
      return String(env.SIGNALFLOW_LMSTUDIO_BASE_URL || env.LMSTUDIO_BASE_URL || "").trim();
    default:
      return "";
  }
}
