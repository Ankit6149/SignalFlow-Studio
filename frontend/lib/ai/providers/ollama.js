import { PROVIDERS } from "../types";

/**
 * Calls local Ollama chat completions endpoint.
 */
export async function generateOllama(prompt, modelOverride = null, config = {}) {
  const baseUrl = config.baseUrl || process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1";
  const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;

  const model = modelOverride || config.modelName || PROVIDERS.ollama.defaultModel || "llama3";

  const body = {
    model,
    messages: [
      {
        role: "user",
        content: prompt
      }
    ],
    format: "json",
    response_format: {
      type: "json_object"
    },
    max_tokens: config.maxTokens || 3000,
    temperature: 0.2
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 55000);

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    if (!resp.ok) {
      const errorDetails = await resp.text();
      throw new Error(`Ollama response failed (HTTP ${resp.status}): ${errorDetails}`);
    }

    const data = await resp.json();
    const rawText = data?.choices?.[0]?.message?.content;

    if (!rawText) {
      throw new Error("Empty chat content returned by local Ollama.");
    }

    return rawText;
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("Local Ollama generation timed out after 55 seconds.");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
