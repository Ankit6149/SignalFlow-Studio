function resolveFetch(fetchImpl) {
  const candidate = fetchImpl || globalThis.fetch;
  if (typeof candidate !== "function") {
    throw new Error("SignalFlow Studio API client requires fetch.");
  }
  return candidate;
}

export function safeJsonParse(value, fallback = null) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

export async function readJsonResponse(response, fallbackMessage) {
  const text = await response.text();
  const parsed = safeJsonParse(text, null);
  if (parsed && typeof parsed === "object") return parsed;
  throw new Error(response.ok ? fallbackMessage : `${fallbackMessage} (HTTP ${response.status})`);
}

export async function readGenerationResponse(
  response,
  { onProgress, fallbackMessage = "SignalFlow returned an unreadable generation response." } = {},
) {
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  if (!contentType.includes("application/x-ndjson") || !response.body) {
    return readJsonResponse(response, fallbackMessage);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalData = null;

  const processLine = (line) => {
    if (!line.trim()) return;
    const event = safeJsonParse(line, null);
    if (!event || typeof event !== "object") throw new Error(fallbackMessage);
    if (event.type === "progress" && event.progress) {
      onProgress?.(event.progress);
      return;
    }
    if ((event.type === "result" || event.type === "error") && event.data) {
      finalData = event.data;
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) processLine(line);
  }

  buffer += decoder.decode();
  if (buffer.trim()) processLine(buffer);

  if (finalData && typeof finalData === "object") return finalData;
  throw new Error(fallbackMessage);
}

export async function getCapabilities({ fetchImpl } = {}) {
  const response = await resolveFetch(fetchImpl)("/api/capabilities", { cache: "no-store" });
  const data = await readJsonResponse(
    response,
    "SignalFlow could not read deployment capabilities.",
  );
  return { response, data };
}

export async function testProviderRoute(payload, { fetchImpl } = {}) {
  const response = await resolveFetch(fetchImpl)("/api/provider_test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await readJsonResponse(
    response,
    "SignalFlow returned an unreadable provider test response.",
  );
  return { response, data };
}

export async function getOwnerSession({ fetchImpl } = {}) {
  const response = await resolveFetch(fetchImpl)("/api/session");
  const data = await readJsonResponse(
    response,
    "SignalFlow could not verify the owner session.",
  );
  return { response, data };
}

export async function generateCampaign(
  payload,
  {
    fetchImpl,
    signal = null,
    onProgress,
  } = {},
) {
  const response = await resolveFetch(fetchImpl)("/api/launch_kit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/x-ndjson",
    },
    signal,
    body: JSON.stringify(payload),
  });
  const data = await readGenerationResponse(response, { onProgress });
  return { response, data };
}

export async function publishPost(payload, { fetchImpl } = {}) {
  const response = await resolveFetch(fetchImpl)("/api/publish", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await readJsonResponse(
    response,
    "SignalFlow returned an unreadable publishing response.",
  );
  return { response, data };
}

export async function getSocialStatus({ fetchImpl } = {}) {
  const response = await resolveFetch(fetchImpl)("/api/social/status");
  const data = await readJsonResponse(
    response,
    "SignalFlow returned an unreadable connector response.",
  );
  return { response, data };
}

export async function disconnectSocial(platform, { fetchImpl } = {}) {
  const response = await resolveFetch(fetchImpl)("/api/social/disconnect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ platform }),
  });
  const data = await readJsonResponse(
    response,
    "SignalFlow returned an unreadable disconnect response.",
  );
  return { response, data };
}

export async function unlockOwnerSession(accessKey, { fetchImpl } = {}) {
  const response = await resolveFetch(fetchImpl)("/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ access_key: String(accessKey || "").trim() }),
  });
  const data = await readJsonResponse(
    response,
    "SignalFlow returned an unreadable session response.",
  );
  return { response, data };
}

export async function lockOwnerSession({ fetchImpl } = {}) {
  return resolveFetch(fetchImpl)("/api/session", { method: "DELETE" });
}
