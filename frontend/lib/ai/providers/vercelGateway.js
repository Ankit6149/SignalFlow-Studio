import { PROVIDERS, getProviderApiKey } from "../types.js";
import { createLinkedAbort, cancelledProviderRequestError } from "../requestAbort.mjs";

const GATEWAY_URL = "https://ai-gateway.vercel.sh/v1/chat/completions";

function safeErrorText(value, maxLength = 1200) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  return normalized.slice(0, maxLength);
}

function gatewayError(code, message, status = null) {
  const error = new Error(message);
  error.code = code;
  if (status !== null) error.status = status;
  return error;
}

/**
 * Calls Vercel AI Gateway using either an explicit Gateway key or Vercel's
 * deployment-provided OIDC token. The request stays on the existing remote
 * inference/privacy path; this adapter only changes credential sourcing.
 */
export async function generateVercelGateway(prompt, modelOverride = null, config = {}) {
  const apiKey = getProviderApiKey("vercel_gateway", config);
  if (!apiKey) {
    throw gatewayError(
      "vercel_gateway_credential_missing",
      "Vercel AI Gateway is unavailable (missing AI_GATEWAY_API_KEY or VERCEL_OIDC_TOKEN).",
      503,
    );
  }

  const model = modelOverride
    || config.modelName
    || PROVIDERS.vercel_gateway.defaultModel
    || "google/gemini-2.5-flash-lite";
  const fetchImpl = typeof config.fetchImpl === "function" ? config.fetchImpl : globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw gatewayError("vercel_gateway_fetch_unavailable", "Vercel AI Gateway requires fetch().", 500);
  }

  const abort = createLinkedAbort({ signal: config.signal, timeoutMs: 50_000 });
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
        // AI Gateway's current Chat Completions contract documents legacy JSON
        // mode as `type: "json"` (or JSON Schema for stricter contracts).
        response_format: { type: "json" },
        max_tokens: config.maxTokens || 3000,
        temperature: 0.2,
        stream: false,
      }),
      signal: abort.signal,
      cache: "no-store",
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      if (abort.cancelled()) throw cancelledProviderRequestError();
      throw gatewayError("vercel_gateway_timeout", "Vercel AI Gateway timed out after 50 seconds.", 504);
    }
    if (error?.code) throw error;
    throw gatewayError("vercel_gateway_request_error", "Vercel AI Gateway request failed before receiving a response.", 502);
  } finally {
    abort.cleanup();
  }

  if (!response.ok) {
    let detail = "";
    try {
      const payload = await response.json();
      detail = payload?.error?.message || payload?.error || payload?.message || "";
    } catch {
      try { detail = await response.text(); } catch { detail = ""; }
    }
    throw gatewayError(
      `vercel_gateway_http_${response.status}`,
      `Vercel AI Gateway request failed (HTTP ${response.status})${detail ? `: ${safeErrorText(detail)}` : "."}`,
      response.status,
    );
  }

  const payload = await response.json();
  const rawText = payload?.choices?.[0]?.message?.content;
  if (!rawText) {
    throw gatewayError("vercel_gateway_empty_content", "Vercel AI Gateway returned empty chat content.", 502);
  }
  return rawText;
}
