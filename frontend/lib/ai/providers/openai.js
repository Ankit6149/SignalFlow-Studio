import { PROVIDERS, getProviderApiKey } from "../types";

/**
 * Calls official OpenAI completions API.
 */
export async function generateOpenAI(prompt, modelOverride = null, config = {}) {
  const apiKey = getProviderApiKey("openai", config);
  if (!apiKey) {
    throw new Error("OpenAI API key is not configured (missing key settings).");
  }

  const model = modelOverride || config.modelName || PROVIDERS.openai.defaultModel || "gpt-4o-mini";
  const url = "https://api.openai.com/v1/chat/completions";

  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${apiKey}`
  };

  const body = {
    model,
    messages: [
      {
        role: "user",
        content: prompt
      }
    ],
    max_tokens: config.maxTokens || 3000,
    temperature: 0.2
  };

  // Add JSON mode for newer models
  if (model.includes("gpt-4") || model.includes("gpt-3.5-turbo")) {
    body.response_format = { type: "json_object" };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 50000);

  let resp;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("Request to OpenAI API timed out after 50 seconds.");
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
    throw new Error(`OpenAI API response failed (HTTP ${resp.status}): ${errorDetails}`);
  }

  const data = await resp.json();
  const rawText = data?.choices?.[0]?.message?.content;

  if (!rawText) {
    throw new Error("Empty chat content returned by OpenAI API.");
  }

  return rawText;
}
