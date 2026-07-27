import {
  getProviderApiKey,
  getProviderBaseUrl,
  getSignalFlowAccessKey,
  getSignalFlowBaseUrl,
} from "./config.mjs";

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function signalFlowRequest(path, {
  method = "GET",
  body,
  provider,
  providerBaseUrl,
  env = process.env,
  fetchImpl = globalThis.fetch,
  timeoutMs = 120000,
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("This Node runtime does not provide fetch(). Use Node 20 or newer.");
  }

  const baseUrl = getSignalFlowBaseUrl(env);
  const accessKey = getSignalFlowAccessKey(env);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (accessKey) headers["x-signalflow-access-key"] = accessKey;

  let requestBody = body;
  if (requestBody && typeof requestBody === "object" && !Array.isArray(requestBody)) {
    requestBody = { ...requestBody };
    const resolvedProvider = String(provider || requestBody.generator || "").toLowerCase();
    const providerKey = getProviderApiKey(resolvedProvider, env);
    const resolvedBaseUrl = getProviderBaseUrl(
      resolvedProvider,
      providerBaseUrl || requestBody.providerBaseUrl,
      env,
    );
    if (providerKey && !requestBody.providerApiKey && !requestBody.temporaryApiKey) {
      if (path.includes("provider_test")) requestBody.temporaryApiKey = providerKey;
      else requestBody.providerApiKey = providerKey;
    }
    if (resolvedBaseUrl && !requestBody.providerBaseUrl && !requestBody.baseUrl) {
      if (path.includes("provider_test")) requestBody.baseUrl = resolvedBaseUrl;
      else requestBody.providerBaseUrl = resolvedBaseUrl;
    }
  }

  try {
    const response = await fetchImpl(`${baseUrl}${path}`, {
      method,
      headers,
      body: requestBody === undefined ? undefined : JSON.stringify(requestBody),
      signal: controller.signal,
    });
    const text = await response.text();
    const data = safeJsonParse(text);

    if (!data || typeof data !== "object") {
      throw new Error(`SignalFlow returned an unreadable response (HTTP ${response.status}).`);
    }
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `SignalFlow request failed (HTTP ${response.status}).`);
    }
    return data;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`SignalFlow request timed out after ${Math.round(timeoutMs / 1000)} seconds.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
