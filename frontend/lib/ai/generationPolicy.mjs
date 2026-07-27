export const MODEL_GENERATION_PROVIDERS = new Set([
  "gemini",
  "openai",
  "claude",
  "openrouter",
  "groq",
  "custom",
  "ollama",
  "lmstudio",
]);

export function normalizeGenerationProvider(value) {
  return String(value || "").trim().toLowerCase();
}

export function assertModelGenerationProvider(value) {
  const provider = normalizeGenerationProvider(value);

  if (["", "template", "offline", "prompt"].includes(provider)) {
    throw new Error(
      "SignalFlow requires a real model provider. Local template and prompt-only generation are not available in the product workflow.",
    );
  }

  if (!MODEL_GENERATION_PROVIDERS.has(provider)) {
    throw new Error(`Unsupported model provider: ${provider || "missing provider"}.`);
  }

  return provider;
}

export function canUseServerProviderConfiguration({
  publicHosted = process.env.SIGNALFLOW_PUBLIC_HOSTED === "true",
  allowServerKey = false,
} = {}) {
  return !publicHosted || Boolean(allowServerKey);
}
