import { generateVercelGateway } from "./providers/vercelGateway";
import { generateOpenAI } from "./providers/openai";
import { generateClaude } from "./providers/claude";
import { generateGemini } from "./providers/gemini";
import { generateGroq } from "./providers/groq";
import { generateOpenRouter } from "./providers/openrouter";
import { generateOllama } from "./providers/ollama";
import { generateLMStudio } from "./providers/lmstudio";
import { generateCustomOpenAI } from "./providers/customOpenAI";
import { resolveOutputTokenBudget } from "./outputBudget.mjs";
import { normalizeProviderError } from "./providerErrors.mjs";

/**
 * Route a raw text request to the selected provider.
 * All adapter failures cross this boundary as one safe ProviderError contract.
 */
export async function generateText({ provider, prompt, modelOverride = null, config = {} }) {
  const p = (provider || "prompt").trim().toLowerCase();
  const resolvedConfig = {
    ...config,
    maxTokens: resolveOutputTokenBudget(prompt, config.maxTokens),
  };
  let budgetTicket = null;

  try {
    budgetTicket = config.requestBudget?.begin?.({
      provider: p,
      model: modelOverride || resolvedConfig.modelName || "",
      kind: config.requestKind || "provider_request",
      destination: config.destination || "",
      maxOutputTokens: resolvedConfig.maxTokens,
    }) || null;
    let result;
    switch (p) {
      case "vercel_gateway":
        result = await generateVercelGateway(prompt, modelOverride, resolvedConfig); break;
      case "openai":
        result = await generateOpenAI(prompt, modelOverride, resolvedConfig); break;
      case "claude":
        result = await generateClaude(prompt, modelOverride, resolvedConfig); break;
      case "gemini":
        result = await generateGemini(prompt, modelOverride, resolvedConfig); break;
      case "groq":
        result = await generateGroq(prompt, modelOverride, resolvedConfig); break;
      case "openrouter":
        result = await generateOpenRouter(prompt, modelOverride, resolvedConfig); break;
      case "ollama":
        result = await generateOllama(prompt, modelOverride, resolvedConfig); break;
      case "lmstudio":
        result = await generateLMStudio(prompt, modelOverride, resolvedConfig); break;
      case "custom":
        result = await generateCustomOpenAI(prompt, modelOverride, resolvedConfig); break;
      default:
        throw new Error(`Text generation not supported for provider mode: "${provider}"`);
    }
    config.requestBudget?.finish?.(budgetTicket, { ok: true });
    return result;
  } catch (error) {
    const normalized = normalizeProviderError(error, {
      provider: p,
      model: modelOverride || "",
    });
    config.requestBudget?.finish?.(budgetTicket, { ok: false, errorCode: normalized.code });
    throw normalized;
  }
}
