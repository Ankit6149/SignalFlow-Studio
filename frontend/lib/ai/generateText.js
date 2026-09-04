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

/**
 * Route a raw text request to the selected provider.
 */
export async function generateText({ provider, prompt, modelOverride = null, config = {} }) {
  const p = (provider || "prompt").trim().toLowerCase();
  const resolvedConfig = {
    ...config,
    maxTokens: resolveOutputTokenBudget(prompt, config.maxTokens),
  };

  switch (p) {
    case "vercel_gateway":
      return await generateVercelGateway(prompt, modelOverride, resolvedConfig);
    case "openai":
      return await generateOpenAI(prompt, modelOverride, resolvedConfig);
    case "claude":
      return await generateClaude(prompt, modelOverride, resolvedConfig);
    case "gemini":
      return await generateGemini(prompt, modelOverride, resolvedConfig);
    case "groq":
      return await generateGroq(prompt, modelOverride, resolvedConfig);
    case "openrouter":
      return await generateOpenRouter(prompt, modelOverride, resolvedConfig);
    case "ollama":
      return await generateOllama(prompt, modelOverride, resolvedConfig);
    case "lmstudio":
      return await generateLMStudio(prompt, modelOverride, resolvedConfig);
    case "custom":
      return await generateCustomOpenAI(prompt, modelOverride, resolvedConfig);
    default:
      throw new Error(`Text generation not supported for provider mode: "${provider}"`);
  }
}
