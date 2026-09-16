import { createCdpWebSocketClient } from "../infrastructure/cdpCaptureWorkerAdapter.mjs";
import { createServerWebSocketFactory } from "../infrastructure/serverWebSocketFactory.mjs";

const SAFE_STATUSES = new Set([
  "ready",
  "unreachable",
  "protocol_error",
  "configuration_invalid",
  "unavailable",
]);

function boundedTimeout(value, fallback = 3500) {
  const parsed = Number(value);
  return Math.max(250, Math.min(10000, Number.isFinite(parsed) ? Math.round(parsed) : fallback));
}

function normalizeEndpoint(value) {
  let url;
  try {
    url = new URL(String(value || "").trim());
  } catch {
    return null;
  }
  if (url.protocol !== "wss:" || url.username || url.password) return null;
  return url.toString();
}

function safeStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return SAFE_STATUSES.has(normalized) ? normalized : "unavailable";
}

function statusForError(error) {
  const code = String(error?.code || "").trim().toLowerCase();
  if (["worker_unavailable", "browser_crash", "navigation_timeout"].includes(code)) return "unreachable";
  if (code === "browser_protocol_failed") return "protocol_error";
  if (code === "websocket_auth_configuration_invalid") return "configuration_invalid";
  return "unavailable";
}

export async function probeCdpBrowserAccess({
  endpoint,
  bearerToken = "",
  timeoutMs = 3500,
  clientFactory = null,
} = {}) {
  const browserEndpoint = normalizeEndpoint(endpoint);
  if (!browserEndpoint) {
    return Object.freeze({ available: false, status: "configuration_invalid" });
  }

  let client = null;
  try {
    const commandTimeoutMs = boundedTimeout(timeoutMs);
    const webSocketFactory = createServerWebSocketFactory({ bearerToken });
    client = clientFactory
      ? await clientFactory({ endpoint: browserEndpoint, webSocketFactory, commandTimeoutMs })
      : await createCdpWebSocketClient({
          endpoint: browserEndpoint,
          webSocketFactory,
          commandTimeoutMs,
        });

    const version = await client.send("Browser.getVersion");
    const protocolVersion = String(version?.protocolVersion || "").trim();
    if (!protocolVersion || protocolVersion.length > 120) {
      return Object.freeze({ available: false, status: "protocol_error" });
    }
    return Object.freeze({ available: true, status: "ready" });
  } catch (error) {
    return Object.freeze({ available: false, status: safeStatus(statusForError(error)) });
  } finally {
    try {
      await client?.close?.();
    } catch {
      // Best effort only. Never expose endpoint, auth material or transport internals.
    }
  }
}
