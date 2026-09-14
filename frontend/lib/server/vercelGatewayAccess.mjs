const GATEWAY_CREDITS_URL = "https://ai-gateway.vercel.sh/v1/credits";
const MAX_CREDENTIAL_LENGTH = 20000;

function safeCredential(value) {
  const token = String(value || "").trim();
  if (!token || token.length > MAX_CREDENTIAL_LENGTH || /[\r\n]/.test(token)) return "";
  return token;
}

function statusLabel(statusCode) {
  if (statusCode === 401) return "unauthorized";
  if (statusCode === 403) return "forbidden";
  if (statusCode === 429) return "rate_limited";
  if (statusCode >= 500) return "upstream_error";
  return "unavailable";
}

/**
 * Verifies that the current Vercel AI Gateway credential can reach the
 * non-generation credits endpoint. The response body is intentionally never
 * read or returned, so balances and credentials stay server-only.
 */
export async function probeVercelGatewayAccess({
  credential,
  fetchImpl = globalThis.fetch,
  timeoutMs = 3500,
} = {}) {
  const token = safeCredential(credential);
  if (!token) return Object.freeze({ available: false, status: "missing", statusCode: null });
  if (typeof fetchImpl !== "function") return Object.freeze({ available: false, status: "unreachable", statusCode: null });

  const timeout = Math.max(500, Math.min(10000, Number(timeoutMs) || 3500));
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetchImpl(GATEWAY_CREDITS_URL, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: controller.signal,
    });
    const statusCode = Number(response?.status || 0) || null;
    if (response?.ok) return Object.freeze({ available: true, status: "authorized", statusCode });
    return Object.freeze({ available: false, status: statusLabel(statusCode), statusCode });
  } catch {
    return Object.freeze({ available: false, status: "unreachable", statusCode: null });
  } finally {
    clearTimeout(timeoutId);
  }
}

export { GATEWAY_CREDITS_URL as VERCEL_GATEWAY_CREDITS_URL };
