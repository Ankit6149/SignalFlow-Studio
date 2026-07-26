import { PROVIDERS, getProviderApiKey } from "../types";

/**
 * Calls Anthropic Claude completions API.
 */
export async function generateClaude(prompt, modelOverride = null, config = {}) {
  const apiKey = getProviderApiKey("claude", config);
  if (!apiKey) {
    throw new Error("Claude API key is not configured (missing key settings).");
  }

  const model = modelOverride || config.modelName || PROVIDERS.claude.defaultModel || "claude-3-5-sonnet-20241022";
  const url = "https://api.anthropic.com/v1/messages";

  const headers = {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01"
  };

  const body = {
    model,
    max_tokens: config.maxTokens || 4000,
    messages: [
      {
        role: "user",
        content: prompt
      }
    ],
    temperature: 0.2
  };

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
      throw new Error("Request to Anthropic Claude API timed out after 50 seconds.");
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
    throw new Error(`Claude API response failed (HTTP ${resp.status}): ${errorDetails}`);
  }

  const data = await resp.json();
  const rawText = data?.content?.[0]?.text;

  if (!rawText) {
    throw new Error("Empty text returned by Anthropic Claude API.");
  }

  return rawText;
}
