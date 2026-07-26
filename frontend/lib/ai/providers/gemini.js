import { PROVIDERS, getProviderApiKey } from "../types";

/**
 * Calls Google Gemini REST API.
 */
export async function generateGemini(prompt, modelOverride = null, config = {}) {
  const apiKey = getProviderApiKey("gemini", config);
  if (!apiKey) {
    throw new Error("Gemini API key is not configured (missing key settings).");
  }

  const model = modelOverride || config.modelName || PROVIDERS.gemini.defaultModel || "gemini-2.0-flash";

  // Attempt generating JSON response first
  try {
    return await makeGeminiRequest(prompt, model, apiKey, true, config.maxTokens);
  } catch (jsonErr) {
    const errorMsg = jsonErr.message || "";
    // If the error message suggests responseMimeType is not supported, or it is a 400 parameter error, retry in text mode
    if (
      errorMsg.includes("response_mime_type") ||
      errorMsg.includes("mime") ||
      errorMsg.includes("MIME") ||
      errorMsg.includes("JSON") ||
      errorMsg.includes("400")
    ) {
      try {
        return await makeGeminiRequest(prompt, model, apiKey, false, config.maxTokens);
      } catch (textErr) {
        throw new Error(`Gemini request failed: ${textErr.message}`);
      }
    }
    throw jsonErr;
  }
}

async function makeGeminiRequest(prompt, model, apiKey, useJsonMode, maxTokens) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const body = {
    contents: [
      {
        parts: [
          {
            text: prompt
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: maxTokens || 3000
    }
  };

  if (useJsonMode) {
    body.generationConfig.responseMimeType = "application/json";
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 50000);

  let resp;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("Request to Gemini API timed out after 50 seconds.");
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
    throw new Error(`Gemini API response failed (HTTP ${resp.status}): ${errorDetails}`);
  }

  const data = await resp.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText) {
    throw new Error("Empty candidate response returned by Gemini API.");
  }

  return rawText;
}
