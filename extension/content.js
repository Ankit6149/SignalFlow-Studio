const CAPABILITY_REQUEST_EVENT = "SignalFlowRequestCapabilities";
const CAPABILITY_RESPONSE_EVENT = "SignalFlowCapabilitiesAvailable";
const CAPABILITY_SCHEMA_VERSION = 1;

function isCapabilitySnapshot(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      value.schemaVersion === CAPABILITY_SCHEMA_VERSION &&
      value.product === "signalflow-studio" &&
      value.deployment &&
      value.session &&
      value.capabilities,
  );
}

function requestPageCapabilities() {
  return new Promise((resolve, reject) => {
    const requestId = `sf-cap-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const timeout = window.setTimeout(() => {
      window.removeEventListener(CAPABILITY_RESPONSE_EVENT, onResponse);
      reject(new Error("SignalFlow did not answer the capability handshake."));
    }, 1800);

    function onResponse(event) {
      if (event?.detail?.requestId !== requestId) return;
      window.clearTimeout(timeout);
      window.removeEventListener(CAPABILITY_RESPONSE_EVENT, onResponse);
      const snapshot = event.detail.snapshot;
      if (!isCapabilitySnapshot(snapshot)) {
        reject(new Error("SignalFlow returned an incompatible capability document."));
        return;
      }
      resolve(snapshot);
    }

    window.addEventListener(CAPABILITY_RESPONSE_EVENT, onResponse);
    window.dispatchEvent(new CustomEvent(CAPABILITY_REQUEST_EVENT, {
      detail: { requestId },
    }));
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "GET_SIGNALFLOW_CAPABILITIES") {
    requestPageCapabilities()
      .then((snapshot) => sendResponse({ success: true, snapshot }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.action === "INGEST_EXTENSION_CONTEXT") {
    const event = new CustomEvent("SignalFlowIngestContext", {
      detail: message.data,
    });
    window.dispatchEvent(event);
    sendResponse({
      success: true,
      acknowledged: false,
      reason: "The current extension bridge dispatched context but did not receive durable ingestion acknowledgement.",
    });
  }

  return false;
});
