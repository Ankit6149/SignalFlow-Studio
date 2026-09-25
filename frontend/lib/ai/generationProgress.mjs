const TERMINAL_DESTINATION_STATES = new Set([
  "complete",
  "needs_review",
  "failed",
  "cancelled",
]);

function normalizedChannels(value) {
  return Array.from(new Set((Array.isArray(value) ? value : [])
    .map((channel) => String(channel || "").trim())
    .filter(Boolean)));
}

export function createGenerationProgressReporter({
  channels = [],
  onProgress = null,
} = {}) {
  const selected = normalizedChannels(channels);
  const destinations = Object.fromEntries(selected.map((channel) => [channel, "queued"]));
  let strategy = "queued";
  let phase = "queued";
  let sequence = 0;

  function snapshot({ status = "", destination = "" } = {}) {
    const completedDestinations = Object.values(destinations)
      .filter((value) => TERMINAL_DESTINATION_STATES.has(value))
      .length;
    return Object.freeze({
      schemaVersion: 1,
      sequence,
      phase,
      status: String(status || ""),
      destination: String(destination || ""),
      strategy,
      completedDestinations,
      totalDestinations: selected.length,
      destinations: Object.freeze({ ...destinations }),
    });
  }

  function emit(details = {}) {
    sequence += 1;
    const event = snapshot(details);
    if (typeof onProgress === "function") {
      try {
        onProgress(event);
      } catch {
        // Progress observers are advisory and must never break generation.
      }
    }
    return event;
  }

  function setStrategy(status) {
    strategy = String(status || "queued");
    phase = "strategy";
    return emit({ status: strategy });
  }

  function queueDestinations() {
    phase = "destinations";
    return emit({ status: "queued" });
  }

  function setDestination(channel, status) {
    const key = String(channel || "").trim();
    if (!Object.prototype.hasOwnProperty.call(destinations, key)) return snapshot();
    destinations[key] = String(status || "queued");
    phase = "destinations";
    return emit({ status: destinations[key], destination: key });
  }

  function cancelOutstanding() {
    for (const channel of selected) {
      if (!TERMINAL_DESTINATION_STATES.has(destinations[channel])) {
        destinations[channel] = "cancelled";
      }
    }
    phase = "cancelled";
    return emit({ status: "cancelled" });
  }

  function complete() {
    phase = "complete";
    return emit({ status: "complete" });
  }

  return Object.freeze({
    setStrategy,
    queueDestinations,
    setDestination,
    cancelOutstanding,
    complete,
    snapshot,
  });
}
