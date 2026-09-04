import { PROVIDERS, getProviderApiKey } from "../types.js";

const GATEWAY_URL = "https://ai-gateway.vercel.sh/v1/chat/completions";

function safeErrorText(value, maxLength = 1200) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  return normalized.slice(0, maxLength);
}

/**
 * Calls Vercel AI Gateway using either an explicit Gateway key or Vercel's
 * deployment-provided OIDC token. The request stays on the existing remote
 * inference/privacy path; this adapter only changes credential sourcing.
 */
export async function generateVercelGateway(prompt, modelOverride = null, config = {}) {
  const apiKey = getProviderApiKey("vercel_gateway", config);
  if (!apiKey) {
    throw new Error("Vercel AI Gateway is unavailable (missing AI_GATEWAY_API_KEY or VERCEL_OIDC_TOKEN).");
  }

  const model = modelOverride
    || config.modelName
    || PROVIDERS.vercel_gateway.defaultModel
    || "google/gemini-2.5-flash-lite";
  const fetchImpl = typeof config.fetchImpl === "function" ? config.fetchImpl : globalThis.fetch;
  if (typeof fetchImpl !== "function") throw new Error("Vercel AI Gateway requires fetch().");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 50_000);
  let response;
  try {
    response = await fetchImpl(GATEWAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: config.maxTokens || 3000,
        temperature: 0.2,
        stream: false,
      }),
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("Vercel AI Gateway timed out after 50 seconds.");
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    let detail = "";
    try {
      const payload = await response.json();
      detail = payload?.error?.message || payload?.error || payload?.message || "";
    } catch {
      try { detail = await response.text(); } catch { detail = ""; }
    }
    throw new Error(`Vercel AI Gateway request failed (HTTP ${response.status})${detail ? `: ${safeErrorText(detail)}` : "."}`);
  }

  const payload = await response.json();
  const rawText = payload?.choices?.[0]?.message?.content;
  if (!rawText) throw new Error("Vercel AI Gateway returned empty chat content.");
  return rawText;
}
