function matchPatternForStudioUrl(studioUrl) {
  const parsed = new URL(studioUrl || "http://localhost:3000");
  if (!/^https?:$/.test(parsed.protocol)) {
    throw new Error("SignalFlow Studio must use an HTTP or HTTPS URL.");
  }
  return `${parsed.protocol}//${parsed.hostname}${parsed.port ? `:${parsed.port}` : ""}/*`;
}

function queryStudioTabs(studioUrl) {
  return new Promise((resolve, reject) => {
    let matchPattern;
    try {
      matchPattern = matchPatternForStudioUrl(studioUrl);
    } catch (error) {
      reject(error);
      return;
    }

    chrome.tabs.query({ url: matchPattern }, (tabs) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!tabs.length) {
        reject(new Error(`SignalFlow Studio is not open at: ${studioUrl}`));
        return;
      }
      resolve(tabs);
    });
  });
}

function sendTabMessage(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response);
    });
  });
}

async function readCapabilities(studioUrl) {
  const tabs = await queryStudioTabs(studioUrl);
  const responses = await Promise.allSettled(
    tabs.map((tab) => sendTabMessage(tab.id, { action: "GET_SIGNALFLOW_CAPABILITIES" })),
  );
  const accepted = responses
    .filter((result) => result.status === "fulfilled" && result.value?.success)
    .map((result) => result.value.snapshot);
  if (!accepted.length) {
    const firstFailure = responses.find((result) => result.status === "rejected");
    throw new Error(firstFailure?.reason?.message || "SignalFlow did not return a compatible capability document.");
  }
  return accepted[0];
}

async function dispatchContext(message) {
  const tabs = await queryStudioTabs(message.studioUrl);
  const responses = await Promise.allSettled(
    tabs.map((tab) => sendTabMessage(tab.id, {
      action: "INGEST_EXTENSION_CONTEXT",
      data: message.data,
    })),
  );
  const acknowledged = responses.find(
    (result) => result.status === "fulfilled" && result.value?.acknowledged === true,
  );
  if (!acknowledged) {
    throw new Error(
      "SignalFlow did not acknowledge durable ingestion. Capture delivery remains disabled until the bridge is ready.",
    );
  }
  return acknowledged.value;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "get_capabilities") {
    readCapabilities(message.studioUrl)
      .then((snapshot) => sendResponse({ success: true, snapshot }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.action === "send_context") {
    dispatchContext(message)
      .then((response) => sendResponse({ success: true, response }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  return false;
});
