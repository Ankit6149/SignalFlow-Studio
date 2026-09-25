export function createLinkedAbort({ signal = null, timeoutMs = 50_000 } = {}) {
  const controller = new AbortController();
  let timedOut = false;

  const abortFromCaller = () => {
    if (!controller.signal.aborted) controller.abort();
  };

  if (signal?.aborted) {
    abortFromCaller();
  } else if (signal?.addEventListener) {
    signal.addEventListener("abort", abortFromCaller, { once: true });
  }

  const timeoutId = setTimeout(() => {
    timedOut = true;
    if (!controller.signal.aborted) controller.abort();
  }, Math.max(1, Number(timeoutMs) || 50_000));

  return Object.freeze({
    signal: controller.signal,
    cancelled: () => Boolean(signal?.aborted && !timedOut),
    timedOut: () => timedOut,
    cleanup() {
      clearTimeout(timeoutId);
      if (signal?.removeEventListener) signal.removeEventListener("abort", abortFromCaller);
    },
  });
}

export function cancelledProviderRequestError() {
  const error = new Error("Generation request was cancelled.");
  error.name = "AbortError";
  error.code = "provider_request_cancelled";
  error.status = 499;
  return error;
}
