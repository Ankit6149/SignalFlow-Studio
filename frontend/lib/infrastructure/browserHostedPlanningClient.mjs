import {
  normalizeContentPiece,
  normalizeNarrativeStrategy,
  normalizePlatformVariant,
} from "../domain/contentPlanning.mjs";

function requireFetch(fetchImpl) {
  if (typeof fetchImpl !== "function") throw new TypeError("Hosted planning client requires fetch().");
  return fetchImpl;
}

async function parseResponse(response) {
  const raw = await response.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    const error = new Error("Hosted planning API returned an unreadable response.");
    error.code = "hosted_planning_unreadable";
    error.status = response.status;
    throw error;
  }
  if (!response.ok || !data?.ok) {
    const error = new Error(data?.error || `Hosted planning request failed (HTTP ${response.status}).`);
    error.code = data?.code || "hosted_planning_failed";
    error.status = response.status;
    throw error;
  }
  return data;
}

function normalizePlan(plan = {}) {
  return Object.freeze({
    strategy: plan.strategy ? normalizeNarrativeStrategy(plan.strategy) : null,
    contentPiece: plan.contentPiece ? normalizeContentPiece(plan.contentPiece) : null,
    variants: Array.isArray(plan.variants) ? plan.variants.map(normalizePlatformVariant) : [],
  });
}

export function createBrowserHostedPlanningClient({ fetchImpl = globalThis.fetch } = {}) {
  const fetcher = requireFetch(fetchImpl);

  async function request(method, body = null, query = "") {
    const response = await fetcher(`/api/planning${query}`, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    return parseResponse(response);
  }

  async function getPlanBundle(opportunityId) {
    const id = String(opportunityId || "").trim();
    if (!id) throw new TypeError("Hosted planning requires opportunityId.");
    const data = await request("GET", null, `?opportunityId=${encodeURIComponent(id)}`);
    return normalizePlan(data.plan || {});
  }

  async function buildStrategy(opportunityId, { refresh = false } = {}) {
    const data = await request("POST", {
      action: "build_strategy",
      opportunityId,
      refresh: refresh === true,
    });
    return normalizePlan(data.plan || {});
  }

  async function reviseStrategy(opportunityId, strategy, patch) {
    const current = normalizeNarrativeStrategy(strategy);
    const data = await request("POST", {
      action: "revise_strategy",
      opportunityId,
      strategyId: current.narrativeStrategyId,
      expectedStrategyRevision: current.strategyRevision,
      patch,
    });
    return normalizePlan(data.plan || {});
  }

  async function approveStrategy(opportunityId, strategy, { reason = "" } = {}) {
    const current = normalizeNarrativeStrategy(strategy);
    const data = await request("POST", {
      action: "approve_strategy",
      opportunityId,
      strategyId: current.narrativeStrategyId,
      expectedStrategyRevision: current.strategyRevision,
      reason,
    });
    return normalizePlan(data.plan || {});
  }

  return Object.freeze({ getPlanBundle, buildStrategy, reviseStrategy, approveStrategy });
}
