export const DEFAULT_MAX_PROVIDER_REQUESTS = 40;
export const MAX_PROVIDER_REQUESTS = 40;

function integer(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
}

export function resolveProviderRequestLimit(value) {
  return Math.max(1, Math.min(MAX_PROVIDER_REQUESTS, integer(value, DEFAULT_MAX_PROVIDER_REQUESTS)));
}

export function estimateGenerationRequestBudget(destinationCount, { maxRequests = DEFAULT_MAX_PROVIDER_REQUESTS } = {}) {
  const destinations = Math.max(0, integer(destinationCount, 0));
  const plannedMaxRequests = 1 + (destinations * 3);
  const hardMaxRequests = resolveProviderRequestLimit(maxRequests);
  return Object.freeze({
    destinations,
    plannedMaxRequests,
    hardMaxRequests,
    withinBudget: plannedMaxRequests <= hardMaxRequests,
  });
}

export function generationRequestBudgetError({ plannedMaxRequests = null, maxRequests = DEFAULT_MAX_PROVIDER_REQUESTS } = {}) {
  const error = new Error(
    plannedMaxRequests
      ? `This generation plan may require up to ${plannedMaxRequests} provider requests, above the hard limit of ${maxRequests}. Reduce destinations before generating.`
      : `Generation reached the hard provider-request limit of ${maxRequests}. Reduce destinations or retry only the affected destination.`,
  );
  error.code = "generation_request_budget_exceeded";
  error.status = 422;
  return error;
}

export function createGenerationExecutionBudget({
  maxRequests = DEFAULT_MAX_PROVIDER_REQUESTS,
  now = () => Date.now(),
} = {}) {
  const hardMaxRequests = resolveProviderRequestLimit(maxRequests);
  const startedAt = now();
  let sequence = 0;
  let completed = 0;
  let failed = 0;
  const entries = [];

  function begin({ provider = "", model = "", kind = "provider_request", destination = "", maxOutputTokens = 0 } = {}) {
    if (entries.length >= hardMaxRequests) {
      throw generationRequestBudgetError({ maxRequests: hardMaxRequests });
    }
    const ticket = {
      id: ++sequence,
      provider: String(provider || ""),
      model: String(model || ""),
      kind: String(kind || "provider_request"),
      destination: String(destination || ""),
      maxOutputTokens: Math.max(0, Number(maxOutputTokens) || 0),
      startedAt: now(),
      finishedAt: null,
      durationMs: null,
      status: "running",
      errorCode: "",
    };
    entries.push(ticket);
    return ticket;
  }

  function finish(ticket, { ok = true, errorCode = "" } = {}) {
    if (!ticket || ticket.finishedAt !== null) return;
    ticket.finishedAt = now();
    ticket.durationMs = Math.max(0, ticket.finishedAt - ticket.startedAt);
    ticket.status = ok ? "completed" : "failed";
    ticket.errorCode = ok ? "" : String(errorCode || "provider_request_failed");
    if (ok) completed += 1;
    else failed += 1;
  }

  function snapshot() {
    const finishedAt = now();
    const byKind = {};
    let maxOutputTokens = 0;
    for (const entry of entries) {
      byKind[entry.kind] = (byKind[entry.kind] || 0) + 1;
      maxOutputTokens += entry.maxOutputTokens;
    }
    const retryRequests = (byKind.destination_revision || 0) + (byKind.duplicate_repair || 0);
    return Object.freeze({
      requestCount: entries.length,
      maxRequests: hardMaxRequests,
      retryRequests,
      completedRequests: completed,
      failedRequests: failed,
      durationMs: Math.max(0, finishedAt - startedAt),
      maxOutputTokens,
      byKind: Object.freeze({ ...byKind }),
      requests: Object.freeze(entries.map((entry) => Object.freeze({
        id: entry.id,
        provider: entry.provider,
        model: entry.model,
        kind: entry.kind,
        destination: entry.destination,
        maxOutputTokens: entry.maxOutputTokens,
        durationMs: entry.durationMs,
        status: entry.status,
        errorCode: entry.errorCode,
      }))),
    });
  }

  return Object.freeze({
    maxRequests: hardMaxRequests,
    begin,
    finish,
    snapshot,
  });
}
