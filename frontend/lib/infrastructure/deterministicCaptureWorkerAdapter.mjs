import { assertPort } from "../domain/ports.mjs";
import { portableClone } from "../domain/contracts.mjs";

const TRANSPARENT_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

function clone(value) {
  return portableClone(value);
}

function assertSession(session) {
  if (!session || session.closed) {
    const error = new Error("Capture session is closed.");
    error.code = "browser_crash";
    throw error;
  }
  return session;
}

export function createDeterministicCaptureWorkerAdapter({
  visibleSelectors = [],
  blockedPrivacyCodes = [],
  screenshotPayloadBase64 = TRANSPARENT_PNG_BASE64,
  screenshotDimensions = { width: 1, height: 1 },
} = {}) {
  const visible = new Set(visibleSelectors.map(String));
  const privacyBlocks = new Set(blockedPrivacyCodes.map(String));
  const dimensions = {
    width: Math.max(1, Math.round(Number(screenshotDimensions?.width) || 1)),
    height: Math.max(1, Math.round(Number(screenshotDimensions?.height) || 1)),
  };

  const adapter = {
    async describe() {
      return {
        available: true,
        adapterKind: "deterministic_demo_fixture",
        capabilities: ["browser_capture", "screenshot", "safe_fixture", "privacy_checkpoints"],
        allowedEnvironments: ["demo"],
        screenshot: true,
        screencast: false,
      };
    },

    async open({ targetOrigin, environment }) {
      if (environment !== "demo") {
        const error = new Error("Deterministic capture adapter is restricted to demo fixtures.");
        error.code = "unauthorized_target";
        throw error;
      }
      return {
        targetOrigin,
        currentUrl: `${targetOrigin}/`,
        environment,
        closed: false,
        fixtureValues: {},
        events: [],
      };
    },

    async navigate(session, target) {
      const state = assertSession(session);
      if (new URL(target).origin !== state.targetOrigin) {
        const error = new Error("Navigation attempted to leave the approved origin.");
        error.code = "origin_changed";
        throw error;
      }
      state.currentUrl = target;
      state.events.push({ action: "navigate", target });
      return null;
    },

    async waitFor(session, step) {
      assertSession(session);
      if (!visible.has(step.selector) && !step.optional) {
        const error = new Error("Capture selector was not available.");
        error.code = "selector_checkpoint_missing";
        throw error;
      }
      return null;
    },

    async click(session, step) {
      assertSession(session);
      if (!visible.has(step.selector) && !step.optional) {
        const error = new Error("Capture selector was not available.");
        error.code = "selector_checkpoint_missing";
        throw error;
      }
      session.events.push({ action: "click", selector: step.selector });
      return null;
    },

    async focus(session, step) {
      assertSession(session);
      if (!visible.has(step.selector) && !step.optional) {
        const error = new Error("Capture selector was not available.");
        error.code = "selector_checkpoint_missing";
        throw error;
      }
      return null;
    },

    async fillSafeFixture(session, step) {
      assertSession(session);
      if (step.value === undefined) {
        const error = new Error("Safe fixture value was not supplied.");
        error.code = "fixture_unavailable";
        throw error;
      }
      session.fixtureValues[step.fixtureKey] = clone(step.value);
      session.events.push({ action: "fill_safe_fixture", fixtureKey: step.fixtureKey });
      return null;
    },

    async select(session, step) {
      assertSession(session);
      if (!visible.has(step.selector) && !step.optional) {
        const error = new Error("Capture selector was not available.");
        error.code = "selector_checkpoint_missing";
        throw error;
      }
      session.events.push({ action: "select", selector: step.selector, optionValue: step.optionValue });
      return null;
    },

    async scroll(session, step) {
      assertSession(session);
      session.events.push({ action: "scroll", scrollY: step.scrollY || 0 });
      return null;
    },

    async pause(session, step) {
      assertSession(session);
      session.events.push({ action: "pause", pauseMs: step.pauseMs || 0 });
      return null;
    },

    async assertVisible(session, step) {
      assertSession(session);
      if (!visible.has(step.selector)) {
        const error = new Error("Expected capture checkpoint is missing.");
        error.code = "selector_checkpoint_missing";
        throw error;
      }
      return true;
    },

    async captureCheckpoint(session, step) {
      const state = assertSession(session);
      state.events.push({ action: "capture_checkpoint", checkpoint: step.checkpoint });
      return {
        payload: {
          encoding: "base64",
          data: screenshotPayloadBase64,
          fixture: true,
          checkpoint: step.checkpoint,
          sourceUrl: state.currentUrl,
        },
        originalName: `${step.checkpoint || "checkpoint"}.png`,
        mimeType: "image/png",
        byteSize: Math.floor(screenshotPayloadBase64.length * 0.75),
        dimensions: clone(dimensions),
        privacyClass: "workspace_private",
      };
    },

    async startRecording() {
      const error = new Error("Screencast capability is not configured on the deterministic screenshot worker.");
      error.code = "capture_capability_missing";
      throw error;
    },

    async stopRecording() {
      const error = new Error("Screencast capability is not configured on the deterministic screenshot worker.");
      error.code = "capture_capability_missing";
      throw error;
    },

    async evaluatePrivacy(session, rules = []) {
      assertSession(session);
      const issueCodes = rules.map((rule) => rule.code).filter((code) => privacyBlocks.has(code));
      return { blocked: issueCodes.length > 0, issueCodes };
    },

    async close(session) {
      if (session) session.closed = true;
      return true;
    },
  };

  return assertPort("captureWorkerAdapter", adapter);
}
