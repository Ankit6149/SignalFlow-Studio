document.addEventListener("DOMContentLoaded", async () => {
  const tabUrlInput = document.getElementById("tab-url");
  const notesTextarea = document.getElementById("notes");
  const sendBtn = document.getElementById("send-btn");
  const openBtn = document.getElementById("open-btn");
  const studioUrlInput = document.getElementById("studio-url");
  const statusMsg = document.getElementById("status-msg");
  const capabilityStatus = document.getElementById("capability-status");
  let capabilitySnapshot = null;
  let capabilityTimer = null;

  function showStatus(text, type = "info") {
    statusMsg.textContent = text;
    statusMsg.dataset.type = type;
    statusMsg.hidden = false;
  }

  function setCapabilityState({ loading = false, snapshot = null, error = "" } = {}) {
    capabilitySnapshot = snapshot;
    const extensionCapability = snapshot?.capabilities?.extension;
    const ready = Boolean(extensionCapability?.available);
    sendBtn.disabled = loading || !ready;

    if (loading) {
      capabilityStatus.dataset.state = "loading";
      capabilityStatus.textContent = "Checking the connected SignalFlow deployment…";
      return;
    }

    if (error) {
      capabilityStatus.dataset.state = "error";
      capabilityStatus.textContent = error;
      return;
    }

    if (!snapshot) {
      capabilityStatus.dataset.state = "error";
      capabilityStatus.textContent = "SignalFlow capabilities are unavailable.";
      return;
    }

    capabilityStatus.dataset.state = ready ? "ready" : "blocked";
    capabilityStatus.textContent = `${snapshot.deployment.profile} · ${snapshot.session.role}. ${extensionCapability.reason}`;
  }

  function requestCapabilities(studioUrl) {
    setCapabilityState({ loading: true });
    chrome.runtime.sendMessage({
      action: "get_capabilities",
      studioUrl,
    }, (response) => {
      if (chrome.runtime.lastError) {
        setCapabilityState({ error: chrome.runtime.lastError.message });
        return;
      }
      if (!response?.success || !response.snapshot) {
        setCapabilityState({
          error: response?.error || `Open SignalFlow Studio at ${studioUrl} to verify this connection.`,
        });
        return;
      }
      setCapabilityState({ snapshot: response.snapshot });
    });
  }

  function currentStudioUrl() {
    return studioUrlInput.value.trim() || "http://localhost:3000";
  }

  chrome.storage.local.get(["studioUrl"], (res) => {
    if (res.studioUrl) studioUrlInput.value = res.studioUrl;
    requestCapabilities(currentStudioUrl());
  });

  studioUrlInput.addEventListener("input", () => {
    const value = currentStudioUrl();
    chrome.storage.local.set({ studioUrl: value });
    window.clearTimeout(capabilityTimer);
    capabilityTimer = window.setTimeout(() => requestCapabilities(value), 350);
  });

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) tabUrlInput.value = tab.url || "";

  sendBtn.addEventListener("click", () => {
    const notes = notesTextarea.value.trim();
    const url = tabUrlInput.value;
    const studioUrl = currentStudioUrl();

    if (!capabilitySnapshot?.capabilities?.extension?.available) {
      showStatus(
        capabilitySnapshot?.capabilities?.extension?.reason ||
          "SignalFlow has not confirmed that extension delivery is available.",
        "error",
      );
      return;
    }

    if (!notes) {
      showStatus("Add a short note describing what SignalFlow should use from this page.", "error");
      notesTextarea.focus();
      return;
    }

    sendBtn.disabled = true;
    showStatus("Sending capture to SignalFlow…", "info");
    chrome.runtime.sendMessage({
      action: "send_context",
      data: { url, notes, timestamp: Date.now() },
      studioUrl,
    }, (response) => {
      if (chrome.runtime.lastError) {
        showStatus(chrome.runtime.lastError.message, "error");
        sendBtn.disabled = false;
        return;
      }
      if (response?.success) {
        notesTextarea.value = "";
        showStatus("SignalFlow acknowledged the capture.", "success");
      } else {
        showStatus(
          response?.error || "SignalFlow did not acknowledge this capture. Your notes remain in the extension.",
          "error",
        );
      }
      sendBtn.disabled = !capabilitySnapshot?.capabilities?.extension?.available;
    });
  });

  openBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: currentStudioUrl() });
  });
});
