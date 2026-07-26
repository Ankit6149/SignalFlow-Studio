import { PROVIDERS, getProviderApiKey } from "../types";

/**
 * Calls Groq Cloud chat completion endpoint.
 */
export async function generateGroq(prompt, modelOverride = null, config = {}) {
  const apiKey = getProviderApiKey("groq", config);
  if (!apiKey) {
    throw new Error("Groq API key is not configured (missing key settings).");
  }

  const model = modelOverride || config.modelName || PROVIDERS.groq.defaultModel || "llama-3.1-8b-instant";
  const url = "https://api.groq.com/openai/v1/chat/completions";

  const body = {
    model,
    messages: [
      {
        role: "user",
        content: prompt
      }
    ],
    response_format: {
      type: "json_object"
    },
    max_tokens: config.maxTokens || 3000,
    temperature: 0.2
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 50000);

  let resp;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("Request to Groq API timed out after 50 seconds.");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!resp.ok) {
    let errorDetails = "";
    try {
      const errorJson = await resp.json();
      errorDetails = errorJson?.error?.message || JSON.stringify(errorJson);
    } catch {
      errorDetails = await resp.text();
    }
    throw new Error(`Groq API response failed (HTTP ${resp.status}): ${errorDetails}`);
  }

  const data = await resp.json();
  const rawText = data?.choices?.[0]?.message?.content;

  if (!rawText) {
    throw new Error("Empty chat content returned by Groq completions.");
  }

  return rawText;
}
