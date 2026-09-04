export const PROVIDERS = {
  prompt: {
    id: "prompt",
    label: "Prompt only",
    description: "Generates a clean instructions prompt for copy-pasting to a free chatbot.",
    isLocal: true,
    isFree: true,
    isConfigured: () => true,
    defaultModel: "manual-copy"
  },
  template: {
    id: "template",
    label: "Template fallback",
    description: "Uses a deterministic rule-based local generator (offline-friendly).",
    isLocal: true,
    isFree: true,
    isConfigured: () => true,
    defaultModel: "deterministic-local"
  },
  vercel_gateway: {
    id: "vercel_gateway",
    label: "Vercel AI Gateway",
    description: "Uses Vercel AI Gateway with an explicit Gateway key or the deployment-provided Vercel OIDC token.",
    isLocal: false,
    isFree: false,
    isConfigured: () => Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN),
    defaultModel: process.env.VERCEL_AI_GATEWAY_MODEL || "google/gemini-2.5-flash-lite",
    requiredEnv: ["AI_GATEWAY_API_KEY|VERCEL_OIDC_TOKEN"],
    canTest: true,
    supportsTemporaryKey: true
  },
  openai: {
    id: "openai",
    label: "OpenAI",
    description: "Access GPT-4o, GPT-4o-mini, or legacy models directly.",
    isLocal: false,
    isFree: false,
    isConfigured: () => Boolean(process.env.OPENAI_API_KEY),
    defaultModel: process.env.DEFAULT_MODEL_NAME || "gpt-4o-mini",
    requiredEnv: ["OPENAI_API_KEY"],
    canTest: true,
    supportsTemporaryKey: true
  },
  claude: {
    id: "claude",
    label: "Anthropic Claude",
    description: "Access Claude 3.5 Sonnet or Claude 3 Opus models.",
    isLocal: false,
    isFree: false,
    isConfigured: () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY),
    defaultModel: process.env.DEFAULT_MODEL_NAME || "claude-3-5-sonnet-20241022",
    requiredEnv: ["ANTHROPIC_API_KEY"],
    canTest: true,
    supportsTemporaryKey: true
  },
  gemini: {
    id: "gemini",
    label: "Google Gemini / Gemma via AI Studio",
    description: "Use your Google AI Studio API key. Put it in GEMINI_API_KEY. Supports Gemini models and Google AI Studio routes. For Gemma/open models, use the model name if available through your Google/provider account, or use OpenRouter/custom gateway if your key is for another provider.",
    isLocal: false,
    isFree: false,
    isConfigured: () => Boolean(process.env.GEMINI_API_KEY),
    defaultModel: process.env.DEFAULT_MODEL_NAME || "gemini-2.5-flash",
    requiredEnv: ["GEMINI_API_KEY"],
    canTest: true,
    supportsTemporaryKey: true
  },
  groq: {
    id: "groq",
    label: "Groq",
    description: "Ultra-fast completions endpoint via Groq Cloud.",
    isLocal: false,
    isFree: false,
    isConfigured: () => Boolean(process.env.GROQ_API_KEY),
    defaultModel: process.env.DEFAULT_MODEL_NAME || "llama-3.1-8b-instant",
    requiredEnv: ["GROQ_API_KEY"],
    canTest: true,
    supportsTemporaryKey: true
  },
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    description: "Unified AI gateway for open-source and paid models.",
    isLocal: false,
    isFree: false,
    isConfigured: () => Boolean(process.env.OPENROUTER_API_KEY),
    defaultModel: process.env.DEFAULT_MODEL_NAME || "google/gemma-3-27b-it:free",
    requiredEnv: ["OPENROUTER_API_KEY"],
    canTest: true,
    supportsTemporaryKey: true
  },
  ollama: {
    id: "ollama",
    label: "Ollama",
    description: "Local model running via Ollama Desktop. Requires local server running.",
    isLocal: true,
    isFree: true,
    isConfigured: () => Boolean(process.env.OLLAMA_BASE_URL) || (
      !process.env.VERCEL && process.env.SIGNALFLOW_PUBLIC_HOSTED !== "true"
    ),
    defaultModel: process.env.DEFAULT_MODEL_NAME || "llama3",
    requiredEnv: ["OLLAMA_BASE_URL"],
    canTest: true,
    supportsTemporaryKey: false
  },
  lmstudio: {
    id: "lmstudio",
    label: "LM Studio",
    description: "Local model running via LM Studio client. Requires local server running.",
    isLocal: true,
    isFree: true,
    isConfigured: () => Boolean(process.env.LMSTUDIO_BASE_URL) || (
      !process.env.VERCEL && process.env.SIGNALFLOW_PUBLIC_HOSTED !== "true"
    ),
    defaultModel: process.env.DEFAULT_MODEL_NAME || "any",
    requiredEnv: ["LMSTUDIO_BASE_URL"],
    canTest: true,
    supportsTemporaryKey: false
  },
  custom: {
    id: "custom",
    label: "Custom Gateway",
    description: "Custom OpenAI-compatible inference endpoint.",
    isLocal: false,
    isFree: false,
    isConfigured: () => Boolean(process.env.CUSTOM_OPENAI_BASE_URL),
    defaultModel: process.env.DEFAULT_MODEL_NAME || "custom-model",
    requiredEnv: ["CUSTOM_OPENAI_BASE_URL", "CUSTOM_OPENAI_API_KEY"],
    canTest: true,
    supportsTemporaryKey: true
  }
};

export function getProviderApiKey(providerKey, config = {}) {
  const temporaryKey = String(config.apiKey || "").trim();
  if (temporaryKey) return temporaryKey;

  const publicHosted = process.env.SIGNALFLOW_PUBLIC_HOSTED === "true";
  if (publicHosted && !config.allowServerKey) return "";

  switch (providerKey) {
    case "vercel_gateway": return process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || "";
    case "openai": return process.env.OPENAI_API_KEY || "";
    case "claude": return process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY || "";
    case "gemini": return process.env.GEMINI_API_KEY || "";
    case "groq": return process.env.GROQ_API_KEY || "";
    case "openrouter": return process.env.OPENROUTER_API_KEY || "";
    case "custom": return process.env.CUSTOM_OPENAI_API_KEY || "";
    default: return "";
  }
}
