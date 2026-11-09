const GATEWAY_AVAILABILITY_URL = "https://ai-gateway.vercel.sh/v1/models?include_availability=true";
const MAX_CREDENTIAL_LENGTH = 20000;
const MAX_MODEL_ID_LENGTH = 240;
const ELIGIBILITY_CATEGORIES = new Set(["configuration", "policy", "transient"]);

function safeCredential(value) {
  const token = String(value || "").trim();
  if (!token || token.length > MAX_CREDENTIAL_LENGTH || /[\r\n]/.test(token)) return "";
  return token;
}

function safeModelId(value) {
  const modelId = String(value || "").trim();
  if (!modelId || modelId.length > MAX_MODEL_ID_LENGTH || /[\r\n]/.test(modelId)) return "";
  return modelId;
}

function statusLabel(statusCode) {
  if (statusCode === 401) return "unauthorized";
  if (statusCode === 403) return "forbidden";
  if (statusCode === 429) return "rate_limited";
  if (statusCode >= 500) return "upstream_error";
  return "unavailable";
}

function eligibilityStatus(row) {
  return String(row?.model_eligibility?.status || "").trim().toLowerCase();
}

function eligibilityCategory(row) {
  const category = String(row?.model_eligibility?.category || "").trim().toLowerCase();
  return ELIGIBILITY_CATEGORIES.has(category) ? category : null;
}

function result(available, status, statusCode, details = {}) {
  const output = { available: Boolean(available), status, statusCode };
  if (details.eligibilityCategory) output.eligibilityCategory = details.eligibilityCategory;
  return Object.freeze(output);
}

/**
 * Verifies that the current Vercel AI Gateway credential is admitted for the
 * actual configured generation model. Vercel's authenticated model catalog
 * exposes model eligibility without requiring a billable generation request.
 * The catalog body is reduced to safe eligibility state only; pricing, model
 * metadata, credentials and account details are never returned.
 */
export async function probeVercelGatewayAccess({
  credential,
  modelId = "",
  fetchImpl = globalThis.fetch,
  timeoutMs = 3500,
} = {}) {
  const token = safeCredential(credential);
  if (!token) return result(false, "missing", null);
  if (typeof fetchImpl !== "function") return result(false, "unreachable", null);

  const timeout = Math.max(500, Math.min(10000, Number(timeoutMs) || 3500));
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetchImpl(GATEWAY_AVAILABILITY_URL, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: controller.signal,
    });
    const statusCode = Number(response?.status || 0) || null;
    if (!response?.ok) return result(false, statusLabel(statusCode), statusCode);

    let payload;
    try {
      payload = await response.json();
    } catch {
      return result(false, "response_invalid", statusCode);
    }

    const rows = Array.isArray(payload?.data) ? payload.data : [];
    const requestedModel = safeModelId(modelId);
    const candidates = requestedModel
      ? rows.filter((row) => String(row?.id || "").trim() === requestedModel)
      : rows.filter((row) => String(row?.type || "").trim().toLowerCase() === "language");

    if (!candidates.length) return result(false, "model_unavailable", statusCode);
    if (candidates.some((row) => eligibilityStatus(row) === "eligible")) {
      return result(true, "authorized", statusCode);
    }

    const ineligible = candidates.find((row) => eligibilityStatus(row) === "ineligible");
    if (ineligible) {
      return result(false, "model_ineligible", statusCode, {
        eligibilityCategory: eligibilityCategory(ineligible),
      });
    }

    return result(false, "availability_unknown", statusCode);
  } catch {
    return result(false, "unreachable", null);
  } finally {
    clearTimeout(timeoutId);
  }
}

export { GATEWAY_AVAILABILITY_URL as VERCEL_GATEWAY_AVAILABILITY_URL };
