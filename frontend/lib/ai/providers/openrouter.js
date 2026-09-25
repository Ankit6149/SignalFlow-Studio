import { PROVIDERS, getProviderApiKey } from "../types";
import { createLinkedAbort, cancelledProviderRequestError } from "../requestAbort.mjs";

/**
 * Calls OpenRouter chat completions endpoint.
 */
export async function generateOpenRouter(prompt, modelOverride = null, config = {}) {
  const apiKey = getProviderApiKey("openrouter", config);
  if (!apiKey) {
    throw new Error("OpenRouter API key is not configured (missing key settings).");
  }

  const model = modelOverride || config.modelName || PROVIDERS.openrouter.defaultModel || "google/gemma-3-27b-it:free";
  const url = "https://openrouter.ai/api/v1/chat/completions";

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

  const abort = createLinkedAbort({ signal: config.signal, timeoutMs: 50_000 });

  let resp;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://github.com/Ankit6149/SignalFlow-Studio",
        "X-Title": "SignalFlow Studio"
      },
      body: JSON.stringify(body),
      signal: abort.signal
    });
  } catch (err) {
    if (err.name === "AbortError") {
      if (abort.cancelled()) throw cancelledProviderRequestError();
      throw new Error("Request to OpenRouter API timed out after 50 seconds.");
    }
    throw err;
  } finally {
    abort.cleanup();
  }

  if (!resp.ok) {
    let errorDetails = "";
    try {
      const errorJson = await resp.json();
      errorDetails = errorJson?.error?.message || JSON.stringify(errorJson);
    } catch {
      errorDetails = await resp.text();
    }
    throw new Error(`OpenRouter API response failed (HTTP ${resp.status}): ${errorDetails}`);
  }

  const data = await resp.json();
  const rawText = data?.choices?.[0]?.message?.content;

  if (!rawText) {
    throw new Error("Empty chat content returned by OpenRouter.");
  }

  return rawText;
}
