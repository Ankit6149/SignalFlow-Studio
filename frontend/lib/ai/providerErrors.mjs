const SAFE_CODES = Object.freeze({
  INVALID_CREDENTIALS: "provider_invalid_credentials",
  AUTHORIZATION: "provider_authorization_failed",
  MODEL_NOT_FOUND: "provider_model_not_found",
  RATE_LIMITED: "provider_rate_limited",
  QUOTA_EXCEEDED: "provider_quota_exceeded",
  PAYMENT_REQUIRED: "provider_payment_required",
  TIMEOUT: "provider_timeout",
  UNAVAILABLE: "provider_unavailable",
  MALFORMED_RESPONSE: "provider_malformed_response",
  EMPTY_RESPONSE: "provider_empty_response",
  UNSUPPORTED_PROVIDER: "provider_unsupported",
  UNKNOWN: "provider_unknown_failure",
});

function integerStatus(error) {
  if (Number.isInteger(error?.httpStatus)) return error.httpStatus;
  if (Number.isInteger(error?.status)) return error.status;
  const match = String(error?.message || "").match(/HTTP\s+(\d{3})/i);
  return match ? Number(match[1]) : null;
}

function correlationId() {
  if (globalThis.crypto?.randomUUID) return `provider-${globalThis.crypto.randomUUID()}`;
  return `provider-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function classify(error) {
  const status = integerStatus(error);
  const message = String(error?.message || "").toLowerCase();

  if (error?.code === "provider_malformed_response") {
    return { code: SAFE_CODES.MALFORMED_RESPONSE, retryable: false, action: "retry_or_choose_model" };
  }
  if (error?.code === "provider_empty_response") {
    return { code: SAFE_CODES.EMPTY_RESPONSE, retryable: true, action: "retry_destination" };
  }
  if (error?.name === "AbortError" || /timed?\s*out|timeout/.test(message)) {
    return { code: SAFE_CODES.TIMEOUT, retryable: true, action: "retry_destination" };
  }
  if (status === 401 || /invalid api key|incorrect api key|missing key|api key is not configured/.test(message)) {
    return { code: SAFE_CODES.INVALID_CREDENTIALS, retryable: false, action: "replace_key" };
  }
  if (status === 403 || /forbidden|not authorized|authorization/.test(message)) {
    return { code: SAFE_CODES.AUTHORIZATION, retryable: false, action: "check_permissions" };
  }
  if (status === 402 || /payment required|billing/.test(message)) {
    return { code: SAFE_CODES.PAYMENT_REQUIRED, retryable: false, action: "check_billing" };
  }
  if (/quota|insufficient_quota|credit balance/.test(message)) {
    return { code: SAFE_CODES.QUOTA_EXCEEDED, retryable: false, action: "check_quota" };
  }
  if (status === 429 || /rate.?limit|too many requests/.test(message)) {
    return { code: SAFE_CODES.RATE_LIMITED, retryable: false, action: "wait_then_retry" };
  }
  if (status === 404 || /model .*not found|unknown model|does not exist/.test(message)) {
    return { code: SAFE_CODES.MODEL_NOT_FOUND, retryable: false, action: "choose_model" };
  }
  if (status && status >= 500) {
    return { code: SAFE_CODES.UNAVAILABLE, retryable: true, action: "retry_destination" };
  }
  if (/json repair failed|valid json|malformed|parse/.test(message)) {
    return { code: SAFE_CODES.MALFORMED_RESPONSE, retryable: false, action: "retry_or_choose_model" };
  }
  if (/empty .*response|empty .*content|empty candidate|non-string response/.test(message)) {
    return { code: SAFE_CODES.EMPTY_RESPONSE, retryable: true, action: "retry_destination" };
  }
  if (/not supported for provider|unsupported model provider/.test(message)) {
    return { code: SAFE_CODES.UNSUPPORTED_PROVIDER, retryable: false, action: "choose_provider" };
  }
  return { code: SAFE_CODES.UNKNOWN, retryable: false, action: "retry_or_contact_owner" };
}

function safeMessage(code, provider) {
  const label = String(provider || "model provider");
  switch (code) {
    case SAFE_CODES.INVALID_CREDENTIALS: return `${label} rejected or is missing the configured credentials.`;
    case SAFE_CODES.AUTHORIZATION: return `${label} did not authorize this request.`;
    case SAFE_CODES.MODEL_NOT_FOUND: return "The selected model is unavailable for this provider.";
    case SAFE_CODES.RATE_LIMITED: return `${label} is rate-limiting requests. Retry deliberately after the limit clears.`;
    case SAFE_CODES.QUOTA_EXCEEDED: return `${label} reports that the current quota is exhausted.`;
    case SAFE_CODES.PAYMENT_REQUIRED: return `${label} requires billing or credits before generation can continue.`;
    case SAFE_CODES.TIMEOUT: return `${label} did not respond within the request limit.`;
    case SAFE_CODES.UNAVAILABLE: return `${label} is temporarily unavailable.`;
    case SAFE_CODES.MALFORMED_RESPONSE: return `${label} returned a response that could not be validated as the required JSON contract.`;
    case SAFE_CODES.EMPTY_RESPONSE: return `${label} returned no usable model output.`;
    case SAFE_CODES.UNSUPPORTED_PROVIDER: return "The selected generation provider is not supported.";
    default: return "The model request failed unexpectedly.";
  }
}

export class ProviderError extends Error {
  constructor({ code, message, provider = "", model = "", retryable = false, recoveryAction = "", httpStatus = null, correlationId: id = "" }) {
    super(message);
    this.name = "ProviderError";
    this.code = code;
    this.provider = String(provider || "");
    this.model = String(model || "");
    this.retryable = Boolean(retryable);
    this.recoveryAction = String(recoveryAction || "");
    this.httpStatus = Number.isInteger(httpStatus) ? httpStatus : null;
    this.correlationId = String(id || correlationId());
  }
}

export function normalizeProviderError(error, { provider = "", model = "" } = {}) {
  if (error instanceof ProviderError) return error;
  const classification = classify(error);
  return new ProviderError({
    ...classification,
    message: safeMessage(classification.code, provider),
    provider,
    model,
    httpStatus: integerStatus(error),
  });
}

export function malformedProviderResponse({ provider = "", model = "" } = {}) {
  return new ProviderError({
    code: SAFE_CODES.MALFORMED_RESPONSE,
    message: safeMessage(SAFE_CODES.MALFORMED_RESPONSE, provider),
    provider,
    model,
    retryable: false,
    recoveryAction: "retry_or_choose_model",
  });
}

export function providerErrorPayload(error) {
  const normalized = error instanceof ProviderError ? error : normalizeProviderError(error);
  return Object.freeze({
    code: normalized.code,
    message: normalized.message,
    retryable: normalized.retryable,
    recoveryAction: normalized.recoveryAction,
    httpStatus: normalized.httpStatus,
    provider: normalized.provider,
    model: normalized.model,
    correlationId: normalized.correlationId,
  });
}

export { SAFE_CODES as PROVIDER_ERROR_CODES };
