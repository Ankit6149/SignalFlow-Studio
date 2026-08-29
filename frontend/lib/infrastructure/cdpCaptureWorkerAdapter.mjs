import { assertPort } from "../domain/ports.mjs";

const DEFAULT_VIEWPORT = Object.freeze({ width: 1440, height: 900, deviceScaleFactor: 1 });
const DEFAULT_SELECTOR_TIMEOUT_MS = 8000;
const DEFAULT_COMMAND_TIMEOUT_MS = 15000;

export class CdpCaptureError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "CdpCaptureError";
    this.code = code;
    this.details = { ...details };
  }
}

function requiredText(value, field, maxLength = 4000) {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new CdpCaptureError("capture_configuration_missing", `${field} is required.`, { field });
  if (normalized.length > maxLength) throw new CdpCaptureError("capture_configuration_invalid", `${field} is too long.`, { field });
  return normalized;
}

function normalizeBrowserEndpoint(value, allowInsecureLocalhost = false) {
  let url;
  try {
    url = new URL(requiredText(value, "browserWSEndpoint", 12000));
  } catch {
    throw new CdpCaptureError("browser_endpoint_invalid", "Browser CDP endpoint must be a WebSocket URL.");
  }
  if (url.username || url.password) {
    throw new CdpCaptureError("browser_endpoint_invalid", "Browser CDP endpoint cannot contain URL userinfo credentials.");
  }
  const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "wss:" && !(allowInsecureLocalhost === true && local && url.protocol === "ws:")) {
    throw new CdpCaptureError("browser_endpoint_insecure", "Remote browser CDP connections require WSS.");
  }
  return url.toString();
}

function normalizeOrigin(value) {
  let url;
  try {
    url = new URL(requiredText(value, "targetOrigin", 1200));
  } catch {
    throw new CdpCaptureError("unauthorized_target", "Capture target origin is invalid.");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new CdpCaptureError("unauthorized_target", "Capture target origin must be an uncredentialed HTTP(S) origin.");
  }
  return url.origin;
}

function normalizeViewport(value = {}) {
  const width = Math.max(320, Math.min(3840, Math.round(Number(value.width || DEFAULT_VIEWPORT.width))));
  const height = Math.max(320, Math.min(2160, Math.round(Number(value.height || DEFAULT_VIEWPORT.height))));
  const deviceScaleFactor = Math.max(1, Math.min(3, Number(value.deviceScaleFactor || DEFAULT_VIEWPORT.deviceScaleFactor)));
  return { width, height, deviceScaleFactor };
}

function boundedMs(value, fallback, maximum = 60000) {
  const parsed = Number(value);
  return Math.max(50, Math.min(maximum, Number.isFinite(parsed) ? Math.round(parsed) : fallback));
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function eventData(event) {
  const value = event?.data ?? event;
  if (typeof value === "string") return value;
  if (value instanceof ArrayBuffer) return new TextDecoder().decode(new Uint8Array(value));
  if (value instanceof Uint8Array) return new TextDecoder().decode(value);
  if (typeof Buffer !== "undefined" && Buffer.isBuffer?.(value)) return value.toString("utf8");
  return String(value ?? "");
}

function on(socket, event, handler) {
  if (typeof socket.addEventListener === "function") socket.addEventListener(event, handler);
  else if (typeof socket.on === "function") socket.on(event, handler);
  else throw new CdpCaptureError("websocket_invalid", "WebSocket implementation does not support events.");
}

function off(socket, event, handler) {
  if (typeof socket.removeEventListener === "function") socket.removeEventListener(event, handler);
  else if (typeof socket.off === "function") socket.off(event, handler);
}

function createSocketDefault(url) {
  if (typeof globalThis.WebSocket !== "function") {
    throw new CdpCaptureError("worker_unavailable", "This worker runtime does not provide a WebSocket client.");
  }
  return new globalThis.WebSocket(url);
}

export async function createCdpWebSocketClient({
  endpoint,
  webSocketFactory = createSocketDefault,
  commandTimeoutMs = DEFAULT_COMMAND_TIMEOUT_MS,
} = {}) {
  const socket = webSocketFactory(endpoint);
  if (!socket || typeof socket.send !== "function") throw new CdpCaptureError("websocket_invalid", "WebSocket factory returned an invalid client.");
  const pending = new Map();
  let nextId = 1;
  let opened = false;
  let closed = false;

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new CdpCaptureError("worker_unavailable", "Timed out connecting to the configured browser worker."));
    }, boundedMs(commandTimeoutMs, DEFAULT_COMMAND_TIMEOUT_MS));
    const handleOpen = () => {
      opened = true;
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new CdpCaptureError("worker_unavailable", "Could not connect to the configured browser worker."));
    };
    const cleanup = () => {
      clearTimeout(timeout);
      off(socket, "open", handleOpen);
      off(socket, "error", handleError);
    };
    on(socket, "open", handleOpen);
    on(socket, "error", handleError);
    if (socket.readyState === 1) handleOpen();
  });

  on(socket, "message", (event) => {
    let message;
    try {
      message = JSON.parse(eventData(event));
    } catch {
      return;
    }
    if (!message?.id || !pending.has(message.id)) return;
    const entry = pending.get(message.id);
    pending.delete(message.id);
    clearTimeout(entry.timeout);
    if (message.error) {
      entry.reject(new CdpCaptureError("browser_protocol_failed", "Browser worker command failed.", {
        method: entry.method,
        protocolCode: Number(message.error.code) || null,
      }));
      return;
    }
    entry.resolve(message.result || {});
  });

  const rejectPending = () => {
    if (closed) return;
    closed = true;
    for (const entry of pending.values()) {
      clearTimeout(entry.timeout);
      entry.reject(new CdpCaptureError("browser_crash", "Browser worker connection closed unexpectedly.", { method: entry.method }));
    }
    pending.clear();
  };
  on(socket, "close", rejectPending);
  on(socket, "error", rejectPending);

  return {
    async send(method, params = {}, sessionId = null) {
      if (!opened || closed) throw new CdpCaptureError("browser_crash", "Browser worker connection is closed.");
      const id = nextId++;
      const message = { id, method, params };
      if (sessionId) message.sessionId = sessionId;
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          pending.delete(id);
          reject(new CdpCaptureError("navigation_timeout", "Browser worker command timed out.", { method }));
        }, boundedMs(commandTimeoutMs, DEFAULT_COMMAND_TIMEOUT_MS));
        pending.set(id, { resolve, reject, timeout, method });
        try {
          socket.send(JSON.stringify(message));
        } catch {
          clearTimeout(timeout);
          pending.delete(id);
          reject(new CdpCaptureError("browser_crash", "Browser worker command could not be sent.", { method }));
        }
      });
    },
    async close() {
      closed = true;
      for (const entry of pending.values()) {
        clearTimeout(entry.timeout);
        entry.reject(new CdpCaptureError("browser_crash", "Browser worker connection closed.", { method: entry.method }));
      }
      pending.clear();
      try {
        socket.close?.();
      } catch {
        // Best effort only; never expose endpoint or transport internals.
      }
    },
  };
}

function assertSession(session) {
  if (!session || session.closed || !session.client || !session.sessionId) {
    throw new CdpCaptureError("browser_crash", "Capture browser session is unavailable.");
  }
  if (Date.now() > session.deadlineMs) throw new CdpCaptureError("navigation_timeout", "Capture session exceeded its bounded duration.");
  return session;
}

async function evaluate(session, expression) {
  const state = assertSession(session);
  const result = await state.client.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
    userGesture: false,
  }, state.sessionId);
  if (result.exceptionDetails) throw new CdpCaptureError("browser_evaluation_failed", "A bounded browser operation failed.");
  return result.result?.value;
}

function selectorExpression(selector, body) {
  return `((selector) => { ${body} })(${JSON.stringify(String(selector))})`;
}

async function elementState(session, selector) {
  return evaluate(session, selectorExpression(selector, `
    const element = document.querySelector(selector);
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      visible: style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0 && rect.width > 0 && rect.height > 0,
      x: rect.left + window.scrollX,
      y: rect.top + window.scrollY,
      width: rect.width,
      height: rect.height
    };
  `));
}

async function waitUntil(check, { timeoutMs, optional = false } = {}) {
  const deadline = Date.now() + boundedMs(timeoutMs, DEFAULT_SELECTOR_TIMEOUT_MS);
  let lastError = null;
  while (Date.now() <= deadline) {
    try {
      const result = await check();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }
  if (optional) return null;
  if (lastError?.code === "origin_changed") throw lastError;
  throw new CdpCaptureError("selector_checkpoint_missing", "Expected capture selector was not available before timeout.");
}

async function currentUrl(session) {
  const value = await evaluate(session, "location.href");
  return requiredText(value, "currentUrl", 4000);
}

async function assertSameOrigin(session) {
  const state = assertSession(session);
  const url = new URL(await currentUrl(state));
  if (url.origin !== state.targetOrigin) {
    throw new CdpCaptureError("origin_changed", "Browser execution attempted to leave the approved capture origin.");
  }
  state.currentUrl = url.toString();
  return state.currentUrl;
}

async function waitForDocument(session, timeoutMs) {
  await waitUntil(async () => {
    const readyState = await evaluate(session, "document.readyState");
    return readyState === "complete" || readyState === "interactive";
  }, { timeoutMs });
  return assertSameOrigin(session);
}

function decodeBase64(value) {
  if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(String(value), "base64"));
  const binary = atob(String(value));
  const output = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) output[index] = binary.charCodeAt(index);
  return output;
}

function pngDimensions(payload) {
  if (!(payload instanceof Uint8Array) || payload.byteLength < 24) return null;
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!signature.every((byte, index) => payload[index] === byte)) return null;
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const width = view.getUint32(16, false);
  const height = view.getUint32(20, false);
  return width && height ? { width, height } : null;
}

function normalizeCookie(cookie, targetOrigin) {
  if (!cookie || typeof cookie !== "object" || Array.isArray(cookie)) throw new CdpCaptureError("secret_resolution_invalid", "Secret resolver returned an invalid cookie.");
  const name = requiredText(cookie.name, "cookie.name", 500);
  const value = requiredText(cookie.value, "cookie.value", 10000);
  const origin = new URL(targetOrigin);
  return {
    name,
    value,
    url: `${origin.protocol}//${origin.host}/`,
    path: String(cookie.path || "/"),
    secure: cookie.secure !== false,
    httpOnly: cookie.httpOnly === true,
    sameSite: ["Strict", "Lax", "None"].includes(cookie.sameSite) ? cookie.sameSite : "Lax",
    ...(Number.isFinite(Number(cookie.expires)) ? { expires: Number(cookie.expires) } : {}),
  };
}

export function createCdpCaptureWorkerAdapter({
  browserWSEndpoint,
  allowedEnvironments = ["preview"],
  viewport = DEFAULT_VIEWPORT,
  selectorTimeoutMs = DEFAULT_SELECTOR_TIMEOUT_MS,
  commandTimeoutMs = DEFAULT_COMMAND_TIMEOUT_MS,
  allowInsecureLocalhost = false,
  secretResolver = null,
  clientFactory = null,
  webSocketFactory = createSocketDefault,
} = {}) {
  const endpoint = normalizeBrowserEndpoint(browserWSEndpoint, allowInsecureLocalhost);
  const allowed = new Set((Array.isArray(allowedEnvironments) ? allowedEnvironments : []).map((item) => String(item).toLowerCase()));
  if (!allowed.size) throw new CdpCaptureError("capture_configuration_invalid", "At least one allowed capture environment is required.");
  const targetViewport = normalizeViewport(viewport);
  const createClient = clientFactory || ((options = {}) => createCdpWebSocketClient({
    endpoint,
    webSocketFactory,
    commandTimeoutMs: options.commandTimeoutMs || commandTimeoutMs,
  }));

  const adapter = {
    async describe() {
      return {
        available: true,
        adapterKind: "cdp_remote_browser",
        adapterVersion: 1,
        capabilities: ["browser_capture", "screenshot", "safe_fixture", "privacy_checkpoints", "focused_region"],
        allowedEnvironments: [...allowed].sort(),
        screenshot: true,
        screencast: false,
        viewport: { ...targetViewport },
      };
    },

    async open({ targetOrigin, environment, secretReferenceIds = [], maxDurationSeconds = 120 } = {}) {
      const approvedOrigin = normalizeOrigin(targetOrigin);
      const normalizedEnvironment = String(environment || "").toLowerCase();
      if (!allowed.has(normalizedEnvironment)) throw new CdpCaptureError("unauthorized_target", `CDP worker is not enabled for ${normalizedEnvironment || "this"} environment.`);
      const client = await createClient({ commandTimeoutMs });
      let targetId = null;
      try {
        const created = await client.send("Target.createTarget", { url: "about:blank" });
        targetId = requiredText(created.targetId, "targetId", 500);
        const attached = await client.send("Target.attachToTarget", { targetId, flatten: true });
        const sessionId = requiredText(attached.sessionId, "sessionId", 500);
        const session = {
          client,
          targetId,
          sessionId,
          targetOrigin: approvedOrigin,
          currentUrl: "about:blank",
          environment: normalizedEnvironment,
          viewport: { ...targetViewport },
          closed: false,
          deadlineMs: Date.now() + Math.max(5, Math.min(600, Number(maxDurationSeconds) || 120)) * 1000,
        };
        await client.send("Page.enable", {}, sessionId);
        await client.send("Runtime.enable", {}, sessionId);
        await client.send("DOM.enable", {}, sessionId);
        await client.send("Network.enable", {}, sessionId);
        await client.send("Emulation.setDeviceMetricsOverride", {
          width: targetViewport.width,
          height: targetViewport.height,
          deviceScaleFactor: targetViewport.deviceScaleFactor,
          mobile: false,
        }, sessionId);

        if (secretReferenceIds.length) {
          if (!secretResolver || typeof secretResolver.resolve !== "function") {
            throw new CdpCaptureError("secret_resolution_unavailable", "Capture recipe requires secret references but no bounded secret resolver is configured.");
          }
          const resolved = await secretResolver.resolve({
            secretReferenceIds: [...secretReferenceIds],
            targetOrigin: approvedOrigin,
            environment: normalizedEnvironment,
          });
          const cookies = Array.isArray(resolved?.cookies) ? resolved.cookies.map((cookie) => normalizeCookie(cookie, approvedOrigin)) : [];
          if (cookies.length) await client.send("Network.setCookies", { cookies }, sessionId);
        }
        return session;
      } catch (error) {
        if (targetId) await client.send("Target.closeTarget", { targetId }).catch(() => {});
        await client.close().catch(() => {});
        throw error;
      }
    },

    async navigate(session, target) {
      const state = assertSession(session);
      let url;
      try {
        url = new URL(requiredText(target, "navigationTarget", 4000));
      } catch {
        throw new CdpCaptureError("unauthorized_target", "Capture navigation target is invalid.");
      }
      if (url.origin !== state.targetOrigin) throw new CdpCaptureError("origin_changed", "Capture worker refused cross-origin navigation.");
      const result = await state.client.send("Page.navigate", { url: url.toString() }, state.sessionId);
      if (result.errorText) throw new CdpCaptureError("navigation_failed", "Browser navigation failed.");
      await waitForDocument(state, commandTimeoutMs);
      return null;
    },

    async waitFor(session, step) {
      return waitUntil(async () => {
        const state = await elementState(session, step.selector);
        return state?.visible ? state : null;
      }, { timeoutMs: selectorTimeoutMs, optional: step.optional === true });
    },

    async click(session, step) {
      const available = await adapter.waitFor(session, step);
      if (!available && step.optional) return null;
      await evaluate(session, selectorExpression(step.selector, `
        const element = document.querySelector(selector);
        if (!element) return false;
        element.click();
        return true;
      `));
      await delay(50);
      await assertSameOrigin(session);
      return null;
    },

    async focus(session, step) {
      const available = await adapter.waitFor(session, step);
      if (!available && step.optional) return null;
      await evaluate(session, selectorExpression(step.selector, `
        const element = document.querySelector(selector);
        if (!element) return false;
        element.focus();
        return true;
      `));
      return null;
    },

    async fillSafeFixture(session, step) {
      if (step.value === undefined || step.value === null) throw new CdpCaptureError("fixture_unavailable", "Safe fixture value was not supplied.");
      if (!step.selector) throw new CdpCaptureError("capture_selector_required", "fill_safe_fixture requires a selector for real browser execution.");
      const available = await adapter.waitFor(session, step);
      if (!available && step.optional) return null;
      const value = String(step.value);
      await evaluate(session, `((selector, value) => {
        const element = document.querySelector(selector);
        if (!element) return false;
        const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value");
        if (descriptor?.set) descriptor.set.call(element, value); else element.value = value;
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      })(${JSON.stringify(String(step.selector))}, ${JSON.stringify(value)})`);
      return null;
    },

    async select(session, step) {
      const available = await adapter.waitFor(session, step);
      if (!available && step.optional) return null;
      await evaluate(session, `((selector, value) => {
        const element = document.querySelector(selector);
        if (!element) return false;
        element.value = value;
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      })(${JSON.stringify(String(step.selector))}, ${JSON.stringify(String(step.optionValue || ""))})`);
      return null;
    },

    async scroll(session, step) {
      assertSession(session);
      await evaluate(session, `window.scrollTo({ top: ${Math.round(Number(step.scrollY || 0))}, left: 0, behavior: "instant" }); true;`);
      return null;
    },

    async pause(session, step) {
      assertSession(session);
      await delay(Math.max(0, Math.min(15000, Math.round(Number(step.pauseMs || 0)))));
      return null;
    },

    async assertVisible(session, step) {
      const state = await elementState(session, step.selector);
      if (!state?.visible) throw new CdpCaptureError("selector_checkpoint_missing", "Expected capture checkpoint is not visible.");
      return true;
    },

    async captureCheckpoint(session, step) {
      const state = assertSession(session);
      const sourceUrl = await assertSameOrigin(state);
      let clip = null;
      if (step.selector) {
        await evaluate(state, selectorExpression(step.selector, `
          const element = document.querySelector(selector);
          if (!element) return false;
          element.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
          return true;
        `));
        await delay(50);
        const region = await elementState(state, step.selector);
        if (!region?.visible) throw new CdpCaptureError("selector_checkpoint_missing", "Focused screenshot region is not visible.");
        clip = {
          x: Math.max(0, region.x),
          y: Math.max(0, region.y),
          width: Math.max(1, region.width),
          height: Math.max(1, region.height),
          scale: 1,
        };
      }
      const captured = await state.client.send("Page.captureScreenshot", {
        format: "png",
        fromSurface: true,
        captureBeyondViewport: Boolean(clip),
        ...(clip ? { clip } : {}),
      }, state.sessionId);
      const payload = decodeBase64(requiredText(captured.data, "screenshot.data", 100_000_000));
      const dimensions = pngDimensions(payload) || (clip
        ? {
            width: Math.max(1, Math.round(clip.width * state.viewport.deviceScaleFactor)),
            height: Math.max(1, Math.round(clip.height * state.viewport.deviceScaleFactor)),
          }
        : {
            width: Math.round(state.viewport.width * state.viewport.deviceScaleFactor),
            height: Math.round(state.viewport.height * state.viewport.deviceScaleFactor),
          });
      return {
        payload,
        originalName: `${step.checkpoint || "checkpoint"}.png`,
        mimeType: "image/png",
        byteSize: payload.byteLength,
        dimensions,
        privacyClass: "workspace_private",
        exportAllowed: true,
        processingAllowed: true,
        captureMetadata: {
          checkpoint: step.checkpoint || null,
          sourceUrl,
          environment: state.environment,
          viewport: { ...state.viewport },
          focusedSelector: step.selector || null,
          adapterKind: "cdp_remote_browser",
          adapterVersion: 1,
        },
      };
    },

    async startRecording() {
      throw new CdpCaptureError("capture_capability_missing", "Screencast is not enabled in the screenshot worker.");
    },

    async stopRecording() {
      throw new CdpCaptureError("capture_capability_missing", "Screencast is not enabled in the screenshot worker.");
    },

    async evaluatePrivacy(session, rules = []) {
      const state = assertSession(session);
      await assertSameOrigin(state);
      const issueCodes = [];
      const warningCodes = [];
      for (const rule of Array.isArray(rules) ? rules : []) {
        if (!rule?.selector) {
          if (rule?.severity === "block") issueCodes.push(String(rule.code));
          else if (rule?.code) warningCodes.push(String(rule.code));
          continue;
        }
        const visible = (await elementState(state, rule.selector))?.visible === true;
        if (!visible) continue;
        if (rule.severity === "warn") warningCodes.push(String(rule.code));
        else issueCodes.push(String(rule.code));
      }
      return {
        blocked: issueCodes.length > 0,
        issueCodes: [...new Set(issueCodes)],
        warningCodes: [...new Set(warningCodes)],
      };
    },

    async close(session) {
      if (!session || session.closed) return true;
      session.closed = true;
      try {
        if (session.targetId) await session.client.send("Target.closeTarget", { targetId: session.targetId });
      } catch {
        // Best effort shutdown only.
      }
      await session.client.close().catch(() => {});
      return true;
    },
  };

  return assertPort("captureWorkerAdapter", adapter);
}
