import WebSocket from "ws";

function boundedSecret(value, field, maxLength = 12000) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  if (normalized.length > maxLength || /[\r\n]/.test(normalized)) {
    const error = new Error(`${field} is invalid.`);
    error.code = "websocket_auth_configuration_invalid";
    error.details = { field };
    throw error;
  }
  return normalized;
}

export function createServerWebSocketFactory({ bearerToken = "", WebSocketImpl = WebSocket } = {}) {
  const token = boundedSecret(bearerToken, "browserAuthToken");
  if (typeof WebSocketImpl !== "function") throw new TypeError("Server WebSocket implementation is required.");
  return function serverWebSocketFactory(endpoint) {
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    return new WebSocketImpl(endpoint, headers ? { headers } : undefined);
  };
}
